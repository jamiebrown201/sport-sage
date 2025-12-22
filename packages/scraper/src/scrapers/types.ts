/**
 * Shared types for all live score scrapers
 *
 * The new interface is source-agnostic - scrapers receive database events
 * and match them by team names, not source-specific IDs.
 */

export interface LiveScore {
  eventId: string; // Our database event ID
  homeScore: number;
  awayScore: number;
  period: string;
  minute?: number;
  isFinished: boolean;
}

/**
 * Event from our database that we want to find scores for
 */
export interface EventToMatch {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  startTime: Date;
  sportSlug: string; // 'football', 'basketball', etc.
}

/**
 * Result of scraping - includes matched scores and unmatched scraped events
 */
export interface ScrapeResult {
  scores: Map<string, LiveScore>;
  unmatchedCount: number; // How many scraped events couldn't be matched
  matchedCount: number;
}

/**
 * Interface all live score scrapers must implement
 *
 * Scrapers fetch all live events from their source, then match them
 * to our database events by team names.
 */
export interface LiveScoresScraper {
  /**
   * Get live scores for the given events
   *
   * @param events Events from our database to find scores for
   * @returns Map of event ID -> live score data
   */
  getLiveScores(events: EventToMatch[]): Promise<ScrapeResult>;
}
