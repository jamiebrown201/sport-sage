/**
 * Event Detail Page - View and edit event details, scores, markets, predictions
 */

import { getDb, events, markets, outcomes, predictions, users, sports } from '@sport-sage/database';
import { eq, inArray } from 'drizzle-orm';
import { layout, timeAgo } from '../ui/layout.js';

export async function handleEventDetail(eventId: string, environment: string, flash?: string): Promise<string> {
  const db = getDb();

  // Get event details with sport info
  const [eventWithSport] = await db
    .select({
      id: events.id,
      sportId: events.sportId,
      competitionId: events.competitionId,
      competitionName: events.competitionName,
      homeTeamId: events.homeTeamId,
      awayTeamId: events.awayTeamId,
      homeTeamName: events.homeTeamName,
      awayTeamName: events.awayTeamName,
      startTime: events.startTime,
      status: events.status,
      homeScore: events.homeScore,
      awayScore: events.awayScore,
      period: events.period,
      minute: events.minute,
      isFeatured: events.isFeatured,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
      externalFlashscoreId: events.externalFlashscoreId,
      externalOddscheckerId: events.externalOddscheckerId,
      sportName: sports.name,
      sportSlug: sports.slug,
    })
    .from(events)
    .leftJoin(sports, eq(events.sportId, sports.id))
    .where(eq(events.id, eventId))
    .limit(1);

  if (!eventWithSport) {
    return layout('Event Not Found', `
      <div class="card">
        <h1>Event Not Found</h1>
        <p>The event with ID "${eventId}" was not found.</p>
        <a href="/events" class="btn">Back to Events</a>
      </div>
    `, environment);
  }

  const event = eventWithSport;

  // Get markets for this event
  const eventMarkets = await db
    .select()
    .from(markets)
    .where(eq(markets.eventId, eventId));

  // Get outcomes for all markets
  const marketIds = eventMarkets.map(m => m.id);
  const allOutcomes = marketIds.length > 0
    ? await db.select().from(outcomes).where(inArray(outcomes.marketId, marketIds))
    : [];

  // Get predictions for this event
  const eventPredictions = await db
    .select({
      id: predictions.id,
      oddsUserId: predictions.userId,
      username: users.username,
      type: predictions.type,
      stake: predictions.stake,
      odds: predictions.odds,
      potentialCoins: predictions.potentialCoins,
      status: predictions.status,
      settledAt: predictions.settledAt,
      createdAt: predictions.createdAt,
    })
    .from(predictions)
    .leftJoin(users, eq(predictions.userId, users.id))
    .where(eq(predictions.eventId, eventId));

  // Status badge
  const statusColor = event.status === 'live' ? 'warning' : event.status === 'finished' ? 'success' : 'info';

  // Score display
  const scoreDisplay = event.homeScore !== null && event.awayScore !== null
    ? `<div style="font-size: 3em; font-weight: bold; margin: 20px 0;">${event.homeScore} - ${event.awayScore}</div>`
    : '<div style="font-size: 1.5em; color: var(--text-muted); margin: 20px 0;">Score not available</div>';

  // Period/minute display
  const periodDisplay = event.period
    ? `<span class="badge badge-${statusColor}">${event.period}${event.minute ? ` ${event.minute}'` : ''}</span>`
    : event.status === 'live'
      ? '<span class="badge badge-warning">LIVE</span>'
      : '';

  // Build markets section with edit capabilities
  const marketsHtml = eventMarkets.length > 0
    ? eventMarkets.map(market => {
        const marketOutcomes = allOutcomes.filter(o => o.marketId === market.id);
        const outcomesHtml = marketOutcomes.map(o => `
          <div style="display: inline-block; padding: 10px 15px; background: ${o.isWinner ? '#0d4d3a' : 'var(--bg-hover)'}; border-radius: 6px; margin: 5px; ${o.isWinner ? 'border: 1px solid var(--success);' : ''}">
            <div style="font-weight: 500;">${o.name}</div>
            <div style="color: var(--primary); font-size: 1.2em;">${o.odds || '-'}</div>
            ${o.isWinner ? '<div style="color: var(--success); font-size: 0.8em;">WINNER</div>' : ''}
            <div style="margin-top: 8px;">
              <form method="POST" action="/events/${eventId}/outcome/${o.id}/winner" style="display: inline;">
                <button type="submit" class="btn btn-sm ${o.isWinner ? 'btn-secondary' : ''}" title="Mark as winner">
                  ${o.isWinner ? 'Unmark' : 'Winner'}
                </button>
              </form>
            </div>
          </div>
        `).join('');

        return `
          <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-card); border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="font-weight: 500; color: var(--text-muted); text-transform: uppercase; font-size: 0.85em;">
                ${market.type}${market.line ? ` (${market.line})` : ''}
                ${market.isSuspended ? '<span class="badge badge-error" style="margin-left: 10px;">SUSPENDED</span>' : ''}
              </div>
              <form method="POST" action="/events/${eventId}/market/${market.id}/suspend" style="display: inline;">
                <button type="submit" class="btn btn-sm ${market.isSuspended ? 'btn-secondary' : 'btn-danger'}">
                  ${market.isSuspended ? 'Unsuspend' : 'Suspend'}
                </button>
              </form>
            </div>
            <div>${outcomesHtml || '<span class="empty">No outcomes</span>'}</div>
          </div>
        `;
      }).join('')
    : '<div class="empty">No markets available</div>';

  // Build predictions section with manual settlement
  const predictionsHtml = eventPredictions.length > 0
    ? `
      <table>
        <thead><tr><th>User</th><th>Type</th><th>Stake</th><th>Odds</th><th>Potential</th><th>Status</th><th>Placed</th><th>Actions</th></tr></thead>
        <tbody>
          ${eventPredictions.map(p => `
            <tr>
              <td>${p.username || 'Unknown'}</td>
              <td>${p.type}</td>
              <td>${p.stake} coins</td>
              <td>${p.odds || '-'}</td>
              <td>${p.potentialCoins || '-'} coins</td>
              <td><span class="badge badge-${p.status === 'won' ? 'success' : p.status === 'lost' ? 'error' : 'info'}">${p.status}</span></td>
              <td class="time-ago">${timeAgo(p.createdAt)}</td>
              <td>
                ${p.status === 'pending' ? `
                  <form method="POST" action="/predictions/${p.id}/settle" style="display: inline;">
                    <input type="hidden" name="eventId" value="${eventId}">
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
          `).join('')}
        </tbody>
      </table>
    `
    : '<div class="empty">No predictions placed</div>';

  const content = `
    <div style="margin-bottom: 20px;">
      <a href="/events" style="color: var(--text-muted);">&larr; Back to Events</a>
    </div>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="color: var(--text-muted); font-size: 0.9em;">
            <span class="badge badge-info" style="margin-right: 8px;">${event.sportName || event.sportSlug || 'Unknown'}</span>
            ${event.competitionName || 'Unknown Competition'}
          </div>
          <h1 style="margin: 10px 0;">${event.homeTeamName} vs ${event.awayTeamName}</h1>
          <div style="color: var(--text-muted);">
            ${event.startTime.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}
          </div>
        </div>
        <div style="text-align: center;">
          <span class="badge badge-${statusColor}" style="font-size: 1.1em; padding: 8px 16px;">${event.status?.toUpperCase()}</span>
          ${periodDisplay}
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        ${scoreDisplay}
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border);">
        <div>
          <div style="color: var(--text-muted); font-size: 0.85em;">Sport</div>
          <div>${event.sportName || event.sportSlug || 'Unknown'}</div>
        </div>
        <div>
          <div style="color: var(--text-muted); font-size: 0.85em;">Event ID</div>
          <div style="font-family: monospace; font-size: 0.85em;">${event.id}</div>
        </div>
        <div>
          <div style="color: var(--text-muted); font-size: 0.85em;">Created</div>
          <div>${timeAgo(event.createdAt)}</div>
        </div>
        <div>
          <div style="color: var(--text-muted); font-size: 0.85em;">Last Updated</div>
          <div>${timeAgo(event.updatedAt)}</div>
        </div>
      </div>
    </div>

    <!-- Edit Event Form -->
    <div class="card">
      <h2 style="margin-top: 0;">Edit Event</h2>
      <form method="POST" action="/events/${eventId}/update">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
          <div>
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Status</label>
            <select name="status" style="width: 100%;">
              <option value="scheduled" ${event.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
              <option value="live" ${event.status === 'live' ? 'selected' : ''}>Live</option>
              <option value="finished" ${event.status === 'finished' ? 'selected' : ''}>Finished</option>
              <option value="cancelled" ${event.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              <option value="postponed" ${event.status === 'postponed' ? 'selected' : ''}>Postponed</option>
            </select>
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Home Score</label>
            <input type="number" name="homeScore" value="${event.homeScore ?? ''}" style="width: 100%;" min="0">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Away Score</label>
            <input type="number" name="awayScore" value="${event.awayScore ?? ''}" style="width: 100%;" min="0">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Period</label>
            <input type="text" name="period" value="${event.period || ''}" style="width: 100%;" placeholder="e.g. 1st Half, 2nd Set">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Minute</label>
            <input type="number" name="minute" value="${event.minute ?? ''}" style="width: 100%;" min="0" max="120">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; color: var(--text-muted);">Start Time</label>
            <input type="datetime-local" name="startTime" value="${event.startTime.toISOString().slice(0, 16)}" style="width: 100%;">
          </div>
          <div>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-top: 25px;">
              <input type="checkbox" name="isFeatured" ${event.isFeatured ? 'checked' : ''} style="width: auto;">
              Featured Event
            </label>
          </div>
        </div>
        <div style="margin-top: 20px;">
          <button type="submit" class="btn">Save Changes</button>
        </div>
      </form>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2 style="margin-top: 0;">Markets (${eventMarkets.length})</h2>
        ${marketsHtml}
      </div>

      <div class="card">
        <h2 style="margin-top: 0;">Predictions (${eventPredictions.length})</h2>
        ${predictionsHtml}
      </div>
    </div>

    <!-- External IDs -->
    <div class="card">
      <h2 style="margin-top: 0;">External IDs</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
        <div>
          <div style="color: var(--text-muted); font-size: 0.85em;">Flashscore ID</div>
          <div style="font-family: monospace;">${event.externalFlashscoreId || '-'}</div>
        </div>
        <div>
          <div style="color: var(--text-muted); font-size: 0.85em;">Oddschecker ID</div>
          <div style="font-family: monospace;">${event.externalOddscheckerId || '-'}</div>
        </div>
      </div>
    </div>

    ${event.status === 'live' ? `
      <div style="text-align: center; margin-top: 20px; color: var(--text-muted); font-size: 0.85em;">
        Auto-refreshes every 30 seconds
      </div>
      <script>setTimeout(() => location.reload(), 30000);</script>
    ` : ''}
  `;

  return layout(`${event.homeTeamName} vs ${event.awayTeamName}`, content, environment);
}

export async function updateEvent(eventId: string, data: {
  status: string;
  homeScore?: number;
  awayScore?: number;
  period?: string;
  minute?: number;
  startTime?: string;
  isFeatured: boolean;
}): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    await db.update(events)
      .set({
        status: data.status as 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed',
        homeScore: data.homeScore !== undefined ? data.homeScore : null,
        awayScore: data.awayScore !== undefined ? data.awayScore : null,
        period: data.period || null,
        minute: data.minute !== undefined ? data.minute : null,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        isFeatured: data.isFeatured,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));
    return { success: true, message: 'Event updated successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function toggleMarketSuspension(marketId: string): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    const [market] = await db.select().from(markets).where(eq(markets.id, marketId)).limit(1);
    if (!market) {
      return { success: false, message: 'Market not found' };
    }
    await db.update(markets)
      .set({ isSuspended: !market.isSuspended, updatedAt: new Date() })
      .where(eq(markets.id, marketId));
    return { success: true, message: `Market ${market.isSuspended ? 'unsuspended' : 'suspended'}` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function toggleOutcomeWinner(outcomeId: string): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  try {
    const [outcome] = await db.select().from(outcomes).where(eq(outcomes.id, outcomeId)).limit(1);
    if (!outcome) {
      return { success: false, message: 'Outcome not found' };
    }
    await db.update(outcomes)
      .set({ isWinner: !outcome.isWinner, updatedAt: new Date() })
      .where(eq(outcomes.id, outcomeId));
    return { success: true, message: `Outcome ${outcome.isWinner ? 'unmarked' : 'marked'} as winner` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
