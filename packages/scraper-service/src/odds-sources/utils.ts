/**
 * Odds Source Utilities
 *
 * Common utilities for normalizing, validating, and deduplicating odds data.
 */

import type { NormalizedOdds } from './types.js';
import { createJobLogger } from '../logger.js';

const logger = createJobLogger('odds-utils');

/**
 * Market types by sport
 * - Football: 3-way (1X2) - home win, draw, away win
 * - Basketball/Tennis: 2-way (moneyline) - home win, away win
 */
export const SPORT_MARKET_TYPES: Record<string, '2way' | '3way'> = {
  football: '3way',
  soccer: '3way',
  basketball: '2way',
  tennis: '2way',
  baseball: '2way',
  hockey: '2way', // Can be 3-way in some markets
  american_football: '2way',
};

/**
 * Normalize team name for consistent matching across sources
 * Handles common variations: FC, United, City, punctuation, etc.
 */
export function normalizeTeamName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    // Remove common suffixes/prefixes
    .replace(/\b(fc|sc|cf|afc|rfc|ac|as|ss|us|cd|ud|sd|rc|real|atletico|athletic|dynamo)\b/gi, '')
    // Normalize common abbreviations
    .replace(/\bunited\b/gi, 'utd')
    .replace(/\bcity\b/gi, '')
    .replace(/\btown\b/gi, '')
    .replace(/\bwanderers\b/gi, '')
    .replace(/\brovers\b/gi, '')
    .replace(/\balbion\b/gi, '')
    .replace(/\bargyle\b/gi, '')
    .replace(/\bforest\b/gi, '')
    .replace(/\bhotspur\b/gi, '')
    .replace(/\binter\b/gi, '')
    // Remove punctuation and extra whitespace
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate string similarity using Levenshtein distance
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Check if two matches are the same (fuzzy matching)
 */
export function isSameMatch(a: NormalizedOdds, b: NormalizedOdds, threshold = 0.75): boolean {
  const aHome = normalizeTeamName(a.homeTeam);
  const aAway = normalizeTeamName(a.awayTeam);
  const bHome = normalizeTeamName(b.homeTeam);
  const bAway = normalizeTeamName(b.awayTeam);

  // Check direct match
  const homeSim = stringSimilarity(aHome, bHome);
  const awaySim = stringSimilarity(aAway, bAway);

  if (homeSim >= threshold && awaySim >= threshold) {
    return true;
  }

  // Check reversed (in case home/away are swapped between sources)
  const homeRevSim = stringSimilarity(aHome, bAway);
  const awayRevSim = stringSimilarity(aAway, bHome);

  return homeRevSim >= threshold && awayRevSim >= threshold;
}

/**
 * Validate odds data
 * Returns null if invalid, or the validated odds if valid
 */
export function validateOdds(odds: NormalizedOdds, sportSlug: string): NormalizedOdds | null {
  // Check team names
  if (!odds.homeTeam || !odds.awayTeam) {
    logger.debug('Invalid odds: missing team names');
    return null;
  }

  if (odds.homeTeam.length < 2 || odds.awayTeam.length < 2) {
    logger.debug('Invalid odds: team names too short');
    return null;
  }

  if (odds.homeTeam.length > 100 || odds.awayTeam.length > 100) {
    logger.debug('Invalid odds: team names too long');
    return null;
  }

  // Check odds values
  const marketType = SPORT_MARKET_TYPES[sportSlug] || '3way';

  if (odds.homeWin === undefined || odds.awayWin === undefined) {
    logger.debug('Invalid odds: missing home/away odds');
    return null;
  }

  // Validate odds are in reasonable range (1.01 to 1000)
  if (odds.homeWin < 1.01 || odds.homeWin > 1000) {
    logger.debug('Invalid odds: home odds out of range', { homeWin: odds.homeWin });
    return null;
  }

  if (odds.awayWin < 1.01 || odds.awayWin > 1000) {
    logger.debug('Invalid odds: away odds out of range', { awayWin: odds.awayWin });
    return null;
  }

  // For 3-way markets (football), validate draw odds if present
  if (marketType === '3way') {
    if (odds.draw !== undefined && (odds.draw < 1.01 || odds.draw > 1000)) {
      logger.debug('Invalid odds: draw odds out of range', { draw: odds.draw });
      return null;
    }
  }

  // Validate implied probability isn't > 150% (accounting for margin)
  const impliedProb = (1 / odds.homeWin) + (1 / odds.awayWin) + (odds.draw ? 1 / odds.draw : 0);
  if (impliedProb > 1.5) {
    logger.debug('Invalid odds: implied probability too high', { impliedProb });
    return null;
  }

  // Validate implied probability isn't < 90% (suspicious)
  if (impliedProb < 0.9) {
    logger.debug('Invalid odds: implied probability too low', { impliedProb });
    return null;
  }

  return odds;
}

/**
 * Merge and deduplicate odds from multiple sources
 * Higher priority sources take precedence for duplicate matches
 */
export function mergeOdds(
  allOdds: NormalizedOdds[],
  sportSlug: string,
  sourcePriorities: Record<string, number> = {}
): NormalizedOdds[] {
  const merged: NormalizedOdds[] = [];

  // Sort by source priority (lower number = higher priority)
  const sorted = [...allOdds].sort((a, b) => {
    const aPriority = sourcePriorities[a.source] ?? 10;
    const bPriority = sourcePriorities[b.source] ?? 10;
    return aPriority - bPriority;
  });

  for (const odds of sorted) {
    // Validate first
    const validated = validateOdds(odds, sportSlug);
    if (!validated) continue;

    // Check for duplicates
    const existingIndex = merged.findIndex((existing) => isSameMatch(existing, validated));

    if (existingIndex === -1) {
      // No duplicate, add it
      merged.push(validated);
    } else {
      // Duplicate found - keep the one from higher priority source
      const existing = merged[existingIndex]!;
      const existingPriority = sourcePriorities[existing.source] ?? 10;
      const newPriority = sourcePriorities[validated.source] ?? 10;

      if (newPriority < existingPriority) {
        // New one has higher priority, replace
        merged[existingIndex] = validated;
        logger.debug('Replaced duplicate with higher priority source', {
          match: `${validated.homeTeam} vs ${validated.awayTeam}`,
          oldSource: existing.source,
          newSource: validated.source,
        });
      } else if (newPriority === existingPriority) {
        // Same priority - merge odds (take best odds for each outcome)
        merged[existingIndex] = {
          ...existing,
          homeWin: Math.max(existing.homeWin ?? 0, validated.homeWin ?? 0),
          draw: existing.draw !== undefined || validated.draw !== undefined
            ? Math.max(existing.draw ?? 0, validated.draw ?? 0) || undefined
            : undefined,
          awayWin: Math.max(existing.awayWin ?? 0, validated.awayWin ?? 0),
          bookmakerCount: (existing.bookmakerCount ?? 1) + (validated.bookmakerCount ?? 1),
        };
        logger.debug('Merged odds from same priority sources', {
          match: `${validated.homeTeam} vs ${validated.awayTeam}`,
          sources: [existing.source, validated.source],
        });
      }
      // If new has lower priority, just skip it
    }
  }

  logger.info(`Merged ${allOdds.length} odds into ${merged.length} unique matches for ${sportSlug}`);
  return merged;
}

/**
 * Get source priorities from config
 */
export function getSourcePriorities(): Record<string, number> {
  return {
    oddsportal: 1,
    bmbets: 2,
    oddscanner: 2,
    nicerodds: 3,
    'the-odds-api': 4,
  };
}
