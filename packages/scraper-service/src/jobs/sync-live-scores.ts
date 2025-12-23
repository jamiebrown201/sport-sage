/**
 * Sync Live Scores Job
 *
 * Fetches live scores from multiple sources and updates events.
 * Queues finished events for settlement.
 * Adapted from Lambda handler for VPS deployment.
 */

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { events, sports } from '@sport-sage/database';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../database/client.js';
import { getBrowserPool } from '../browser/pool.js';
import { createJobLogger } from '../logger.js';
import { recordRequest } from '../monitoring/metrics.js';
import { getRateLimitDetector } from '../rate-limit/detector.js';
import { waitWithJitter } from '../browser/behavior.js';
import type { Page } from 'playwright';

const logger = createJobLogger('sync-live-scores');

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const SETTLEMENT_QUEUE_URL = process.env.SETTLEMENT_QUEUE_URL;

interface LiveScore {
  homeScore: number;
  awayScore: number;
  period?: string;
  minute?: number;
  isFinished: boolean;
  competitionName?: string;
}

export async function runSyncLiveScores(): Promise<void> {
  logger.info('Starting live scores sync');
  const startTime = Date.now();

  const db = getDb();

  // Get live events
  const liveEventsWithSport = await db
    .select({
      id: events.id,
      homeTeamName: events.homeTeamName,
      awayTeamName: events.awayTeamName,
      startTime: events.startTime,
      sportSlug: sports.slug,
      competitionName: events.competitionName,
    })
    .from(events)
    .innerJoin(sports, eq(events.sportId, sports.id))
    .where(sql`${events.status}::text = 'live'`);

  if (liveEventsWithSport.length === 0) {
    logger.info('No live events, skipping sync');
    return;
  }

  logger.info(`Found ${liveEventsWithSport.length} live events`);

  const browserPool = getBrowserPool();
  const rateLimiter = getRateLimitDetector();

  let updated = 0;
  let finished = 0;

  try {
    const { page, release } = await browserPool.getPage();

    try {
      // Wait for rate limit
      await rateLimiter.waitForRateLimit('livescore.com');

      // Fetch live scores from API-based source (faster than scraping)
      const scores = await fetchLiveScores(page, liveEventsWithSport);
      recordRequest('livescore', true, Date.now() - startTime);
      rateLimiter.recordSuccess('livescore.com');

      for (const [eventId, score] of scores) {
        try {
          const newStatus = score.isFinished ? 'finished' : 'live';

          await db
            .update(events)
            .set({
              homeScore: score.homeScore,
              awayScore: score.awayScore,
              period: score.period,
              minute: score.minute ?? null,
              status: sql.raw(`'${newStatus}'::event_status`),
              updatedAt: new Date(),
            })
            .where(eq(events.id, eventId));

          updated++;

          // Queue for settlement if finished
          if (score.isFinished) {
            finished++;
            await queueForSettlement(eventId, score);
          }
        } catch (error) {
          logger.error(`Failed to update event: ${eventId}`, { error });
        }
      }
    } finally {
      await release();
    }

    logger.info('Live scores sync completed', {
      updated,
      finished,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    recordRequest('livescore', false, Date.now() - startTime, { blocked: true });
    rateLimiter.recordFailure('livescore.com');
    logger.error('Live scores sync failed', { error });
    throw error;
  }
}

async function fetchLiveScores(
  page: Page,
  liveEvents: Array<{
    id: string;
    homeTeamName: string | null;
    awayTeamName: string | null;
    sportSlug: string;
  }>
): Promise<Map<string, LiveScore>> {
  const scores = new Map<string, LiveScore>();

  // Group events by sport for efficient fetching
  const eventsBySport = new Map<string, typeof liveEvents>();
  for (const event of liveEvents) {
    if (!event.homeTeamName || !event.awayTeamName) continue;

    const sportEvents = eventsBySport.get(event.sportSlug) || [];
    sportEvents.push(event);
    eventsBySport.set(event.sportSlug, sportEvents);
  }

  // Fetch from API-based sources when possible
  for (const [sportSlug, sportEvents] of eventsBySport) {
    try {
      // Try API-based source first (365scores, ESPN, etc.)
      const apiScores = await fetchFromApi(sportSlug);

      // Match to our events
      for (const event of sportEvents) {
        const matched = matchScoreToEvent(event, apiScores);
        if (matched) {
          scores.set(event.id, matched);
        }
      }
    } catch (error) {
      logger.warn(`Failed to fetch scores for ${sportSlug}`, { error });
    }
  }

  // Fallback to scraping if we didn't match all events
  const unmatchedEvents = liveEvents.filter((e) => !scores.has(e.id));

  if (unmatchedEvents.length > 0) {
    logger.info(`${unmatchedEvents.length} events not matched via API, falling back to scraping`);

    try {
      await page.goto('https://www.livescore.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitWithJitter(1000);

      const scrapedScores = await scrapeLiveScores(page);

      for (const event of unmatchedEvents) {
        const matched = matchScoreToEvent(event, scrapedScores);
        if (matched) {
          scores.set(event.id, matched);
        }
      }
    } catch (error) {
      logger.warn('Scraping fallback failed', { error });
    }
  }

  return scores;
}

async function fetchFromApi(
  sportSlug: string
): Promise<Array<{ homeTeam: string; awayTeam: string; score: LiveScore }>> {
  // Use 365scores API (public, no auth required)
  const sportIds: Record<string, number> = {
    football: 1,
    basketball: 2,
    tennis: 3,
  };

  const sportId = sportIds[sportSlug];
  if (!sportId) return [];

  try {
    const response = await fetch(
      `https://webws.365scores.com/web/games/current/?appTypeId=5&langId=1&timezoneName=Europe/London&userCountryId=21&sports=${sportId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const games = data.games || [];

    return games.map((game: any) => ({
      homeTeam: game.homeCompetitor?.name || '',
      awayTeam: game.awayCompetitor?.name || '',
      score: {
        homeScore: game.homeCompetitor?.score || 0,
        awayScore: game.awayCompetitor?.score || 0,
        period: game.statusText,
        minute: game.gameTime,
        isFinished: game.statusGroup === 4, // 4 = finished
        competitionName: game.competitionDisplayName,
      },
    }));
  } catch (error) {
    logger.debug('365scores API failed', { error });
    return [];
  }
}

async function scrapeLiveScores(
  page: Page
): Promise<Array<{ homeTeam: string; awayTeam: string; score: LiveScore }>> {
  const scores: Array<{ homeTeam: string; awayTeam: string; score: LiveScore }> = [];

  try {
    // Wait for match elements
    await page.waitForSelector('.match, [class*="match"]', { timeout: 10000 });

    const matches = await page.$$('.match, [class*="match"]');

    for (const match of matches) {
      try {
        const homeTeam = await match.$eval('.home, [class*="home"]', (el: Element) =>
          el.textContent?.trim()
        );
        const awayTeam = await match.$eval('.away, [class*="away"]', (el: Element) =>
          el.textContent?.trim()
        );

        const scoreElements = await match.$$eval('.score, [class*="score"]', (els: Element[]) =>
          els.map((el) => parseInt(el.textContent || '0'))
        );

        const statusText = await match.$eval('.status, [class*="status"]', (el: Element) =>
          el.textContent?.trim()
        );

        if (homeTeam && awayTeam && scoreElements.length >= 2) {
          scores.push({
            homeTeam,
            awayTeam,
            score: {
              homeScore: scoreElements[0],
              awayScore: scoreElements[1],
              period: statusText,
              isFinished:
                statusText?.toLowerCase().includes('ft') ||
                statusText?.toLowerCase().includes('finished') ||
                false,
            },
          });
        }
      } catch {
        continue;
      }
    }
  } catch (error) {
    logger.debug('Scraping live scores failed', { error });
  }

  return scores;
}

function matchScoreToEvent(
  event: { homeTeamName: string | null; awayTeamName: string | null },
  scores: Array<{ homeTeam: string; awayTeam: string; score: LiveScore }>
): LiveScore | null {
  if (!event.homeTeamName || !event.awayTeamName) return null;

  const eventHome = normalizeTeamName(event.homeTeamName);
  const eventAway = normalizeTeamName(event.awayTeamName);

  const MATCH_THRESHOLD = 0.7;

  for (const { homeTeam, awayTeam, score } of scores) {
    const scrapedHome = normalizeTeamName(homeTeam);
    const scrapedAway = normalizeTeamName(awayTeam);

    const homeSim = stringSimilarity(eventHome, scrapedHome);
    const awaySim = stringSimilarity(eventAway, scrapedAway);

    if (homeSim >= MATCH_THRESHOLD && awaySim >= MATCH_THRESHOLD) {
      return score;
    }
  }

  return null;
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bfc\b/gi, '')
    .replace(/\bsc\b/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1;

  // Simple Levenshtein-based similarity
  const matrix: number[][] = Array(shorter.length + 1)
    .fill(null)
    .map(() => Array(longer.length + 1).fill(0));

  for (let i = 0; i <= shorter.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= longer.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= shorter.length; i++) {
    for (let j = 1; j <= longer.length; j++) {
      const cost = shorter[i - 1] === longer[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }

  return (longer.length - matrix[shorter.length][longer.length]) / longer.length;
}

async function queueForSettlement(eventId: string, score: LiveScore): Promise<void> {
  if (!SETTLEMENT_QUEUE_URL) {
    logger.warn('Settlement queue URL not configured, skipping');
    return;
  }

  try {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: SETTLEMENT_QUEUE_URL,
        MessageBody: JSON.stringify({
          type: 'event_finished',
          eventId,
          result: {
            homeScore: score.homeScore,
            awayScore: score.awayScore,
          },
        }),
        MessageGroupId: eventId,
        MessageDeduplicationId: `${eventId}-${Date.now()}`,
      })
    );

    logger.info(`Queued event for settlement: ${eventId}`);
  } catch (error) {
    logger.error(`Failed to queue event for settlement: ${eventId}`, { error });
  }
}
