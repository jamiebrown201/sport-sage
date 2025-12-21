import type { Page } from 'playwright-core';

/**
 * Common fixture format across all scrapers
 */
export interface ScrapedFixture {
  externalId: string;
  sportSlug: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  source: string; // 'flashscore', 'sofascore', etc.
}

/**
 * Scraper result with metadata
 */
export interface ScraperResult {
  fixtures: ScrapedFixture[];
  source: string;
  success: boolean;
  duration: number;
  error?: string;
}

/**
 * Base interface for all fixture scrapers
 */
export interface FixturesScraper {
  readonly source: string;
  readonly priority: number; // Lower = higher priority

  /**
   * Get upcoming fixtures for a sport
   */
  getUpcomingFixtures(sportSlug: string, days: number): Promise<ScrapedFixture[]>;

  /**
   * Check if this scraper supports a given sport
   */
  supportsSport(sportSlug: string): boolean;
}

/**
 * Abstract base class with common functionality
 */
export abstract class BaseFixturesScraper implements FixturesScraper {
  abstract readonly source: string;
  abstract readonly priority: number;
  protected abstract readonly sportUrls: Record<string, string>;

  constructor(protected page: Page) {}

  abstract getUpcomingFixtures(sportSlug: string, days: number): Promise<ScrapedFixture[]>;

  supportsSport(sportSlug: string): boolean {
    return sportSlug in this.sportUrls;
  }

  /**
   * Get CET/CEST offset in milliseconds for timezone handling
   */
  protected getCETOffset(date: Date): number {
    const year = date.getUTCFullYear();

    // Find last Sunday of March (DST starts)
    const marchLast = new Date(Date.UTC(year, 2, 31));
    const dstStart = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay(), 1, 0));

    // Find last Sunday of October (DST ends)
    const octLast = new Date(Date.UTC(year, 9, 31));
    const dstEnd = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay(), 1, 0));

    // CEST (summer) = UTC+2, CET (winter) = UTC+1
    if (date >= dstStart && date < dstEnd) {
      return 2 * 60 * 60 * 1000;
    }
    return 1 * 60 * 60 * 1000;
  }
}
