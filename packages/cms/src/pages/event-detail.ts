/**
 * Event Detail Page - View event details, scores, markets, predictions
 */

import { getDb, events, markets, outcomes, predictions, users, sports } from '@sport-sage/database';
import { eq, inArray } from 'drizzle-orm';
import { layout, timeAgo } from '../ui/layout.js';

export async function handleEventDetail(eventId: string, environment: string): Promise<string> {
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
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
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

  // Build markets section
  const marketsHtml = eventMarkets.length > 0
    ? eventMarkets.map(market => {
        const marketOutcomes = allOutcomes.filter(o => o.marketId === market.id);
        const outcomesHtml = marketOutcomes.map(o => `
          <div style="display: inline-block; padding: 10px 15px; background: ${o.isWinner ? '#0d4d3a' : 'var(--bg-hover)'}; border-radius: 6px; margin: 5px; ${o.isWinner ? 'border: 1px solid var(--success);' : ''}">
            <div style="font-weight: 500;">${o.name}</div>
            <div style="color: var(--primary); font-size: 1.2em;">${o.odds || '-'}</div>
            ${o.isWinner ? '<div style="color: var(--success); font-size: 0.8em;">WINNER</div>' : ''}
          </div>
        `).join('');

        return `
          <div style="margin-bottom: 20px;">
            <div style="font-weight: 500; margin-bottom: 10px; color: var(--text-muted); text-transform: uppercase; font-size: 0.85em;">
              ${market.type}${market.line ? ` (${market.line})` : ''}
              ${market.isSuspended ? '<span class="badge badge-error" style="margin-left: 10px;">SUSPENDED</span>' : ''}
            </div>
            <div>${outcomesHtml || '<span class="empty">No outcomes</span>'}</div>
          </div>
        `;
      }).join('')
    : '<div class="empty">No markets available</div>';

  // Build predictions section
  const predictionsHtml = eventPredictions.length > 0
    ? `
      <table>
        <thead><tr><th>User</th><th>Type</th><th>Stake</th><th>Potential Win</th><th>Status</th><th>Placed</th></tr></thead>
        <tbody>
          ${eventPredictions.map(p => `
            <tr>
              <td>${p.username || 'Unknown'}</td>
              <td>${p.type}</td>
              <td>${p.stake} coins</td>
              <td>${p.potentialCoins || '-'} coins</td>
              <td><span class="badge badge-${p.status === 'won' ? 'success' : p.status === 'lost' ? 'error' : 'info'}">${p.status}</span></td>
              <td class="time-ago">${timeAgo(p.createdAt)}</td>
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

    ${event.status === 'live' ? `
      <div style="text-align: center; margin-top: 20px; color: var(--text-muted); font-size: 0.85em;">
        Auto-refreshes every 30 seconds
      </div>
      <script>setTimeout(() => location.reload(), 30000);</script>
    ` : ''}
  `;

  return layout(`${event.homeTeamName} vs ${event.awayTeamName}`, content, environment);
}
