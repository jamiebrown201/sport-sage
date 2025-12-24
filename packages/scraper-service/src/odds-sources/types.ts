/**
 * Odds Source Types
 *
 * Common interfaces for all odds scraping sources.
 */

import type { Page } from 'playwright';

export interface NormalizedOdds {
  homeTeam: string;
  awayTeam: string;
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  source: string;
  bookmakerCount?: number;
  scrapedAt: Date;
}

export interface OddsSourceConfig {
  name: string;
  domain: string;
  enabled: boolean;
  priority: number; // Lower = higher priority
  cooldownMinutes: number; // Minimum time between scrapes of this source
  sportUrls: Record<string, string[]>;
}

export interface OddsSourceResult {
  source: string;
  odds: NormalizedOdds[];
  success: boolean;
  error?: string;
  duration: number;
}

export interface OddsSource {
  config: OddsSourceConfig;
  scrape(page: Page, sportSlug: string): Promise<NormalizedOdds[]>;
}

export interface SourceUsage {
  lastUsed: Date | null;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  lastError?: string;
}

// Track performance per sport
export interface SportSourceStats {
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  lastSuccess: Date | null;
  lastFailure: Date | null;
}

/**
 * Custom error for when a source explicitly shows "no data available"
 * This is NOT a failure - the site works, just no matches scheduled.
 * Examples: "No upcoming matches", "Odds will appear when available", etc.
 */
export class NoDataAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoDataAvailableError';
  }
}

/**
 * Common patterns that indicate "no data" (not a failure)
 */
export const NO_DATA_PATTERNS = [
  /no\s+(?:upcoming|scheduled|available)\s+(?:matches|events|games)/i,
  /odds\s+will\s+(?:appear|feature|be\s+available)/i,
  /(?:betting\s+)?odds\s+(?:for|on)\s+.+\s+will\s+feature\s+here/i,
  /no\s+(?:events|matches)\s+(?:found|available)/i,
  /currently\s+no\s+(?:odds|matches|events)/i,
  /check\s+back\s+(?:later|soon)/i,
  /no\s+(?:live|upcoming)\s+(?:events|matches)/i,
];

/**
 * Custom error for when a source blocks us (Cloudflare, captcha, etc.)
 * This IS a failure - the site is blocking our scraper.
 */
export class BotBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotBlockedError';
  }
}

/**
 * Patterns that indicate the site is blocking us (real failure)
 */
export const BOT_BLOCKED_PATTERNS = [
  /enable\s+javascript\s+and\s+cookies\s+to\s+continue/i,
  /challenge-error-text/i,
  /cf[-_]?chl[-_]?/i, // Cloudflare challenge
  /captcha/i,
  /access\s+denied/i,
  /please\s+verify\s+you\s+are\s+(?:a\s+)?human/i,
  /bot\s+(?:detected|protection)/i,
  /unusual\s+traffic/i,
  /automated\s+access/i,
  /rate\s+limit(?:ed)?/i,
  /too\s+many\s+requests/i,
  /blocked/i,
  /forbidden/i,
];
