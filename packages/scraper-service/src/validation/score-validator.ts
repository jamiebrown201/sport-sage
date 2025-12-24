/**
 * Score Validation
 *
 * Validates live score updates to prevent bad data from affecting settlements.
 *
 * Detects:
 * - Negative scores
 * - Scores that decreased (should never happen in most sports)
 * - Scores exceeding sport-specific limits
 * - Unrealistic score differences
 */

import { getDb } from '../database/client.js';
import { events, eventScoreHistory } from '@sport-sage/database';
import { eq, desc } from 'drizzle-orm';
import { createJobLogger } from '../logger.js';

const logger = createJobLogger('score-validator');

export interface ScoreValidationResult {
  isValid: boolean;
  reasons: string[];
  shouldFlag: boolean;
}

interface SportScoreLimits {
  maxScore: number;
  maxDifference: number;
  allowDecrease: boolean;
  periodBased?: boolean; // Tennis, volleyball - scores reset per period
}

// Sport-specific score limits
const SPORT_LIMITS: Record<string, SportScoreLimits> = {
  football: {
    maxScore: 15,
    maxDifference: 10,
    allowDecrease: false,
  },
  soccer: {
    maxScore: 15,
    maxDifference: 10,
    allowDecrease: false,
  },
  basketball: {
    maxScore: 200,
    maxDifference: 100,
    allowDecrease: false,
  },
  tennis: {
    maxScore: 7, // Per set
    maxDifference: 7,
    allowDecrease: true, // New sets reset scores
    periodBased: true,
  },
  volleyball: {
    maxScore: 35, // Per set
    maxDifference: 20,
    allowDecrease: true,
    periodBased: true,
  },
  ice_hockey: {
    maxScore: 15,
    maxDifference: 12,
    allowDecrease: false,
  },
  hockey: {
    maxScore: 15,
    maxDifference: 12,
    allowDecrease: false,
  },
  american_football: {
    maxScore: 70,
    maxDifference: 60,
    allowDecrease: false,
  },
  baseball: {
    maxScore: 30,
    maxDifference: 25,
    allowDecrease: false,
  },
  rugby: {
    maxScore: 80,
    maxDifference: 60,
    allowDecrease: false,
  },
  handball: {
    maxScore: 50,
    maxDifference: 30,
    allowDecrease: false,
  },
  cricket: {
    maxScore: 500, // First innings can be high
    maxDifference: 400,
    allowDecrease: false,
  },
};

// Default limits for unknown sports
const DEFAULT_LIMITS: SportScoreLimits = {
  maxScore: 100,
  maxDifference: 50,
  allowDecrease: false,
};

/**
 * Get score limits for a sport
 */
function getSportLimits(sportSlug: string): SportScoreLimits {
  const normalized = sportSlug.toLowerCase().replace(/[^a-z]/g, '_');
  return SPORT_LIMITS[normalized] || DEFAULT_LIMITS;
}

/**
 * Validate a score update
 */
export function validateScoreUpdate(
  sportSlug: string,
  homeScore: number | null,
  awayScore: number | null,
  previousHomeScore: number | null,
  previousAwayScore: number | null,
  period?: string
): ScoreValidationResult {
  const reasons: string[] = [];
  let shouldFlag = false;
  const limits = getSportLimits(sportSlug);

  // Check for null scores (valid - game may not have started)
  if (homeScore === null || awayScore === null) {
    return { isValid: true, reasons: [], shouldFlag: false };
  }

  // Check 1: Negative scores
  if (homeScore < 0) {
    reasons.push(`Negative home score: ${homeScore}`);
    shouldFlag = true;
  }
  if (awayScore < 0) {
    reasons.push(`Negative away score: ${awayScore}`);
    shouldFlag = true;
  }

  // Check 2: Scores exceeding sport limits
  if (homeScore > limits.maxScore) {
    reasons.push(`Home score exceeds limit for ${sportSlug}: ${homeScore} > ${limits.maxScore}`);
    shouldFlag = true;
  }
  if (awayScore > limits.maxScore) {
    reasons.push(`Away score exceeds limit for ${sportSlug}: ${awayScore} > ${limits.maxScore}`);
    shouldFlag = true;
  }

  // Check 3: Score difference too large
  const scoreDiff = Math.abs(homeScore - awayScore);
  if (scoreDiff > limits.maxDifference) {
    reasons.push(`Score difference exceeds limit for ${sportSlug}: ${scoreDiff} > ${limits.maxDifference}`);
    shouldFlag = true;
  }

  // Check 4: Score decreased (unless sport allows it)
  if (!limits.allowDecrease && previousHomeScore !== null && previousAwayScore !== null) {
    if (homeScore < previousHomeScore) {
      reasons.push(`Home score decreased: ${previousHomeScore} -> ${homeScore}`);
      shouldFlag = true;
    }
    if (awayScore < previousAwayScore) {
      reasons.push(`Away score decreased: ${previousAwayScore} -> ${awayScore}`);
      shouldFlag = true;
    }
  }

  // Check 5: Large jump in score (potentially missed updates or error)
  if (previousHomeScore !== null && previousAwayScore !== null) {
    const homeJump = homeScore - previousHomeScore;
    const awayJump = awayScore - previousAwayScore;

    // More than 5 points/goals in a single update is suspicious (except basketball)
    const maxJump = sportSlug === 'basketball' ? 20 : 5;

    if (homeJump > maxJump) {
      reasons.push(`Large home score jump: +${homeJump} in single update`);
      // Don't flag, just warn - could be catch-up after missed updates
    }
    if (awayJump > maxJump) {
      reasons.push(`Large away score jump: +${awayJump} in single update`);
    }
  }

  return {
    isValid: reasons.filter(r => r.includes('exceeds') || r.includes('Negative') || r.includes('decreased')).length === 0,
    reasons,
    shouldFlag,
  };
}

