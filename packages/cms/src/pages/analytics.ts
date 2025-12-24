/**
 * Analytics Page - Trends, charts, and insights
 */

import { getDb, events, predictions, users, scraperRuns, sports } from '@sport-sage/database';
import { desc, eq, sql, count, gte, and, sum } from 'drizzle-orm';
import { layout, timeAgo } from '../ui/layout.js';

export async function handleAnalytics(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const period = query.get('period') || '7';
  const days = parseInt(period);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get overall stats
  const [totalEvents] = await db.select({ count: count() }).from(events);
  const [totalPredictions] = await db.select({ count: count() }).from(predictions);
  const [totalUsers] = await db.select({ count: count() }).from(users);

  // Get period-specific stats
  const [newUsers] = await db.select({ count: count() }).from(users)
    .where(gte(users.createdAt, cutoff));
  const [newPredictions] = await db.select({ count: count() }).from(predictions)
    .where(gte(predictions.createdAt, cutoff));
  const [newEvents] = await db.select({ count: count() }).from(events)
    .where(gte(events.createdAt, cutoff));

  // Prediction stats
  const [wonPredictions] = await db.select({ count: count() }).from(predictions)
    .where(and(
      gte(predictions.createdAt, cutoff),
      sql`${predictions.status}::text = 'won'`
    ));
  const [lostPredictions] = await db.select({ count: count() }).from(predictions)
    .where(and(
      gte(predictions.createdAt, cutoff),
      sql`${predictions.status}::text = 'lost'`
    ));

  // Get stakes and winnings
  const [stakeStats] = await db
    .select({
      totalStaked: sql<number>`COALESCE(SUM(${predictions.stake}), 0)`,
      totalWon: sql<number>`COALESCE(SUM(CASE WHEN ${predictions.status}::text = 'won' THEN ${predictions.potentialCoins} ELSE 0 END), 0)`,
    })
    .from(predictions)
    .where(gte(predictions.createdAt, cutoff));

  // Events by sport
  const eventsBySport = await db
    .select({
      sportId: events.sportId,
      sportName: sports.name,
      count: count(),
    })
    .from(events)
    .leftJoin(sports, eq(events.sportId, sports.id))
    .where(gte(events.createdAt, cutoff))
    .groupBy(events.sportId, sports.name)
    .orderBy(desc(count()));

  // Events by status
  const eventsByStatus = await db
    .select({
      status: events.status,
      count: count(),
    })
    .from(events)
    .where(gte(events.createdAt, cutoff))
    .groupBy(events.status);

  // Scraper performance
  const scraperStats = await db
    .select({
      source: scraperRuns.source,
      total: count(),
      success: sql<number>`SUM(CASE WHEN ${scraperRuns.status}::text = 'success' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN ${scraperRuns.status}::text = 'failed' THEN 1 ELSE 0 END)`,
      avgDuration: sql<number>`AVG(${scraperRuns.durationMs})`,
      totalItems: sql<number>`SUM(${scraperRuns.itemsProcessed})`,
    })
    .from(scraperRuns)
    .where(gte(scraperRuns.startedAt, cutoff))
    .groupBy(scraperRuns.source)
    .orderBy(desc(count()));

  // Daily breakdown (last 7 days)
  const dailyPredictions = await db
    .select({
      date: sql<string>`DATE(${predictions.createdAt})`,
      count: count(),
      won: sql<number>`SUM(CASE WHEN ${predictions.status}::text = 'won' THEN 1 ELSE 0 END)`,
      lost: sql<number>`SUM(CASE WHEN ${predictions.status}::text = 'lost' THEN 1 ELSE 0 END)`,
    })
    .from(predictions)
    .where(gte(predictions.createdAt, cutoff))
    .groupBy(sql`DATE(${predictions.createdAt})`)
    .orderBy(sql`DATE(${predictions.createdAt})`);

  // Top users by predictions
  const topUsers = await db
    .select({
      userId: predictions.userId,
      username: users.username,
      count: count(),
      wins: sql<number>`SUM(CASE WHEN ${predictions.status}::text = 'won' THEN 1 ELSE 0 END)`,
    })
    .from(predictions)
    .leftJoin(users, eq(predictions.userId, users.id))
    .where(gte(predictions.createdAt, cutoff))
    .groupBy(predictions.userId, users.username)
    .orderBy(desc(count()))
    .limit(10);

  const winRate = (wonPredictions?.count || 0) + (lostPredictions?.count || 0) > 0
    ? Math.round(((wonPredictions?.count || 0) / ((wonPredictions?.count || 0) + (lostPredictions?.count || 0))) * 100)
    : 0;

  const sportRows = eventsBySport.map(s => `
    <tr>
      <td>${s.sportName || 'Unknown'}</td>
      <td>${s.count}</td>
      <td>
        <div style="background: var(--bg-dark); border-radius: 4px; overflow: hidden; height: 8px; width: 100px;">
          <div style="background: var(--primary); height: 100%; width: ${Math.round((s.count / (eventsBySport[0]?.count || 1)) * 100)}%;"></div>
        </div>
      </td>
    </tr>
  `).join('');

  const statusRows = eventsByStatus.map(s => {
    const statusColor = s.status === 'live' ? 'warning' : s.status === 'finished' ? 'success' : s.status === 'scheduled' ? 'info' : 'error';
    return `
      <tr>
        <td><span class="badge badge-${statusColor}">${s.status}</span></td>
        <td>${s.count}</td>
      </tr>
    `;
  }).join('');

  const scraperRows = scraperStats.map(s => {
    const successRate = s.total > 0 ? Math.round((Number(s.success) / Number(s.total)) * 100) : 0;
    return `
      <tr>
        <td>${s.source}</td>
        <td>${s.total}</td>
        <td style="color: var(--success);">${s.success}</td>
        <td style="color: var(--error);">${s.failed}</td>
        <td>${successRate}%</td>
        <td>${s.avgDuration ? Math.round(Number(s.avgDuration) / 1000) + 's' : '-'}</td>
        <td>${Number(s.totalItems || 0).toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  const dailyRows = dailyPredictions.map(d => `
    <tr>
      <td>${d.date}</td>
      <td>${d.count}</td>
      <td style="color: var(--success);">${d.won}</td>
      <td style="color: var(--error);">${d.lost}</td>
      <td>${d.count > 0 ? Math.round((Number(d.won) / d.count) * 100) : 0}%</td>
    </tr>
  `).join('');

  const userRows = topUsers.map((u, i) => {
    const userWinRate = u.count > 0 ? Math.round((Number(u.wins) / u.count) * 100) : 0;
    return `
      <tr>
        <td>${i + 1}</td>
        <td><a href="/users/${u.userId}">${u.username || 'Unknown'}</a></td>
        <td>${u.count}</td>
        <td style="color: var(--success);">${u.wins}</td>
        <td>${userWinRate}%</td>
      </tr>
    `;
  }).join('');

  const content = `
    <h1>Analytics</h1>

    <!-- Period Selector -->
    <form class="search-box" method="GET" style="margin-bottom: 30px;">
      <select name="period">
        <option value="1" ${period === '1' ? 'selected' : ''}>Last 24 hours</option>
        <option value="7" ${period === '7' ? 'selected' : ''}>Last 7 days</option>
        <option value="30" ${period === '30' ? 'selected' : ''}>Last 30 days</option>
        <option value="90" ${period === '90' ? 'selected' : ''}>Last 90 days</option>
      </select>
      <button type="submit">Update</button>
      <a href="/analytics/export?period=${period}" class="btn btn-secondary">Export CSV</a>
    </form>

    <!-- Overview Stats -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value">${totalUsers?.count || 0}</div>
        <div class="stat-label">Total Users</div>
        <div style="font-size: 0.8em; color: var(--success);">+${newUsers?.count || 0} new</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalPredictions?.count || 0}</div>
        <div class="stat-label">Total Predictions</div>
        <div style="font-size: 0.8em; color: var(--success);">+${newPredictions?.count || 0} new</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalEvents?.count || 0}</div>
        <div class="stat-label">Total Events</div>
        <div style="font-size: 0.8em; color: var(--success);">+${newEvents?.count || 0} new</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: ${winRate >= 50 ? 'var(--success)' : 'var(--warning)'};">${winRate}%</div>
        <div class="stat-label">Win Rate (${days}d)</div>
      </div>
    </div>

    <!-- Prediction Economy -->
    <div class="card" style="margin-bottom: 20px;">
      <h2 style="margin-top: 0;">Prediction Economy (${days} days)</h2>
      <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
        <div class="stat">
          <div class="stat-value">${(stakeStats?.totalStaked || 0).toLocaleString()}</div>
          <div class="stat-label">Coins Staked</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: var(--success);">${(stakeStats?.totalWon || 0).toLocaleString()}</div>
          <div class="stat-label">Coins Won</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: var(--success);">${wonPredictions?.count || 0}</div>
          <div class="stat-label">Winning Bets</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: var(--error);">${lostPredictions?.count || 0}</div>
          <div class="stat-label">Losing Bets</div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Events by Sport -->
      <div class="card">
        <h2 style="margin-top: 0;">Events by Sport</h2>
        <table>
          <thead><tr><th>Sport</th><th>Events</th><th>Distribution</th></tr></thead>
          <tbody>${sportRows || '<tr><td colspan="3" class="empty">No data</td></tr>'}</tbody>
        </table>
      </div>

      <!-- Events by Status -->
      <div class="card">
        <h2 style="margin-top: 0;">Events by Status</h2>
        <table>
          <thead><tr><th>Status</th><th>Count</th></tr></thead>
          <tbody>${statusRows || '<tr><td colspan="2" class="empty">No data</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <!-- Daily Breakdown -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Daily Predictions Breakdown</h2>
      <table>
        <thead><tr><th>Date</th><th>Total</th><th>Won</th><th>Lost</th><th>Win Rate</th></tr></thead>
        <tbody>${dailyRows || '<tr><td colspan="5" class="empty">No data</td></tr>'}</tbody>
      </table>
    </div>

    <!-- Scraper Performance -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Scraper Performance</h2>
      <table>
        <thead><tr><th>Source</th><th>Runs</th><th>Success</th><th>Failed</th><th>Rate</th><th>Avg Time</th><th>Items</th></tr></thead>
        <tbody>${scraperRows || '<tr><td colspan="7" class="empty">No data</td></tr>'}</tbody>
      </table>
    </div>

    <!-- Top Users -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Top Users (${days} days)</h2>
      <table>
        <thead><tr><th>#</th><th>User</th><th>Predictions</th><th>Wins</th><th>Win Rate</th></tr></thead>
        <tbody>${userRows || '<tr><td colspan="5" class="empty">No data</td></tr>'}</tbody>
      </table>
    </div>
  `;

  return layout('Analytics', content, environment);
}

export async function handleAnalyticsExport(query: URLSearchParams): Promise<{ csv: string; filename: string }> {
  const db = getDb();
  const period = query.get('period') || '7';
  const days = parseInt(period);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Export predictions data
  const exportData = await db
    .select({
      date: sql<string>`DATE(${predictions.createdAt})`,
      total: count(),
      won: sql<number>`SUM(CASE WHEN ${predictions.status}::text = 'won' THEN 1 ELSE 0 END)`,
      lost: sql<number>`SUM(CASE WHEN ${predictions.status}::text = 'lost' THEN 1 ELSE 0 END)`,
      staked: sql<number>`SUM(${predictions.stake})`,
    })
    .from(predictions)
    .where(gte(predictions.createdAt, cutoff))
    .groupBy(sql`DATE(${predictions.createdAt})`)
    .orderBy(sql`DATE(${predictions.createdAt})`);

  const csv = [
    'Date,Total Predictions,Won,Lost,Staked',
    ...exportData.map(d => `${d.date},${d.total},${d.won},${d.lost},${d.staked}`)
  ].join('\n');

  return {
    csv,
    filename: `analytics-${period}d-${new Date().toISOString().split('T')[0]}.csv`
  };
}
