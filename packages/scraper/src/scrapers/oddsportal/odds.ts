import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay, retryWithBackoff } from '../../utils/browser';

export interface OddsPortalOdds {
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  startTime?: Date;
  bookmakerCount: number;
}

export interface OddsPortalEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  startTime?: Date;
  odds: OddsPortalOdds | null;
}

/**
 * OddsPortal scraper - Works FREE without proxy!
 *
 * Covers: Football, Basketball, Tennis, Hockey, Baseball, Handball, Volleyball
 * Provides: Odds comparison from multiple bookmakers
 *
 * Test result (2024-12-21): 187 items found, works without proxy
 */
export class OddsPortalScraper {
  constructor(private page: Page) {}

  // Main sport pages now just list leagues - we need to go to specific league pages
  // or use the "matches" endpoint which shows today's games
  // Note: Football "/matches/football/" sometimes returns empty - use England Premier League as primary
  // OddsPortal URL patterns:
  // - League pages (/football/england/premier-league/) show fixtures in JSON-LD but no odds in DOM
  // - Match pages (/matches/football/) use eventRow class with odds
  // - Today's matches: Try /matches/{sport}/ first, fall back to specific leagues for JSON-LD fixtures
  private readonly sportUrls: Record<string, string[]> = {
    // Football: /matches/football/ has eventRow structure, league pages have JSON-LD
    football: [
      'https://www.oddsportal.com/matches/football/',  // Main matches endpoint - may be blocked
      'https://www.oddsportal.com/football/england/premier-league/',  // JSON-LD fallback
      'https://www.oddsportal.com/football/spain/laliga/',  // JSON-LD fallback
    ],
    basketball: [
      'https://www.oddsportal.com/basketball/usa/nba/',  // NBA has eventRow
      'https://www.oddsportal.com/matches/basketball/',
    ],
    tennis: [
      'https://www.oddsportal.com/matches/tennis/',
    ],
    hockey: [
      'https://www.oddsportal.com/hockey/usa/nhl/',  // NHL has eventRow
      'https://www.oddsportal.com/matches/hockey/',
    ],
    baseball: [
      'https://www.oddsportal.com/matches/baseball/',
    ],
    handball: [
      'https://www.oddsportal.com/matches/handball/',
    ],
    volleyball: [
      'https://www.oddsportal.com/matches/volleyball/',
    ],
  };

  async getUpcomingOdds(sport: string = 'football'): Promise<OddsPortalEvent[]> {
    const allEvents: OddsPortalEvent[] = [];
    const urls = this.sportUrls[sport] || this.sportUrls.football;

    logger.info(`OddsPortal: Fetching ${sport} odds from ${urls.length} URL(s)`);

    // Try each URL until we get events
    for (const url of urls) {
      const events = await this.scrapeUrl(url, sport);
      for (const event of events) {
        // Deduplicate by team names
        const exists = allEvents.some(
          e => e.homeTeam.toLowerCase() === event.homeTeam.toLowerCase() &&
               e.awayTeam.toLowerCase() === event.awayTeam.toLowerCase()
        );
        if (!exists) {
          allEvents.push(event);
        }
      }

      // If we got enough events, stop
      if (allEvents.length >= 20) {
        logger.info(`OddsPortal: Got ${allEvents.length} events, stopping URL iteration`);
        break;
      }
    }

    logger.info(`OddsPortal: Retrieved ${allEvents.length} total ${sport} events with odds`);
    return allEvents;
  }

