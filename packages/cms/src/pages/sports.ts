/**
 * Sports Page - Manage sports visibility and settings
 */

import { getDb, sports, competitions, events } from '@sport-sage/database';
import { eq, count, desc, asc, sql } from 'drizzle-orm';
import { layout } from '../ui/layout.js';

export async function handleSports(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const flash = query.get('flash') || '';

  // Get all sports with counts
  const allSports = await db
    .select({
      id: sports.id,
      name: sports.name,
      slug: sports.slug,
      iconName: sports.iconName,
      isActive: sports.isActive,
      sortOrder: sports.sortOrder,
    })
    .from(sports)
    .orderBy(asc(sports.sortOrder), asc(sports.name));

  // Get counts for each sport
  const sportsWithCounts = await Promise.all(
    allSports.map(async (sport) => {
      const [compCount] = await db.select({ count: count() }).from(competitions)
        .where(eq(competitions.sportId, sport.id));
      const [eventCount] = await db.select({ count: count() }).from(events)
        .where(eq(events.sportId, sport.id));
      const [liveCount] = await db.select({ count: count() }).from(events)
        .where(sql`${events.sportId} = ${sport.id} AND ${events.status}::text = 'live'`);
      const [scheduledCount] = await db.select({ count: count() }).from(events)
        .where(sql`${events.sportId} = ${sport.id} AND ${events.status}::text = 'scheduled'`);

      return {
        ...sport,
        competitionCount: compCount?.count || 0,
        eventCount: eventCount?.count || 0,
        liveCount: liveCount?.count || 0,
        scheduledCount: scheduledCount?.count || 0,
      };
    })
  );

  const activeCount = sportsWithCounts.filter(s => s.isActive).length;
  const totalEvents = sportsWithCounts.reduce((sum, s) => sum + s.eventCount, 0);
  const totalLive = sportsWithCounts.reduce((sum, s) => sum + s.liveCount, 0);

  const rows = sportsWithCounts.map(s => `
    <tr>
      <td style="font-weight: bold;">${s.sortOrder}</td>
      <td>
        <span style="display: inline-flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.5em;">${getIconEmoji(s.iconName)}</span>
          <a href="/sports/${s.id}">${s.name}</a>
        </span>
      </td>
      <td><code>${s.slug}</code></td>
      <td>${s.iconName}</td>
      <td>
        <span class="badge badge-${s.isActive ? 'success' : 'error'}">${s.isActive ? 'Active' : 'Inactive'}</span>
      </td>
      <td>${s.competitionCount}</td>
      <td>
        ${s.liveCount > 0 ? `<span class="badge badge-warning">${s.liveCount} live</span>` : ''}
        ${s.scheduledCount > 0 ? `<span style="color: var(--text-muted);">${s.scheduledCount} scheduled</span>` : ''}
        ${s.eventCount === 0 ? '<span style="color: var(--text-muted);">-</span>' : ''}
      </td>
      <td>
        <a href="/sports/${s.id}" class="btn btn-sm btn-secondary">Edit</a>
        <a href="/sports/${s.id}/toggle" class="btn btn-sm ${s.isActive ? 'btn-danger' : ''}" style="margin-left: 5px;">
          ${s.isActive ? 'Disable' : 'Enable'}
        </a>
      </td>
    </tr>
  `).join('');

  const content = `
    <h1>Sports Management</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value">${sportsWithCounts.length}</div>
        <div class="stat-label">Total Sports</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--success);">${activeCount}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--error);">${sportsWithCounts.length - activeCount}</div>
        <div class="stat-label">Inactive</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalEvents.toLocaleString()}</div>
        <div class="stat-label">Total Events</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--warning);">${totalLive}</div>
        <div class="stat-label">Live Now</div>
      </div>
    </div>

    <!-- Sports Table -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <span style="color: var(--text-muted);">
          Lower sort order appears first in the app
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 60px;">Order</th>
            <th>Sport</th>
            <th>Slug</th>
            <th>Icon</th>
            <th>Status</th>
            <th>Competitions</th>
            <th>Events</th>
            <th style="width: 150px;">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Quick Actions -->
    <div class="card">
      <h2 style="margin-top: 0;">Quick Actions</h2>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <a href="/competitions" class="btn btn-secondary">Manage Competitions</a>
        <a href="/teams" class="btn btn-secondary">Manage Teams</a>
        <a href="/events" class="btn btn-secondary">Browse Events</a>
      </div>
    </div>
  `;

  return layout('Sports Management', content, environment);
}

