/**
 * Competitions Page - Browse and edit competitions
 */

import { getDb, competitions, sports, events } from '@sport-sage/database';
import { eq, ilike, count, desc, and } from 'drizzle-orm';
import { layout, timeAgo } from '../ui/layout.js';

export async function handleCompetitions(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const search = query.get('search') || '';
  const flash = query.get('flash') || '';
  const sportFilter = query.get('sport') || '';

  const conditions = [];
  if (search) {
    conditions.push(ilike(competitions.name, `%${search}%`));
  }
  if (sportFilter) {
    conditions.push(eq(competitions.sportId, sportFilter));
  }

  // Get all sports for filter dropdown
  const allSports = await db.select().from(sports).orderBy(sports.name);

  const allComps = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      shortName: competitions.shortName,
      country: competitions.country,
      tier: competitions.tier,
      isActive: competitions.isActive,
      sportId: competitions.sportId,
      sportName: sports.name,
      sportSlug: sports.slug,
    })
    .from(competitions)
    .leftJoin(sports, eq(competitions.sportId, sports.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(competitions.name)
    .limit(100);

  // Get event counts for each competition
  const compsWithCounts = await Promise.all(
    allComps.map(async (comp) => {
      const [eventCount] = await db.select({ count: count() }).from(events)
        .where(eq(events.competitionId, comp.id));
      return { ...comp, eventCount: eventCount?.count || 0 };
    })
  );

  const rows = compsWithCounts.map(c => `
    <tr>
      <td><a href="/competitions/${c.id}">${c.name}</a></td>
      <td style="color: var(--text-muted);">${c.shortName || '-'}</td>
      <td>${c.country || '-'}</td>
      <td><span class="badge badge-info">${c.sportName || c.sportSlug}</span></td>
      <td><span class="badge badge-${c.tier === 'tier1' ? 'success' : c.tier === 'tier2' ? 'warning' : 'info'}">${c.tier}</span></td>
      <td>${c.eventCount} events</td>
      <td>
        <span class="badge badge-${c.isActive ? 'success' : 'error'}">${c.isActive ? 'Active' : 'Inactive'}</span>
      </td>
      <td>
        <a href="/competitions/${c.id}" class="btn btn-sm btn-secondary">Edit</a>
      </td>
    </tr>
  `).join('');

  const content = `
    <h1>Competitions</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <form class="search-box" method="GET">
      <input type="text" name="search" placeholder="Search competitions..." value="${search}" style="flex: 1;">
      <select name="sport">
        <option value="">All Sports</option>
        ${allSports.map(s => `<option value="${s.id}" ${sportFilter === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
      </select>
      <button type="submit">Search</button>
    </form>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <span style="color: var(--text-muted);">${compsWithCounts.length} competitions found</span>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Short Name</th><th>Country</th><th>Sport</th><th>Tier</th><th>Events</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows.length > 0 ? rows : '<tr><td colspan="8" class="empty">No competitions found</td></tr>'}</tbody>
      </table>
    </div>
  `;

  return layout('Competitions', content, environment);
}

export async function handleCompetitionDetail(id: string, environment: string, flash?: string): Promise<string> {
  const db = getDb();

  const [competition] = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      shortName: competitions.shortName,
      country: competitions.country,
      tier: competitions.tier,
      isActive: competitions.isActive,
      sportId: competitions.sportId,
      logoUrl: competitions.logoUrl,
      externalFlashscoreId: competitions.externalFlashscoreId,
      externalOddscheckerId: competitions.externalOddscheckerId,
      sportName: sports.name,
    })
    .from(competitions)
    .leftJoin(sports, eq(competitions.sportId, sports.id))
    .where(eq(competitions.id, id))
    .limit(1);

  if (!competition) {
    return layout('Competition Not Found', '<h1>Competition not found</h1>', environment);
  }

  // Get all sports for dropdown
  const allSports = await db.select().from(sports).orderBy(sports.name);

  // Get recent events for this competition
  const recentEvents = await db
    .select({
      id: events.id,
      homeTeam: events.homeTeamName,
      awayTeam: events.awayTeamName,
      startTime: events.startTime,
      status: events.status,
    })
    .from(events)
    .where(eq(events.competitionId, id))
    .orderBy(desc(events.startTime))
    .limit(20);

  const [eventCount] = await db.select({ count: count() }).from(events)
    .where(eq(events.competitionId, id));

  const eventRows = recentEvents.map(e => `
    <tr>
      <td>${e.startTime.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td><a href="/events/${e.id}">${e.homeTeam} vs ${e.awayTeam}</a></td>
      <td><span class="badge badge-${e.status === 'live' ? 'warning' : e.status === 'finished' ? 'success' : 'info'}">${e.status}</span></td>
    </tr>
  `).join('');

  const content = `
    <h1>Competition: ${competition.name}</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <div class="grid-2">
      <!-- Edit Form -->
      <div class="card">
        <h2 style="margin-top: 0;">Edit Competition</h2>
        <form method="POST" action="/competitions/${id}/update">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Name</label>
            <input type="text" name="name" value="${competition.name}" style="width: 100%;" required>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Short Name</label>
            <input type="text" name="shortName" value="${competition.shortName || ''}" style="width: 100%;" placeholder="e.g. PL, UCL">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Country</label>
            <input type="text" name="country" value="${competition.country || ''}" style="width: 100%;" placeholder="e.g. England">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Sport</label>
            <select name="sportId" style="width: 100%;">
              ${allSports.map(s => `<option value="${s.id}" ${competition.sportId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Tier</label>
            <select name="tier" style="width: 100%;">
              <option value="tier1" ${competition.tier === 'tier1' ? 'selected' : ''}>Tier 1 (Major)</option>
              <option value="tier2" ${competition.tier === 'tier2' ? 'selected' : ''}>Tier 2 (Standard)</option>
              <option value="tier3" ${competition.tier === 'tier3' ? 'selected' : ''}>Tier 3 (Minor)</option>
            </select>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Logo URL</label>
            <input type="text" name="logoUrl" value="${competition.logoUrl || ''}" style="width: 100%;" placeholder="https://...">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" name="isActive" ${competition.isActive ? 'checked' : ''} style="width: auto;">
              Active (visible in app)
            </label>
          </div>
          <button type="submit" class="btn">Save Changes</button>
        </form>
      </div>

      <!-- Competition Info -->
      <div class="card">
        <h2 style="margin-top: 0;">Competition Info</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">ID</div>
            <div style="font-family: monospace; font-size: 0.85em;">${competition.id}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Sport</div>
            <div>${competition.sportName}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Flashscore ID</div>
            <div style="font-family: monospace; font-size: 0.85em;">${competition.externalFlashscoreId || '-'}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Oddschecker ID</div>
            <div style="font-family: monospace; font-size: 0.85em;">${competition.externalOddscheckerId || '-'}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Total Events</div>
            <div>${eventCount?.count || 0} events</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Status</div>
            <div><span class="badge badge-${competition.isActive ? 'success' : 'error'}">${competition.isActive ? 'Active' : 'Inactive'}</span></div>
          </div>
        </div>
        ${competition.logoUrl ? `
          <div style="margin-top: 20px; text-align: center;">
            <img src="${competition.logoUrl}" alt="${competition.name}" style="max-width: 100px; max-height: 100px;">
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Recent Events -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Recent Events (${recentEvents.length})</h2>
      <table>
        <thead><tr><th>Date</th><th>Match</th><th>Status</th></tr></thead>
        <tbody>${eventRows || '<tr><td colspan="3" class="empty">No events</td></tr>'}</tbody>
      </table>
    </div>

    <div style="margin-top: 20px;">
      <a href="/competitions" class="btn btn-secondary">Back to Competitions</a>
    </div>
  `;

  return layout(competition.name, content, environment);
}

export async function updateCompetition(id: string, data: {
  name: string;
  shortName?: string;
  country?: string;
  sportId: string;
  tier: string;
  logoUrl?: string;
  isActive: boolean;
}): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    await db.update(competitions)
      .set({
        name: data.name,
        shortName: data.shortName || null,
        country: data.country || null,
        sportId: data.sportId,
        tier: data.tier as 'tier1' | 'tier2' | 'tier3',
        logoUrl: data.logoUrl || null,
        isActive: data.isActive,
      })
      .where(eq(competitions.id, id));
    return { success: true, message: 'Competition updated successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