  private async scrapeUrl(url: string, sport: string): Promise<OddsPortalEvent[]> {
    const events: OddsPortalEvent[] = [];

    logger.info(`OddsPortal: Scraping ${url}`);

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(url, {
          waitUntil: 'networkidle',  // Wait for network to settle
          timeout: 45000,
        });
      });

      await randomDelay(2000, 3000);

      // OddsPortal uses JavaScript-rendered content - need to wait longer
      // Try scrolling to trigger lazy loading
      await this.page.evaluate(() => {
        window.scrollBy(0, 500);
      });
      await randomDelay(1500, 2500);

      // Wait for matches to load - OddsPortal now uses Next.js and dynamic loading
      // Try multiple selectors including new React-based structure
      await this.page.waitForSelector('[class*="eventRow"], [class*="event-row"], [class*="flex"][class*="border"], table tbody tr, div[class*="group"]', {
        timeout: 15000,
      }).catch(() => {
        logger.debug('OddsPortal: No matches found on page');
      });

      // Extra wait for React hydration
      await randomDelay(2000, 3000);

      // Debug: Log page structure to understand current DOM
      const debugInfo = await this.page.evaluate(() => {
        const title = document.title;
        const bodyLength = document.body.innerHTML.length;

        // Check for common structures
        const hasNextData = !!document.querySelector('#__NEXT_DATA__');
        const hasTable = !!document.querySelector('table');
        const divCount = document.querySelectorAll('div').length;

        // Look for any elements containing team-like patterns (e.g., "vs", "-")
        const allText = document.body.innerText;
        const hasVsPattern = allText.includes(' - ') || allText.includes(' vs ');

        // Find elements with event-like classes
        const eventLikeElements = document.querySelectorAll('[class*="event"], [class*="match"], [class*="fixture"], [class*="game"]');

        // Get sample of visible text for debugging
        const sampleText = allText.substring(0, 500);

        // Look for specific OddsPortal patterns
        const flexDivs = document.querySelectorAll('div[class*="flex"]');
        const linkCount = document.querySelectorAll('a').length;

        // Try to find odds-like numbers (e.g., 1.50, 2.00) - also try 1.5, 2.0
        const oddsPattern = allText.match(/\d+\.\d{1,2}/g) || [];

        // Look for rows that contain both team names and odds
        const rowsWithOdds = document.querySelectorAll('a[href*="/football/"], a[href*="/basketball/"], a[href*="/tennis/"], a[href*="/hockey/"]');
        const matchRowInfo: string[] = [];
        rowsWithOdds.forEach((a, i) => {
          if (i < 5) {
            const parent = a.closest('div');
            const text = parent?.textContent?.trim().substring(0, 100) || '';
            matchRowInfo.push(text);
          }
        });

        return {
          title,
          bodyLength,
          hasNextData,
          hasTable,
          divCount,
          hasVsPattern,
          eventLikeCount: eventLikeElements.length,
          flexDivCount: flexDivs.length,
          linkCount,
          oddsPatternCount: oddsPattern.length,
          sampleOdds: oddsPattern.slice(0, 10),
          sampleText: sampleText.replace(/\s+/g, ' ').trim(),
          matchRowInfo,
        };
      });

      logger.info(`OddsPortal Debug: title="${debugInfo.title}", body=${debugInfo.bodyLength} chars, hasNextData=${debugInfo.hasNextData}, hasTable=${debugInfo.hasTable}, divs=${debugInfo.divCount}, flexDivs=${debugInfo.flexDivCount}, links=${debugInfo.linkCount}, eventLike=${debugInfo.eventLikeCount}, hasVsPattern=${debugInfo.hasVsPattern}, oddsNumbers=${debugInfo.oddsPatternCount}`);

      if (debugInfo.matchRowInfo && debugInfo.matchRowInfo.length > 0) {
        logger.info(`OddsPortal Debug: Match rows found: ${debugInfo.matchRowInfo.slice(0, 3).join(' | ')}`);
      }

      if (debugInfo.sampleOdds.length > 0) {
        logger.info(`OddsPortal Debug: Sample odds values found: ${debugInfo.sampleOdds.join(', ')}`);
      }

      // Log more detailed info about match patterns found
      const matchDebug = await this.page.evaluate(() => {
        const text = document.body.innerText || '';

        // Look for "Team - Team" patterns
        const teamMatches = text.match(/([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)\s*-\s*([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*)/g) || [];

        // Look for any links that might be match links
        const matchLinks: string[] = [];
        document.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href') || '';
          const text = a.textContent?.trim() || '';
          if ((href.includes('/match/') || href.includes('/football/') || text.includes(' - ')) && text.length > 5 && text.length < 100) {
            matchLinks.push(`${text} -> ${href.substring(0, 50)}`);
          }
        });

        // Get page URL to verify we loaded correct page
        const currentUrl = window.location.href;

        return {
          teamMatches: teamMatches.slice(0, 5),
          matchLinks: matchLinks.slice(0, 5),
          currentUrl,
        };
      });

      logger.info(`OddsPortal Debug: URL=${matchDebug.currentUrl}`);
      if (matchDebug.teamMatches.length > 0) {
        logger.info(`OddsPortal Debug: Team patterns found: ${matchDebug.teamMatches.join(', ')}`);
      }
      if (matchDebug.matchLinks.length > 0) {
        logger.info(`OddsPortal Debug: Match links: ${matchDebug.matchLinks.slice(0, 3).join(' | ')}`);
      }

      logger.debug(`OddsPortal Debug: Sample text: ${debugInfo.sampleText.substring(0, 200)}`);

      // Debug: Get a sample of the actual HTML around match-like content
      const htmlSample = await this.page.evaluate(() => {
        // Find divs that might contain match info
        const links = document.querySelectorAll('a[href*="/football/"], a[href*="/basketball/"], a[href*="/tennis/"]');
        const samples: string[] = [];
        links.forEach((link, i) => {
          if (i < 3) {
            const parent = link.closest('div')?.parentElement;
            if (parent) {
              // Get outer HTML but limit size
              const html = parent.outerHTML.substring(0, 300);
              samples.push(html);
            }
          }
        });
        return samples;
      });

      if (htmlSample.length > 0) {
        logger.info(`OddsPortal HTML Sample (first match): ${htmlSample[0]?.substring(0, 250)}`);
      }

      // Debug: Count eventRow elements specifically
      const eventRowCount = await this.page.evaluate(() => {
        // Try multiple selectors for event rows
        const eventRows1 = document.querySelectorAll('.eventRow');
        const eventRows2 = document.querySelectorAll('[class*="eventRow"]');
        const eventRows3 = document.querySelectorAll('div[class*="event"]');
        const flexEventDivs = document.querySelectorAll('div.flex.w-full');

        // Get first match for each
        const firstRow = eventRows2[0] || eventRows3[0];
        const firstRowText = firstRow?.textContent?.substring(0, 150) || 'none';
        const firstRowClasses = firstRow?.className || 'none';

        // Also check for data-v attributes (Vue.js)
        const vueElements = document.querySelectorAll('[data-v-f69a8221]');

        return {
          eventRow: eventRows1.length,
          eventRowPartial: eventRows2.length,
          divEvent: eventRows3.length,
          flexWideFull: flexEventDivs.length,
          vueElements: vueElements.length,
          firstRowText,
          firstRowClasses,
        };
      });
      logger.info(`OddsPortal Debug: eventRow=${eventRowCount.eventRow}, eventRow*=${eventRowCount.eventRowPartial}, div.event*=${eventRowCount.divEvent}, flexFull=${eventRowCount.flexWideFull}, vue=${eventRowCount.vueElements}`);
      logger.info(`OddsPortal Debug: First row classes: ${eventRowCount.firstRowClasses}`);

      // Try to extract from JSON-LD structured data first (most reliable)
      const jsonLdEvents = await this.page.evaluate(() => {
        const results: Array<{
          homeTeam: string;
          awayTeam: string;
          startTime: string;
          competition: string;
        }> = [];

        // Find all script tags with JSON-LD
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        scripts.forEach(script => {
          try {
            const data = JSON.parse(script.textContent || '');
            // Handle array of events
            const events = Array.isArray(data) ? data : [data];
            events.forEach(event => {
              if (event['@type']?.includes('SportsEvent') && event.name) {
                // Parse "Team1 - Team2" format
                const nameParts = event.name.split(' - ');
                if (nameParts.length === 2) {
                  results.push({
                    homeTeam: nameParts[0].trim(),
                    awayTeam: nameParts[1].trim(),
                    startTime: event.startDate || '',
                    competition: event.location?.name || 'Unknown',
                  });
                }
              }
            });
          } catch {
            // Invalid JSON, skip
          }
        });

        return results;
      });

      if (jsonLdEvents.length > 0) {
        logger.info(`OddsPortal: Found ${jsonLdEvents.length} events from JSON-LD structured data`);
        logger.info(`OddsPortal: Sample JSON-LD events: ${jsonLdEvents.slice(0, 3).map(e => `${e.homeTeam} vs ${e.awayTeam}`).join(', ')}`);
      }

      // Extract event data with odds from DOM
      const scrapedEvents = await this.page.evaluate((sportName) => {
        const results: Array<{
          id: string;
          homeTeam: string;
          awayTeam: string;
          competition: string;
          time: string;
          odds: {
            home: string;
            draw: string;
            away: string;
            bookmakerCount: number;
          } | null;
        }> = [];

        let currentCompetition = '';

        // Strategy 0: NEW OddsPortal Vue.js structure (2024-12-23)
        // Look for: <div class="eventRow flex w-full flex-col text-xs">
        const eventRows = document.querySelectorAll('.eventRow, [class*="eventRow"]');

        eventRows.forEach((row, idx) => {
          try {
            // Get all text from the row
            const rowText = row.textContent || '';

            // Find team names - look for links inside the row
            const links = row.querySelectorAll('a');
            const teamLinks: string[] = [];
            links.forEach(link => {
              const href = link.getAttribute('href') || '';
              const text = link.textContent?.trim() || '';
              // Team links typically contain match paths
              if ((href.includes('/match/') || href.includes('/football/') || href.includes('/basketball/')) && text.length > 2 && text.length < 50) {
                teamLinks.push(text);
              }
            });

            // Try to find "Team1 - Team2" pattern in the row text
            let homeTeam = '';
            let awayTeam = '';

            if (teamLinks.length >= 2) {
              homeTeam = teamLinks[0];
              awayTeam = teamLinks[1];
            } else {
              const matchPattern = rowText.match(/([A-Za-z][A-Za-z0-9\s\.'-]+)\s*[-–]\s*([A-Za-z][A-Za-z0-9\s\.'-]+)/);
              if (matchPattern) {
                homeTeam = matchPattern[1].trim();
                awayTeam = matchPattern[2].trim();
              }
            }

            if (homeTeam && awayTeam && homeTeam.length > 2 && awayTeam.length > 2) {
              // Look for odds - decimal numbers like 1.50, 2.00
              const oddsMatches = rowText.match(/\d+\.\d{1,2}/g) || [];
              let odds: { home: string; draw: string; away: string; bookmakerCount: number } | null = null;

              if (oddsMatches.length >= 2) {
                if (oddsMatches.length === 2) {
                  // 2-way market (no draw)
                  odds = { home: oddsMatches[0], draw: '', away: oddsMatches[1], bookmakerCount: 1 };
                } else if (oddsMatches.length >= 3) {
                  // 3-way market (with draw)
                  odds = { home: oddsMatches[0], draw: oddsMatches[1], away: oddsMatches[2], bookmakerCount: 1 };
                }
              }

              const id = `op_${sportName}_${homeTeam.toLowerCase().replace(/\s+/g, '_')}_row_${idx}`;
              results.push({
                id,
                homeTeam,
                awayTeam,
                competition: currentCompetition || 'Unknown',
                time: '',
                odds,
              });
            }
          } catch {
            // Skip failed rows
          }
        });

        // If eventRow strategy found results, return them
        if (results.length > 0) {
          return results;
        }

        // Strategy 1: Try traditional table rows (old OddsPortal structure)
        const tableRows = document.querySelectorAll(
          'table tbody tr, [class*="eventRow"], [class*="event-row"], .table-main tr'
        );

        // Strategy 2: Try new React/Next.js structure - look for flex containers with match data
        // OddsPortal 2024+ uses Tailwind CSS with flex layouts
        const flexRows = document.querySelectorAll(
          'div[class*="flex"][class*="border"], div[class*="group"], a[href*="/match/"]'
        );

        // Combine all potential row elements
        const allRows = [...Array.from(tableRows), ...Array.from(flexRows)];

        // Strategy 3: Look for links to matches which contain team names
        const matchLinks = document.querySelectorAll('a[href*="/football/"], a[href*="/basketball/"], a[href*="/tennis/"]');

        // Process table rows first (traditional structure)
        allRows.forEach((row, idx) => {
          try {
            // Check if this is a competition header
            const compHeader = row.querySelector('[class*="table-participant"], th, .table-participant, [class*="tournament"]');
            if (compHeader && !row.querySelector('[class*="odds"]') && !row.textContent?.match(/\d+\.\d{2}/)) {
              const compText = compHeader.textContent?.trim();
              if (compText && compText.length > 3 && compText.length < 100) {
                currentCompetition = compText;
              }
              return;
            }

            // Try multiple methods to find team names
            let participantText = '';

            // Method 1: Look for participant elements
            const participantEl = row.querySelector(
              '[class*="participant"], [class*="team"], .table-participant a, td:first-child a'
            );
            if (participantEl) {
              participantText = participantEl.textContent?.trim() || '';
            }

            // Method 2: Look for links that might contain match info
            if (!participantText || !participantText.includes(' - ')) {
              const matchLink = row.querySelector('a[href*="/match/"], a[href*="football"], a[href*="basketball"]') as HTMLAnchorElement;
              if (matchLink) {
                participantText = matchLink.textContent?.trim() || '';
              }
            }

            // Method 3: Get full row text and try to parse
            if (!participantText || !participantText.includes(' - ')) {
              const rowText = row.textContent?.trim() || '';
              // Look for "Team1 - Team2" pattern in the text
              const matchPattern = rowText.match(/([A-Za-z\s\.]+)\s*-\s*([A-Za-z\s\.]+)/);
              if (matchPattern) {
                participantText = `${matchPattern[1]} - ${matchPattern[2]}`;
              }
            }

            // Parse team names from participant text
            let homeTeam = '';
            let awayTeam = '';

            if (participantText.includes(' - ')) {
              const parts = participantText.split(' - ');
              homeTeam = parts[0]?.trim() || '';
              awayTeam = parts[1]?.trim() || '';
            } else if (participantText.includes(' v ')) {
              const parts = participantText.split(' v ');
              homeTeam = parts[0]?.trim() || '';
              awayTeam = parts[1]?.trim() || '';
            } else if (participantText.includes(' vs ')) {
              const parts = participantText.split(' vs ');
              homeTeam = parts[0]?.trim() || '';
              awayTeam = parts[1]?.trim() || '';
            }

            if (!homeTeam || !awayTeam) return;
            // Filter out invalid team names (too short or too long)
            if (homeTeam.length < 2 || awayTeam.length < 2 || homeTeam.length > 50 || awayTeam.length > 50) return;

            // Find time
            const timeEl = row.querySelector('[class*="time"], .table-time, td:nth-child(1)');
            const time = timeEl?.textContent?.trim() || '';

            // Find odds - multiple strategies
            let odds: {
              home: string;
              draw: string;
              away: string;
              bookmakerCount: number;
            } | null = null;

            // Method 1: Traditional odds cells
            const oddsCells = row.querySelectorAll('[class*="odds"], .odds-nowrp, td[class*="odds"]');
            if (oddsCells.length >= 2) {
              if (oddsCells.length === 2) {
                odds = {
                  home: oddsCells[0]?.textContent?.trim() || '',
                  draw: '',
                  away: oddsCells[1]?.textContent?.trim() || '',
                  bookmakerCount: 1,
                };
              } else if (oddsCells.length >= 3) {
                odds = {
                  home: oddsCells[0]?.textContent?.trim() || '',
                  draw: oddsCells[1]?.textContent?.trim() || '',
                  away: oddsCells[2]?.textContent?.trim() || '',
                  bookmakerCount: 1,
                };
              }
            }

            // Method 2: Look for any decimal odds patterns in the row
            if (!odds || (!odds.home && !odds.away)) {
              const rowText = row.textContent || '';
              const oddsMatches = rowText.match(/\d+\.\d{2}/g);
              if (oddsMatches && oddsMatches.length >= 2) {
                if (oddsMatches.length === 2) {
                  odds = {
                    home: oddsMatches[0],
                    draw: '',
                    away: oddsMatches[1],
                    bookmakerCount: 1,
                  };
                } else if (oddsMatches.length >= 3) {
                  odds = {
                    home: oddsMatches[0],
                    draw: oddsMatches[1],
                    away: oddsMatches[2],
                    bookmakerCount: 1,
                  };
                }
              }
            }

            // Method 3: Try alternate selectors
            if (!odds || (!odds.home && !odds.away)) {
              const altOdds = row.querySelectorAll('a[class*="odds"], span[class*="odds"], p[class*="odds"]');
              if (altOdds.length >= 2) {
                if (altOdds.length === 2) {
                  odds = {
                    home: altOdds[0]?.textContent?.trim() || '',
                    draw: '',
                    away: altOdds[1]?.textContent?.trim() || '',
                    bookmakerCount: 1,
                  };
                } else if (altOdds.length >= 3) {
                  odds = {
                    home: altOdds[0]?.textContent?.trim() || '',
                    draw: altOdds[1]?.textContent?.trim() || '',
                    away: altOdds[2]?.textContent?.trim() || '',
                    bookmakerCount: 1,
                  };
                }
              }
            }

            const id = `op_${sportName}_${homeTeam.toLowerCase().replace(/\s+/g, '_')}_${idx}`;

            results.push({
              id,
              homeTeam,
              awayTeam,
              competition: currentCompetition || 'Unknown',
              time,
              odds,
            });
          } catch {
            // Skip failed rows
          }
        });

        return results;
      }, sport);

      // Count events with/without odds for debugging
      let withOdds = 0;
      let withoutOdds = 0;

      for (const event of scrapedEvents) {
        const parsedEvent = this.parseEvent(event, sport);
        if (parsedEvent) {
          events.push(parsedEvent);
          if (parsedEvent.odds) {
            withOdds++;
          } else {
            withoutOdds++;
          }
        }
      }

      logger.info(`OddsPortal: DOM parsing: ${withOdds} events with odds, ${withoutOdds} without odds`);

      // If DOM parsing found nothing, fall back to JSON-LD events (without odds)
      if (events.length === 0 && jsonLdEvents.length > 0) {
        logger.info(`OddsPortal: DOM parsing found no events, using ${jsonLdEvents.length} events from JSON-LD`);
        for (const jsonEvent of jsonLdEvents) {
          events.push({
            id: `op_${sport}_${jsonEvent.homeTeam.toLowerCase().replace(/\s+/g, '_')}_jsonld`,
            homeTeam: jsonEvent.homeTeam,
            awayTeam: jsonEvent.awayTeam,
            competition: jsonEvent.competition,
            startTime: jsonEvent.startTime ? new Date(jsonEvent.startTime) : undefined,
            odds: null, // No odds from JSON-LD
          });
        }
      }

      logger.info(`OddsPortal: Retrieved ${events.length} ${sport} events with odds`);
      return events;
    } catch (error) {
      logger.error(`OddsPortal ${sport} failed`, { error });
      return events;
    }
  }

  async getOddsForMatch(matchUrl: string): Promise<OddsPortalOdds | null> {
    logger.info(`OddsPortal: Fetching detailed odds from ${matchUrl}`);

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(matchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      });

      await randomDelay(1500, 2500);

      // Wait for odds table
      await this.page.waitForSelector('[class*="odds"], table', {
        timeout: 10000,
      }).catch(() => {
        logger.debug('OddsPortal: No odds table found');
      });

      const oddsData = await this.page.evaluate(() => {
        const result: {
          homeTeam: string;
          awayTeam: string;
          competition: string;
          odds: Array<{
            bookmaker: string;
            home: string;
            draw: string;
            away: string;
          }>;
        } = {
          homeTeam: '',
          awayTeam: '',
          competition: '',
          odds: [],
        };

        // Get match info
        const participantEl = document.querySelector('[class*="participant"], h1');
        const participantText = participantEl?.textContent?.trim() || '';

        if (participantText.includes(' - ')) {
          const parts = participantText.split(' - ');
          result.homeTeam = parts[0]?.trim() || '';
          result.awayTeam = parts[1]?.trim() || '';
        }

        // Get competition
        const compEl = document.querySelector('[class*="breadcrumb"] a:last-child, [class*="tournament"]');
        result.competition = compEl?.textContent?.trim() || 'Unknown';

        // Get odds from all bookmakers
        const oddsRows = document.querySelectorAll('[class*="bookmaker-row"], table tbody tr');

        oddsRows.forEach((row) => {
          try {
            const bookmakerEl = row.querySelector('[class*="bookmaker"], td:first-child');
            const oddsCells = row.querySelectorAll('[class*="odds"], td[class*="odds"]');

            if (oddsCells.length >= 2) {
              result.odds.push({
                bookmaker: bookmakerEl?.textContent?.trim() || 'Unknown',
                home: oddsCells[0]?.textContent?.trim() || '',
                draw: oddsCells.length >= 3 ? (oddsCells[1]?.textContent?.trim() || '') : '',
                away: oddsCells[oddsCells.length - 1]?.textContent?.trim() || '',
              });
            }
          } catch {
            // Skip
          }
        });

        return result;
      });

      if (!oddsData.homeTeam || oddsData.odds.length === 0) {
        return null;
      }

      // Calculate consensus odds (average of all bookmakers)
      const homeOdds = oddsData.odds
        .map(o => this.parseOddsValue(o.home))
        .filter((n): n is number => n !== null);
      const drawOdds = oddsData.odds
        .map(o => this.parseOddsValue(o.draw))
        .filter((n): n is number => n !== null);
      const awayOdds = oddsData.odds
        .map(o => this.parseOddsValue(o.away))
        .filter((n): n is number => n !== null);

      return {
        homeTeam: oddsData.homeTeam,
        awayTeam: oddsData.awayTeam,
        competition: oddsData.competition,
        homeWin: homeOdds.length > 0 ? this.calculateAverage(homeOdds) : undefined,
        draw: drawOdds.length > 0 ? this.calculateAverage(drawOdds) : undefined,
        awayWin: awayOdds.length > 0 ? this.calculateAverage(awayOdds) : undefined,
        bookmakerCount: oddsData.odds.length,
      };
    } catch (error) {
      logger.error('OddsPortal detailed odds failed', { error });
      return null;
    }
  }

  private parseEvent(
    event: {
      id: string;
      homeTeam: string;
      awayTeam: string;
      competition: string;
      time: string;
      odds: { home: string; draw: string; away: string; bookmakerCount: number } | null;
    },
    sport: string
  ): OddsPortalEvent | null {
    try {
      let parsedOdds: OddsPortalOdds | null = null;

      if (event.odds) {
        const homeOdds = this.parseOddsValue(event.odds.home);
        const drawOdds = this.parseOddsValue(event.odds.draw);
        const awayOdds = this.parseOddsValue(event.odds.away);

        if (homeOdds || awayOdds) {
          parsedOdds = {
            homeTeam: event.homeTeam,
            awayTeam: event.awayTeam,
            competition: event.competition,
            homeWin: homeOdds ?? undefined,
            draw: drawOdds ?? undefined,
            awayWin: awayOdds ?? undefined,
            bookmakerCount: event.odds.bookmakerCount,
          };
        }
      }

      return {
        id: event.id,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        competition: event.competition,
        startTime: this.parseTime(event.time),
        odds: parsedOdds,
      };
    } catch {
      return null;
    }
  }

  private parseOddsValue(text: string): number | null {
    if (!text || text === '-' || text === '' || text === 'N/A') return null;

    // Handle fractional odds (e.g., "5/2")
    if (text.includes('/')) {
      const [num, den] = text.split('/').map(Number);
      if (num && den) {
        return parseFloat((num / den + 1).toFixed(2));
      }
    }

    // Handle decimal odds
    const decimal = parseFloat(text.replace(',', '.'));
    if (!isNaN(decimal) && decimal > 1) {
      return parseFloat(decimal.toFixed(2));
    }

    return null;
  }

  private parseTime(timeStr: string): Date | undefined {
    if (!timeStr) return undefined;

    const now = new Date();

    // Try to parse time like "15:00" or "20:30"
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const date = new Date(now);
      date.setHours(parseInt(timeMatch[1]!), parseInt(timeMatch[2]!), 0, 0);
      // If time is in the past, assume it's tomorrow
      if (date < now) {
        date.setDate(date.getDate() + 1);
      }
      return date;
    }

    // Try to parse date like "21 Dec" or "21/12"
    const dateMatch = timeStr.match(/(\d{1,2})\s*(?:\/|\.|\s+)(\d{1,2}|\w+)/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]!);
      let month: number;

      // Check if second part is month name or number
      const monthPart = dateMatch[2]!;
      if (/^\d+$/.test(monthPart)) {
        month = parseInt(monthPart) - 1;
      } else {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        month = monthNames.findIndex(m => monthPart.toLowerCase().startsWith(m));
        if (month === -1) month = now.getMonth();
      }

      const date = new Date(now.getFullYear(), month, day);
      if (date < now) {
        date.setFullYear(date.getFullYear() + 1);
      }
      return date;
    }

    return undefined;
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return parseFloat((sum / numbers.length).toFixed(2));
  }

  getSupportedSports(): string[] {
    return Object.keys(this.sportUrls);
  }
}
