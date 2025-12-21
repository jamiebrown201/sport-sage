/**
 * Monitoring Page - Scraper health, source status, alerts
 */

import { getDb, scraperRuns, scraperAlerts } from '@sport-sage/database';
import { desc, gte, sql } from 'drizzle-orm';
import { layout, timeAgo, formatDuration } from '../ui/layout.js';

const SOURCES = ['flashscore', 'oddschecker', 'sofascore', 'espn', '365scores', 'fotmob', 'livescore', 'oddsportal', 'multi'];

export async function handleMonitoring(environment: string): Promise<string> {
  const db = getDb();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get recent runs
  const recentRuns = await db
    .select()
    .from(scraperRuns)
    .where(gte(scraperRuns.startedAt, oneDayAgo))
    .orderBy(desc(scraperRuns.startedAt));

  // Calculate stats
  const totalRuns = recentRuns.length;
  const successful = recentRuns.filter(r => r.status === 'success').length;
  const failed = recentRuns.filter(r => r.status === 'failed').length;
  const successRate = totalRuns > 0 ? Math.round((successful / totalRuns) * 100) : 0;
  const totalItemsProcessed = recentRuns.reduce((sum, r) => sum + (r.itemsProcessed || 0), 0);

  // Get active alerts
  const activeAlerts = await db
    .select()
    .from(scraperAlerts)
    .where(sql`${scraperAlerts.acknowledgedAt} IS NULL`)
    .orderBy(desc(scraperAlerts.createdAt))
    .limit(20);

  // Group runs by job type
  const byJobType: Record<string, { total: number; success: number; failed: number; lastRun: Date | null; avgDuration: number }> = {};
  for (const run of recentRuns) {
    const jt = run.jobType;
    if (!byJobType[jt]) {
      byJobType[jt] = { total: 0, success: 0, failed: 0, lastRun: null, avgDuration: 0 };
    }
    byJobType[jt].total++;
    if (run.status === 'success') byJobType[jt].success++;
    if (run.status === 'failed') byJobType[jt].failed++;
    if (!byJobType[jt].lastRun || run.startedAt > byJobType[jt].lastRun) {
      byJobType[jt].lastRun = run.startedAt;
    }
  }

  // Calculate avg durations
  for (const jt of Object.keys(byJobType)) {
    const runs = recentRuns.filter(r => r.jobType === jt && r.durationMs);
    if (runs.length > 0) {
      byJobType[jt].avgDuration = Math.round(runs.reduce((sum, r) => sum + (r.durationMs || 0), 0) / runs.length);
    }
  }

  // Source stats
  const sourceStats: Record<string, { success: number; failed: number; lastRun: Date | null }> = {};
  for (const source of SOURCES) {
    sourceStats[source] = { success: 0, failed: 0, lastRun: null };
  }
  for (const run of recentRuns) {
    const src = run.source;
    if (sourceStats[src]) {
      if (run.status === 'success') sourceStats[src].success++;
      if (run.status === 'failed') sourceStats[src].failed++;
      if (!sourceStats[src].lastRun || run.startedAt > sourceStats[src].lastRun) {
        sourceStats[src].lastRun = run.startedAt;
      }
    }
  }

  // Health check
  const recentActivity = recentRuns.length > 0 && (Date.now() - recentRuns[0].startedAt.getTime()) < 10 * 60 * 1000;
  const lowFailureRate = successRate >= 80;
  const noActiveCritical = !activeAlerts.some(a => a.severity === 'critical');
  const isHealthy = recentActivity && lowFailureRate && noActiveCritical;

  // Build UI
  const sourceCards = SOURCES.filter(s => s !== 'multi').map(source => {
    const stats = sourceStats[source];
    const total = stats.success + stats.failed;
    const rate = total > 0 ? Math.round((stats.success / total) * 100) : 0;
    const status = total === 0 ? 'unknown' : rate >= 80 ? 'healthy' : rate >= 50 ? 'degraded' : 'down';
    const statusColor = status === 'healthy' ? 'var(--success)' : status === 'degraded' ? 'var(--warning)' : status === 'down' ? 'var(--error)' : 'var(--text-muted)';
    const statusBg = status === 'healthy' ? '#0d4d3a' : status === 'degraded' ? '#4d3d0d' : status === 'down' ? '#4d0d0d' : 'var(--bg-hover)';

    return `
      <div class="stat" style="background: ${statusBg}; border: 1px solid ${statusColor}40;">
        <div style="font-size: 0.85em; color: var(--text-muted); text-transform: capitalize; margin-bottom: 5px;">${source}</div>
        <div class="stat-value" style="color: ${statusColor}; font-size: 1.8em;">${rate}%</div>
        <div class="stat-label">${stats.success}/${total} success</div>
        ${stats.lastRun ? `<div style="font-size: 0.75em; color: #666; margin-top: 5px;">${timeAgo(stats.lastRun)}</div>` : ''}
      </div>
    `;
  }).join('');

  const jobTypeRows = Object.entries(byJobType).map(([jt, stats]) => {
    const rate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
    return `
      <tr>
        <td style="font-family: monospace;">${jt}</td>
        <td>${stats.total}</td>
        <td><span class="badge badge-${rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'error'}">${rate}%</span></td>
        <td>${stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : '-'}</td>
        <td class="time-ago">${stats.lastRun ? timeAgo(stats.lastRun) : '-'}</td>
      </tr>
    `;
  }).join('');

  const recentRunsRows = recentRuns.slice(0, 15).map(run => `
    <tr>
      <td style="font-family: monospace; font-size: 0.85em;">${run.jobType}</td>
      <td>${run.source}</td>
      <td><span class="badge badge-${run.status === 'success' ? 'success' : run.status === 'failed' ? 'error' : 'warning'}">${run.status}</span></td>
      <td>${run.durationMs ? formatDuration(run.durationMs) : '-'}</td>
      <td>${run.itemsProcessed || 0}</td>
      <td class="time-ago">${timeAgo(run.startedAt)}</td>
    </tr>
  `).join('');

  const alertsHtml = activeAlerts.length === 0
    ? '<div class="empty">No active alerts</div>'
    : activeAlerts.map(alert => {
        const severityColor = alert.severity === 'critical' ? 'var(--error)' : alert.severity === 'error' ? '#ff6666' : 'var(--warning)';
        return `
          <div style="padding: 12px; background: ${alert.severity === 'critical' ? '#4d0d0d' : 'var(--bg-hover)'}; border-radius: 8px; border-left: 3px solid ${severityColor}; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="badge" style="background: ${severityColor}30; color: ${severityColor};">${alert.severity?.toUpperCase()}</span>
                <span style="color: var(--text-muted); margin-left: 10px; font-size: 0.85em;">${alert.alertType}</span>
              </div>
              <form method="POST" action="/monitoring/acknowledge/${alert.id}" style="display: inline;">
                <button type="submit" class="btn btn-secondary btn-sm">Acknowledge</button>
              </form>
            </div>
            <p style="margin: 8px 0 0; color: #ccc;">${alert.message}</p>
            <div style="font-size: 0.75em; color: #666; margin-top: 5px;">${timeAgo(alert.createdAt)}</div>
          </div>
        `;
      }).join('');

  const content = `
    <h1>Scraper Monitoring</h1>

    <!-- Health Banner -->
    <div class="card" style="background: ${isHealthy ? '#0d4d3a' : '#4d0d0d'}; border-color: ${isHealthy ? 'var(--success)' : 'var(--error)'};">
      <div style="display: flex; align-items: center; gap: 15px;">
        <div style="width: 20px; height: 20px; border-radius: 50%; background: ${isHealthy ? 'var(--success)' : 'var(--error)'}; ${!isHealthy ? 'animation: pulse 2s infinite;' : ''}"></div>
        <div>
          <div style="font-size: 1.3em; font-weight: bold; color: ${isHealthy ? 'var(--success)' : 'var(--error)'};">
            ${isHealthy ? 'System Healthy' : 'System Degraded'}
          </div>
          <div style="color: var(--text-muted); font-size: 0.9em;">
            ${!recentActivity ? 'No recent scraper activity' : ''}
            ${!lowFailureRate ? `High failure rate (${successRate}%)` : ''}
            ${!noActiveCritical ? 'Critical alerts require attention' : ''}
            ${isHealthy ? 'All systems operational' : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value">${totalRuns}</div>
        <div class="stat-label">Total Runs (24h)</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: ${successRate >= 80 ? 'var(--success)' : successRate >= 50 ? 'var(--warning)' : 'var(--error)'};">${successRate}%</div>
        <div class="stat-label">Success Rate</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalItemsProcessed.toLocaleString()}</div>
        <div class="stat-label">Items Processed</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: ${activeAlerts.length > 0 ? 'var(--warning)' : 'var(--text-muted)'};">${activeAlerts.length}</div>
        <div class="stat-label">Active Alerts</div>
      </div>
    </div>

    <!-- Source Health -->
    <h2>Source Health</h2>
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); margin-bottom: 30px;">
      ${sourceCards}
    </div>

    <div class="grid-2">
      <!-- Job Type Breakdown -->
      <div class="card">
        <h2 style="margin-top: 0;">By Job Type</h2>
        <table>
          <thead><tr><th>Job</th><th>Runs</th><th>Success</th><th>Avg Time</th><th>Last Run</th></tr></thead>
          <tbody>${jobTypeRows || '<tr><td colspan="5" class="empty">No data</td></tr>'}</tbody>
        </table>
      </div>

      <!-- Active Alerts -->
      <div class="card">
        <h2 style="margin-top: 0;">Active Alerts (${activeAlerts.length})</h2>
        ${alertsHtml}
      </div>
    </div>

    <!-- Recent Runs -->
    <div class="card">
      <h2 style="margin-top: 0;">Recent Runs</h2>
      <table>
        <thead><tr><th>Job</th><th>Source</th><th>Status</th><th>Duration</th><th>Items</th><th>Time</th></tr></thead>
        <tbody>${recentRunsRows || '<tr><td colspan="6" class="empty">No recent runs</td></tr>'}</tbody>
      </table>
    </div>

    <!-- Auto-refresh -->
    <script>setTimeout(() => location.reload(), 30000);</script>
  `;

  return layout('Monitoring', content, environment);
}

export async function handleAcknowledgeAlert(alertId: string): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    UPDATE scraper_alerts
    SET acknowledged_at = NOW(), acknowledged_by = 'cms'
    WHERE id = ${alertId}::uuid
  `);
}
