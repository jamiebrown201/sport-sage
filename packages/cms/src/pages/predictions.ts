/**
 * Predictions Page - Monitor and manually settle user predictions
 */

import { getDb, predictions, users, events, userStats } from '@sport-sage/database';
import { desc, eq, sql, and, gte, count } from 'drizzle-orm';
import { layout, timeAgo } from '../ui/layout.js';

export async function handlePredictions(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const status = query.get('status') || '';
  const page = parseInt(query.get('page') || '1');
  const flash = query.get('flash') || '';
  const limit = 50;
  const offset = (page - 1) * limit;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Build conditions
  const conditions = [];
  if (status) {
    conditions.push(sql`${predictions.status}::text = ${status}`);
  }

  // Get predictions with user and event info
  const allPredictions = await db
    .select({
      id: predictions.id,
      type: predictions.type,
      stake: predictions.stake,
      odds: predictions.odds,
      potentialCoins: predictions.potentialCoins,
      status: predictions.status,
      settledAt: predictions.settledAt,
      createdAt: predictions.createdAt,
      userId: predictions.userId,
      username: users.username,
      homeTeam: events.homeTeamName,
      awayTeam: events.awayTeamName,
      eventId: events.id,
      eventStatus: events.status,
    })
    .from(predictions)
    .leftJoin(users, eq(predictions.userId, users.id))
    .leftJoin(events, eq(predictions.eventId, events.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(predictions.createdAt))
    .limit(limit)
    .offset(offset);

  // Get stats
  const [totalPredictions] = await db.select({ count: count() }).from(predictions);
  const [pendingPredictions] = await db.select({ count: count() }).from(predictions)
    .where(sql`${predictions.status}::text = 'pending'`);
  const [wonPredictions] = await db.select({ count: count() }).from(predictions)
    .where(sql`${predictions.status}::text = 'won'`);
  const [lostPredictions] = await db.select({ count: count() }).from(predictions)
    .where(sql`${predictions.status}::text = 'lost'`);

  // Recent activity
  const [recentPredictions] = await db.select({ count: count() }).from(predictions)
    .where(gte(predictions.createdAt, oneDayAgo));
  const [settledToday] = await db.select({ count: count() }).from(predictions)
    .where(and(
      sql`${predictions.settledAt} IS NOT NULL`,
      gte(predictions.settledAt, oneDayAgo)
    ));

  // Calculate win rate
  const totalSettled = (wonPredictions?.count || 0) + (lostPredictions?.count || 0);
  const winRate = totalSettled > 0 ? Math.round(((wonPredictions?.count || 0) / totalSettled) * 100) : 0;

  // Build table rows with manual settlement options
  const rows = allPredictions.map(p => {
    const statusColor = p.status === 'won' ? 'success' : p.status === 'lost' ? 'error' : p.status === 'void' ? 'warning' : 'info';
    return `
      <tr>
        <td><a href="/users/${p.userId}">${p.username || 'Unknown'}</a></td>
        <td>
          <a href="/events/${p.eventId}">${p.homeTeam} vs ${p.awayTeam}</a>
          <div style="font-size: 0.8em; color: var(--text-muted);">
            <span class="badge badge-${p.eventStatus === 'live' ? 'warning' : p.eventStatus === 'finished' ? 'success' : 'info'}" style="font-size: 0.9em;">${p.eventStatus}</span>
          </div>
        </td>
        <td>${p.type}</td>
        <td>${p.stake} coins</td>
        <td>${p.odds ? Number(p.odds).toFixed(2) : '-'}</td>
        <td>${p.potentialCoins || '-'} coins</td>
        <td><span class="badge badge-${statusColor}">${p.status}</span></td>
        <td class="time-ago">${timeAgo(p.createdAt)}</td>
        <td>
          ${p.status === 'pending' ? `
            <form method="POST" action="/predictions/${p.id}/settle" style="display: flex; gap: 5px;">
              <select name="result" style="padding: 4px 8px; font-size: 0.85em;">
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="void">Void</option>
              </select>
              <button type="submit" class="btn btn-sm">Settle</button>
            </form>
          ` : `<span class="time-ago">${p.settledAt ? timeAgo(p.settledAt) : '-'}</span>`}
        </td>
      </tr>
    `;
  }).join('');

  const content = `
    <h1>Predictions</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value">${totalPredictions?.count || 0}</div>
        <div class="stat-label">Total Predictions</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--info);">${pendingPredictions?.count || 0}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--success);">${wonPredictions?.count || 0}</div>
        <div class="stat-label">Won</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--error);">${lostPredictions?.count || 0}</div>
        <div class="stat-label">Lost</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: ${winRate >= 50 ? 'var(--success)' : 'var(--warning)'};">${winRate}%</div>
        <div class="stat-label">Win Rate</div>
      </div>
    </div>

    <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value">${recentPredictions?.count || 0}</div>
        <div class="stat-label">Placed (24h)</div>
      </div>
      <div class="stat">
        <div class="stat-value">${settledToday?.count || 0}</div>
        <div class="stat-label">Settled (24h)</div>
      </div>
    </div>

    <!-- Filters -->
    <form class="search-box" method="GET">
      <select name="status">
        <option value="">All Status</option>
        <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
        <option value="won" ${status === 'won' ? 'selected' : ''}>Won</option>
        <option value="lost" ${status === 'lost' ? 'selected' : ''}>Lost</option>
        <option value="void" ${status === 'void' ? 'selected' : ''}>Void</option>
      </select>
      <button type="submit">Filter</button>
      ${pendingPredictions?.count > 0 ? `
        <a href="/predictions?status=pending" class="btn btn-secondary">View Pending (${pendingPredictions.count})</a>
      ` : ''}
    </form>

    <!-- Predictions Table -->
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Event</th>
            <th>Type</th>
            <th>Stake</th>
            <th>Odds</th>
            <th>Potential</th>
            <th>Status</th>
            <th>Placed</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length > 0 ? rows : '<tr><td colspan="9" class="empty">No predictions found</td></tr>'}
        </tbody>
      </table>

      ${allPredictions.length === limit ? `
        <div style="margin-top: 20px; text-align: center;">
          <a href="/predictions?page=${page + 1}&status=${status}">Next Page &rarr;</a>
        </div>
      ` : ''}
    </div>
  `;

  return layout('Predictions', content, environment);
}

export async function settlePrediction(predictionId: string, result: 'won' | 'lost' | 'void'): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    // Get prediction details
    const [prediction] = await db.select().from(predictions).where(eq(predictions.id, predictionId)).limit(1);
    if (!prediction) {
      return { success: false, message: 'Prediction not found' };
    }

    if (prediction.status !== 'pending') {
      return { success: false, message: 'Prediction already settled' };
    }

    // Calculate settled amounts
    let settledCoins = 0;
    let settledStars = 0;

    if (result === 'won') {
      settledCoins = prediction.potentialCoins || 0;
      settledStars = prediction.potentialStars || 0;
    } else if (result === 'void') {
      // Return stake on void
      settledCoins = prediction.stake;
      settledStars = 0;
    }
    // Lost = 0 coins, 0 stars

    // Update prediction
    await db.update(predictions)
      .set({
        status: result,
        settledCoins,
        settledStars,
        settledAt: new Date(),
      })
      .where(eq(predictions.id, predictionId));

    // Update user coins if won or void
    if (settledCoins > 0) {
      await db.update(users)
        .set({
          coins: sql`${users.coins} + ${settledCoins}`,
          stars: sql`${users.stars} + ${settledStars}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, prediction.userId));
    }

    // Update user stats
    if (result === 'won' || result === 'lost') {
      const statsUpdate = result === 'won'
        ? {
            totalWins: sql`${userStats.totalWins} + 1`,
            currentStreak: sql`${userStats.currentStreak} + 1`,
            bestStreak: sql`GREATEST(${userStats.bestStreak}, ${userStats.currentStreak} + 1)`,
            totalStarsEarned: sql`${userStats.totalStarsEarned} + ${settledStars}`,
            biggestWin: sql`GREATEST(${userStats.biggestWin}, ${settledCoins})`,
          }
        : {
            totalLosses: sql`${userStats.totalLosses} + 1`,
            currentStreak: 0,
          };

      await db.update(userStats)
        .set({
          ...statsUpdate,
          updatedAt: new Date(),
        })
        .where(eq(userStats.userId, prediction.userId));
    }

    return { success: true, message: `Prediction settled as ${result}` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
