import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getDb, users, userStats } from '@sport-sage/database';
import { eq, desc, sql } from 'drizzle-orm';

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
  const queryStringParameters = event.queryStringParameters;
  const route = path.replace(/^\/api\/leaderboard\/?/, '').replace(/\/$/, '') || '';

  const cognitoId = getCognitoId(event);
  if (!cognitoId) {
    return response(401, { error: 'Unauthorized' });
  }

  // Get current user
  const userResult = await db.select().from(users).where(eq(users.cognitoId, cognitoId)).limit(1);
  if (userResult.length === 0) {
    return response(404, { error: 'User not found. Please complete registration.' });
  }
  const currentUser = userResult[0];

  try {
    // GET /api/leaderboard - Global rankings
    if (httpMethod === 'GET' && route === '') {
      return handleGetLeaderboard(currentUser.id, queryStringParameters || {});
    }

    // GET /api/leaderboard/position - Current user's rank
    if (httpMethod === 'GET' && route === 'position') {
      return handleGetPosition(currentUser.id);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Leaderboard handler error:', error);
    return response(500, { error: 'Internal server error' });
  }
}

interface GetLeaderboardParams {
  page?: string;
  pageSize?: string;
  sortBy?: string;
}

async function handleGetLeaderboard(
  currentUserId: string,
  params: GetLeaderboardParams
): Promise<APIGatewayProxyResultV2> {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '50', 10)));
  const offset = (page - 1) * pageSize;

  // Determine sort column
  const sortBy = params.sortBy || 'stars';
  let orderColumn;
  switch (sortBy) {
    case 'wins':
      orderColumn = userStats.totalWins;
      break;
    case 'streak':
      orderColumn = userStats.currentStreak;
      break;
    case 'stars':
    default:
      orderColumn = userStats.totalStarsEarned;
  }

  // Count total users with stats
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userStats);
  const total = countResult[0]?.count || 0;

  // Fetch leaderboard with user info
  const leaderboardData = await db
    .select({
      rank: sql<number>`row_number() over (order by ${orderColumn} desc)::int`,
      userId: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      stars: userStats.totalStarsEarned,
      wins: userStats.totalWins,
      losses: userStats.totalLosses,
      currentStreak: userStats.currentStreak,
      bestStreak: userStats.bestStreak,
    })
    .from(userStats)
    .innerJoin(users, eq(users.id, userStats.userId))
    .orderBy(desc(orderColumn))
    .limit(pageSize)
    .offset(offset);

  const data = leaderboardData.map((entry) => ({
    rank: entry.rank,
    userId: entry.userId,
    username: entry.username,
    avatarUrl: entry.avatarUrl,
    stars: entry.stars,
    wins: entry.wins,
    losses: entry.losses,
    winRate:
      entry.wins + entry.losses > 0
        ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100)
        : 0,
    currentStreak: entry.currentStreak,
    bestStreak: entry.bestStreak,
    isCurrentUser: entry.userId === currentUserId,
  }));

  return response(200, {
    data,
    pagination: {
      page,
      pageSize,
      total,
      hasMore: offset + data.length < total,
    },
    sortBy,
  });
}

async function handleGetPosition(userId: string): Promise<APIGatewayProxyResultV2> {
  // Get user's stats
  const statsResult = await db.select().from(userStats).where(eq(userStats.userId, userId)).limit(1);

  if (statsResult.length === 0) {
    return response(200, {
      rank: null,
      stars: 0,
      percentile: null,
      message: 'No predictions made yet',
    });
  }

  const stats = statsResult[0];

  // Count users with more stars
  const higherRankedResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userStats)
    .where(sql`${userStats.totalStarsEarned} > ${stats.totalStarsEarned}`);
  const higherRanked = higherRankedResult[0]?.count || 0;

  // Count total users
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userStats);
  const totalUsers = totalResult[0]?.count || 0;

  const rank = higherRanked + 1;
  const percentile = totalUsers > 0 ? Math.round(((totalUsers - rank) / totalUsers) * 100) : 0;

  return response(200, {
    rank,
    totalUsers,
    stars: stats.totalStarsEarned,
    wins: stats.totalWins,
    losses: stats.totalLosses,
    winRate:
      stats.totalWins + stats.totalLosses > 0
        ? Math.round((stats.totalWins / (stats.totalWins + stats.totalLosses)) * 100)
        : 0,
    currentStreak: stats.currentStreak,
    bestStreak: stats.bestStreak,
    percentile,
    percentileMessage:
      percentile >= 90
        ? 'Top 10%!'
        : percentile >= 75
          ? 'Top 25%'
          : percentile >= 50
            ? 'Top 50%'
            : 'Keep making predictions to climb the ranks!',
  });
}
