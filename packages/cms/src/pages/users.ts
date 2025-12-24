/**
 * Users Page - Manage users, view stats, edit coins
 */

import { getDb, users, userStats, predictions } from '@sport-sage/database';
import { desc, eq, ilike, sql, count, gte } from 'drizzle-orm';
import { layout, timeAgo } from '../ui/layout.js';

export async function handleUsers(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const search = query.get('search') || '';
  const flash = query.get('flash') || '';
  const sortBy = query.get('sort') || 'created';
  const page = parseInt(query.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const conditions = search ? ilike(users.username, `%${search}%`) : undefined;

  // Get users with stats
  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      coins: users.coins,
      stars: users.stars,
      gems: users.gems,
      subscriptionTier: users.subscriptionTier,
      createdAt: users.createdAt,
      totalPredictions: userStats.totalPredictions,
      totalWins: userStats.totalWins,
      totalLosses: userStats.totalLosses,
      currentStreak: userStats.currentStreak,
      bestStreak: userStats.bestStreak,
    })
    .from(users)
    .leftJoin(userStats, eq(users.id, userStats.userId))
    .where(conditions)
    .orderBy(
      sortBy === 'coins' ? desc(users.coins) :
      sortBy === 'stars' ? desc(users.stars) :
      sortBy === 'predictions' ? desc(userStats.totalPredictions) :
      sortBy === 'wins' ? desc(userStats.totalWins) :
      desc(users.createdAt)
    )
    .limit(limit)
    .offset(offset);

  // Get total user count
  const [totalUsers] = await db.select({ count: count() }).from(users);
  const [activeUsers] = await db.select({ count: count() }).from(users)
    .where(gte(users.updatedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [proUsers] = await db.select({ count: count() }).from(users)
    .where(sql`${users.subscriptionTier}::text != 'free'`);

  const rows = allUsers.map(u => {
    const winRate = (u.totalWins || 0) + (u.totalLosses || 0) > 0
      ? Math.round(((u.totalWins || 0) / ((u.totalWins || 0) + (u.totalLosses || 0))) * 100)
      : 0;
    return `
      <tr>
        <td><a href="/users/${u.id}">${u.username}</a></td>
        <td style="color: var(--text-muted); font-size: 0.9em;">${u.email}</td>
        <td style="color: var(--primary);">${u.coins.toLocaleString()}</td>
        <td style="color: var(--warning);">${u.stars.toLocaleString()}</td>
        <td>${u.totalPredictions || 0}</td>
        <td style="color: var(--success);">${u.totalWins || 0}</td>
        <td>${winRate}%</td>
        <td><span class="badge badge-${u.subscriptionTier === 'elite' ? 'success' : u.subscriptionTier === 'pro' ? 'warning' : 'info'}">${u.subscriptionTier}</span></td>
        <td class="time-ago">${timeAgo(u.createdAt)}</td>
        <td>
          <a href="/users/${u.id}" class="btn btn-sm btn-secondary">Manage</a>
        </td>
      </tr>
    `;
  }).join('');

  const content = `
    <h1>Users</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value">${totalUsers?.count || 0}</div>
        <div class="stat-label">Total Users</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--success);">${activeUsers?.count || 0}</div>
        <div class="stat-label">Active (7 days)</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--warning);">${proUsers?.count || 0}</div>
        <div class="stat-label">Pro/Elite</div>
      </div>
    </div>

    <!-- Search & Sort -->
    <form class="search-box" method="GET">
      <input type="text" name="search" placeholder="Search by username..." value="${search}" style="flex: 1;">
      <select name="sort">
        <option value="created" ${sortBy === 'created' ? 'selected' : ''}>Newest First</option>
        <option value="coins" ${sortBy === 'coins' ? 'selected' : ''}>Most Coins</option>
        <option value="stars" ${sortBy === 'stars' ? 'selected' : ''}>Most Stars</option>
        <option value="predictions" ${sortBy === 'predictions' ? 'selected' : ''}>Most Predictions</option>
        <option value="wins" ${sortBy === 'wins' ? 'selected' : ''}>Most Wins</option>
      </select>
      <button type="submit">Search</button>
    </form>

    <!-- Users Table -->
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Coins</th>
            <th>Stars</th>
            <th>Predictions</th>
            <th>Wins</th>
            <th>Win Rate</th>
            <th>Tier</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length > 0 ? rows : '<tr><td colspan="10" class="empty">No users found</td></tr>'}
        </tbody>
      </table>

      ${allUsers.length === limit ? `
        <div style="margin-top: 20px; text-align: center;">
          <a href="/users?page=${page + 1}&search=${search}&sort=${sortBy}">Next Page &rarr;</a>
        </div>
      ` : ''}
    </div>
  `;

  return layout('Users', content, environment);
}

export async function handleUserDetail(userId: string, environment: string, flash?: string): Promise<string> {
  const db = getDb();

  const [user] = await db
    .select({
      id: users.id,
      cognitoId: users.cognitoId,
      username: users.username,
      email: users.email,
      coins: users.coins,
      stars: users.stars,
      gems: users.gems,
      subscriptionTier: users.subscriptionTier,
      subscriptionExpiresAt: users.subscriptionExpiresAt,
      isAdsEnabled: users.isAdsEnabled,
      avatarUrl: users.avatarUrl,
      referralCode: users.referralCode,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return layout('User Not Found', '<h1>User not found</h1>', environment);
  }

  // Get user stats
  const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId)).limit(1);

  // Get recent predictions
  const recentPredictions = await db
    .select({
      id: predictions.id,
      type: predictions.type,
      stake: predictions.stake,
      odds: predictions.odds,
      potentialCoins: predictions.potentialCoins,
      status: predictions.status,
      createdAt: predictions.createdAt,
    })
    .from(predictions)
    .where(eq(predictions.userId, userId))
    .orderBy(desc(predictions.createdAt))
    .limit(20);

  const predictionRows = recentPredictions.map(p => `
    <tr>
      <td>${p.type}</td>
      <td>${p.stake} coins</td>
      <td>${p.odds ? Number(p.odds).toFixed(2) : '-'}</td>
      <td>${p.potentialCoins || '-'}</td>
      <td><span class="badge badge-${p.status === 'won' ? 'success' : p.status === 'lost' ? 'error' : 'info'}">${p.status}</span></td>
      <td class="time-ago">${timeAgo(p.createdAt)}</td>
    </tr>
  `).join('');

  const winRate = (stats?.totalWins || 0) + (stats?.totalLosses || 0) > 0
    ? Math.round(((stats?.totalWins || 0) / ((stats?.totalWins || 0) + (stats?.totalLosses || 0))) * 100)
    : 0;

  const content = `
    <h1>User: ${user.username}</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <div class="grid-2">
      <!-- Edit User Form -->
      <div class="card">
        <h2 style="margin-top: 0;">Edit User</h2>
        <form method="POST" action="/users/${userId}/update">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Coins</label>
            <input type="number" name="coins" value="${user.coins}" style="width: 100%;" min="0">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Stars</label>
            <input type="number" name="stars" value="${user.stars}" style="width: 100%;" min="0">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Gems</label>
            <input type="number" name="gems" value="${user.gems}" style="width: 100%;" min="0">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Subscription Tier</label>
            <select name="subscriptionTier" style="width: 100%;">
              <option value="free" ${user.subscriptionTier === 'free' ? 'selected' : ''}>Free</option>
              <option value="pro" ${user.subscriptionTier === 'pro' ? 'selected' : ''}>Pro</option>
              <option value="elite" ${user.subscriptionTier === 'elite' ? 'selected' : ''}>Elite</option>
            </select>
          </div>
          <button type="submit" class="btn">Save Changes</button>
        </form>

        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border);">
          <h3 style="font-size: 1em; margin-bottom: 10px;">Quick Actions</h3>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <form method="POST" action="/users/${userId}/add-coins" style="display: inline;">
              <input type="hidden" name="amount" value="1000">
              <button type="submit" class="btn btn-sm btn-secondary">+1000 Coins</button>
            </form>
            <form method="POST" action="/users/${userId}/add-coins" style="display: inline;">
              <input type="hidden" name="amount" value="5000">
              <button type="submit" class="btn btn-sm btn-secondary">+5000 Coins</button>
            </form>
            <form method="POST" action="/users/${userId}/reset-coins" style="display: inline;">
              <button type="submit" class="btn btn-sm btn-danger" onclick="return confirm('Reset to 1000 coins?')">Reset Coins</button>
            </form>
          </div>
        </div>
      </div>

      <!-- User Info -->
      <div class="card">
        <h2 style="margin-top: 0;">User Info</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">User ID</div>
            <div style="font-family: monospace; font-size: 0.85em;">${user.id}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Cognito ID</div>
            <div style="font-family: monospace; font-size: 0.85em; word-break: break-all;">${user.cognitoId}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Email</div>
            <div>${user.email}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Referral Code</div>
            <div style="font-family: monospace;">${user.referralCode || '-'}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Joined</div>
            <div>${timeAgo(user.createdAt)}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.85em;">Last Active</div>
            <div>${timeAgo(user.updatedAt)}</div>
          </div>
        </div>
        ${user.avatarUrl ? `
          <div style="margin-top: 20px; text-align: center;">
            <img src="${user.avatarUrl}" alt="${user.username}" style="max-width: 80px; max-height: 80px; border-radius: 50%;">
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Stats -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Statistics</h2>
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-value">${stats?.totalPredictions || 0}</div>
          <div class="stat-label">Total Predictions</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: var(--success);">${stats?.totalWins || 0}</div>
          <div class="stat-label">Wins</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: var(--error);">${stats?.totalLosses || 0}</div>
          <div class="stat-label">Losses</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: ${winRate >= 50 ? 'var(--success)' : 'var(--warning)'};">${winRate}%</div>
          <div class="stat-label">Win Rate</div>
        </div>
        <div class="stat">
          <div class="stat-value">${stats?.currentStreak || 0}</div>
          <div class="stat-label">Current Streak</div>
        </div>
        <div class="stat">
          <div class="stat-value">${stats?.bestStreak || 0}</div>
          <div class="stat-label">Best Streak</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: var(--warning);">${stats?.totalStarsEarned || 0}</div>
          <div class="stat-label">Stars Earned</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: var(--primary);">${stats?.biggestWin || 0}</div>
          <div class="stat-label">Biggest Win</div>
        </div>
      </div>
    </div>

    <!-- Recent Predictions -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Recent Predictions</h2>
      <table>
        <thead><tr><th>Type</th><th>Stake</th><th>Odds</th><th>Potential</th><th>Status</th><th>Placed</th></tr></thead>
        <tbody>${predictionRows || '<tr><td colspan="6" class="empty">No predictions</td></tr>'}</tbody>
      </table>
    </div>

    <div style="margin-top: 20px;">
      <a href="/users" class="btn btn-secondary">Back to Users</a>
    </div>
  `;

  return layout(user.username, content, environment);
}

export async function updateUser(userId: string, data: {
  coins: number;
  stars: number;
  gems: number;
  subscriptionTier: string;
}): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    await db.update(users)
      .set({
        coins: data.coins,
        stars: data.stars,
        gems: data.gems,
        subscriptionTier: data.subscriptionTier as 'free' | 'pro' | 'elite',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return { success: true, message: 'User updated successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function addCoinsToUser(userId: string, amount: number): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    await db.update(users)
      .set({
        coins: sql`${users.coins} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return { success: true, message: `Added ${amount} coins` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function resetUserCoins(userId: string): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    await db.update(users)
      .set({
        coins: 1000,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return { success: true, message: 'Coins reset to 1000' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
