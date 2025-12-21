import { getDb, events } from '@sport-sage/database';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { normalizeTeamName, combinedSimilarity, findOrCreateTeam } from './team-names';

/**
 * Event deduplication system
 *
 * Prevents creating duplicate events when multiple sources scrape the same match.
 * Uses fuzzy team name matching + time window matching.
 */

// Time window for considering events as the same match (2 hours)
const TIME_WINDOW_MS = 2 * 60 * 60 * 1000;

// Minimum similarity for team name matching in dedup
const DEDUP_THRESHOLD = 0.80;

export interface ScrapedFixture {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  startTime: Date;
  externalId: string;
  source: string; // 'flashscore', 'sofascore', 'espn', '365scores', etc.
}

export interface DeduplicatedEvent {
  eventId: string;
  isNew: boolean;
  matchedSource?: string;
  confidence?: number;
}

/**
 * Find existing event or create new one with deduplication
 *
 * Checks:
 * 1. Exact external ID match (same source)
 * 2. Cross-source match by teams + time window
 */
export async function findOrCreateEvent(
  fixture: ScrapedFixture,
  sportId: string,
  competitionId: string
): Promise<DeduplicatedEvent> {
  const db = getDb();

  // 1. Check exact external ID match first (fastest path)
  const externalIdField = getExternalIdField(fixture.source);
  if (externalIdField) {
    const exactMatch = await db.query.events.findFirst({
      where: sql`${events[externalIdField as keyof typeof events]} = ${fixture.externalId}`,
    });

    if (exactMatch) {
      logger.debug(`Exact match found for ${fixture.source} ID: ${fixture.externalId}`);
      return {
        eventId: exactMatch.id,
        isNew: false,
        matchedSource: fixture.source,
      };
    }
  }

  // 2. Check for cross-source duplicates using team matching + time window
  const crossSourceMatch = await findCrossSourceDuplicate(fixture, sportId);

  if (crossSourceMatch) {
    // Update the existing event with this source's external ID
    await updateEventWithExternalId(crossSourceMatch.eventId, fixture.source, fixture.externalId);

    logger.info(`Cross-source dedup: "${fixture.homeTeam} vs ${fixture.awayTeam}" matched existing event (${(crossSourceMatch.confidence * 100).toFixed(0)}% confidence)`);

    return {
      eventId: crossSourceMatch.eventId,
      isNew: false,
      matchedSource: crossSourceMatch.matchedSource,
      confidence: crossSourceMatch.confidence,
    };
  }

  // 3. No match found - create new event
  const newEventId = await createNewEvent(fixture, sportId, competitionId);

  return {
    eventId: newEventId,
    isNew: true,
  };
}

/**
 * Find potential duplicate from other sources
 */
