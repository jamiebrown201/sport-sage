/**
 * Settlement Queue Page - Review held predictions before payout
 *
 * Shows predictions held for review due to:
 * - Large potential wins
 * - Flagged events
 * - Score instability
 */

import { getDb, predictions, events, users, outcomes, auditLog } from '@sport-sage/database';
import { eq, desc, and, sql, count } from 'drizzle-orm';
import { layout, timeAgo, tooltip } from '../ui/layout.js';

interface HeldPrediction {
  id: string;
  userId: string;
  userName: string | null;
  eventId: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  stake: number;
  potentialCoins: number;
  outcomeId: string | null;
  outcomeName: string | null;
  holdReason: string | null;
  heldAt: Date | null;
  createdAt: Date;
}

// Threshold for automatically holding large wins
export const LARGE_WIN_THRESHOLD = 1000;

export async function handleSettlementQueue(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const flash = query.get('flash') || '';

  // Get all held predictions
  const heldPredictions = await db
    .select({
      id: predictions.id,
      userId: predictions.userId,
      eventId: predictions.eventId,
      stake: predictions.stake,
      potentialCoins: predictions.potentialCoins,
      outcomeId: predictions.outcomeId,
      holdReason: predictions.holdReason,
      heldAt: predictions.heldAt,
      createdAt: predictions.createdAt,
    })
    .from(predictions)
    .where(eq(predictions.isHeld, true))
    .orderBy(desc(predictions.heldAt))
    .limit(100);

  // Enrich with user and event data
  const enrichedPredictions: HeldPrediction[] = [];

  for (const pred of heldPredictions) {
    const [user] = await db
      .select({ name: users.username })
      .from(users)
      .where(eq(users.id, pred.userId))
      .limit(1);

    let eventData = null;
    let outcomeName = null;

    if (pred.eventId) {
      const [event] = await db
        .select({
          homeTeam: events.homeTeamName,
          awayTeam: events.awayTeamName,
          homeScore: events.homeScore,
          awayScore: events.awayScore,
        })
        .from(events)
        .where(eq(events.id, pred.eventId))
        .limit(1);
      eventData = event;
    }

    if (pred.outcomeId) {
      const [outcome] = await db
        .select({ name: outcomes.name })
        .from(outcomes)
        .where(eq(outcomes.id, pred.outcomeId))
        .limit(1);
      outcomeName = outcome?.name || null;
    }

    enrichedPredictions.push({
      id: pred.id,
      userId: pred.userId,
      userName: user?.name || null,
      eventId: pred.eventId,
      homeTeam: eventData?.homeTeam || null,
      awayTeam: eventData?.awayTeam || null,
      homeScore: eventData?.homeScore ?? null,
      awayScore: eventData?.awayScore ?? null,
      stake: pred.stake,
      potentialCoins: pred.potentialCoins,
      outcomeId: pred.outcomeId,
      outcomeName,
      holdReason: pred.holdReason,
      heldAt: pred.heldAt,
      createdAt: pred.createdAt,
    });
  }

  // Stats
  const totalHeld = enrichedPredictions.length;
  const totalPotentialPayout = enrichedPredictions.reduce((sum, p) => sum + p.potentialCoins, 0);
  const largeWins = enrichedPredictions.filter(p => p.potentialCoins >= LARGE_WIN_THRESHOLD).length;
  const flaggedEventHolds = enrichedPredictions.filter(p => p.holdReason?.includes('flagged')).length;

  const rows = enrichedPredictions.map(pred => {
    const heldAgo = pred.heldAt ? timeAgo(pred.heldAt) : 'Unknown';
    const isLargeWin = pred.potentialCoins >= LARGE_WIN_THRESHOLD;

    return `
      <tr>
        <td>
          ${pred.eventId ? `<a href="/events/${pred.eventId}">${pred.homeTeam} vs ${pred.awayTeam}</a>` : 'Unknown'}
          <div style="font-size: 0.8em; color: var(--text-muted);">
            Score: ${pred.homeScore ?? '?'} - ${pred.awayScore ?? '?'}
          </div>
        </td>
        <td>${pred.outcomeName || 'Unknown'}</td>
        <td>${pred.userName || pred.userId.slice(0, 8)}</td>
        <td>${pred.stake}</td>
        <td style="color: ${isLargeWin ? 'var(--warning)' : 'var(--success)'}; font-weight: bold;">
          ${pred.potentialCoins}
          ${isLargeWin ? `<span class="badge badge-warning" style="margin-left: 5px;">LARGE</span>` : ''}
        </td>
        <td style="max-width: 200px; font-size: 0.85em; word-wrap: break-word;">
          ${pred.holdReason || 'No reason provided'}
        </td>
        <td class="time-ago">${heldAgo}</td>
        <td>
          <div style="display: flex; gap: 5px;">
            <form method="POST" action="/settlement-queue/${pred.id}/release" style="display: inline;">
              <button type="submit" class="btn btn-sm" style="background: var(--success);">Release</button>
            </form>
            <form method="POST" action="/settlement-queue/${pred.id}/void" style="display: inline;">
              <button type="submit" class="btn btn-sm btn-danger" onclick="return confirm('This will void the prediction and refund the stake. Continue?')">Void</button>
            </form>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const content = `
    <h1>Settlement Queue ${tooltip('<strong>Settlement Queue</strong>Predictions held for manual review before settlement.<br><br><strong>Hold triggers:</strong><ul><li>Large potential win (>${LARGE_WIN_THRESHOLD} coins)</li><li>Event was flagged for anomalies</li><li>Score changed recently (unstable)</li><li>Multiple score corrections detected</li></ul><br><strong>Actions:</strong><ul><li><strong>Release</strong>: Complete settlement, pay out winnings</li><li><strong>Void</strong>: Cancel prediction, refund stake</li></ul>', 'right')}</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat" style="border-color: ${totalHeld > 0 ? 'var(--warning)' : 'var(--success)'};">
        <div class="stat-value" style="color: ${totalHeld > 0 ? 'var(--warning)' : 'var(--success)'};">${totalHeld}</div>
        <div class="stat-label">Held Predictions ${tooltip('<strong>Held Predictions</strong>Total predictions awaiting manual review before settlement.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--warning);">${totalPotentialPayout}</div>
        <div class="stat-label">Total Payout ${tooltip('<strong>Total Potential Payout</strong>Sum of all pending payouts if all held predictions are released.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--warning);">${largeWins}</div>
        <div class="stat-label">Large Wins ${tooltip(`<strong>Large Wins</strong>Predictions with potential payout >= ${LARGE_WIN_THRESHOLD} coins. Automatically held for review.`, 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value">${flaggedEventHolds}</div>
        <div class="stat-label">Flagged Event ${tooltip('<strong>Flagged Event Holds</strong>Predictions held because the event was flagged for anomalies.', 'bottom')}</div>
      </div>
    </div>

    <!-- Held Predictions Table -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0;">Held Predictions (${totalHeld})</h2>
        ${totalHeld > 0 ? `
          <form method="POST" action="/settlement-queue/release-all" style="display: inline;">
            <button type="submit" class="btn btn-sm" style="background: var(--success);" onclick="return confirm('Release all ${totalHeld} held predictions and pay out ${totalPotentialPayout} coins?')">
              Release All
            </button>
          </form>
        ` : ''}
      </div>

      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>Match</th>
              <th>Pick</th>
              <th>User</th>
              <th>Stake</th>
              <th>Payout</th>
              <th>Hold Reason</th>
              <th>Held</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="8" class="empty" style="color: var(--success);">No held predictions - all clear!</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Quick Links -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Related Pages</h2>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <a href="/review-queue" class="btn btn-secondary">Review Queue</a>
        <a href="/bulk-settle" class="btn btn-secondary">Bulk Settle</a>
        <a href="/predictions" class="btn btn-secondary">All Predictions</a>
      </div>
    </div>
  `;

  return layout('Settlement Queue', content, environment);
}

/**
 * Release a held prediction (complete settlement)
 */
export async function releasePrediction(predictionId: string, userId?: string): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  try {
    // Get the prediction
    const [pred] = await db
      .select({
        id: predictions.id,
        predUserId: predictions.userId,
        stake: predictions.stake,
        potentialCoins: predictions.potentialCoins,
        outcomeId: predictions.outcomeId,
        holdReason: predictions.holdReason,
      })
      .from(predictions)
      .where(eq(predictions.id, predictionId))
      .limit(1);

    if (!pred) {
      return { success: false, message: 'Prediction not found' };
    }

    // Get the outcome to determine if it's a win
    let isWinner = false;
    if (pred.outcomeId) {
      const [outcome] = await db
        .select({ isWinner: outcomes.isWinner })
        .from(outcomes)
        .where(eq(outcomes.id, pred.outcomeId))
        .limit(1);
      isWinner = outcome?.isWinner || false;
    }

    const result = isWinner ? 'won' : 'lost';

    // Release the hold and settle the prediction
    await db
      .update(predictions)
      .set({
        isHeld: false,
        status: result,
        settledAt: new Date(),
        settledCoins: isWinner ? pred.potentialCoins : 0,
        reviewedBy: userId || null,
        reviewedAt: new Date(),
      })
      .where(eq(predictions.id, predictionId));

    // Pay out winnings if won
    if (isWinner) {
      await db
        .update(users)
        .set({
          coins: sql`${users.coins} + ${pred.potentialCoins}`,
        })
        .where(eq(users.id, pred.predUserId));
    }

    // Log the action
    await db.insert(auditLog).values({
      tableName: 'predictions',
      recordId: predictionId,
      action: 'release',
      oldValues: { isHeld: true, holdReason: pred.holdReason },
      newValues: { isHeld: false, status: result, settledCoins: isWinner ? pred.potentialCoins : 0 },
      reason: `Released by admin. ${isWinner ? `Paid out ${pred.potentialCoins} coins.` : 'Lost - no payout.'}`,
      changedBy: userId || null,
    });

    return {
      success: true,
      message: isWinner
        ? `Released and paid out ${pred.potentialCoins} coins`
        : 'Released - prediction lost, no payout',
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Void a held prediction (refund stake)
 */
export async function voidPrediction(predictionId: string, userId?: string): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  try {
    // Get the prediction
    const [pred] = await db
      .select({
        id: predictions.id,
        predUserId: predictions.userId,
        stake: predictions.stake,
        holdReason: predictions.holdReason,
      })
      .from(predictions)
      .where(eq(predictions.id, predictionId))
      .limit(1);

    if (!pred) {
      return { success: false, message: 'Prediction not found' };
    }

    // Void the prediction
    await db
      .update(predictions)
      .set({
        isHeld: false,
        status: 'void',
        settledAt: new Date(),
        reviewedBy: userId || null,
        reviewedAt: new Date(),
      })
      .where(eq(predictions.id, predictionId));

    // Refund the stake
    await db
      .update(users)
      .set({
        coins: sql`${users.coins} + ${pred.stake}`,
      })
      .where(eq(users.id, pred.predUserId));

    // Log the action
    await db.insert(auditLog).values({
      tableName: 'predictions',
      recordId: predictionId,
      action: 'void',
      oldValues: { isHeld: true, holdReason: pred.holdReason },
      newValues: { isHeld: false, status: 'void' },
      reason: `Voided by admin. Refunded ${pred.stake} coins.`,
      changedBy: userId || null,
    });

    return {
      success: true,
      message: `Voided prediction and refunded ${pred.stake} coins`,
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Release all held predictions
 */
export async function releaseAllPredictions(userId?: string): Promise<{ success: boolean; message: string; released: number }> {
  const db = getDb();

  try {
    const heldPredictions = await db
      .select({ id: predictions.id })
      .from(predictions)
      .where(eq(predictions.isHeld, true));

    for (const pred of heldPredictions) {
      await releasePrediction(pred.id, userId);
    }

    return {
      success: true,
      message: `Released ${heldPredictions.length} predictions`,
      released: heldPredictions.length,
    };
  } catch (error: any) {
    return { success: false, message: error.message, released: 0 };
  }
}

/**
 * Hold a prediction for review
 */
export async function holdPrediction(
  predictionId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  try {
    await db
      .update(predictions)
      .set({
        isHeld: true,
        holdReason: reason,
        heldAt: new Date(),
      })
      .where(eq(predictions.id, predictionId));

    return { success: true, message: 'Prediction held for review' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
