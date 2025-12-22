import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay } from '../../utils/browser';
import { matchEvents, type ScrapedEvent } from '../../utils/team-matcher';
import type { LiveScoresScraper, EventToMatch, ScrapeResult, LiveScore } from '../types';

/**
 * Flashscore live scores scraper
 *
 * Requires residential proxy to access from AWS IPs.
 * Matches events by team names, not source-specific IDs.
 */
export class FlashscoreLiveScoresScraper implements LiveScoresScraper {
  constructor(private page: Page) {}

  async getLiveScores(events: EventToMatch[]): Promise<ScrapeResult> {
    const scores = new Map<string, LiveScore>();

    if (events.length === 0) {
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }

    logger.info(`Flashscore: Looking for scores for ${events.length} events`);

    try {
      // Navigate to live scores page
      // Use 'load' instead of 'networkidle' as proxy connections can be slow
      // Flashscore is JS-heavy but initial content loads quickly
      logger.debug('Flashscore: Starting navigation...');

      await this.page.goto('https://www.flashscore.com/', {
        waitUntil: 'load',
        timeout: 45000, // Longer timeout for proxy connections
      });

      logger.debug('Flashscore: Page loaded, waiting for content...');

      // Random delay to appear more human-like
      await randomDelay(1500, 2500);

      // Wait for match containers to load (Flashscore uses divs with event__ prefix)
      // Try multiple possible selectors as they change their structure
      const matchSelector = '.event__match, [class*="event__match"], .sportName, [class*="sportName"]';

      logger.debug('Flashscore: Waiting for match elements...');
      await this.page.waitForSelector(matchSelector, { timeout: 20000 }).catch(() => {
        logger.warn('Flashscore: Timeout waiting for match elements');
      });

      // Extra wait for JS to fully render
      await randomDelay(2000, 3000);

      // Debug: log what we can see on the page
      const pageContent = await this.page.content();
      const hasEventMatch = pageContent.includes('event__match');
      const hasSportName = pageContent.includes('sportName');
      const pageTitle = await this.page.title();
      const bodyLength = pageContent.length;

      logger.info(`Flashscore: Page loaded - title: "${pageTitle}", body: ${bodyLength} chars, event__match: ${hasEventMatch}, sportName: ${hasSportName}`);

      // Get all matches - try multiple selector patterns
      let allMatches = await this.page.$$('.event__match');
      logger.info(`Flashscore: selector '.event__match' found ${allMatches.length} elements`);

      if (allMatches.length === 0) {
        // Try alternative selectors
        allMatches = await this.page.$$('[class*="event__match"]');
        logger.info(`Flashscore: selector '[class*="event__match"]' found ${allMatches.length} elements`);
      }

      if (allMatches.length === 0) {
        // Try even broader selector
        allMatches = await this.page.$$('div[id^="g_1_"]');
        logger.info(`Flashscore: selector 'div[id^="g_1_"]' found ${allMatches.length} elements`);
      }

      if (allMatches.length === 0) {
        // Try to find ANY divs to understand the page structure
        const allDivs = await this.page.$$('div');
        logger.info(`Flashscore: Total divs on page: ${allDivs.length}`);

        // Check for common Flashscore patterns
        const sportNameElements = await this.page.$$('.sportName');
        logger.info(`Flashscore: '.sportName' found ${sportNameElements.length} elements`);

        // Check if blocked
        const blockedContent = pageContent.includes('blocked') ||
          pageContent.includes('captcha') ||
          pageContent.includes('challenge');
        logger.warn(`Flashscore: No matches found. Possible blocking: ${blockedContent}`);

        return { scores, unmatchedCount: 0, matchedCount: 0 };
      }

      logger.info(`Flashscore: Found ${allMatches.length} match elements to parse`);

      // Parse all matches into ScrapedEvent format
      const scrapedEvents: ScrapedEvent[] = [];
      let parseFailed = 0;

      for (const match of allMatches) {
        try {
          const scraped = await this.parseMatch(match);
          if (scraped) {
            scrapedEvents.push(scraped);
          } else {
            parseFailed++;
          }
        } catch (error) {
          parseFailed++;
          logger.debug('Flashscore: Failed to parse match', { error });
        }
      }

      logger.info(`Flashscore: Parsed ${scrapedEvents.length} events successfully, ${parseFailed} failed to parse`);

      // Log sample of parsed events
      if (scrapedEvents.length > 0) {
        const sample = scrapedEvents.slice(0, 3).map(e => `${e.homeTeam} vs ${e.awayTeam}`);
        logger.info(`Flashscore: Sample events: ${sample.join(', ')}`);
      }

      // Convert our events to DatabaseEvent format for matching
      const dbEvents = events.map(e => ({
        id: e.id,
        homeTeamName: e.homeTeamName,
        awayTeamName: e.awayTeamName,
        startTime: e.startTime,
      }));

      // Match by team names
      const matches = matchEvents(scrapedEvents, dbEvents, {
        threshold: 0.7,
        requireBothTeams: true,
        timeWindowMs: 12 * 60 * 60 * 1000,
      });

      // Convert matches to LiveScore format
      for (const match of matches) {
        const scraped = match.scrapedEvent;
        scores.set(match.dbEvent.id, {
          eventId: match.dbEvent.id,
          homeScore: scraped.homeScore ?? 0,
          awayScore: scraped.awayScore ?? 0,
          period: scraped.period || 'LIVE',
          minute: scraped.minute,
          isFinished: scraped.isFinished ?? false,
        });

        logger.debug(`Flashscore: Matched "${scraped.homeTeam} vs ${scraped.awayTeam}" ` +
          `to "${match.dbEvent.homeTeamName} vs ${match.dbEvent.awayTeamName}" ` +
          `(confidence: ${match.confidence.toFixed(2)})`);
      }

      const unmatchedCount = scrapedEvents.length - matches.length;
      logger.info(`Flashscore: Matched ${matches.length} events, ${unmatchedCount} unmatched`);

      return { scores, matchedCount: matches.length, unmatchedCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Flashscore live scores failed', {
        error: errorMessage,
        stack: errorStack,
        url: this.page.url(),
      });
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }
  }

  private async parseMatch(element: any): Promise<ScrapedEvent | null> {
    try {
      // Flashscore uses heavily obfuscated CSS classes (wcl-XXX_randomHash)
      // Instead of relying on classes, we use DOM structure and text patterns
      const matchData = await element.evaluate((el: Element) => {
        // Strategy: Extract ALL text from the element and parse it structurally
        // Flashscore structure is roughly:
        // [Time/Status] [Home Team] [Score] - [Score] [Away Team]

        // Method 1: Look for links to team pages (most reliable)
        const teamLinks = el.querySelectorAll('a[href*="/team/"]');
        const teamNames: string[] = [];

        teamLinks.forEach((link) => {
          // Get the deepest text content (usually in a span)
          const textEl = link.querySelector('span') || link;
          const text = textEl.textContent?.trim();
          // Filter out scores and empty strings
          if (text && text.length > 1 && text.length < 60 && !/^[\d\-:]+$/.test(text)) {
            teamNames.push(text);
          }
        });

        // Method 2: If no team links, look for participant divs by structure
        if (teamNames.length < 2) {
          // Find divs that look like participant containers
          const allDivs = el.querySelectorAll('div');
          allDivs.forEach((div) => {
            const className = div.className || '';
            // Look for participant-related classes (obfuscated but contain patterns)
            if (className.includes('participant') || className.includes('Participant')) {
              const spans = div.querySelectorAll('span');
              spans.forEach((span) => {
                const text = span.textContent?.trim();
                if (text && text.length > 1 && text.length < 60 && !/^[\d\-:]+$/.test(text)) {
                  if (!teamNames.includes(text)) {
                    teamNames.push(text);
                  }
                }
              });
            }
          });
        }

        // Method 3: Look for score elements and extract adjacent team names
        const scoreElements: string[] = [];
        const allSpans = el.querySelectorAll('span');
        allSpans.forEach((span) => {
          const text = span.textContent?.trim();
          // Scores are typically 1-3 digit numbers
          if (text && /^\d{1,3}$/.test(text)) {
            scoreElements.push(text);
          }
        });

        // Extract status/period text
        let statusText = '';
        // Look for time/status elements (usually contain ', HT, FT, etc.)
        allSpans.forEach((span) => {
          const text = span.textContent?.trim() || '';
          const className = span.className || '';
          if (
            className.includes('stage') ||
            className.includes('Stage') ||
            className.includes('time') ||
            className.includes('Time') ||
            text.includes("'") ||
            /^(HT|FT|ET|PEN|1H|2H|Live)$/i.test(text) ||
            /^\d+['′]$/.test(text)
          ) {
            if (text.length < 20) {
              statusText = text;
            }
          }
        });

        // Check for "Finished" status
        const isFinished =
          el.textContent?.toLowerCase().includes('finished') ||
          el.textContent?.toLowerCase().includes('ft') ||
          el.className?.includes('finished');

        // Get element ID for debugging
        const id = el.getAttribute('id') || '';

        return {
          teamNames: teamNames.slice(0, 2),
          scores: scoreElements.slice(0, 2),
          statusText,
          isFinished: !!isFinished,
          id,
          // Debug: include raw text for troubleshooting
          rawText: el.textContent?.substring(0, 200) || '',
        };
      }).catch(() => null);

      if (!matchData) return null;

      // Need at least 2 team names
      if (matchData.teamNames.length < 2) {
        // Log first failure for debugging
        if (this.parseFailCount === 0) {
          logger.debug('Flashscore parse failed - raw text sample:', {
            rawText: matchData.rawText,
            teamNames: matchData.teamNames,
            id: matchData.id,
          });
        }
        this.parseFailCount++;
        return null;
      }

      const homeTeam = matchData.teamNames[0];
      const awayTeam = matchData.teamNames[1];
      const homeScore = matchData.scores[0] ? parseInt(matchData.scores[0]) : 0;
      const awayScore = matchData.scores[1] ? parseInt(matchData.scores[1]) : 0;

      const period = this.parsePeriod(matchData.statusText);
      const minute = this.parseMinute(matchData.statusText);

      return {
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        period,
        minute,
        isFinished: matchData.isFinished,
        sourceId: matchData.id || undefined,
        sourceName: 'flashscore',
      };
    } catch (error) {
      return null;
    }
  }

  private parseFailCount = 0;

  private parsePeriod(stageText: string | null): string {
    if (!stageText) return 'LIVE';

    const text = stageText.toLowerCase();

    if (text.includes('finished') || text.includes('ft')) return 'FT';
    if (text.includes('half time') || text.includes('ht')) return 'HT';
    if (text.includes('1st half') || text.includes('first half')) return '1H';
    if (text.includes('2nd half') || text.includes('second half')) return '2H';
    if (text.includes('extra time') || text.includes('et')) return 'ET';
    if (text.includes('penalties') || text.includes('pens')) return 'PEN';

    // For other sports
    if (text.includes('1st set')) return '1S';
    if (text.includes('2nd set')) return '2S';
    if (text.includes('3rd set')) return '3S';
    if (text.includes('1st quarter') || text.includes('q1')) return '1Q';
    if (text.includes('2nd quarter') || text.includes('q2')) return '2Q';
    if (text.includes('3rd quarter') || text.includes('q3')) return '3Q';
    if (text.includes('4th quarter') || text.includes('q4')) return '4Q';

    return 'LIVE';
  }

  private parseMinute(stageText: string | null): number | undefined {
    if (!stageText) return undefined;

    // Look for minute pattern like "45'" or "45+3'"
    const minuteMatch = stageText.match(/(\d+)'/);
    if (minuteMatch) {
      return parseInt(minuteMatch[1]);
    }

    return undefined;
  }
}