async function findCrossSourceDuplicate(
  fixture: ScrapedFixture,
  sportId: string
): Promise<{ eventId: string; matchedSource: string; confidence: number } | null> {
  const db = getDb();

  // Get events in the same sport within time window
  const timeStart = new Date(fixture.startTime.getTime() - TIME_WINDOW_MS);
  const timeEnd = new Date(fixture.startTime.getTime() + TIME_WINDOW_MS);

  const candidates = await db.query.events.findMany({
    where: and(
      eq(events.sportId, sportId),
      gte(events.startTime, timeStart),
      lte(events.startTime, timeEnd)
    ),
  });

  if (candidates.length === 0) {
    return null;
  }

  const normalizedHome = normalizeTeamName(fixture.homeTeam);
  const normalizedAway = normalizeTeamName(fixture.awayTeam);

  let bestMatch: { eventId: string; matchedSource: string; confidence: number } | null = null;

  for (const candidate of candidates) {
    const candidateHome = normalizeTeamName(candidate.homeTeamName || '');
    const candidateAway = normalizeTeamName(candidate.awayTeamName || '');

    // Calculate similarity for both teams
    const homeSimilarity = combinedSimilarity(normalizedHome, candidateHome);
    const awaySimilarity = combinedSimilarity(normalizedAway, candidateAway);

    // Both teams must meet threshold
    if (homeSimilarity >= DEDUP_THRESHOLD && awaySimilarity >= DEDUP_THRESHOLD) {
      const avgConfidence = (homeSimilarity + awaySimilarity) / 2;

      // Determine which source the existing event came from
      const matchedSource = candidate.externalFlashscoreId
        ? 'flashscore'
        : candidate.externalOddscheckerId
        ? 'oddschecker'
        : 'unknown';

      if (!bestMatch || avgConfidence > bestMatch.confidence) {
        bestMatch = {
          eventId: candidate.id,
          matchedSource,
          confidence: avgConfidence,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Update existing event with a new source's external ID
 */
async function updateEventWithExternalId(
  eventId: string,
  source: string,
  externalId: string
): Promise<void> {
  const db = getDb();
  const field = getExternalIdField(source);

  if (!field) {
    logger.warn(`Unknown source for external ID update: ${source}`);
    return;
  }

  // Use raw SQL to dynamically set the field
  await db.execute(sql`
    UPDATE events
    SET ${sql.identifier(field)} = ${externalId},
        updated_at = NOW()
    WHERE id = ${eventId}::uuid
  `);

  logger.debug(`Updated event ${eventId} with ${source} ID: ${externalId}`);
}

/**
 * Create new event
 */
async function createNewEvent(
  fixture: ScrapedFixture,
  sportId: string,
  competitionId: string
): Promise<string> {
  const db = getDb();

  // Resolve teams using the team matching system
  const homeTeamId = await findOrCreateTeam(fixture.homeTeam, fixture.source);
  const awayTeamId = await findOrCreateTeam(fixture.awayTeam, fixture.source);

  const externalIdField = getExternalIdField(fixture.source);
  const externalIdColumn = externalIdField ? externalIdField.replace(/([A-Z])/g, '_$1').toLowerCase() : null;

  // Create event with source-specific external ID
  const result = await db.execute(sql`
    INSERT INTO events (
      sport_id, competition_id, competition_name,
      home_team_id, away_team_id, home_team_name, away_team_name,
      start_time, status${externalIdColumn ? sql`, ${sql.identifier(externalIdColumn)}` : sql``}
    ) VALUES (
      ${sportId}::uuid, ${competitionId}::uuid, ${fixture.competition},
      ${homeTeamId}::uuid, ${awayTeamId}::uuid, ${fixture.homeTeam}, ${fixture.awayTeam},
      ${fixture.startTime.toISOString()}::timestamptz, 'scheduled'::event_status${externalIdColumn ? sql`, ${fixture.externalId}` : sql``}
    ) RETURNING id
  `);

  const newEventId = (result.rows?.[0] as any)?.id;

  // Create default match_winner market
  await db.execute(sql`
    INSERT INTO markets (event_id, type, name, is_main_market)
    VALUES (${newEventId}::uuid, 'match_winner'::market_type, 'Match Result', true)
  `);

  logger.info(`Created new event: "${fixture.homeTeam} vs ${fixture.awayTeam}" from ${fixture.source}`);

  return newEventId;
}

/**
 * Get the database field name for a source's external ID
 */
function getExternalIdField(source: string): string | null {
  const sourceToField: Record<string, string> = {
    flashscore: 'externalFlashscoreId',
    oddschecker: 'externalOddscheckerId',
    // Add more sources as we add their columns to the schema
    // sofascore: 'externalSofascoreId',
    // espn: 'externalEspnId',
    // '365scores': 'external365ScoresId',
  };

  return sourceToField[source] || null;
}

/**
 * Batch find or create events with deduplication
 * More efficient for processing many fixtures at once
 */
export async function bulkFindOrCreateEvents(
  fixtures: ScrapedFixture[],
  sportId: string,
  getCompetitionId: (fixture: ScrapedFixture) => Promise<string>
): Promise<Map<string, DeduplicatedEvent>> {
  const results = new Map<string, DeduplicatedEvent>();

  for (const fixture of fixtures) {
    const competitionId = await getCompetitionId(fixture);
    const key = `${fixture.homeTeam}:${fixture.awayTeam}:${fixture.startTime.toISOString()}`;

    try {
      const result = await findOrCreateEvent(fixture, sportId, competitionId);
      results.set(key, result);
    } catch (error) {
      logger.error(`Failed to process fixture: ${fixture.homeTeam} vs ${fixture.awayTeam}`, error);
    }
  }

  return results;
}

/**
 * Get deduplication stats for monitoring
 */
export interface DedupStats {
  total: number;
  new: number;
  deduplicated: number;
  bySource: Record<string, number>;
}

export function calculateDedupStats(results: Map<string, DeduplicatedEvent>): DedupStats {
  const stats: DedupStats = {
    total: results.size,
    new: 0,
    deduplicated: 0,
    bySource: {},
  };

  for (const result of results.values()) {
    if (result.isNew) {
      stats.new++;
    } else {
      stats.deduplicated++;
      if (result.matchedSource) {
        stats.bySource[result.matchedSource] = (stats.bySource[result.matchedSource] || 0) + 1;
      }
    }
  }

  return stats;
}
