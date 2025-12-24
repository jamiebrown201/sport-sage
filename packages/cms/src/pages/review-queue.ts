/**
 * Review Queue Page - Review and approve/reject flagged events
 *
 * Shows events flagged for suspicious odds or score data.
 * Admins can approve (unflag) or reject (void predictions).
 */

import { getDb, events, predictions, oddsHistory, eventScoreHistory, users, auditLog } from '@sport-sage/database';
import { eq, desc, and, sql, count } from 'drizzle-orm';
import { layout, timeAgo, tooltip } from '../ui/layout.js';

interface FlaggedEvent {
  id: string;
  homeTeamName: string | null;
  awayTeamName: string | null;
  startTime: Date;
  status: string;
  flagReason: string | null;
  flaggedAt: Date | null;
  homeScore: number | null;
  awayScore: number | null;
  predictionCount: number;
}

export async function handleReviewQueue(query: URLSearchParams, environment: string): Promise<string> {
  const db = getDb();
  const flash = query.get('flash') || '';

  // Get all flagged events
  const flaggedEvents = await db
    .select({
      id: events.id,
      homeTeamName: events.homeTeamName,
      awayTeamName: events.awayTeamName,
      startTime: events.startTime,
      status: events.status,
      flagReason: events.flagReason,
      flaggedAt: events.flaggedAt,
      homeScore: events.homeScore,
      awayScore: events.awayScore,
      predictionCount: events.predictionCount,
    })
    .from(events)
    .where(eq(events.isFlagged, true))
    .orderBy(desc(events.flaggedAt))
    .limit(100);

  // Get pending predictions that would be affected if we void
  const pendingCounts: Record<string, number> = {};
  for (const evt of flaggedEvents) {
    const [result] = await db
      .select({ count: count() })
      .from(predictions)
      .where(and(
        eq(predictions.eventId, evt.id),
        sql`${predictions.status}::text = 'pending'`
      ));
    pendingCounts[evt.id] = result?.count || 0;
  }

  // Stats
  const [totalFlagged] = await db
    .select({ count: count() })
    .from(events)
    .where(eq(events.isFlagged, true));

  const oddsFlags = flaggedEvents.filter(e => e.flagReason?.includes('Odds') || e.flagReason?.includes('odds')).length;
  const scoreFlags = flaggedEvents.filter(e => e.flagReason?.includes('SCORE') || e.flagReason?.includes('score')).length;

  // Severity breakdown
  const criticalCount = flaggedEvents.filter(e => e.flagReason?.includes('CRITICAL')).length;
  const highCount = flaggedEvents.filter(e => e.flagReason?.includes('HIGH')).length;
  const otherCount = flaggedEvents.length - criticalCount - highCount;

  const rows = flaggedEvents.map(evt => {
    const severityMatch = evt.flagReason?.match(/\[(CRITICAL|HIGH|MEDIUM|LOW)\]/);
    const severity = severityMatch?.[1] || 'UNKNOWN';
    const severityColor = severity === 'CRITICAL' ? 'error' : severity === 'HIGH' ? 'warning' : 'info';
    const pendingBets = pendingCounts[evt.id] || 0;
    const flaggedAgo = evt.flaggedAt ? timeAgo(evt.flaggedAt) : 'Unknown';

    return `
      <tr>
        <td>
          <span class="badge badge-${severityColor}">${severity}</span>
        </td>
        <td>
          <a href="/events/${evt.id}">${evt.homeTeamName} vs ${evt.awayTeamName}</a>
          <div style="font-size: 0.8em; color: var(--text-muted);">
            ${evt.startTime.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        </td>
        <td>
          <span class="badge badge-${evt.status === 'live' ? 'warning' : evt.status === 'finished' ? 'success' : 'info'}">${evt.status}</span>
        </td>
        <td style="max-width: 300px; font-size: 0.85em; word-wrap: break-word;">
          ${evt.flagReason?.replace(/\[(CRITICAL|HIGH|MEDIUM|LOW)\]/, '') || 'No reason provided'}
        </td>
        <td class="time-ago">${flaggedAgo}</td>
        <td style="text-align: center;">
          ${pendingBets > 0 ? `<span style="color: var(--warning);">${pendingBets}</span>` : '-'}
        </td>
        <td>
          <div style="display: flex; gap: 5px;">
            <form method="POST" action="/review-queue/${evt.id}/approve" style="display: inline;">
              <button type="submit" class="btn btn-sm" style="background: var(--success);">Approve</button>
            </form>
            <form method="POST" action="/review-queue/${evt.id}/reject" style="display: inline;">
              <button type="submit" class="btn btn-sm btn-danger" onclick="return confirm('This will void all ${pendingBets} pending predictions. Continue?')">Reject</button>
            </form>
            <a href="/events/${evt.id}" class="btn btn-sm btn-secondary">View</a>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const content = `
    <h1>Review Queue ${tooltip('<strong>Review Queue</strong>Flagged events require human review before betting resumes.<br><br><strong>Flagging triggers:</strong><ul><li>Odds anomalies (extreme values, rapid changes)</li><li>Score anomalies (negative, decreasing, exceeds limits)</li><li>Arbitrage detection (implied probability <50%)</li></ul><br><strong>Actions:</strong><ul><li><strong>Approve</strong>: Clear flag, allow betting</li><li><strong>Reject</strong>: Void all pending predictions, refund stakes</li></ul>', 'right')}</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat" style="border-color: ${(totalFlagged?.count || 0) > 0 ? 'var(--error)' : 'var(--success)'};">
        <div class="stat-value" style="color: ${(totalFlagged?.count || 0) > 0 ? 'var(--error)' : 'var(--success)'};">${totalFlagged?.count || 0}</div>
        <div class="stat-label">Flagged Events ${tooltip('<strong>Flagged Events</strong>Total events currently flagged for review. These events may have betting restrictions.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--error);">${criticalCount}</div>
        <div class="stat-label">Critical ${tooltip('<strong>Critical Severity</strong>Events with critical anomalies. Odds were NOT applied. Immediate review required.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--warning);">${highCount}</div>
        <div class="stat-label">High ${tooltip('<strong>High Severity</strong>Events with significant anomalies. Odds were applied but event is flagged for review.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value">${oddsFlags}</div>
        <div class="stat-label">Odds Issues ${tooltip('<strong>Odds Issues</strong>Flags triggered by odds anomalies (extreme values, rapid changes, etc.)', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value">${scoreFlags}</div>
        <div class="stat-label">Score Issues ${tooltip('<strong>Score Issues</strong>Flags triggered by score anomalies (negative, decreased, exceeded limits)', 'bottom')}</div>
      </div>
    </div>

    <!-- Flagged Events Table -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0;">Flagged Events (${flaggedEvents.length})</h2>
        ${flaggedEvents.length > 0 ? `
          <form method="POST" action="/review-queue/approve-all" style="display: inline;">
            <button type="submit" class="btn btn-sm" style="background: var(--success);" onclick="return confirm('Approve all ${flaggedEvents.length} flagged events?')">
              Approve All
            </button>
          </form>
        ` : ''}
      </div>

      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Severity ${tooltip('<strong>Severity</strong><ul><li><strong>CRITICAL</strong>: Odds not applied, betting blocked</li><li><strong>HIGH</strong>: Flagged but betting allowed</li><li><strong>MEDIUM/LOW</strong>: Minor issues</li></ul>', 'bottom')}</th>
              <th>Match</th>
              <th style="width: 90px;">Status</th>
              <th>Flag Reason</th>
              <th style="width: 100px;">Flagged</th>
              <th style="width: 80px; text-align: center;">Pending Bets ${tooltip('<strong>Pending Bets</strong>Number of pending predictions on this event. Will be voided if you reject.', 'bottom')}</th>
              <th style="width: 180px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="7" class="empty" style="color: var(--success);">No flagged events - all clear!</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Quick Links -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Related Pages</h2>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <a href="/settlement-queue" class="btn btn-secondary">Settlement Queue</a>
        <a href="/bulk-settle" class="btn btn-secondary">Bulk Settle</a>
        <a href="/issues" class="btn btn-secondary">Issues</a>
        <a href="/events?status=live" class="btn btn-secondary">Live Events</a>
      </div>
    </div>
  `;

  return layout('Review Queue', content, environment);
}

/**
 * Approve a flagged event (unflag it)
 */
export async function approveEvent(eventId: string, userId?: string): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  try {
    // Get the event first to log what we're approving
    const [event] = await db
      .select({
        id: events.id,
        flagReason: events.flagReason,
        homeTeamName: events.homeTeamName,
        awayTeamName: events.awayTeamName,
      })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return { success: false, message: 'Event not found' };
    }

    // Unflag the event
    await db
      .update(events)
      .set({
        isFlagged: false,
        reviewedBy: userId || null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    // Log the action
    await db.insert(auditLog).values({
      tableName: 'events',
      recordId: eventId,
      action: 'unflag',
      oldValues: { isFlagged: true, flagReason: event.flagReason },
      newValues: { isFlagged: false },
      reason: 'Approved by admin review',
      changedBy: userId || null,
    });

    return {
      success: true,
      message: `Approved: ${event.homeTeamName} vs ${event.awayTeamName}`,
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Reject a flagged event (void all predictions)
 */
export async function rejectEvent(eventId: string, userId?: string): Promise<{ success: boolean; message: string; voided: number }> {
  const db = getDb();

  try {
    // Get the event
    const [event] = await db
      .select({
        id: events.id,
        flagReason: events.flagReason,
        homeTeamName: events.homeTeamName,
        awayTeamName: events.awayTeamName,
      })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return { success: false, message: 'Event not found', voided: 0 };
    }

    // Get all pending predictions for this event
    const pendingPredictions = await db
      .select({
        id: predictions.id,
        userId: predictions.userId,
        stake: predictions.stake,
      })
      .from(predictions)
      .where(and(
        eq(predictions.eventId, eventId),
        sql`${predictions.status}::text = 'pending'`
      ));

    // Void all predictions and refund stakes
    for (const pred of pendingPredictions) {
      // Void the prediction
      await db
        .update(predictions)
        .set({
          status: 'void',
          settledAt: new Date(),
        })
        .where(eq(predictions.id, pred.id));

      // Refund the stake
      await db
        .update(users)
        .set({
          coins: sql`${users.coins} + ${pred.stake}`,
        })
        .where(eq(users.id, pred.userId));
    }

    // Keep the event flagged but mark as reviewed
    await db
      .update(events)
      .set({
        reviewedBy: userId || null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    // Log the action
    await db.insert(auditLog).values({
      tableName: 'events',
      recordId: eventId,
      action: 'void',
      oldValues: { pendingPredictions: pendingPredictions.length },
      newValues: { voidedPredictions: pendingPredictions.length },
      reason: `Rejected by admin review. Voided ${pendingPredictions.length} predictions.`,
      changedBy: userId || null,
    });

    return {
      success: true,
      message: `Rejected: ${event.homeTeamName} vs ${event.awayTeamName}. Voided ${pendingPredictions.length} predictions.`,
      voided: pendingPredictions.length,
    };
  } catch (error: any) {
    return { success: false, message: error.message, voided: 0 };
  }
}

/**
 * Approve all flagged events
 */
export async function approveAllEvents(userId?: string): Promise<{ success: boolean; message: string; approved: number }> {
  const db = getDb();

  try {
    const flaggedEvents = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.isFlagged, true));

    for (const evt of flaggedEvents) {
      await approveEvent(evt.id, userId);
    }

    return {
      success: true,
      message: `Approved ${flaggedEvents.length} events`,
      approved: flaggedEvents.length,
    };
  } catch (error: any) {
    return { success: false, message: error.message, approved: 0 };
  }
}
