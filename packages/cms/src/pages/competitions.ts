/**
 * Competitions Page - Browse competitions
 */

import { getDb, competitions } from '@sport-sage/database';
import { ilike } from 'drizzle-orm';
import { layout } from '../ui/layout.js';

export async function handleCompetitions(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const search = query.get('search') || '';

  const conditions = search ? ilike(competitions.name, `%${search}%`) : undefined;

  const allComps = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      country: competitions.country,
    })
    .from(competitions)
    .where(conditions)
    .orderBy(competitions.name)
    .limit(100);

  const rows = allComps.map(c => `
    <tr><td>${c.name}</td><td>${c.country || '-'}</td></tr>
  `).join('');

  const content = `
    <h1>Competitions</h1>

    <form class="search-box" method="GET">
      <input type="text" name="search" placeholder="Search competitions..." value="${search}" style="flex: 1;">
      <button type="submit">Search</button>
    </form>

    <div class="card">
      <table>
        <thead><tr><th>Name</th><th>Country</th></tr></thead>
        <tbody>${rows.length > 0 ? rows : '<tr><td colspan="2" class="empty">No competitions found</td></tr>'}</tbody>
      </table>
    </div>
  `;

  return layout('Competitions', content, environment);
}
