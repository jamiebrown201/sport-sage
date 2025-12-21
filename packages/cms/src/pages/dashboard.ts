/**
 * Dashboard Page - Overview
 */

import { getDb, events, sports, teams } from '@sport-sage/database';
import { gte, lte, and, count, sql } from 'drizzle-orm';
import { layout, timeAgo } from '../ui/layout.js';

export async function handleDashboard(environment: string): Promise<string> {
  const db = getDb();
  const now = new Date();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalEvents] = await db.select({ count: count() }).from(events);
  const [scheduledEvents] = await db.select({ count: count() }).from(events)
    .where(and(sql`${events.status}::text = 'scheduled'`, gte(events.startTime, now)));
  const [liveEvents] = await db.select({ count: count() }).from(events)
    .where(sql`${events.status}::text = 'live'`);
  const [totalTeams] = await db.select({ count: count() }).from(teams);
  const [recentEvents] = await db.select({ count: count() }).from(events)
    .where(gte(events.createdAt, yesterday));

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

  const content = `
    <h1>Dashboard</h1>

    <div class="stats-grid">
      <div class="stat">
        <div class="stat-value">${scheduledEvents?.count || 0}</div>
        <div class="stat-label">Scheduled Events</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--warning);">${liveEvents?.count || 0}</div>
        <div class="stat-label">Live Now</div>
      </div>
      <div class="stat">
        <div class="stat-value">${recentEvents?.count || 0}</div>
        <div class="stat-label">Created (24h)</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalTeams?.count || 0}</div>
        <div class="stat-label">Teams</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalEvents?.count || 0}</div>
        <div class="stat-label">Total Events</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2 style="margin-top: 0;">Fixtures by Sport (Next 7 Days)</h2>
        <table>
          <thead><tr><th>Sport</th><th>Count</th></tr></thead>
          <tbody>${sportRows || '<tr><td colspan="2" class="empty">No sports found</td></tr>'}</tbody>
        </table>
      </div>

      <div class="card">
        <h2 style="margin-top: 0;">Today's Events</h2>
        <table>
          <thead><tr><th>Time</th><th>Match</th><th>Competition</th><th>Status</th></tr></thead>
          <tbody>${todayRows}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2 style="margin-top: 0;">Quick Actions</h2>
      <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <a href="/monitoring" class="btn">View Monitoring</a>
        <a href="/lambdas/trigger/sync-fixtures" class="btn btn-secondary">Trigger Sync Fixtures</a>
        <a href="/lambdas/trigger/sync-odds" class="btn btn-secondary">Trigger Sync Odds</a>
        <a href="/query" class="btn btn-secondary">SQL Query</a>
      </div>
    </div>
  `;

  return layout('Dashboard', content, environment);
}
