/**
 * Odds Source Manager
 *
 * Manages multiple odds scraping sources with intelligent rotation.
 * Features:
 * - Cooldown tracking per source
 * - Failure tracking with backoff
 * - Priority-based selection
 * - Round-robin distribution to avoid detection
 */

import type { Page } from 'playwright';
import type { OddsSource, NormalizedOdds, SourceUsage, OddsSourceResult } from './types.js';
import { oddsPortalSource } from './oddsportal.js';
import { bmBetsSource } from './bmbets.js';
import { nicerOddsSource } from './nicerodds.js';
import { oddScannerSource } from './oddscanner.js';
import { createJobLogger } from '../logger.js';
import { getRateLimitDetector } from '../rate-limit/detector.js';

const logger = createJobLogger('odds-sources');

// All available sources
export const allSources: OddsSource[] = [
  oddsPortalSource,
  bmBetsSource,
  oddScannerSource,
  nicerOddsSource,
];

// Track source usage
const sourceUsage: Map<string, SourceUsage> = new Map();

// Initialize usage tracking
for (const source of allSources) {
  sourceUsage.set(source.config.name, {
    lastUsed: null,
    successCount: 0,
    failureCount: 0,
    consecutiveFailures: 0,
    lastError: undefined,
  });
}

/**
 * Get enabled sources sorted by priority
 */
export function getEnabledSources(): OddsSource[] {
  return allSources
    .filter((s) => s.config.enabled)
    .sort((a, b) => a.config.priority - b.config.priority);
}

/**
 * Check if a source is on cooldown
 */
function isOnCooldown(source: OddsSource): boolean {
  const usage = sourceUsage.get(source.config.name);
  if (!usage || !usage.lastUsed) return false;

  const cooldownMs = source.config.cooldownMinutes * 60 * 1000;
  const elapsed = Date.now() - usage.lastUsed.getTime();

  // Add extra cooldown for consecutive failures (exponential backoff)
  const backoffMultiplier = Math.pow(2, Math.min(usage.consecutiveFailures, 4)); // Max 16x
  const adjustedCooldown = cooldownMs * backoffMultiplier;

  return elapsed < adjustedCooldown;
}

/**
 * Get the next available source (not on cooldown, lowest priority number = highest priority)
 */
export function getNextAvailableSource(): OddsSource | null {
  const enabled = getEnabledSources();

  for (const source of enabled) {
    if (!isOnCooldown(source)) {
      return source;
    }
  }

  return null;
}

/**
 * Get the best source considering:
 * 1. Not on cooldown
 * 2. Fewest consecutive failures
 * 3. Highest success rate
 * 4. Priority
 */
