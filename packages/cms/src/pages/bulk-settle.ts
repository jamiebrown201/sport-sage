/**
 * Bulk Settle Page - Settle all pending predictions for finished events
 */

import { getDb, predictions, events, users, outcomes, markets } from '@sport-sage/database';
import { eq, sql, and, desc, isNotNull } from 'drizzle-orm';
import { layout, timeAgo, tooltip } from '../ui/layout.js';

interface UnsettledPrediction {
  predictionId: string;
  userId: string;
  userName: string | null;
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  stake: number;
  outcomeId: string;
  outcomeName: string;
  marketType: string;
  isWinner: boolean | null;
  finishedAt: Date | null;
}

export async function handleBulkSettle(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const flash = query.get('flash') || '';

  // Get all pending predictions for finished events (only single predictions with eventId/outcomeId)
  const unsettledPredictions = await db
    .select({
      predictionId: predictions.id,
      userId: predictions.userId,
      eventId: predictions.eventId,
      stake: predictions.stake,
      outcomeId: predictions.outcomeId,
    })
    .from(predictions)
    .innerJoin(events, eq(predictions.eventId, events.id))
    .where(and(
      sql`${predictions.status}::text = 'pending'`,
      sql`${events.status}::text = 'finished'`,
      isNotNull(predictions.eventId),
      isNotNull(predictions.outcomeId)
    ))
    .orderBy(desc(events.updatedAt))
    .limit(500);

  // Enrich with full data
  const enrichedPredictions: UnsettledPrediction[] = [];

  for (const p of unsettledPredictions) {
    if (!p.eventId || !p.outcomeId) continue;

    const [event] = await db.select({
      homeTeam: events.homeTeamName,
      awayTeam: events.awayTeamName,
      homeScore: events.homeScore,
      awayScore: events.awayScore,
      finishedAt: events.updatedAt,
    }).from(events).where(eq(events.id, p.eventId)).limit(1);

    const [user] = await db.select({ name: users.username }).from(users).where(eq(users.id, p.userId)).limit(1);

    const [outcome] = await db.select({
      name: outcomes.name,
      isWinner: outcomes.isWinner,
      marketId: outcomes.marketId,
    }).from(outcomes).where(eq(outcomes.id, p.outcomeId)).limit(1);

    let marketType = 'Unknown';
    if (outcome) {
      const [market] = await db.select({ type: markets.type }).from(markets).where(eq(markets.id, outcome.marketId)).limit(1);
      if (market) marketType = market.type;
    }

    enrichedPredictions.push({
      predictionId: p.predictionId,
      userId: p.userId,
      userName: user?.name || null,
      eventId: p.eventId,
      homeTeam: event?.homeTeam || 'Unknown',
      awayTeam: event?.awayTeam || 'Unknown',
      homeScore: event?.homeScore ?? null,
      awayScore: event?.awayScore ?? null,
      stake: p.stake,
      outcomeId: p.outcomeId,
      outcomeName: outcome?.name || 'Unknown',
      marketType,
      isWinner: outcome?.isWinner ?? null,
      finishedAt: event?.finishedAt || null,
    });
  }

  // Group by resolvable status
  const autoResolvable = enrichedPredictions.filter(p => p.isWinner !== null);
  const needsManualReview = enrichedPredictions.filter(p => p.isWinner === null);

  // Stats
  const totalPending = enrichedPredictions.length;
  const canAutoSettle = autoResolvable.length;
  const willWin = autoResolvable.filter(p => p.isWinner === true).length;
  const willLose = autoResolvable.filter(p => p.isWinner === false).length;

  const autoRows = autoResolvable.slice(0, 50).map(p => `
    <tr>
      <td><a href="/events/${p.eventId}">${p.homeTeam} vs ${p.awayTeam}</a></td>
      <td style="font-family: monospace;">${p.homeScore ?? '?'} - ${p.awayScore ?? '?'}</td>
      <td>${p.outcomeName}</td>
      <td>${p.marketType}</td>
      <td><span class="badge badge-${p.isWinner ? 'success' : 'error'}">${p.isWinner ? 'WON' : 'LOST'}</span></td>
      <td>${p.stake}</td>
      <td>${p.userName || p.userId.slice(0, 8)}</td>
      <td class="time-ago">${p.finishedAt ? timeAgo(p.finishedAt) : '-'}</td>
    </tr>
  `).join('');

  const manualRows = needsManualReview.slice(0, 50).map(p => `
    <tr>
      <td><a href="/events/${p.eventId}">${p.homeTeam} vs ${p.awayTeam}</a></td>
      <td style="font-family: monospace;">${p.homeScore ?? '?'} - ${p.awayScore ?? '?'}</td>
      <td>${p.outcomeName}</td>
      <td>${p.marketType}</td>
      <td><span class="badge badge-warning">NEEDS REVIEW</span></td>
      <td>${p.stake}</td>
      <td>${p.userName || p.userId.slice(0, 8)}</td>
      <td>
        <a href="/events/${p.eventId}" class="btn btn-sm btn-secondary">Review</a>
      </td>
    </tr>
  `).join('');

  const content = `
    <h1>Bulk Settle Predictions ${tooltip('<strong>Prediction Settlement</strong>Settles pending predictions for finished events.<br><br><strong>Process:</strong><ol style="margin: 8px 0 0 16px;"><li>Event finishes → status becomes "finished"</li><li>Outcomes marked as winner/loser on event page</li><li>Predictions matched to winning outcomes</li><li>User coins updated (stake × 2 for wins)</li></ol>', 'right')}</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <!-- Summary -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value">${totalPending}</div>
        <div class="stat-label">Pending ${tooltip('<strong>Pending Predictions</strong>Total predictions with status "pending" where the event has finished. These are waiting to be settled.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--success);">${canAutoSettle}</div>
        <div class="stat-label">Auto-Settle ${tooltip('<strong>Can Auto-Settle</strong>Predictions where the outcome isWinner flag is set. These can be settled with one click.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--success);">${willWin}</div>
        <div class="stat-label">Will Win ${tooltip('<strong>Winning Predictions</strong>Predictions on outcomes marked as winners. Users will receive stake × 2 payout.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--error);">${willLose}</div>
        <div class="stat-label">Will Lose ${tooltip('<strong>Losing Predictions</strong>Predictions on outcomes marked as losers. Users lose their stake (already deducted at prediction time).', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--warning);">${needsManualReview.length}</div>
        <div class="stat-label">Need Review ${tooltip('<strong>Need Manual Review</strong>Predictions where outcomes don\'t have isWinner set. Go to the event page and mark which outcomes won.', 'bottom')}</div>
      </div>
    </div>

    <!-- Auto-Settleable -->
    ${canAutoSettle > 0 ? `
      <div class="card" style="border-color: var(--success);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2 style="margin: 0; color: var(--success);">Ready to Settle (${canAutoSettle})</h2>
          <form method="POST" action="/bulk-settle/execute" style="display: inline;">
            <button type="submit" class="btn">Settle All ${canAutoSettle} Predictions</button>
          </form>
        </div>
        <p style="color: var(--text-muted); margin-bottom: 15px;">
          These predictions have outcome winners marked and can be automatically settled.
        </p>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>Match</th>
                <th>Score</th>
                <th>Pick</th>
                <th>Market</th>
                <th>Result</th>
                <th>Stake</th>
                <th>User</th>
                <th>Finished</th>
              </tr>
            </thead>
            <tbody>${autoRows || '<tr><td colspan="8" class="empty">No predictions to settle</td></tr>'}</tbody>
          </table>
        </div>
        ${canAutoSettle > 50 ? `<p style="color: var(--text-muted); margin-top: 15px;">Showing first 50 of ${canAutoSettle}</p>` : ''}
      </div>
    ` : `
      <div class="card" style="border-color: var(--success);">
        <div style="text-align: center; padding: 40px;">
          <div style="font-size: 2em; color: var(--success); margin-bottom: 15px;">All caught up!</div>
          <p style="color: var(--text-muted);">No predictions ready for automatic settlement.</p>
        </div>
      </div>
    `}

    <!-- Needs Manual Review -->
    ${needsManualReview.length > 0 ? `
      <div class="card" style="margin-top: 20px; border-color: var(--warning);">
        <h2 style="margin-top: 0; color: var(--warning);">Needs Manual Review (${needsManualReview.length})</h2>
        <p style="color: var(--text-muted); margin-bottom: 15px;">
          These predictions are for finished events but the outcome winners haven't been marked.
          Go to the event detail page to mark the winning outcomes.
        </p>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>Match</th>
                <th>Score</th>
                <th>Pick</th>
                <th>Market</th>
                <th>Status</th>
                <th>Stake</th>
                <th>User</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>${manualRows || '<tr><td colspan="8" class="empty">None</td></tr>'}</tbody>
          </table>
        </div>
        ${needsManualReview.length > 50 ? `<p style="color: var(--text-muted); margin-top: 15px;">Showing first 50 of ${needsManualReview.length}</p>` : ''}
      </div>
    ` : ''}

    <!-- Quick Actions -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Related Actions</h2>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <a href="/predictions" class="btn btn-secondary">All Predictions</a>
        <a href="/lambdas/trigger/settlement" class="btn btn-secondary">Trigger Settlement Lambda</a>
        <a href="/lifecycle" class="btn btn-secondary">Event Lifecycle</a>
        <a href="/issues" class="btn btn-secondary">View Issues</a>
      </div>
    </div>
  `;

  return layout('Bulk Settle', content, environment);
}

