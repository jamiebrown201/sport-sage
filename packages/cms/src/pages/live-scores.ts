/**
 * Live Scores Page - Monitor live events and scraper sources
 */

import { getDb, events, scraperRuns } from '@sport-sage/database';
import { desc, sql, and, gte } from 'drizzle-orm';
import { layout, timeAgo } from '../ui/layout.js';

// Source configuration with expected behavior
const LIVE_SCORE_SOURCES = [
  { name: 'livescore', label: 'LiveScore API', priority: 1, needsProxy: false, status: 'working' },
  { name: 'espn', label: 'ESPN API', priority: 3, needsProxy: false, status: 'working' },
  { name: '365scores', label: '365Scores API', priority: 4, needsProxy: false, status: 'working' },
  { name: 'sofascore', label: 'SofaScore API', priority: 2, needsProxy: false, status: 'blocked' },
  { name: 'fotmob', label: 'FotMob API', priority: 5, needsProxy: false, status: 'blocked' },
  { name: 'flashscore', label: 'Flashscore', priority: 10, needsProxy: true, status: 'working' },
];

export async function handleLiveScores(environment: string): Promise<string> {
  const db = getDb();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Get live events with scores
  const liveEvents = await db
    .select({
      id: events.id,
      homeTeam: events.homeTeamName,
      awayTeam: events.awayTeamName,
      homeScore: events.homeScore,
      awayScore: events.awayScore,
      period: events.period,
      minute: events.minute,
      competition: events.competitionName,
      sportSlug: events.sportSlug,
      startTime: events.startTime,
      updatedAt: events.updatedAt,
    })
    .from(events)
    .where(sql`${events.status}::text = 'live'`)
    .orderBy(desc(events.updatedAt))
    .limit(100);

  // Get recently finished events
  const recentlyFinished = await db
    .select({
      id: events.id,
      homeTeam: events.homeTeamName,
      awayTeam: events.awayTeamName,
      homeScore: events.homeScore,
      awayScore: events.awayScore,
      competition: events.competitionName,
      updatedAt: events.updatedAt,
    })
    .from(events)
    .where(and(
      sql`${events.status}::text = 'finished'`,
      gte(events.updatedAt, oneHourAgo)
    ))
    .orderBy(desc(events.updatedAt))
    .limit(20);

  // Get recent sync-live-scores runs
  const recentRuns = await db
    .select()
    .from(scraperRuns)
    .where(and(
      sql`${scraperRuns.jobType} = 'sync_live_scores'`,
      gte(scraperRuns.startedAt, oneHourAgo)
    ))
    .orderBy(desc(scraperRuns.startedAt))
    .limit(20);

  // Calculate source stats from recent runs
  const sourceStats: Record<string, { success: number; fail: number; lastRun: Date | null; itemsProcessed: number }> = {};
  for (const source of LIVE_SCORE_SOURCES) {
    sourceStats[source.name] = { success: 0, fail: 0, lastRun: null, itemsProcessed: 0 };
  }

  for (const run of recentRuns) {
    const src = run.source;
    if (sourceStats[src]) {
      if (run.status === 'success') {
        sourceStats[src].success++;
        sourceStats[src].itemsProcessed += run.itemsProcessed || 0;
      }
      if (run.status === 'failed') sourceStats[src].fail++;
      if (!sourceStats[src].lastRun || run.startedAt > sourceStats[src].lastRun) {
        sourceStats[src].lastRun = run.startedAt;
      }
    }
  }

  // Build source cards
  const sourceCards = LIVE_SCORE_SOURCES.map(source => {
    const stats = sourceStats[source.name] || { success: 0, fail: 0, lastRun: null, itemsProcessed: 0 };
    const total = stats.success + stats.fail;
    const rate = total > 0 ? Math.round((stats.success / total) * 100) : 0;

    let status = source.status;
    let statusColor = 'var(--text-muted)';
    let statusBg = 'var(--bg-hover)';

    if (source.status === 'blocked') {
      statusColor = 'var(--error)';
      statusBg = '#4d0d0d';
    } else if (total > 0) {
      if (rate >= 80) {
        status = 'healthy';
        statusColor = 'var(--success)';
        statusBg = '#0d4d3a';
      } else if (rate >= 50) {
        status = 'degraded';
        statusColor = 'var(--warning)';
        statusBg = '#4d3d0d';
      } else {
        status = 'failing';
        statusColor = 'var(--error)';
        statusBg = '#4d0d0d';
      }
    }

    return `
      <div class="stat" style="background: ${statusBg}; border: 1px solid ${statusColor}40; position: relative;">
        <div style="position: absolute; top: 8px; right: 8px;">
          ${source.needsProxy ? '<span style="font-size: 0.7em; background: #4d3d0d; color: var(--warning); padding: 2px 6px; border-radius: 4px;">PROXY</span>' : '<span style="font-size: 0.7em; background: #0d4d3a; color: var(--success); padding: 2px 6px; border-radius: 4px;">FREE</span>'}
        </div>
        <div style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 5px;">${source.label}</div>
        <div style="font-size: 0.75em; color: ${statusColor}; text-transform: uppercase; margin-bottom: 8px;">${status}</div>
        ${source.status !== 'blocked' ? `
          <div class="stat-value" style="color: ${statusColor}; font-size: 1.5em;">${rate}%</div>
          <div class="stat-label">${stats.success}/${total} runs</div>
          <div style="font-size: 0.75em; color: var(--text-muted); margin-top: 3px;">${stats.itemsProcessed} items</div>
        ` : `
          <div style="font-size: 0.85em; color: var(--error);">API Blocked</div>
        `}
        ${stats.lastRun ? `<div style="font-size: 0.7em; color: #666; margin-top: 8px;">${timeAgo(stats.lastRun)}</div>` : ''}
      </div>
    `;
  }).join('');

  // Build live events table
  const liveRows = liveEvents.length > 0
    ? liveEvents.map(e => {
        const scoreDisplay = e.homeScore !== null && e.awayScore !== null
          ? `<strong>${e.homeScore} - ${e.awayScore}</strong>`
          : '<span style="color: var(--text-muted);">-</span>';
        const periodDisplay = e.period || (e.minute ? `${e.minute}'` : 'LIVE');

        return `
          <tr>
            <td>
              <span class="badge badge-warning pulse">${periodDisplay}</span>
            </td>
            <td><a href="/events/${e.id}">${e.homeTeam} vs ${e.awayTeam}</a></td>
            <td style="font-family: monospace; font-size: 1.1em;">${scoreDisplay}</td>
            <td>${e.competition}</td>
            <td>${e.sportSlug}</td>
            <td class="time-ago">${timeAgo(e.updatedAt)}</td>
          </tr>
        `;
      }).join('')
    : '<tr><td colspan="6" class="empty">No live events</td></tr>';

  // Build recently finished table
  const finishedRows = recentlyFinished.length > 0
    ? recentlyFinished.map(e => `
        <tr>
          <td><a href="/events/${e.id}">${e.homeTeam} vs ${e.awayTeam}</a></td>
          <td style="font-family: monospace;"><strong>${e.homeScore} - ${e.awayScore}</strong></td>
          <td>${e.competition}</td>
          <td class="time-ago">${timeAgo(e.updatedAt)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" class="empty">No recent finished events</td></tr>';

  // Build recent runs table
  const runRows = recentRuns.slice(0, 10).map(run => `
    <tr>
      <td>${run.source}</td>
      <td><span class="badge badge-${run.status === 'success' ? 'success' : 'error'}">${run.status}</span></td>
      <td>${run.itemsProcessed || 0}</td>
      <td>${run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '-'}</td>
      <td class="time-ago">${timeAgo(run.startedAt)}</td>
    </tr>
  `).join('');

  const content = `
    <h1>Live Scores</h1>

    <!-- Summary Stats -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value" style="color: var(--warning);">${liveEvents.length}</div>
        <div class="stat-label">Live Events</div>
      </div>
      <div class="stat">
        <div class="stat-value">${recentlyFinished.length}</div>
        <div class="stat-label">Finished (1h)</div>
      </div>
      <div class="stat">
        <div class="stat-value">${recentRuns.length}</div>
        <div class="stat-label">Scraper Runs (1h)</div>
      </div>
      <div class="stat">
        <div class="stat-value">${recentRuns.filter(r => r.status === 'success').length}</div>
        <div class="stat-label">Successful</div>
      </div>
    </div>

    <!-- Source Health -->
    <h2>Live Score Sources</h2>
    <p style="color: var(--text-muted); margin-bottom: 15px; font-size: 0.9em;">
      FREE sources are tried first (priority 1-5). PROXY sources only used as fallback.
    </p>
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom: 30px;">
      ${sourceCards}
    </div>

    <!-- Live Events -->
    <div class="card">
      <h2 style="margin-top: 0;">Live Events (${liveEvents.length})</h2>
      <table>
        <thead><tr><th>Status</th><th>Match</th><th>Score</th><th>Competition</th><th>Sport</th><th>Updated</th></tr></thead>
        <tbody>${liveRows}</tbody>
      </table>
    </div>

    <div class="grid-2">
      <!-- Recently Finished -->
      <div class="card">
        <h2 style="margin-top: 0;">Recently Finished</h2>
        <table>
          <thead><tr><th>Match</th><th>Score</th><th>Competition</th><th>Finished</th></tr></thead>
          <tbody>${finishedRows}</tbody>
        </table>
      </div>

      <!-- Recent Scraper Runs -->
      <div class="card">
        <h2 style="margin-top: 0;">Recent Scraper Runs</h2>
        <table>
          <thead><tr><th>Source</th><th>Status</th><th>Items</th><th>Duration</th><th>Time</th></tr></thead>
          <tbody>${runRows || '<tr><td colspan="5" class="empty">No recent runs</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <!-- Auto-refresh -->
    <div style="text-align: center; margin-top: 20px; color: var(--text-muted); font-size: 0.85em;">
      Auto-refreshes every 30 seconds
    </div>
    <script>setTimeout(() => location.reload(), 30000);</script>
  `;

  return layout('Live Scores', content, environment);
}
