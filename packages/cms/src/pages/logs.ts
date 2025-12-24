/**
 * Logs Page - Comprehensive logging and debugging
 */

import { getDb, scraperRuns, scraperAlerts } from '@sport-sage/database';
import { desc, eq, sql, gte, and, ilike } from 'drizzle-orm';
import { layout, timeAgo, formatDuration } from '../ui/layout.js';

export async function handleLogs(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const logType = query.get('type') || 'scraper';
  const source = query.get('source') || '';
  const status = query.get('status') || '';
  const search = query.get('search') || '';
  const hoursBack = parseInt(query.get('hours') || '24');

  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  // Build conditions
  const conditions = [gte(scraperRuns.startedAt, cutoff)];
  if (source) {
    conditions.push(sql`${scraperRuns.source}::text = ${source}`);
  }
  if (status) {
    conditions.push(sql`${scraperRuns.status}::text = ${status}`);
  }
  if (search) {
    conditions.push(sql`(${scraperRuns.errorMessage} ILIKE ${'%' + search + '%'} OR ${scraperRuns.jobType}::text ILIKE ${'%' + search + '%'})`);
  }

  // Get scraper runs
  const runs = await db
    .select()
    .from(scraperRuns)
    .where(and(...conditions))
    .orderBy(desc(scraperRuns.startedAt))
    .limit(100);

  // Get recent alerts
  const alerts = await db
    .select()
    .from(scraperAlerts)
    .where(gte(scraperAlerts.createdAt, cutoff))
    .orderBy(desc(scraperAlerts.createdAt))
    .limit(50);

  // Stats
  const successRuns = runs.filter(r => r.status === 'success').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;
  const avgDuration = runs.length > 0
    ? Math.round(runs.reduce((sum, r) => sum + (r.durationMs || 0), 0) / runs.length)
    : 0;
  const totalItems = runs.reduce((sum, r) => sum + (r.itemsProcessed || 0), 0);

  const runRows = runs.map(r => {
    const statusColor = r.status === 'success' ? 'success' : r.status === 'failed' ? 'error' : r.status === 'partial' ? 'warning' : 'info';
    return `
      <tr>
        <td class="time-ago">${timeAgo(r.startedAt)}</td>
        <td><span class="badge badge-info">${r.jobType}</span></td>
        <td>${r.source}</td>
        <td><span class="badge badge-${statusColor}">${r.status}</span></td>
        <td>${formatDuration(r.durationMs || 0)}</td>
        <td>${r.itemsProcessed || 0}</td>
        <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${r.errorMessage ? 'var(--error)' : 'var(--text-muted)'};">
          ${r.errorMessage || '-'}
        </td>
        <td>
          <a href="/logs/run/${r.id}" class="btn btn-sm btn-secondary">Details</a>
        </td>
      </tr>
    `;
  }).join('');

  const alertRows = alerts.map(a => {
    const severityColor = a.severity === 'critical' ? 'error' : a.severity === 'error' ? 'error' : a.severity === 'warning' ? 'warning' : 'info';
    return `
      <tr>
        <td class="time-ago">${timeAgo(a.createdAt)}</td>
        <td><span class="badge badge-${severityColor}">${a.severity}</span></td>
        <td>${a.alertType}</td>
        <td style="max-width: 400px;">${a.message}</td>
        <td>${a.acknowledgedAt ? `Ack'd ${timeAgo(a.acknowledgedAt)}` : '<span class="badge badge-warning">Pending</span>'}</td>
      </tr>
    `;
  }).join('');

  const content = `
    <h1>Logs</h1>

    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value">${runs.length}</div>
        <div class="stat-label">Total Runs (${hoursBack}h)</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--success);">${successRuns}</div>
        <div class="stat-label">Successful</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--error);">${failedRuns}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat">
        <div class="stat-value">${formatDuration(avgDuration)}</div>
        <div class="stat-label">Avg Duration</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalItems.toLocaleString()}</div>
        <div class="stat-label">Items Processed</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: ${alerts.filter(a => !a.acknowledgedAt).length > 0 ? 'var(--warning)' : 'var(--success)'};">${alerts.filter(a => !a.acknowledgedAt).length}</div>
        <div class="stat-label">Pending Alerts</div>
      </div>
    </div>

    <!-- Filters -->
    <form class="search-box" method="GET">
      <select name="hours">
        <option value="1" ${hoursBack === 1 ? 'selected' : ''}>Last 1 hour</option>
        <option value="6" ${hoursBack === 6 ? 'selected' : ''}>Last 6 hours</option>
        <option value="24" ${hoursBack === 24 ? 'selected' : ''}>Last 24 hours</option>
        <option value="72" ${hoursBack === 72 ? 'selected' : ''}>Last 3 days</option>
        <option value="168" ${hoursBack === 168 ? 'selected' : ''}>Last 7 days</option>
      </select>
      <select name="source">
        <option value="">All Sources</option>
        <option value="flashscore" ${source === 'flashscore' ? 'selected' : ''}>Flashscore</option>
        <option value="oddschecker" ${source === 'oddschecker' ? 'selected' : ''}>Oddschecker</option>
        <option value="sofascore" ${source === 'sofascore' ? 'selected' : ''}>Sofascore</option>
        <option value="espn" ${source === 'espn' ? 'selected' : ''}>ESPN</option>
        <option value="365scores" ${source === '365scores' ? 'selected' : ''}>365Scores</option>
        <option value="oddsportal" ${source === 'oddsportal' ? 'selected' : ''}>OddsPortal</option>
        <option value="betexplorer" ${source === 'betexplorer' ? 'selected' : ''}>BetExplorer</option>
        <option value="multi" ${source === 'multi' ? 'selected' : ''}>Multi</option>
      </select>
      <select name="status">
        <option value="">All Status</option>
        <option value="success" ${status === 'success' ? 'selected' : ''}>Success</option>
        <option value="failed" ${status === 'failed' ? 'selected' : ''}>Failed</option>
        <option value="partial" ${status === 'partial' ? 'selected' : ''}>Partial</option>
        <option value="running" ${status === 'running' ? 'selected' : ''}>Running</option>
      </select>
      <input type="text" name="search" placeholder="Search errors..." value="${search}" style="flex: 1;">
      <button type="submit">Filter</button>
    </form>

    <!-- Quick Links -->
    <div style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
      <a href="/logs?status=failed&hours=${hoursBack}" class="btn btn-sm ${status === 'failed' ? '' : 'btn-secondary'}">View Failed Only</a>
      <a href="/lambdas/logs/sync-live-scores" class="btn btn-sm btn-secondary">Live Scores Lambda Logs</a>
      <a href="/lambdas/logs/sync-fixtures" class="btn btn-sm btn-secondary">Fixtures Lambda Logs</a>
      <a href="/lambdas/logs/sync-odds" class="btn btn-sm btn-secondary">Odds Lambda Logs</a>
    </div>

    <!-- Scraper Runs -->
    <div class="card">
      <h2 style="margin-top: 0;">Scraper Runs (${runs.length})</h2>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Job Type</th>
              <th>Source</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Items</th>
              <th>Error</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${runRows || '<tr><td colspan="8" class="empty">No runs found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Alerts -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Alerts (${alerts.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Severity</th>
            <th>Type</th>
            <th>Message</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${alertRows || '<tr><td colspan="5" class="empty">No alerts</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  return layout('Logs', content, environment);
}

export async function handleRunDetail(runId: string, environment: string): Promise<string> {
  const db = getDb();

  const [run] = await db.select().from(scraperRuns).where(eq(scraperRuns.id, runId)).limit(1);

  if (!run) {
    return layout('Run Not Found', '<h1>Run not found</h1>', environment);
  }

  const statusColor = run.status === 'success' ? 'success' : run.status === 'failed' ? 'error' : run.status === 'partial' ? 'warning' : 'info';

  // Get related alerts
  const relatedAlerts = await db.select().from(scraperAlerts).where(eq(scraperAlerts.runId, runId));

  const alertRows = relatedAlerts.map(a => `
    <tr>
      <td><span class="badge badge-${a.severity === 'critical' || a.severity === 'error' ? 'error' : a.severity === 'warning' ? 'warning' : 'info'}">${a.severity}</span></td>
      <td>${a.alertType}</td>
      <td>${a.message}</td>
    </tr>
  `).join('');

  const content = `
    <div style="margin-bottom: 20px;">
      <a href="/logs" style="color: var(--text-muted);">&larr; Back to Logs</a>
    </div>

    <h1>Run Details</h1>

    <div class="grid-2">
      <div class="card">
        <h2 style="margin-top: 0;">Overview</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Job Type</div>
            <div><span class="badge badge-info">${run.jobType}</span></div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Source</div>
            <div>${run.source}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Status</div>
            <div><span class="badge badge-${statusColor}">${run.status}</span></div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Duration</div>
            <div>${formatDuration(run.durationMs || 0)}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Started</div>
            <div>${run.startedAt.toLocaleString()}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Completed</div>
            <div>${run.completedAt?.toLocaleString() || '-'}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 style="margin-top: 0;">Metrics</h2>
        <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr);">
          <div class="stat">
            <div class="stat-value">${run.itemsProcessed || 0}</div>
            <div class="stat-label">Processed</div>
          </div>
          <div class="stat">
            <div class="stat-value" style="color: var(--success);">${run.itemsCreated || 0}</div>
            <div class="stat-label">Created</div>
          </div>
          <div class="stat">
            <div class="stat-value" style="color: var(--info);">${run.itemsUpdated || 0}</div>
            <div class="stat-label">Updated</div>
          </div>
          <div class="stat">
            <div class="stat-value" style="color: var(--error);">${run.itemsFailed || 0}</div>
            <div class="stat-label">Failed</div>
          </div>
        </div>
      </div>
    </div>

    ${run.sportStats ? `
      <div class="card" style="margin-top: 20px;">
        <h2 style="margin-top: 0;">Sport Breakdown</h2>
        <pre style="background: var(--bg-dark); padding: 15px; border-radius: 8px;">${JSON.stringify(run.sportStats, null, 2)}</pre>
      </div>
    ` : ''}

    ${run.errorMessage ? `
      <div class="card" style="margin-top: 20px; border-color: var(--error);">
        <h2 style="margin-top: 0; color: var(--error);">Error</h2>
        <div style="background: var(--bg-dark); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <strong>${run.errorMessage}</strong>
        </div>
        ${run.errorStack ? `
          <pre style="background: var(--bg-dark); padding: 15px; border-radius: 8px; font-size: 0.85em; overflow-x: auto;">${run.errorStack}</pre>
        ` : ''}
      </div>
    ` : ''}

    ${relatedAlerts.length > 0 ? `
      <div class="card" style="margin-top: 20px;">
        <h2 style="margin-top: 0;">Related Alerts (${relatedAlerts.length})</h2>
        <table>
          <thead><tr><th>Severity</th><th>Type</th><th>Message</th></tr></thead>
          <tbody>${alertRows}</tbody>
        </table>
      </div>
    ` : ''}

    ${run.lambdaRequestId ? `
      <div class="card" style="margin-top: 20px;">
        <h2 style="margin-top: 0;">Lambda Info</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Request ID</div>
            <div style="font-family: monospace; font-size: 0.85em;">${run.lambdaRequestId}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Memory Used</div>
            <div>${run.lambdaMemoryUsedMb || '-'} MB</div>
          </div>
        </div>
      </div>
    ` : ''}
  `;

  return layout('Run Details', content, environment);
}
