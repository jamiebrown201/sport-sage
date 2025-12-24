/**
 * Dashboard Page - Overview
 */

import { getDb, events, sports, teams, predictions, scraperRuns } from '@sport-sage/database';
import { gte, lte, and, count, sql, desc, eq } from 'drizzle-orm';
import { layout, timeAgo, tooltip } from '../ui/layout.js';
import { getIssuesWidget } from './issues.js';

export async function handleDashboard(environment: string): Promise<string> {
  const db = getDb();
  const now = new Date();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [totalEvents] = await db.select({ count: count() }).from(events);
  const [scheduledEvents] = await db.select({ count: count() }).from(events)
    .where(and(sql`${events.status}::text = 'scheduled'`, gte(events.startTime, now)));
  const [liveEvents] = await db.select({ count: count() }).from(events)
    .where(sql`${events.status}::text = 'live'`);
  const [finishedEvents] = await db.select({ count: count() }).from(events)
    .where(sql`${events.status}::text = 'finished'`);
  const [totalTeams] = await db.select({ count: count() }).from(teams);
  const [recentEvents] = await db.select({ count: count() }).from(events)
    .where(gte(events.createdAt, yesterday));

  // Prediction stats
  const [totalPredictions] = await db.select({ count: count() }).from(predictions);
  const [pendingPredictions] = await db.select({ count: count() }).from(predictions)
    .where(sql`${predictions.status}::text = 'pending'`);

  // Recent scraper activity
  const recentRuns = await db
    .select()
    .from(scraperRuns)
    .where(gte(scraperRuns.startedAt, oneHourAgo))
    .orderBy(desc(scraperRuns.startedAt))
    .limit(10);

  const successfulRuns = recentRuns.filter(r => r.status === 'success').length;
  const failedRuns = recentRuns.filter(r => r.status === 'failed').length;
  const scraperHealthy = recentRuns.length > 0 && (successfulRuns / recentRuns.length) >= 0.8;

  const sportStats = await db.execute(sql`
    SELECT s.name, s.slug, COUNT(e.id) as count
    FROM sports s
    LEFT JOIN events e ON e.sport_id = s.id
      AND e.status::text = 'scheduled'
      AND e.start_time >= ${now.toISOString()}::timestamptz
      AND e.start_time <= ${nextWeek.toISOString()}::timestamptz
    WHERE s.is_active = true
    GROUP BY s.id, s.name, s.slug
    ORDER BY count DESC
  `);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get live events with scores and sport info
  const liveEventsList = await db
    .select({
      id: events.id,
      homeTeam: events.homeTeamName,
      awayTeam: events.awayTeamName,
      homeScore: events.homeScore,
      awayScore: events.awayScore,
      period: events.period,
      competition: events.competitionName,
      updatedAt: events.updatedAt,
      sportName: sports.name,
      sportSlug: sports.slug,
    })
    .from(events)
    .leftJoin(sports, eq(events.sportId, sports.id))
    .where(sql`${events.status}::text = 'live'`)
    .orderBy(desc(events.updatedAt))
    .limit(10);

  const todayEvents = await db
    .select({
      id: events.id,
      homeTeam: events.homeTeamName,
      awayTeam: events.awayTeamName,
      competition: events.competitionName,
      startTime: events.startTime,
      status: events.status,
    })
    .from(events)
    .where(and(gte(events.startTime, today), lte(events.startTime, tomorrow)))
    .orderBy(events.startTime)
    .limit(15);

  const sportRows = (sportStats.rows || []).map((row: any) => `
    <tr>
      <td>${row.name}</td>
      <td><span class="badge badge-info">${row.count}</span></td>
    </tr>
  `).join('');

  const liveRows = liveEventsList.length > 0
    ? liveEventsList.map(e => {
        const score = e.homeScore !== null && e.awayScore !== null
          ? `<strong>${e.homeScore} - ${e.awayScore}</strong>`
          : '-';
        return `
          <tr>
            <td><span class="badge badge-warning pulse">${e.period || 'LIVE'}</span></td>
            <td>
              <span class="badge badge-info" style="font-size: 0.7em; margin-right: 6px;">${e.sportName || e.sportSlug || '?'}</span>
              <a href="/events/${e.id}">${e.homeTeam} vs ${e.awayTeam}</a>
              <div style="font-size: 0.8em; color: var(--text-muted);">${e.competition || ''}</div>
            </td>
            <td style="font-family: monospace;">${score}</td>
            <td class="time-ago">${timeAgo(e.updatedAt)}</td>
          </tr>
        `;
      }).join('')
    : '<tr><td colspan="4" class="empty">No live events</td></tr>';

  const todayRows = todayEvents.length > 0
    ? todayEvents.map(e => `
      <tr>
        <td>${e.startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
        <td><a href="/events/${e.id}">${e.homeTeam} vs ${e.awayTeam}</a></td>
        <td>${e.competition}</td>
        <td><span class="badge badge-${e.status === 'live' ? 'warning' : 'info'}">${e.status}</span></td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="empty">No events today</td></tr>';

  const recentRunRows = recentRuns.slice(0, 5).map(r => `
    <tr>
      <td style="font-family: monospace; font-size: 0.85em;">${r.jobType}</td>
      <td>${r.source}</td>
      <td><span class="badge badge-${r.status === 'success' ? 'success' : 'error'}">${r.status}</span></td>
      <td class="time-ago">${timeAgo(r.startedAt)}</td>
    </tr>
  `).join('');

  // Get issues widget
  const issuesWidget = await getIssuesWidget();

  const content = `
    <h1>Dashboard</h1>

    <!-- Issues Widget -->
    ${issuesWidget}

    <!-- System Health Banner -->
    <div class="card" style="background: ${scraperHealthy ? '#0d4d3a' : recentRuns.length === 0 ? 'var(--bg-hover)' : '#4d3d0d'}; border-color: ${scraperHealthy ? 'var(--success)' : recentRuns.length === 0 ? 'var(--border)' : 'var(--warning)'}; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 15px;">
        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${scraperHealthy ? 'var(--success)' : recentRuns.length === 0 ? 'var(--text-muted)' : 'var(--warning)'}; ${!scraperHealthy && recentRuns.length > 0 ? 'animation: pulse 2s infinite;' : ''}"></div>
        <div>
          <span style="font-weight: 500; color: ${scraperHealthy ? 'var(--success)' : recentRuns.length === 0 ? 'var(--text-muted)' : 'var(--warning)'};">
            ${scraperHealthy ? 'Scrapers Healthy' : recentRuns.length === 0 ? 'No Recent Activity' : 'Scraper Issues'}
          </span>
          ${tooltip('<strong>System Health</strong>Healthy = 80%+ success rate in last hour.<br><br><strong>Job Types:</strong><ul><li>sync-fixtures: Fetches upcoming matches (every 2h)</li><li>sync-odds: Scrapes odds from multiple sources (every 5m)</li><li>sync-live-scores: Updates live match scores (every 1m)</li><li>transition-events: Moves scheduled→live→finished (every 1m)</li></ul>', 'right')}
          <span style="color: var(--text-muted); margin-left: 15px; font-size: 0.9em;">
            ${recentRuns.length} runs in last hour (${successfulRuns} success, ${failedRuns} failed)
          </span>
        </div>
        <a href="/monitoring" style="margin-left: auto; color: var(--primary); font-size: 0.9em;">View Details &rarr;</a>
      </div>
    </div>

    <!-- Primary Stats -->
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-value">${scheduledEvents?.count || 0}</div>
        <div class="stat-label">Scheduled ${tooltip('<strong>Scheduled Events</strong>Events with status "scheduled" and start_time in the future. These are upcoming matches waiting to begin.', 'bottom')}</div>
      </div>
      <div class="stat" style="background: ${(liveEvents?.count || 0) > 0 ? '#4d3d0d' : 'var(--bg-hover)'}; border: 1px solid ${(liveEvents?.count || 0) > 0 ? 'var(--warning)40' : 'transparent'};">
        <div class="stat-value" style="color: var(--warning);">${liveEvents?.count || 0}</div>
        <div class="stat-label">Live Now ${tooltip('<strong>Live Events</strong>Events with status "live". The scraper updates these every 60 seconds via the sync-live-scores job.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--success);">${finishedEvents?.count || 0}</div>
        <div class="stat-label">Finished ${tooltip('<strong>Finished Events</strong>Events with status "finished". Final scores are stored in home_score and away_score columns.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalTeams?.count || 0}</div>
        <div class="stat-label">Teams ${tooltip('<strong>Teams Database</strong>Teams are auto-created when fixtures sync. Each team has aliases per source (e.g., "Man Utd" from flashscore, "Manchester United" from oddschecker). Fuzzy matching at 85% confidence auto-links variations.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalPredictions?.count || 0}</div>
        <div class="stat-label">Predictions ${tooltip('<strong>All Predictions</strong>Total user predictions across all events. Includes pending, won, lost, and void outcomes.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--info);">${pendingPredictions?.count || 0}</div>
        <div class="stat-label">Pending Bets ${tooltip('<strong>Pending Predictions</strong>Predictions awaiting settlement. These need the associated event to finish, then can be settled via the Bulk Settle page.', 'bottom')}</div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Live Events -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0;">Live Events ${tooltip('<strong>Live Events</strong>Shows current in-play matches with live scores. Updated every 60 seconds by the sync-live-scores job.<br><br><strong>Period</strong>: Current game period (1H, 2H, HT, etc.)<br><strong>Score</strong>: Real-time score from Flashscore', 'right')}</h2>
          <a href="/live-scores" style="font-size: 0.85em;">View All &rarr;</a>
        </div>
        <table style="margin-top: 15px;">
          <thead><tr><th>Status</th><th>Match</th><th>Score</th><th>Updated</th></tr></thead>
          <tbody>${liveRows}</tbody>
        </table>
      </div>

      <!-- Recent Scraper Runs -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0;">Recent Scraper Activity ${tooltip('<strong>Scraper Runs</strong>Each job execution is logged with status.<br><br><strong>Sources:</strong><ul><li>flashscore: Fixtures & live scores</li><li>oddschecker: Odds comparison</li><li>betfair/bet365: Direct odds</li></ul><strong>Statuses:</strong><ul><li>success: Completed normally</li><li>failed: Error occurred (check logs)</li></ul>', 'left')}</h2>
          <a href="/monitoring" style="font-size: 0.85em;">View All &rarr;</a>
        </div>
        <table style="margin-top: 15px;">
          <thead><tr><th>Job</th><th>Source</th><th>Status</th><th>Time</th></tr></thead>
          <tbody>${recentRunRows || '<tr><td colspan="4" class="empty">No recent runs</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2 style="margin-top: 0;">Fixtures by Sport (Next 7 Days) ${tooltip('<strong>Upcoming Fixtures</strong>Count of scheduled events per sport for the next 7 days. Only shows active sports with at least one event.', 'right')}</h2>
        <table>
          <thead><tr><th>Sport</th><th>Count</th></tr></thead>
          <tbody>${sportRows || '<tr><td colspan="2" class="empty">No sports found</td></tr>'}</tbody>
        </table>
      </div>

      <div class="card">
        <h2 style="margin-top: 0;">Today's Matches ${tooltip('<strong>Today\'s Schedule</strong>All events starting today (00:00 to 23:59 local time), regardless of status.', 'left')}</h2>
        <table>
          <thead><tr><th>Time</th><th>Match</th><th>Competition</th><th>Status</th></tr></thead>
          <tbody>${todayRows}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2 style="margin-top: 0;">Quick Actions ${tooltip('<strong>Quick Actions</strong>Manual triggers for scraper jobs. Useful for testing or forcing immediate data refresh.<br><br><strong>Warning:</strong> Triggering too frequently may cause rate limiting from data sources.', 'right')}</h2>
      <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <a href="/live-scores" class="btn">Live Scores</a>
        <a href="/predictions" class="btn">Predictions</a>
        <a href="/scraper" class="btn">Scraper Status</a>
        <a href="/scraper/trigger/sync-live-scores" class="btn btn-secondary">Trigger Live Scores</a>
        <a href="/scraper/trigger/sync-fixtures" class="btn btn-secondary">Trigger Fixtures</a>
        <a href="/scraper/trigger/sync-odds" class="btn btn-secondary">Trigger Odds</a>
        <a href="/query" class="btn btn-secondary">SQL Query</a>
      </div>
    </div>
  `;

  return layout('Dashboard', content, environment);
}
