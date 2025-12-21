/**
 * Events Page - Browse events
 */

import { getDb, events } from '@sport-sage/database';
import { desc, and, sql } from 'drizzle-orm';
import { layout, timeAgo } from '../ui/layout.js';

export async function handleEvents(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const search = query.get('search') || '';
  const status = query.get('status') || 'scheduled';
  const page = parseInt(query.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) conditions.push(sql`${events.status}::text = ${status}`);
  if (search) {
    conditions.push(sql`(${events.homeTeamName} ILIKE ${'%' + search + '%'} OR ${events.awayTeamName} ILIKE ${'%' + search + '%'})`);
  }

  const allEvents = await db
    .select({
      id: events.id,
      homeTeam: events.homeTeamName,
      awayTeam: events.awayTeamName,
      competition: events.competitionName,
      startTime: events.startTime,
      status: events.status,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(events.startTime))
    .limit(limit)
    .offset(offset);

  const rows = allEvents.map(e => `
    <tr>
      <td>${e.startTime.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td><a href="/events/${e.id}">${e.homeTeam} vs ${e.awayTeam}</a></td>
      <td>${e.competition}</td>
      <td><span class="badge badge-${e.status === 'live' ? 'warning' : e.status === 'finished' ? 'success' : 'info'}">${e.status}</span></td>
      <td class="time-ago">${timeAgo(e.createdAt)}</td>
    </tr>
  `).join('');

  const content = `
    <h1>Events</h1>

    <form class="search-box" method="GET">
      <input type="text" name="search" placeholder="Search teams..." value="${search}" style="flex: 1;">
      <select name="status">
        <option value="">All Status</option>
        <option value="scheduled" ${status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
        <option value="live" ${status === 'live' ? 'selected' : ''}>Live</option>
        <option value="finished" ${status === 'finished' ? 'selected' : ''}>Finished</option>
      </select>
      <button type="submit">Search</button>
    </form>

    <div class="card">
      <table>
        <thead><tr><th>Date</th><th>Match</th><th>Competition</th><th>Status</th><th>Added</th></tr></thead>
        <tbody>${rows.length > 0 ? rows : '<tr><td colspan="5" class="empty">No events found</td></tr>'}</tbody>
      </table>
      ${allEvents.length === limit ? `
        <div style="margin-top: 20px; text-align: center;">
          <a href="/events?page=${page + 1}&search=${encodeURIComponent(search)}&status=${status}">Next Page →</a>
        </div>
      ` : ''}
    </div>
  `;

  return layout('Events', content, environment);
}
