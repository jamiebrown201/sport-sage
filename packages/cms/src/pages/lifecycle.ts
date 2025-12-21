/**
 * Lifecycle Page - Event status flow visualization
 */

import { getDb } from '@sport-sage/database';
import { sql } from 'drizzle-orm';
import { layout, timeAgo } from '../ui/layout.js';

export async function handleLifecycle(environment: string): Promise<string> {
  const db = getDb();
  const now = new Date();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

  // Status counts
  const statusCounts = await db.execute(sql`
    SELECT status::text as status, COUNT(*) as count
    FROM events
    GROUP BY status::text
  `);

  const countsByStatus: Record<string, number> = {};
  (statusCounts.rows || []).forEach((row: any) => {
    countsByStatus[row.status] = parseInt(row.count);
  });

  // Events that should be live
  const shouldBeLive = await db.execute(sql`
    SELECT id, home_team_name, away_team_name, start_time, competition_name
    FROM events
    WHERE status::text = 'scheduled'
      AND start_time <= ${now.toISOString()}::timestamptz
    ORDER BY start_time DESC
    LIMIT 10
  `);

  // Live events
  const liveNow = await db.execute(sql`
    SELECT id, home_team_name, away_team_name, start_time, home_score, away_score, minute, period
    FROM events
    WHERE status::text = 'live'
    ORDER BY start_time
    LIMIT 20
  `);

  // Recently finished
  const recentlyFinished = await db.execute(sql`
    SELECT id, home_team_name, away_team_name, home_score, away_score, updated_at
    FROM events
    WHERE status::text = 'finished'
      AND updated_at >= ${oneDayAgo.toISOString()}::timestamptz
    ORDER BY updated_at DESC
    LIMIT 15
  `);

  // Upcoming
  const upcoming = await db.execute(sql`
    SELECT id, home_team_name, away_team_name, start_time, competition_name
    FROM events
    WHERE status::text = 'scheduled'
      AND start_time >= ${now.toISOString()}::timestamptz
      AND start_time <= ${twoHoursFromNow.toISOString()}::timestamptz
    ORDER BY start_time
    LIMIT 10
  `);

  const shouldBeLiveRows = (shouldBeLive.rows || []).map((e: any) => `
    <tr style="background: rgba(255, 68, 68, 0.1);">
      <td>${new Date(e.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
      <td>${e.home_team_name} vs ${e.away_team_name}</td>
      <td>${e.competition_name || '-'}</td>
      <td><span class="badge badge-error">Should be live!</span></td>
    </tr>
  `).join('');

  const liveNowRows = (liveNow.rows || []).map((e: any) => `
    <tr>
      <td>${e.minute ? `${e.minute}'` : e.period || '-'}</td>
      <td>${e.home_team_name} vs ${e.away_team_name}</td>
      <td><strong>${e.home_score ?? '-'} - ${e.away_score ?? '-'}</strong></td>
    </tr>
  `).join('');

  const finishedRows = (recentlyFinished.rows || []).map((e: any) => `
    <tr>
      <td>${timeAgo(new Date(e.updated_at))}</td>
      <td>${e.home_team_name} vs ${e.away_team_name}</td>
      <td><strong>${e.home_score} - ${e.away_score}</strong></td>
    </tr>
  `).join('');

  const upcomingRows = (upcoming.rows || []).map((e: any) => {
    const mins = Math.round((new Date(e.start_time).getTime() - now.getTime()) / 60000);
    return `
      <tr>
        <td>in ${mins}m</td>
        <td>${e.home_team_name} vs ${e.away_team_name}</td>
        <td>${e.competition_name || '-'}</td>
      </tr>
    `;
  }).join('');

  const content = `
    <h1>Event Lifecycle</h1>

    <!-- Flow Diagram -->
    <div class="card" style="background: #1a2a3a; border-color: var(--primary);">
      <h2 style="margin-top: 0;">How Events Flow</h2>
      <pre style="background: transparent; font-size: 0.9em; color: #ccc; overflow-x: auto;">
┌─────────────────────┐        ┌──────────────────────┐        ┌─────────────────────┐        ┌────────────────────────┐
│   sync-fixtures     │        │  transition-events   │        │   sync-live-scores  │        │   settle-predictions   │
│   (every 6 hours)   │   →    │   (every 1 minute)   │   →    │   (every 1 minute)  │   →    │   (SQS triggered)      │
└─────────────────────┘        └──────────────────────┘        └─────────────────────┘        └────────────────────────┘
         │                              │                              │                                │
    Creates events              Marks scheduled                Updates scores                    Settles bets
    status=SCHEDULED            → LIVE when                    Detects finished                  Credits winners
                               start_time passes               status=FINISHED                   Updates stats
      </pre>
    </div>

    <!-- Status Counts -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value">${countsByStatus['scheduled'] || 0}</div>
        <div class="stat-label">Scheduled</div>
      </div>
      <div class="stat" style="background: linear-gradient(135deg, #4d3d0d 0%, #3d2d0d 100%);">
        <div class="stat-value" style="color: var(--warning);">${countsByStatus['live'] || 0}</div>
        <div class="stat-label">Live</div>
      </div>
      <div class="stat">
        <div class="stat-value">${countsByStatus['finished'] || 0}</div>
        <div class="stat-label">Finished</div>
      </div>
      <div class="stat">
        <div class="stat-value">${countsByStatus['cancelled'] || 0}</div>
        <div class="stat-label">Cancelled</div>
      </div>
    </div>

    ${(shouldBeLive.rows || []).length > 0 ? `
    <div class="card" style="border-color: var(--error);">
      <h2 style="margin-top: 0; color: var(--error);">Events That Should Be Live</h2>
      <p style="color: var(--text-muted); margin-bottom: 15px;">These events have passed their start time but are still marked as 'scheduled'.</p>
      <table>
        <thead><tr><th>Started</th><th>Match</th><th>Competition</th><th>Issue</th></tr></thead>
        <tbody>${shouldBeLiveRows}</tbody>
      </table>
      <div style="margin-top: 15px;">
        <a href="/lambdas/trigger/transition-events" class="btn">Run transition-events now</a>
      </div>
    </div>
    ` : ''}

    <div class="grid-2">
      <div class="card">
        <h2 style="margin-top: 0;">Live Now (${(liveNow.rows || []).length})</h2>
        ${liveNowRows ? `
          <table>
            <thead><tr><th>Time</th><th>Match</th><th>Score</th></tr></thead>
            <tbody>${liveNowRows}</tbody>
          </table>
        ` : '<div class="empty">No live events</div>'}
        <div style="margin-top: 15px;">
          <a href="/lambdas/trigger/sync-live-scores" class="btn btn-secondary">Sync Scores</a>
        </div>
      </div>

      <div class="card">
        <h2 style="margin-top: 0;">Starting Soon (Next 2 Hours)</h2>
        ${upcomingRows ? `
          <table>
            <thead><tr><th>Starts</th><th>Match</th><th>Competition</th></tr></thead>
            <tbody>${upcomingRows}</tbody>
          </table>
        ` : '<div class="empty">No events in next 2 hours</div>'}
      </div>
    </div>

    <div class="card">
      <h2 style="margin-top: 0;">Recently Finished (24h)</h2>
      ${finishedRows ? `
        <table>
          <thead><tr><th>Ended</th><th>Match</th><th>Result</th></tr></thead>
          <tbody>${finishedRows}</tbody>
        </table>
      ` : '<div class="empty">No finished events in last 24 hours</div>'}
    </div>
  `;

  return layout('Lifecycle', content, environment);
}
