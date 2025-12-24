/**
 * Source Mapping Page - Manage team name normalization across sources
 */

import { getDb, teams, teamAliases } from '@sport-sage/database';
import { eq, ilike, count, sql, desc, and, isNull } from 'drizzle-orm';
import { layout } from '../ui/layout.js';

const SOURCES = ['flashscore', 'oddschecker', 'sofascore', 'espn', '365scores', 'livescore', 'betexplorer', 'oddsportal', 'manual'];

export async function handleSourceMapping(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const flash = query.get('flash') || '';
  const search = query.get('search') || '';
  const source = query.get('source') || '';
  const showUnmapped = query.get('unmapped') === '1';

  // Get teams with alias counts
  let teamsQuery = db
    .select({
      id: teams.id,
      name: teams.name,
      shortName: teams.shortName,
    })
    .from(teams);

  if (search) {
    teamsQuery = teamsQuery.where(ilike(teams.name, `%${search}%`)) as typeof teamsQuery;
  }

  const allTeams = await teamsQuery.orderBy(teams.name).limit(200);

  // Get alias data for each team
  const teamsWithAliases = await Promise.all(
    allTeams.map(async (team) => {
      const aliases = await db
        .select({
          id: teamAliases.id,
          alias: teamAliases.alias,
          source: teamAliases.source,
        })
        .from(teamAliases)
        .where(eq(teamAliases.teamId, team.id));

      return {
        ...team,
        aliases,
        aliasCount: aliases.length,
        hasFlashscore: aliases.some(a => a.source === 'flashscore'),
        hasOddschecker: aliases.some(a => a.source === 'oddschecker'),
      };
    })
  );

  // Filter results
  let filteredTeams = teamsWithAliases;
  if (showUnmapped) {
    filteredTeams = teamsWithAliases.filter(t => t.aliasCount === 0);
  }
  if (source) {
    filteredTeams = filteredTeams.filter(t => t.aliases.some(a => a.source === source));
  }

  // Get stats
  const [totalTeams] = await db.select({ count: count() }).from(teams);
  const teamsWithNoAliases = await db
    .select({ count: count() })
    .from(teams)
    .leftJoin(teamAliases, eq(teams.id, teamAliases.teamId))
    .where(isNull(teamAliases.id));
  const [totalAliases] = await db.select({ count: count() }).from(teamAliases);

  // Source breakdown
  const sourceBreakdown = await db
    .select({
      source: teamAliases.source,
      count: count(),
    })
    .from(teamAliases)
    .groupBy(teamAliases.source)
    .orderBy(desc(count()));

  const rows = filteredTeams.map(t => {
    const sourceAliases = SOURCES.map(s => {
      const alias = t.aliases.find(a => a.source === s);
      if (alias) {
        return `<span class="badge badge-success" title="${s}: ${alias.alias}" style="font-size: 0.7em;">${s.slice(0, 3).toUpperCase()}</span>`;
      }
      return `<span class="badge badge-error" title="No ${s} alias" style="font-size: 0.7em; opacity: 0.3;">${s.slice(0, 3).toUpperCase()}</span>`;
    }).join(' ');

    return `
      <tr>
        <td><a href="/teams/${t.id}">${t.name}</a></td>
        <td style="color: var(--text-muted);">${t.shortName || '-'}</td>
        <td>${sourceAliases}</td>
        <td>${t.aliasCount}</td>
        <td>
          <a href="/teams/${t.id}" class="btn btn-sm btn-secondary">Edit Aliases</a>
        </td>
      </tr>
    `;
  }).join('');

  const sourceRows = sourceBreakdown.map(s => `
    <tr>
      <td>${s.source}</td>
      <td>${s.count}</td>
      <td>
        <a href="/source-mapping?source=${s.source}" class="btn btn-sm btn-secondary">View</a>
      </td>
    </tr>
  `).join('');

  const content = `
    <h1>Source Mapping</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <p style="color: var(--text-muted); margin-bottom: 20px;">
      Manage team name aliases across different data sources. Teams need aliases to match data from different scrapers.
    </p>

    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value">${totalTeams?.count || 0}</div>
        <div class="stat-label">Total Teams</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--success);">${totalAliases?.count || 0}</div>
        <div class="stat-label">Total Aliases</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--error);">${teamsWithNoAliases[0]?.count || 0}</div>
        <div class="stat-label">Teams Without Aliases</div>
      </div>
      <div class="stat">
        <div class="stat-value">${SOURCES.length}</div>
        <div class="stat-label">Supported Sources</div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Search and Filter -->
      <div class="card">
        <h2 style="margin-top: 0;">Search Teams</h2>
        <form class="search-box" method="GET">
          <input type="text" name="search" placeholder="Search teams..." value="${search}" style="flex: 1;">
          <select name="source">
            <option value="">All Sources</option>
            ${SOURCES.map(s => `<option value="${s}" ${source === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <label style="display: flex; align-items: center; gap: 5px;">
            <input type="checkbox" name="unmapped" value="1" ${showUnmapped ? 'checked' : ''} style="width: auto;">
            Unmapped only
          </label>
          <button type="submit">Search</button>
        </form>
      </div>

      <!-- Source Breakdown -->
      <div class="card">
        <h2 style="margin-top: 0;">Aliases by Source</h2>
        <table>
          <thead><tr><th>Source</th><th>Aliases</th><th>Actions</th></tr></thead>
          <tbody>${sourceRows || '<tr><td colspan="3" class="empty">No aliases</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <!-- Teams Table -->
    <div class="card" style="margin-top: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0;">Teams (${filteredTeams.length}${search || source || showUnmapped ? ' filtered' : ''})</h2>
        <div style="display: flex; gap: 10px;">
          <a href="/source-mapping?unmapped=1" class="btn btn-sm ${showUnmapped ? '' : 'btn-secondary'}">Show Unmapped</a>
          <a href="/source-mapping" class="btn btn-sm btn-secondary">Clear Filters</a>
        </div>
      </div>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>Team Name</th>
              <th>Short Name</th>
              <th>Source Coverage</th>
              <th>Aliases</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty">No teams found</td></tr>'}</tbody>
        </table>
      </div>
      ${filteredTeams.length >= 200 ? '<p style="color: var(--text-muted); margin-top: 15px;">Showing first 200 results. Use search to narrow down.</p>' : ''}
    </div>

    <!-- Quick Actions -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Import Aliases</h2>
      <p style="color: var(--text-muted); margin-bottom: 15px;">
        Add aliases in bulk by importing from a CSV file. Format: team_name,alias,source
      </p>
      <form method="POST" action="/source-mapping/import" enctype="multipart/form-data" style="display: flex; gap: 10px;">
        <textarea name="csvData" placeholder="team_name,alias,source&#10;Manchester United,Man Utd,flashscore&#10;Manchester United,Man United,oddschecker" style="flex: 1; height: 100px; font-family: monospace;"></textarea>
        <button type="submit" class="btn">Import</button>
      </form>
    </div>
  `;

  return layout('Source Mapping', content, environment);
}

export async function importAliases(csvData: string): Promise<{ success: boolean; message: string; imported: number }> {
  const db = getDb();
  let imported = 0;
  const errors: string[] = [];

  const lines = csvData.trim().split('\n');

  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 3) continue;

    const [teamName, alias, source] = parts;
    if (!teamName || !alias || !source) continue;

    // Skip header row
    if (teamName.toLowerCase() === 'team_name') continue;

    try {
      // Find team by name
      const [team] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(ilike(teams.name, teamName))
        .limit(1);

      if (!team) {
        errors.push(`Team not found: ${teamName}`);
        continue;
      }

      // Check if alias already exists
      const [existing] = await db
        .select({ id: teamAliases.id })
        .from(teamAliases)
        .where(and(
          eq(teamAliases.teamId, team.id),
          eq(teamAliases.alias, alias),
          eq(teamAliases.source, source)
        ))
        .limit(1);

      if (existing) {
        continue; // Already exists, skip
      }

      // Insert alias
      await db.insert(teamAliases).values({
        teamId: team.id,
        alias,
        source,
      });

      imported++;
    } catch (err: any) {
      errors.push(`Error for ${teamName}: ${err.message}`);
    }
  }

  if (imported === 0 && errors.length > 0) {
    return { success: false, message: errors[0], imported: 0 };
  }

  return {
    success: true,
    message: `Imported ${imported} aliases${errors.length > 0 ? ` (${errors.length} errors)` : ''}`,
    imported,
  };
}
