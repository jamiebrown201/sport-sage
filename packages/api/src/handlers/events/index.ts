import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, events, markets, outcomes, sports } from '@sport-sage/database';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';

const db = getDb();

// CORS headers
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path, pathParameters, queryStringParameters } = event;
  const route = path.replace(/^\/api\/events\/?/, '').replace(/\/$/, '') || '';

  try {
    // GET /api/events - List events with filters
    if (httpMethod === 'GET' && route === '') {
      return handleListEvents(queryStringParameters || {});
    }

    // GET /api/events/sports - List available sports
    if (httpMethod === 'GET' && route === 'sports') {
      return handleListSports();
    }

    // GET /api/events/featured - Featured events
    if (httpMethod === 'GET' && route === 'featured') {
      return handleFeaturedEvents();
    }

    // GET /api/events/:id - Single event with markets
    if (httpMethod === 'GET' && route && !route.includes('/')) {
      const eventId = pathParameters?.proxy || route;
      return handleGetEvent(eventId);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Events handler error:', error);
    return response(500, { error: 'Internal server error' });
  }
}

interface ListEventsParams {
  sport?: string;
  status?: string;
  date?: string;
  page?: string;
  pageSize?: string;
}

async function handleListEvents(params: ListEventsParams): Promise<APIGatewayProxyResult> {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(params.pageSize || '20', 10)));
  const offset = (page - 1) * pageSize;

  // Build conditions
  const conditions: Parameters<typeof and>[0][] = [];

  // Filter by sport slug
  if (params.sport) {
    const sportResult = await db
      .select({ id: sports.id })
      .from(sports)
      .where(eq(sports.slug, params.sport as any))
      .limit(1);

    if (sportResult.length > 0) {
      conditions.push(eq(events.sportId, sportResult[0].id));
    } else {
      // Sport not found, return empty
      return response(200, {
        data: [],
        pagination: { page, pageSize, total: 0, hasMore: false },
      });
    }
  }

  // Filter by status
  if (params.status) {
    const validStatuses = ['scheduled', 'live', 'finished', 'cancelled', 'postponed'];
    if (validStatuses.includes(params.status)) {
      conditions.push(eq(events.status, params.status as any));
    }
  }

  // Filter by date (YYYY-MM-DD)
  if (params.date) {
    const dateStart = new Date(`${params.date}T00:00:00Z`);
    const dateEnd = new Date(`${params.date}T23:59:59Z`);
    if (!isNaN(dateStart.getTime())) {
      conditions.push(gte(events.startTime, dateStart));
      conditions.push(lte(events.startTime, dateEnd));
    }
  }

  // Count total
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(whereClause);
  const total = countResult[0]?.count || 0;

  // Fetch events with markets and outcomes
  const eventsData = await db.query.events.findMany({
    where: whereClause,
    with: {
      sport: true,
      competition: true,
      markets: {
        where: eq(markets.isMainMarket, true),
        with: {
          outcomes: true,
        },
      },
    },
    orderBy: [asc(events.startTime)],
    limit: pageSize,
    offset,
  });

  // Transform to API response format
  const data = eventsData.map(formatEventResponse);

  return response(200, {
    data,
    pagination: {
      page,
      pageSize,
      total,
      hasMore: offset + data.length < total,
    },
  });
}

async function handleListSports(): Promise<APIGatewayProxyResult> {
  const sportsData = await db
    .select()
    .from(sports)
    .where(eq(sports.isActive, true))
    .orderBy(asc(sports.sortOrder));

  // Get event counts per sport
  const countsResult = await db
    .select({
      sportId: events.sportId,
      count: sql<number>`count(*)::int`,
    })
    .from(events)
    .where(eq(events.status, 'scheduled'))
    .groupBy(events.sportId);

  const countsBySport = new Map(countsResult.map((c) => [c.sportId, c.count]));

  const data = sportsData.map((sport) => ({
    id: sport.id,
    name: sport.name,
    slug: sport.slug,
    iconName: sport.iconName,
    eventCount: countsBySport.get(sport.id) || 0,
  }));

  return response(200, { data });
}

async function handleFeaturedEvents(): Promise<APIGatewayProxyResult> {
  const featured = await db.query.events.findMany({
    where: and(
      eq(events.isFeatured, true),
      eq(events.status, 'scheduled')
    ),
    with: {
      sport: true,
      competition: true,
      markets: {
        where: eq(markets.isMainMarket, true),
        with: {
          outcomes: true,
        },
      },
    },
    orderBy: [asc(events.startTime)],
    limit: 10,
  });

  // If no featured events, return upcoming events with high prediction counts
  if (featured.length === 0) {
    const popular = await db.query.events.findMany({
      where: eq(events.status, 'scheduled'),
      with: {
        sport: true,
        competition: true,
        markets: {
          where: eq(markets.isMainMarket, true),
          with: {
            outcomes: true,
          },
        },
      },
      orderBy: [desc(events.predictionCount), asc(events.startTime)],
      limit: 10,
    });

    return response(200, {
      data: popular.map(formatEventResponse),
    });
  }

  return response(200, {
    data: featured.map(formatEventResponse),
  });
}

async function handleGetEvent(eventId: string): Promise<APIGatewayProxyResult> {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(eventId)) {
    return response(400, { error: 'Invalid event ID format' });
  }

  const eventData = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      sport: true,
      competition: true,
      markets: {
        with: {
          outcomes: true,
        },
      },
      sponsoredEvent: true,
    },
  });

  if (!eventData) {
    return response(404, { error: 'Event not found' });
  }

  return response(200, {
    data: formatEventResponse(eventData),
  });
}

function formatEventResponse(event: any) {
  return {
    id: event.id,
    sport: event.sport
      ? {
          id: event.sport.id,
          name: event.sport.name,
          slug: event.sport.slug,
          iconName: event.sport.iconName,
        }
      : null,
    competition: event.competition
      ? {
          id: event.competition.id,
          name: event.competition.name,
          shortName: event.competition.shortName,
          country: event.competition.country,
        }
      : null,
    homeTeamName: event.homeTeamName,
    awayTeamName: event.awayTeamName,
    player1Name: event.player1Name,
    player2Name: event.player2Name,
    startTime: event.startTime,
    status: event.status,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    period: event.period,
    minute: event.minute,
    isFeatured: event.isFeatured,
    predictionCount: event.predictionCount,
    markets: (event.markets || []).map((market: any) => ({
      id: market.id,
      type: market.type,
      name: market.name,
      line: market.line ? parseFloat(market.line) : null,
      isSuspended: market.isSuspended,
      isMainMarket: market.isMainMarket,
      outcomes: (market.outcomes || []).map((outcome: any) => ({
        id: outcome.id,
        name: outcome.name,
        odds: parseFloat(outcome.odds),
        previousOdds: outcome.previousOdds ? parseFloat(outcome.previousOdds) : null,
        isSuspended: outcome.isSuspended,
      })),
    })),
    sponsoredEvent: event.sponsoredEvent
      ? {
          sponsorName: event.sponsoredEvent.sponsorName,
          sponsorLogoUrl: event.sponsoredEvent.sponsorLogoUrl,
          title: event.sponsoredEvent.title,
          description: event.sponsoredEvent.description,
          bonusStarsMultiplier: parseFloat(event.sponsoredEvent.bonusStarsMultiplier),
        }
      : null,
  };
}
