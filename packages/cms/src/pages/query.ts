/**
 * Query Page - SQL query runner
 */

import { getDb } from '@sport-sage/database';
import { sql } from 'drizzle-orm';
import { layout } from '../ui/layout.js';

const EXAMPLE_QUERIES = [
  "SELECT slug, COUNT(*) FROM events e JOIN sports s ON e.sport_id = s.id GROUP BY slug",
  "SELECT home_team_name, away_team_name, start_time FROM events WHERE status = 'scheduled' ORDER BY start_time LIMIT 10",
  "SELECT name, COUNT(*) as alias_count FROM teams t LEFT JOIN team_aliases ta ON t.id = ta.team_id GROUP BY t.id ORDER BY alias_count DESC LIMIT 10",
];

export async function handleQuery(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const rawQuery = query.get('q') || '';
  let result = '';
  let error = '';

  if (rawQuery) {
    try {
      if (!rawQuery.trim().toLowerCase().startsWith('select')) {
        throw new Error('Only SELECT queries are allowed');
      }
      const queryResult = await db.execute(sql.raw(rawQuery));
      result = JSON.stringify(queryResult.rows, null, 2);
    } catch (e: any) {
      error = e.message;
    }
  }

  const content = `
    <h1>SQL Query</h1>

    <div class="card">
      <form method="GET">
        <textarea name="q" style="width: 100%; height: 120px; font-family: monospace; resize: vertical; background: var(--bg-input); border: 1px solid #444; color: var(--text); padding: 15px; border-radius: 6px;">${rawQuery}</textarea>
        <div style="margin-top: 10px;">
          <button type="submit">Run Query</button>
          <span style="color: var(--text-muted); margin-left: 15px;">Only SELECT queries allowed</span>
        </div>
      </form>
    </div>

    ${error ? `<div class="card" style="border-color: var(--error);"><pre style="color: var(--error);">${error}</pre></div>` : ''}
    ${result ? `<div class="card"><h2 style="margin-top: 0;">Results</h2><pre><code>${result}</code></pre></div>` : ''}

    <div class="card">
      <h2 style="margin-top: 0;">Example Queries</h2>
      ${EXAMPLE_QUERIES.map(q => `
        <div style="margin-bottom: 10px;">
          <a href="/query?q=${encodeURIComponent(q)}" style="font-family: monospace; font-size: 0.9em;">${q}</a>
        </div>
      `).join('')}
    </div>
  `;

  return layout('Query', content, environment);
}
