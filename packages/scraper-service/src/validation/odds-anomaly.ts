/**
 * Odds Anomaly Detection
 *
 * Detects suspicious odds patterns that could indicate:
 * - Scraper errors returning bad data
 * - Market manipulation
 * - Data corruption
 *
 * Flags events for human review before users can bet.
 */

import { getDb } from '../database/client.js';
import { events, oddsHistory } from '@sport-sage/database';
import { eq, sql } from 'drizzle-orm';
import { createJobLogger } from '../logger.js';

const logger = createJobLogger('odds-anomaly');

export interface OddsAnomalyResult {
  isAnomalous: boolean;
  reasons: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface OddsValues {
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  source: string;
}

interface PreviousOdds {
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  updatedAt: Date;
}

// Configuration thresholds
const THRESHOLDS = {
  // Odds value limits
  MIN_ODDS: 1.01,
  MAX_ODDS: 50.0, // Anything above this is suspicious

  // Implied probability checks
  MIN_IMPLIED_PROBABILITY: 0.50, // Below 50% = guaranteed profit for bettors (arbitrage)
  MAX_IMPLIED_PROBABILITY: 1.50, // Above 150% is normal bookmaker margin

  // Change detection
  MAX_CHANGE_PERCENT: 0.50, // 50% change in short time is suspicious
  CHANGE_TIME_WINDOW_MS: 5 * 60 * 1000, // 5 minutes

  // Similar odds detection (all outcomes too close = likely error)
  SIMILAR_ODDS_THRESHOLD: 0.15, // Max 15% difference between all odds
};

/**
 * Calculate implied probability from decimal odds
 */
function impliedProbability(odds: number): number {
  return 1 / odds;
}

/**
 * Calculate percentage change between two values
 */
function percentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 1 : 0;
  return Math.abs(newValue - oldValue) / oldValue;
}

/**
 * Check if all odds are suspiciously similar
 */
function checkSimilarOdds(odds: OddsValues): boolean {
  const values = [odds.homeWin, odds.draw, odds.awayWin].filter(
    (v): v is number => v !== undefined && v > 0
  );

  if (values.length < 2) return false;

  const min = Math.min(...values);
  const max = Math.max(...values);

  // If max is within threshold of min, they're too similar
  const variation = (max - min) / min;
  return variation < THRESHOLDS.SIMILAR_ODDS_THRESHOLD;
}

/**
 * Check if home/away odds are inverted (home team heavily unfavored when shouldn't be)
 */
function checkInvertedOdds(
  newOdds: OddsValues,
  previousOdds: PreviousOdds | null
): boolean {
  if (!previousOdds || !previousOdds.homeWin || !previousOdds.awayWin) {
    return false;
  }
  if (!newOdds.homeWin || !newOdds.awayWin) {
    return false;
  }

  // Previously home was favored (lower odds), now away is heavily favored
  const wasHomeFavored = previousOdds.homeWin < previousOdds.awayWin;
  const nowAwayHeavilyFavored = newOdds.awayWin < newOdds.homeWin * 0.5;

  // Or vice versa
  const wasAwayFavored = previousOdds.awayWin < previousOdds.homeWin;
  const nowHomeHeavilyFavored = newOdds.homeWin < newOdds.awayWin * 0.5;

  return (wasHomeFavored && nowAwayHeavilyFavored) ||
         (wasAwayFavored && nowHomeHeavilyFavored);
}

/**
 * Detect anomalies in odds data
 */
