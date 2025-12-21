/**
 * Teams Page - Browse teams
 */

import { getDb, teams, teamAliases, events } from '@sport-sage/database';
import { desc, eq, count, ilike, sql } from 'drizzle-orm';
import { layout, timeAgo } from '../ui/layout.js';

export async function handleTeams(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const search = query.get('search') || '';

  const conditions = search ? ilike(teams.name, `%${search}%`) : undefined;

  const allTeams = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(conditions)
    .orderBy(teams.name)
    .limit(100);

  const teamsWithAliases = await Promise.all(
    allTeams.map(async (team) => {
      const [aliasCount] = await db.select({ count: count() }).from(teamAliases)
        .where(eq(teamAliases.teamId, team.id));
      return { ...team, aliasCount: aliasCount?.count || 0 };
    })
  );

  const rows = teamsWithAliases.map(t => `
    <tr>
      <td><a href="/teams/${t.id}">${t.name}</a></td>
      <td>${t.aliasCount} aliases</td>
    </tr>
  `).join('');

  const content = `
    <h1>Teams</h1>

    <form class="search-box" method="GET">
      <input type="text" name="search" placeholder="Search teams..." value="${search}" style="flex: 1;">
      <button type="submit">Search</button>
    </form>

    <div class="card">
      <table>
        <thead><tr><th>Name</th><th>Aliases</th></tr></thead>
        <tbody>${rows.length > 0 ? rows : '<tr><td colspan="2" class="empty">No teams found</td></tr>'}</tbody>
      </table>
    </div>
  `;

  return layout('Teams', content, environment);
}

export async function handleTeamDetail(id: string, environment: string): Promise<string> {
  const db = getDb();

  const team = await db.query.teams.findFirst({ where: eq(teams.id, id) });
  if (!team) {
    return layout('Team Not Found', '<h1>Team not found</h1>', environment);
  }

  const aliases = await db.select().from(teamAliases).where(eq(teamAliases.teamId, id));
  const recentEvents = await db
    .select({
      id: events.id,
      homeTeam: events.homeTeamName,
      awayTeam: events.awayTeamName,
      startTime: events.startTime,
      status: events.status,
    })
    .from(events)
    .where(sql`${events.homeTeamId} = ${id} OR ${events.awayTeamId} = ${id}`)
    .orderBy(desc(events.startTime))
    .limit(20);

  const aliasRows = aliases.map(a => `<tr><td>${a.alias}</td><td>${a.source}</td></tr>`).join('');
  const eventRows = recentEvents.map(e => `
    <tr>
      <td>${e.startTime.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td>${e.homeTeam} vs ${e.awayTeam}</td>
      <td><span class="badge badge-info">${e.status}</span></td>
    </tr>
  `).join('');

  const content = `
    <h1>${team.name}</h1>

    <div class="grid-2">
      <div class="card">
        <h2 style="margin-top: 0;">Aliases</h2>
        <table>
          <thead><tr><th>Alias</th><th>Source</th></tr></thead>
          <tbody>${aliasRows || '<tr><td colspan="2" class="empty">No aliases</td></tr>'}</tbody>
        </table>
      </div>

      <div class="card">
        <h2 style="margin-top: 0;">Recent Events</h2>
        <table>
          <thead><tr><th>Date</th><th>Match</th><th>Status</th></tr></thead>
          <tbody>${eventRows || '<tr><td colspan="3" class="empty">No events</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <div style="margin-top: 20px;">
      <a href="/teams" class="btn btn-secondary">Back to Teams</a>
    </div>
  `;

  return layout(team.name, content, environment);
}