export function getBestSource(): OddsSource | null {
  const enabled = getEnabledSources();
  const available = enabled.filter((s) => !isOnCooldown(s));

  if (available.length === 0) {
    // All on cooldown - return the one with shortest remaining cooldown
    const soonestAvailable = enabled
      .map((s) => {
        const usage = sourceUsage.get(s.config.name)!;
        const cooldownMs = s.config.cooldownMinutes * 60 * 1000;
        const elapsed = usage.lastUsed ? Date.now() - usage.lastUsed.getTime() : cooldownMs;
        const remaining = Math.max(0, cooldownMs - elapsed);
        return { source: s, remaining };
      })
      .sort((a, b) => a.remaining - b.remaining)[0];

    if (soonestAvailable && soonestAvailable.remaining < 10 * 60 * 1000) {
      // Less than 10 minutes - return it anyway
      return soonestAvailable.source;
    }

    return null;
  }

  // Score sources
  const scored = available.map((s) => {
    const usage = sourceUsage.get(s.config.name)!;
    const total = usage.successCount + usage.failureCount;
    const successRate = total > 0 ? usage.successCount / total : 0.5; // Default to 50% for new sources

    // Score: higher is better
    // Penalize consecutive failures heavily, reward success rate, consider priority
    const score =
      successRate * 10 -
      usage.consecutiveFailures * 5 +
      (10 - s.config.priority); // Priority 1 gets +9, priority 10 gets 0

    return { source: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.source || null;
}

/**
 * Record successful scrape
 */
export function recordSuccess(sourceName: string): void {
  const usage = sourceUsage.get(sourceName);
  if (usage) {
    usage.lastUsed = new Date();
    usage.successCount++;
    usage.consecutiveFailures = 0;
    usage.lastError = undefined;
  }

  getRateLimitDetector().recordSuccess(getSourceDomain(sourceName));
  logger.info(`Source ${sourceName} succeeded (total: ${usage?.successCount})`);
}

/**
 * Record failed scrape
 */
export function recordFailure(sourceName: string, error: string): void {
  const usage = sourceUsage.get(sourceName);
  if (usage) {
    usage.lastUsed = new Date();
    usage.failureCount++;
    usage.consecutiveFailures++;
    usage.lastError = error;
  }

  getRateLimitDetector().recordFailure(getSourceDomain(sourceName));
  logger.warn(`Source ${sourceName} failed (consecutive: ${usage?.consecutiveFailures})`, { error });
}

/**
 * Get domain for a source
 */
function getSourceDomain(sourceName: string): string {
  const source = allSources.find((s) => s.config.name === sourceName);
  return source?.config.domain || sourceName;
}

/**
 * Get source by name
 */
export function getSource(name: string): OddsSource | undefined {
  return allSources.find((s) => s.config.name === name);
}

/**
 * Scrape from multiple sources with rotation
 *
 * @param page - Playwright page
 * @param sportSlug - Sport to scrape
 * @param maxSources - Maximum sources to try (default 2)
 * @returns Combined odds from all successful sources
 */
export async function scrapeWithRotation(
  page: Page,
  sportSlug: string,
  maxSources: number = 2
): Promise<OddsSourceResult[]> {
  const results: OddsSourceResult[] = [];
  const triedSources = new Set<string>();

  for (let i = 0; i < maxSources; i++) {
    // Get best available source that we haven't tried
    const available = getEnabledSources().filter(
      (s) => !triedSources.has(s.config.name) && !isOnCooldown(s)
    );

    if (available.length === 0) break;

    // Score and pick best
    const source = available[0]!;
    triedSources.add(source.config.name);

    const startTime = Date.now();
    logger.info(`Trying source: ${source.config.name} for ${sportSlug}`);

    try {
      const odds = await source.scrape(page, sportSlug);
      const duration = Date.now() - startTime;

      if (odds.length > 0) {
        recordSuccess(source.config.name);
        results.push({
          source: source.config.name,
          odds,
          success: true,
          duration,
        });
        logger.info(`${source.config.name}: Got ${odds.length} odds for ${sportSlug}`);

        // If we got good results, we can stop
        if (odds.length >= 10) break;
      } else {
        recordFailure(source.config.name, 'No odds returned');
        results.push({
          source: source.config.name,
          odds: [],
          success: false,
          error: 'No odds returned',
          duration,
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      recordFailure(source.config.name, errorMessage);
      results.push({
        source: source.config.name,
        odds: [],
        success: false,
        error: errorMessage,
        duration,
      });
    }
  }

  return results;
}

/**
 * Get status of all sources
 */
export function getSourcesStatus(): Record<string, {
  enabled: boolean;
  priority: number;
  onCooldown: boolean;
  cooldownRemaining?: number;
  usage: SourceUsage;
}> {
  const status: Record<string, any> = {};

  for (const source of allSources) {
    const usage = sourceUsage.get(source.config.name)!;
    const onCooldown = isOnCooldown(source);

    let cooldownRemaining: number | undefined;
    if (onCooldown && usage.lastUsed) {
      const cooldownMs = source.config.cooldownMinutes * 60 * 1000;
      const backoffMultiplier = Math.pow(2, Math.min(usage.consecutiveFailures, 4));
      const adjustedCooldown = cooldownMs * backoffMultiplier;
      const elapsed = Date.now() - usage.lastUsed.getTime();
      cooldownRemaining = Math.max(0, adjustedCooldown - elapsed);
    }

    status[source.config.name] = {
      enabled: source.config.enabled,
      priority: source.config.priority,
      onCooldown,
      cooldownRemaining,
      usage: { ...usage },
    };
  }

  return status;
}

export { NormalizedOdds, OddsSourceResult } from './types.js';
export {
  normalizeTeamName,
  stringSimilarity,
  isSameMatch,
  validateOdds,
  mergeOdds,
  getSourcePriorities,
  SPORT_MARKET_TYPES,
} from './utils.js';
