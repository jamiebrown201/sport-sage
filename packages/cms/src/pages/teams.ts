/**
 * Teams Page - Browse and edit teams
 */

import { getDb, teams, teamAliases, events } from '@sport-sage/database';
import { desc, eq, count, ilike, sql } from 'drizzle-orm';
import { layout, timeAgo } from '../ui/layout.js';

export async function handleTeams(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const search = query.get('search') || '';
  const flash = query.get('flash') || '';

  const conditions = search ? ilike(teams.name, `%${search}%`) : undefined;

  const allTeams = await db
    .select({ id: teams.id, name: teams.name, shortName: teams.shortName })
    .from(teams)
    .where(conditions)
    .orderBy(teams.name)
    .limit(100);

  const teamsWithAliases = await Promise.all(
    allTeams.map(async (team) => {
      const [aliasCount] = await db.select({ count: count() }).from(teamAliases)
        .where(eq(teamAliases.teamId, team.id));
      const [eventCount] = await db.select({ count: count() }).from(events)
        .where(sql`${events.homeTeamId} = ${team.id} OR ${events.awayTeamId} = ${team.id}`);
      return { ...team, aliasCount: aliasCount?.count || 0, eventCount: eventCount?.count || 0 };
    })
  );

  const rows = teamsWithAliases.map(t => `
    <tr>
      <td><a href="/teams/${t.id}">${t.name}</a></td>
      <td style="color: var(--text-muted);">${t.shortName || '-'}</td>
      <td>${t.aliasCount} aliases</td>
      <td>${t.eventCount} events</td>
      <td>
        <a href="/teams/${t.id}" class="btn btn-sm btn-secondary">View/Edit</a>
      </td>
    </tr>
  `).join('');

  const content = `
    <h1>Teams</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <form class="search-box" method="GET">
      <input type="text" name="search" placeholder="Search teams..." value="${search}" style="flex: 1;">
      <button type="submit">Search</button>
    </form>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <span style="color: var(--text-muted);">${teamsWithAliases.length} teams found</span>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Short Name</th><th>Aliases</th><th>Events</th><th>Actions</th></tr></thead>
        <tbody>${rows.length > 0 ? rows : '<tr><td colspan="5" class="empty">No teams found</td></tr>'}</tbody>
      </table>
    </div>
  `;

  return layout('Teams', content, environment);
}

export async function handleTeamDetail(id: string, environment: string, flash?: string): Promise<string> {
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

  const aliasRows = aliases.map(a => `
    <tr>
      <td>${a.alias}</td>
      <td>${a.source}</td>
      <td>
        <form method="POST" action="/teams/${id}/alias/${a.id}/delete" style="display: inline;">
          <button type="submit" class="btn btn-sm btn-danger" onclick="return confirm('Delete this alias?')">Delete</button>
        </form>
      </td>
    </tr>
  `).join('');

  const eventRows = recentEvents.map(e => `
    <tr>
      <td>${e.startTime.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td><a href="/events/${e.id}">${e.homeTeam} vs ${e.awayTeam}</a></td>
      <td><span class="badge badge-${e.status === 'live' ? 'warning' : e.status === 'finished' ? 'success' : 'info'}">${e.status}</span></td>
    </tr>
  `).join('');

  const content = `
    <h1>Team: ${team.name}</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <div class="grid-2">
      <!-- Edit Team Form -->
      <div class="card">
        <h2 style="margin-top: 0;">Edit Team Details</h2>
        <form method="POST" action="/teams/${id}/update">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Team Name</label>
            <input type="text" name="name" value="${team.name}" style="width: 100%;" required>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Short Name</label>
            <input type="text" name="shortName" value="${team.shortName || ''}" style="width: 100%;" placeholder="e.g. MUN, LIV">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Logo URL</label>
            <input type="text" name="logoUrl" value="${team.logoUrl || ''}" style="width: 100%;" placeholder="https://...">
          </div>
          <button type="submit" class="btn">Save Changes</button>
        </form>
      </div>

      <!-- Team Info -->
      <div class="card">
        <h2 style="margin-top: 0;">Team Info</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">ID</div>
            <div style="font-family: monospace; font-size: 0.85em;">${team.id}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Flashscore ID</div>
            <div style="font-family: monospace; font-size: 0.85em;">${team.externalFlashscoreId || '-'}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Oddschecker ID</div>
            <div style="font-family: monospace; font-size: 0.85em;">${team.externalOddscheckerId || '-'}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Total Events</div>
            <div>${recentEvents.length}+ events</div>
          </div>
        </div>
        ${team.logoUrl ? `
          <div style="margin-top: 20px; text-align: center;">
            <img src="${team.logoUrl}" alt="${team.name}" style="max-width: 100px; max-height: 100px;">
          </div>
        ` : ''}
      </div>
    </div>

    <div class="grid-2" style="margin-top: 20px;">
      <!-- Aliases -->
      <div class="card">
        <h2 style="margin-top: 0;">Aliases (${aliases.length})</h2>
        <table>
          <thead><tr><th>Alias</th><th>Source</th><th>Actions</th></tr></thead>
          <tbody>${aliasRows || '<tr><td colspan="3" class="empty">No aliases</td></tr>'}</tbody>
        </table>

        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border);">
          <h3 style="font-size: 1em; margin-bottom: 10px;">Add New Alias</h3>
          <form method="POST" action="/teams/${id}/alias/add" style="display: flex; gap: 10px;">
            <input type="text" name="alias" placeholder="Team alias name" style="flex: 1;" required>
            <select name="source" required>
              <option value="manual">Manual</option>
              <option value="flashscore">Flashscore</option>
              <option value="oddschecker">Oddschecker</option>
              <option value="sofascore">Sofascore</option>
              <option value="espn">ESPN</option>
            </select>
            <button type="submit" class="btn">Add</button>
          </form>
        </div>
      </div>

      <!-- Recent Events -->
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

export async function updateTeam(id: string, data: { name: string; shortName?: string; logoUrl?: string }): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    await db.update(teams)
      .set({
        name: data.name,
        shortName: data.shortName || null,
        logoUrl: data.logoUrl || null,
      })
      .where(eq(teams.id, id));
    return { success: true, message: 'Team updated successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function addTeamAlias(teamId: string, alias: string, source: string): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    await db.insert(teamAliases).values({
      teamId,
      alias,
      source,
    });
    return { success: true, message: 'Alias added successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function deleteTeamAlias(aliasId: string): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    await db.delete(teamAliases).where(eq(teamAliases.id, aliasId));
    return { success: true, message: 'Alias deleted successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
