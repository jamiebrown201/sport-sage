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