export async function handleSportDetail(id: string, environment: string, flash?: string): Promise<string> {
  const db = getDb();

  const [sport] = await db
    .select()
    .from(sports)
    .where(eq(sports.id, id))
    .limit(1);

  if (!sport) {
    return layout('Sport Not Found', '<h1>Sport not found</h1>', environment);
  }

  // Get competitions for this sport
  const sportCompetitions = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      tier: competitions.tier,
      isActive: competitions.isActive,
    })
    .from(competitions)
    .where(eq(competitions.sportId, id))
    .orderBy(competitions.tier, competitions.name);

  // Get event counts
  const [eventCount] = await db.select({ count: count() }).from(events)
    .where(eq(events.sportId, id));
  const [liveCount] = await db.select({ count: count() }).from(events)
    .where(sql`${events.sportId} = ${id} AND ${events.status}::text = 'live'`);

  const compRows = sportCompetitions.map(c => `
    <tr>
      <td><a href="/competitions/${c.id}">${c.name}</a></td>
      <td><span class="badge badge-${c.tier === 'tier1' ? 'success' : c.tier === 'tier2' ? 'warning' : 'info'}">${c.tier}</span></td>
      <td><span class="badge badge-${c.isActive ? 'success' : 'error'}">${c.isActive ? 'Active' : 'Inactive'}</span></td>
    </tr>
  `).join('');

  const content = `
    <div style="margin-bottom: 20px;">
      <a href="/sports" style="color: var(--text-muted);">&larr; Back to Sports</a>
    </div>

    <h1>
      <span style="font-size: 1.2em; margin-right: 15px;">${getIconEmoji(sport.iconName)}</span>
      ${sport.name}
    </h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <div class="grid-2">
      <!-- Edit Form -->
      <div class="card">
        <h2 style="margin-top: 0;">Edit Sport</h2>
        <form method="POST" action="/sports/${id}/update">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Name</label>
            <input type="text" name="name" value="${sport.name}" style="width: 100%;" required>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Icon Name</label>
            <input type="text" name="iconName" value="${sport.iconName}" style="width: 100%;" required>
            <div style="font-size: 0.8em; color: var(--text-muted); margin-top: 5px;">
              Icon names: football, tennis, basketball, cricket, etc.
            </div>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Sort Order</label>
            <input type="number" name="sortOrder" value="${sport.sortOrder}" style="width: 100px;" min="0">
            <div style="font-size: 0.8em; color: var(--text-muted); margin-top: 5px;">
              Lower numbers appear first in the app
            </div>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" name="isActive" ${sport.isActive ? 'checked' : ''} style="width: auto;">
              Active (visible in app)
            </label>
          </div>
          <button type="submit" class="btn">Save Changes</button>
        </form>
      </div>

      <!-- Sport Info -->
      <div class="card">
        <h2 style="margin-top: 0;">Sport Info</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">ID</div>
            <div style="font-family: monospace; font-size: 0.85em;">${sport.id}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Slug</div>
            <div><code>${sport.slug}</code></div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Status</div>
            <div><span class="badge badge-${sport.isActive ? 'success' : 'error'}">${sport.isActive ? 'Active' : 'Inactive'}</span></div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Total Events</div>
            <div>${eventCount?.count || 0}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Live Events</div>
            <div style="color: var(--warning);">${liveCount?.count || 0}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Competitions</div>
            <div>${sportCompetitions.length}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Competitions -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Competitions (${sportCompetitions.length})</h2>
      <table>
        <thead><tr><th>Name</th><th>Tier</th><th>Status</th></tr></thead>
        <tbody>${compRows || '<tr><td colspan="3" class="empty">No competitions</td></tr>'}</tbody>
      </table>
    </div>
  `;

  return layout(sport.name, content, environment);
}

export async function updateSport(id: string, data: {
  name: string;
  iconName: string;
  sortOrder: number;
  isActive: boolean;
}): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    await db.update(sports)
      .set({
        name: data.name,
        iconName: data.iconName,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      })
      .where(eq(sports.id, id));
    return { success: true, message: 'Sport updated successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function toggleSportActive(id: string): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    const [sport] = await db.select({ isActive: sports.isActive }).from(sports).where(eq(sports.id, id)).limit(1);
    if (!sport) {
      return { success: false, message: 'Sport not found' };
    }
    await db.update(sports).set({ isActive: !sport.isActive }).where(eq(sports.id, id));
    return { success: true, message: `Sport ${sport.isActive ? 'disabled' : 'enabled'} successfully` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

function getIconEmoji(iconName: string): string {
  const icons: Record<string, string> = {
    football: '\u26BD',
    tennis: '\uD83C\uDFBE',
    basketball: '\uD83C\uDFC0',
    cricket: '\uD83C\uDFCF',
    american_football: '\uD83C\uDFC8',
    golf: '\u26F3',
    boxing: '\uD83E\uDD4A',
    mma: '\uD83E\uDD4B',
    f1: '\uD83C\uDFCE\uFE0F',
    horse_racing: '\uD83C\uDFC7',
    rugby: '\uD83C\uDFC9',
    ice_hockey: '\uD83C\uDFD2',
    baseball: '\u26BE',
    esports: '\uD83C\uDFAE',
    darts: '\uD83C\uDFAF',
  };
  return icons[iconName] || '\uD83C\uDFC6';
}