export function detectOddsAnomalies(
  newOdds: OddsValues,
  previousOdds: PreviousOdds | null
): OddsAnomalyResult {
  const reasons: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  const oddsValues = [newOdds.homeWin, newOdds.draw, newOdds.awayWin].filter(
    (v): v is number => v !== undefined
  );

  // Check 1: Extreme odds values
  for (const odds of oddsValues) {
    if (odds < THRESHOLDS.MIN_ODDS) {
      reasons.push(`Odds below minimum (${odds} < ${THRESHOLDS.MIN_ODDS})`);
      severity = 'critical';
    }
    if (odds > THRESHOLDS.MAX_ODDS) {
      reasons.push(`Extreme high odds detected (${odds} > ${THRESHOLDS.MAX_ODDS})`);
      severity = severity === 'critical' ? 'critical' : 'high';
    }
  }

  // Check 2: Implied probability (arbitrage detection)
  const totalImpliedProb = oddsValues.reduce((sum, o) => sum + impliedProbability(o), 0);
  if (totalImpliedProb < THRESHOLDS.MIN_IMPLIED_PROBABILITY) {
    reasons.push(`Implied probability too low (${(totalImpliedProb * 100).toFixed(1)}%) - possible arbitrage opportunity`);
    severity = 'critical';
  }

  // Check 3: Rapid change detection
  if (previousOdds && previousOdds.updatedAt) {
    const timeSinceUpdate = Date.now() - previousOdds.updatedAt.getTime();

    if (timeSinceUpdate < THRESHOLDS.CHANGE_TIME_WINDOW_MS) {
      const changes: string[] = [];

      if (newOdds.homeWin && previousOdds.homeWin) {
        const change = percentChange(previousOdds.homeWin, newOdds.homeWin);
        if (change > THRESHOLDS.MAX_CHANGE_PERCENT) {
          changes.push(`Home odds changed ${(change * 100).toFixed(0)}%`);
        }
      }

      if (newOdds.draw && previousOdds.draw) {
        const change = percentChange(previousOdds.draw, newOdds.draw);
        if (change > THRESHOLDS.MAX_CHANGE_PERCENT) {
          changes.push(`Draw odds changed ${(change * 100).toFixed(0)}%`);
        }
      }

      if (newOdds.awayWin && previousOdds.awayWin) {
        const change = percentChange(previousOdds.awayWin, newOdds.awayWin);
        if (change > THRESHOLDS.MAX_CHANGE_PERCENT) {
          changes.push(`Away odds changed ${(change * 100).toFixed(0)}%`);
        }
      }

      if (changes.length > 0) {
        reasons.push(`Rapid odds change in ${Math.round(timeSinceUpdate / 1000)}s: ${changes.join(', ')}`);
        severity = severity === 'critical' ? 'critical' : 'high';
      }
    }
  }

  // Check 4: All outcomes have similar odds (likely scraper error)
  if (checkSimilarOdds(newOdds)) {
    reasons.push(`All outcomes have suspiciously similar odds (within ${THRESHOLDS.SIMILAR_ODDS_THRESHOLD * 100}%)`);
    severity = severity === 'critical' ? 'critical' : 'high';
  }

  // Check 5: Inverted odds (favorite switched dramatically)
  if (checkInvertedOdds(newOdds, previousOdds)) {
    reasons.push('Home/away odds inverted dramatically from previous values');
    severity = severity === 'critical' ? 'critical' : 'high';
  }

  return {
    isAnomalous: reasons.length > 0,
    reasons,
    severity,
  };
}

/**
 * Flag an event for review due to odds anomalies
 */
export async function flagEventForReview(
  eventId: string,
  reasons: string[],
  severity: string
): Promise<void> {
  const db = getDb();

  try {
    await db
      .update(events)
      .set({
        isFlagged: true,
        flagReason: `[${severity.toUpperCase()}] Odds anomaly: ${reasons.join('; ')}`,
        flaggedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    logger.warn('Event flagged for odds anomaly', {
      eventId,
      severity,
      reasons,
    });
  } catch (error) {
    logger.error('Failed to flag event', { eventId, error });
  }
}

/**
 * Record odds change in history for audit trail
 */
export async function recordOddsHistory(
  eventId: string,
  marketType: string,
  outcomeName: string,
  previousOdds: string | null,
  newOdds: string,
  changePercent: string | null,
  source: string,
  isFlagged: boolean
): Promise<void> {
  const db = getDb();

  try {
    await db.insert(oddsHistory).values({
      eventId,
      marketType,
      outcomeName,
      previousOdds,
      newOdds,
      changePercent,
      source,
      isFlagged: isFlagged ? 1 : 0,
    });
  } catch (error) {
    logger.error('Failed to record odds history', { eventId, error });
  }
}

/**
 * Process odds update with anomaly detection
 * Returns true if odds should be applied, false if event was flagged
 */
export async function validateAndProcessOdds(
  eventId: string,
  newOdds: OddsValues,
  previousOdds: PreviousOdds | null
): Promise<{ valid: boolean; flagged: boolean }> {
  const anomalyResult = detectOddsAnomalies(newOdds, previousOdds);

  if (anomalyResult.isAnomalous) {
    // Flag the event for human review
    await flagEventForReview(eventId, anomalyResult.reasons, anomalyResult.severity);

    // Record the flagged odds change
    if (newOdds.homeWin !== undefined) {
      await recordOddsHistory(
        eventId,
        'match_winner',
        'Home Win',
        previousOdds?.homeWin?.toString() || null,
        newOdds.homeWin.toString(),
        previousOdds?.homeWin
          ? `${percentChange(previousOdds.homeWin, newOdds.homeWin) > 0 ? '+' : ''}${(percentChange(previousOdds.homeWin, newOdds.homeWin) * 100).toFixed(0)}%`
          : null,
        newOdds.source,
        true
      );
    }

    // For critical severity, don't apply the odds at all
    if (anomalyResult.severity === 'critical') {
      logger.warn('Critical odds anomaly - odds not applied', {
        eventId,
        reasons: anomalyResult.reasons,
      });
      return { valid: false, flagged: true };
    }

    // For other severities, apply odds but keep event flagged
    return { valid: true, flagged: true };
  }

  // No anomalies detected - record normal odds change for history
  if (newOdds.homeWin !== undefined && previousOdds?.homeWin !== undefined) {
    const change = percentChange(previousOdds.homeWin, newOdds.homeWin);
    if (change > 0.05) { // Only record if change > 5%
      await recordOddsHistory(
        eventId,
        'match_winner',
        'Home Win',
        previousOdds.homeWin.toString(),
        newOdds.homeWin.toString(),
        `${change > 0 ? '+' : ''}${(change * 100).toFixed(0)}%`,
        newOdds.source,
        false
      );
    }
  }

  return { valid: true, flagged: false };
}