/**
 * Record score in history for audit trail
 */
export async function recordScoreHistory(
  eventId: string,
  homeScore: number | null,
  awayScore: number | null,
  period: string | null,
  minute: number | null,
  source: string
): Promise<void> {
  const db = getDb();

  try {
    await db.insert(eventScoreHistory).values({
      eventId,
      homeScore,
      awayScore,
      period,
      minute,
      source,
    });
  } catch (error) {
    logger.error('Failed to record score history', { eventId, error });
  }
}

/**
 * Get the most recent score from history
 */
export async function getLatestScoreFromHistory(
  eventId: string
): Promise<{ homeScore: number | null; awayScore: number | null; scrapedAt: Date } | null> {
  const db = getDb();

  try {
    const [latest] = await db
      .select({
        homeScore: eventScoreHistory.homeScore,
        awayScore: eventScoreHistory.awayScore,
        scrapedAt: eventScoreHistory.scrapedAt,
      })
      .from(eventScoreHistory)
      .where(eq(eventScoreHistory.eventId, eventId))
      .orderBy(desc(eventScoreHistory.scrapedAt))
      .limit(1);

    return latest || null;
  } catch (error) {
    logger.error('Failed to get latest score from history', { eventId, error });
    return null;
  }
}

/**
 * Check if score has been stable (no changes recently)
 * Used for settlement safety checks
 */
export async function isScoreStable(
  eventId: string,
  stableForMinutes: number = 5
): Promise<{ stable: boolean; changeCount: number }> {
  const db = getDb();
  const cutoffTime = new Date(Date.now() - stableForMinutes * 60 * 1000);

  try {
    const recentScores = await db
      .select({
        homeScore: eventScoreHistory.homeScore,
        awayScore: eventScoreHistory.awayScore,
        scrapedAt: eventScoreHistory.scrapedAt,
      })
      .from(eventScoreHistory)
      .where(eq(eventScoreHistory.eventId, eventId))
      .orderBy(desc(eventScoreHistory.scrapedAt))
      .limit(10);

    if (recentScores.length < 2) {
      return { stable: true, changeCount: 0 };
    }

    // Count score changes in the time window
    let changeCount = 0;
    const scoresInWindow = recentScores.filter(s => s.scrapedAt >= cutoffTime);

    for (let i = 1; i < scoresInWindow.length; i++) {
      const current = scoresInWindow[i - 1];
      const previous = scoresInWindow[i];

      if (
        current.homeScore !== previous.homeScore ||
        current.awayScore !== previous.awayScore
      ) {
        changeCount++;
      }
    }

    return {
      stable: changeCount === 0,
      changeCount,
    };
  } catch (error) {
    logger.error('Failed to check score stability', { eventId, error });
    return { stable: true, changeCount: 0 }; // Assume stable on error
  }
}

/**
 * Flag event for score anomalies
 */
export async function flagEventForScoreAnomaly(
  eventId: string,
  reasons: string[]
): Promise<void> {
  const db = getDb();

  try {
    await db
      .update(events)
      .set({
        isFlagged: true,
        flagReason: `[SCORE] ${reasons.join('; ')}`,
        flaggedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    logger.warn('Event flagged for score anomaly', { eventId, reasons });
  } catch (error) {
    logger.error('Failed to flag event for score anomaly', { eventId, error });
  }
}

/**
 * Validate and process a score update
 * Records history and flags if anomalous
 */
export async function validateAndProcessScore(
  eventId: string,
  sportSlug: string,
  homeScore: number | null,
  awayScore: number | null,
  period: string | null,
  minute: number | null,
  source: string
): Promise<{ valid: boolean; flagged: boolean }> {
  // Get previous score from history
  const previousScore = await getLatestScoreFromHistory(eventId);

  // Validate the new score
  const validationResult = validateScoreUpdate(
    sportSlug,
    homeScore,
    awayScore,
    previousScore?.homeScore ?? null,
    previousScore?.awayScore ?? null,
    period ?? undefined
  );

  // Always record to history (even if invalid - for audit trail)
  await recordScoreHistory(eventId, homeScore, awayScore, period, minute, source);

  // Flag event if validation failed
  if (validationResult.shouldFlag) {
    await flagEventForScoreAnomaly(eventId, validationResult.reasons);
    return { valid: validationResult.isValid, flagged: true };
  }

  return { valid: true, flagged: false };
}