export async function executeBulkSettle(): Promise<{ success: boolean; message: string; settled: number }> {
  const db = getDb();
  let settledCount = 0;
  const errors: string[] = [];

  try {
    // Get all pending predictions for finished events where outcome is marked
    const toSettle = await db
      .select({
        predictionId: predictions.id,
        userId: predictions.userId,
        stake: predictions.stake,
        outcomeId: predictions.outcomeId,
      })
      .from(predictions)
      .innerJoin(events, eq(predictions.eventId, events.id))
      .where(and(
        sql`${predictions.status}::text = 'pending'`,
        sql`${events.status}::text = 'finished'`,
        isNotNull(predictions.eventId),
        isNotNull(predictions.outcomeId)
      ));

    for (const prediction of toSettle) {
      if (!prediction.outcomeId) continue;

      const [outcome] = await db
        .select({ isWinner: outcomes.isWinner })
        .from(outcomes)
        .where(eq(outcomes.id, prediction.outcomeId))
        .limit(1);

      if (outcome?.isWinner === null || outcome?.isWinner === undefined) {
        continue; // Skip if winner not determined
      }

      const result = outcome.isWinner ? 'won' : 'lost';

      try {
        // Update prediction status
        await db.update(predictions)
          .set({ status: result, settledAt: new Date() })
          .where(eq(predictions.id, prediction.predictionId));

        // Update user coins if won (return stake + winnings based on 2x payout)
        if (result === 'won') {
          const payout = prediction.stake * 2;
          await db.update(users)
            .set({ coins: sql`${users.coins} + ${payout}` })
            .where(eq(users.id, prediction.userId));
        }

        settledCount++;
      } catch (err: any) {
        errors.push(`Failed to settle ${prediction.predictionId}: ${err.message}`);
      }
    }

    if (errors.length > 0 && settledCount === 0) {
      return { success: false, message: `Settlement failed: ${errors[0]}`, settled: 0 };
    }

    return {
      success: true,
      message: `Successfully settled ${settledCount} predictions${errors.length > 0 ? ` (${errors.length} errors)` : ''}`,
      settled: settledCount,
    };
  } catch (error: any) {
    return { success: false, message: error.message, settled: 0 };
  }
}
