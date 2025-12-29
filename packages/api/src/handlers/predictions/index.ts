// Force rebuild v2
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  getDb,
  users,
  userStats,
  predictions,
  events,
  markets,
  outcomes,
  transactions,
} from '@sport-sage/database';
import { eq, and, desc, sql } from 'drizzle-orm';

const db = getDb();

// CORS headers
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

function getCognitoId(event: APIGatewayProxyEventV2): string | null {
  // HTTP API v2 format - JWT authorizer puts claims here
  const jwt = (event.requestContext as any).authorizer?.jwt?.claims;
  if (jwt?.sub) return jwt.sub as string;
  return null;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const httpMethod = event.requestContext.http.method;
  const path = event.rawPath;
  const pathParameters = event.pathParameters;
  const queryStringParameters = event.queryStringParameters;
  const route = path.replace(/^\/api\/predictions\/?/, '').replace(/\/$/, '') || '';

  const cognitoId = getCognitoId(event);
  if (!cognitoId) {
    return response(401, { error: 'Unauthorized' });
  }

  // Get user
  const userResult = await db.select().from(users).where(eq(users.cognitoId, cognitoId)).limit(1);
  if (userResult.length === 0) {
    return response(404, { error: 'User not found. Please complete registration.' });
  }
  const user = userResult[0];

  try {
    // POST /api/predictions - Create prediction
    if (httpMethod === 'POST' && route === '') {
      return handleCreatePrediction(event, user);
    }

    // GET /api/predictions - List user's predictions
    if (httpMethod === 'GET' && route === '') {
      return handleListPredictions(user.id, queryStringParameters || {});
    }

    // GET /api/predictions/stats - Get prediction stats
    if (httpMethod === 'GET' && route === 'stats') {
      return handleGetStats(user.id);
    }

    // GET /api/predictions/:id - Get single prediction
    if (httpMethod === 'GET' && route && !route.includes('/')) {
      const predictionId = pathParameters?.proxy || route;
      return handleGetPrediction(predictionId, user.id);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Predictions handler error:', error);
    return response(500, { error: 'Internal server error' });
  }
}

interface CreatePredictionBody {
  eventId: string;
  outcomeId: string;
  stake: number;
}

async function handleCreatePrediction(
  event: APIGatewayProxyEventV2,
  user: typeof users.$inferSelect
): Promise<APIGatewayProxyResultV2> {
  let body: CreatePredictionBody;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return response(400, { error: 'Invalid JSON body' });
  }

  const { eventId, outcomeId, stake } = body;

  // Validate inputs
  if (!eventId || !outcomeId || !stake) {
    return response(400, { error: 'eventId, outcomeId, and stake are required' });
  }

  // Validate stake
  const MIN_STAKE = 10;
  const MAX_STAKE = 1000;
  if (stake < MIN_STAKE || stake > MAX_STAKE) {
    return response(400, { error: `Stake must be between ${MIN_STAKE} and ${MAX_STAKE} coins` });
  }

  if (stake > user.coins) {
    return response(400, { error: 'Insufficient coins' });
  }

  // Get event
  const eventResult = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (eventResult.length === 0) {
    return response(404, { error: 'Event not found' });
  }
  const eventData = eventResult[0];

  // Validate event is still open for predictions
  if (eventData.status !== 'scheduled') {
    return response(400, { error: 'Event is no longer open for predictions' });
  }

  // Check if event has started
  if (new Date(eventData.startTime) <= new Date()) {
    return response(400, { error: 'Event has already started' });
  }

  // Get outcome and market
  const outcomeResult = await db.select().from(outcomes).where(eq(outcomes.id, outcomeId)).limit(1);
  if (outcomeResult.length === 0) {
    return response(404, { error: 'Outcome not found' });
  }
  const outcomeData = outcomeResult[0];

  if (outcomeData.isSuspended) {
    return response(400, { error: 'This selection is currently suspended' });
  }

  const marketResult = await db.select().from(markets).where(eq(markets.id, outcomeData.marketId)).limit(1);
  if (marketResult.length === 0) {
    return response(404, { error: 'Market not found' });
  }
  const marketData = marketResult[0];

  if (marketData.isSuspended) {
    return response(400, { error: 'This market is currently suspended' });
  }

  // Calculate potential winnings
  const odds = parseFloat(outcomeData.odds);
  const potentialCoins = Math.floor(stake * odds);
  const potentialStars = Math.floor(potentialCoins - stake);

  // Create prediction and deduct coins in a transaction
  const newCoins = user.coins - stake;

  // Deduct coins from user
  await db
    .update(users)
    .set({ coins: newCoins, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // Create prediction
  // Note: Using sql template to cast enum values for RDS Data API compatibility
  const [newPrediction] = await db
    .insert(predictions)
    .values({
      userId: user.id,
      type: sql`'single'::prediction_type` as unknown as 'single',
      eventId,
      marketId: marketData.id,
      outcomeId,
      stake,
      odds: outcomeData.odds,
      totalOdds: outcomeData.odds,
      potentialCoins,
      potentialStars,
      starsMultiplier: '1.0',
    })
    .returning();

  // Create transaction record
  // Note: Using sql template to cast enum values for RDS Data API compatibility
  await db.insert(transactions).values({
    userId: user.id,
    type: sql`'prediction_stake'::transaction_type` as unknown as 'prediction_stake',
    currency: sql`'coins'::currency_type` as unknown as 'coins',
    amount: -stake,
    balanceAfter: newCoins,
    description: `Prediction on ${eventData.homeTeamName || eventData.player1Name} vs ${eventData.awayTeamName || eventData.player2Name}`,
    referenceId: newPrediction.id,
    referenceType: 'prediction',
  });

  // Update user stats
  await db
    .update(userStats)
    .set({
      totalPredictions: sql`${userStats.totalPredictions} + 1`,
      totalCoinsWagered: sql`${userStats.totalCoinsWagered} + ${stake}`,
      updatedAt: new Date(),
    })
    .where(eq(userStats.userId, user.id));

  // Increment event prediction count
  await db
    .update(events)
    .set({
      predictionCount: sql`${events.predictionCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  return response(201, {
    prediction: {
      id: newPrediction.id,
      type: 'single',
      stake,
      odds,
      potentialCoins,
      potentialStars,
      status: 'pending',
      event: {
        id: eventData.id,
        homeTeamName: eventData.homeTeamName,
        awayTeamName: eventData.awayTeamName,
        player1Name: eventData.player1Name,
        player2Name: eventData.player2Name,
        startTime: eventData.startTime,
      },
      outcome: {
        id: outcomeData.id,
        name: outcomeData.name,
        odds,
      },
      createdAt: newPrediction.createdAt,
    },
    newBalance: newCoins,
  });
}

interface ListPredictionsParams {
  status?: string;
  page?: string;
  pageSize?: string;
}

async function handleListPredictions(
  userId: string,
  params: ListPredictionsParams
): Promise<APIGatewayProxyResultV2> {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(params.pageSize || '20', 10)));
  const offset = (page - 1) * pageSize;

  // Build conditions
  const conditions = [eq(predictions.userId, userId)];

  if (params.status) {
    const validStatuses = ['pending', 'won', 'lost', 'void', 'cashout'];
    if (validStatuses.includes(params.status)) {
      conditions.push(eq(predictions.status, params.status as any));
    }
  }

  const whereClause = and(...conditions);

  // Count total
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(predictions)
    .where(whereClause);
  const total = countResult[0]?.count || 0;

  // Fetch predictions with related data
  const predictionsData = await db.query.predictions.findMany({
    where: whereClause,
    with: {
      event: true,
      outcome: true,
    },
    orderBy: [desc(predictions.createdAt)],
    limit: pageSize,
    offset,
  });

  const data = predictionsData.map((p) => ({
    id: p.id,
    type: p.type,
    stake: p.stake,
    odds: parseFloat(p.odds),
    totalOdds: parseFloat(p.totalOdds),
    potentialCoins: p.potentialCoins,
    potentialStars: p.potentialStars,
    status: p.status,
    settledCoins: p.settledCoins,
    settledStars: p.settledStars,
    settledAt: p.settledAt,
    createdAt: p.createdAt,
    event: p.event
      ? {
          id: p.event.id,
          homeTeamName: p.event.homeTeamName,
          awayTeamName: p.event.awayTeamName,
          player1Name: p.event.player1Name,
          player2Name: p.event.player2Name,
          startTime: p.event.startTime,
          status: p.event.status,
          homeScore: p.event.homeScore,
          awayScore: p.event.awayScore,
        }
      : null,
    outcome: p.outcome
      ? {
          id: p.outcome.id,
          name: p.outcome.name,
          odds: parseFloat(p.outcome.odds),
          isWinner: p.outcome.isWinner,
        }
      : null,
  }));

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

async function handleGetStats(userId: string): Promise<APIGatewayProxyResultV2> {
  const statsResult = await db.select().from(userStats).where(eq(userStats.userId, userId)).limit(1);

  if (statsResult.length === 0) {
    return response(200, {
      totalPredictions: 0,
      totalWins: 0,
      totalLosses: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalStarsEarned: 0,
      totalCoinsWagered: 0,
    });
  }

  const stats = statsResult[0];
  const winRate =
    stats.totalWins + stats.totalLosses > 0
      ? Math.round((stats.totalWins / (stats.totalWins + stats.totalLosses)) * 100)
      : 0;

  return response(200, {
    totalPredictions: stats.totalPredictions,
    totalWins: stats.totalWins,
    totalLosses: stats.totalLosses,
    winRate,
    currentStreak: stats.currentStreak,
    bestStreak: stats.bestStreak,
    totalStarsEarned: stats.totalStarsEarned,
    totalCoinsWagered: stats.totalCoinsWagered,
  });
}

async function handleGetPrediction(predictionId: string, userId: string): Promise<APIGatewayProxyResultV2> {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(predictionId)) {
    return response(400, { error: 'Invalid prediction ID format' });
  }

  const predictionData = await db.query.predictions.findFirst({
    where: and(eq(predictions.id, predictionId), eq(predictions.userId, userId)),
    with: {
      event: true,
      outcome: true,
      market: true,
    },
  });

  if (!predictionData) {
    return response(404, { error: 'Prediction not found' });
  }

  return response(200, {
    data: {
      id: predictionData.id,
      type: predictionData.type,
      stake: predictionData.stake,
      odds: parseFloat(predictionData.odds),
      totalOdds: parseFloat(predictionData.totalOdds),
      potentialCoins: predictionData.potentialCoins,
      potentialStars: predictionData.potentialStars,
      status: predictionData.status,
      settledCoins: predictionData.settledCoins,
      settledStars: predictionData.settledStars,
      settledAt: predictionData.settledAt,
      createdAt: predictionData.createdAt,
      event: predictionData.event
        ? {
            id: predictionData.event.id,
            homeTeamName: predictionData.event.homeTeamName,
            awayTeamName: predictionData.event.awayTeamName,
            player1Name: predictionData.event.player1Name,
            player2Name: predictionData.event.player2Name,
            startTime: predictionData.event.startTime,
            status: predictionData.event.status,
            homeScore: predictionData.event.homeScore,
            awayScore: predictionData.event.awayScore,
          }
        : null,
      market: predictionData.market
        ? {
            id: predictionData.market.id,
            type: predictionData.market.type,
            name: predictionData.market.name,
          }
        : null,
      outcome: predictionData.outcome
        ? {
            id: predictionData.outcome.id,
            name: predictionData.outcome.name,
            odds: parseFloat(predictionData.outcome.odds),
            isWinner: predictionData.outcome.isWinner,
          }
        : null,
    },
  });
}
