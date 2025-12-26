import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getDb, users, userStats, transactions, DAILY_TOPUP_AMOUNT } from '@sport-sage/database';
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
  const route = path.replace(/^\/api\/wallet\/?/, '').replace(/\/$/, '') || '';

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
    // GET /api/wallet - Get balances
    if (httpMethod === 'GET' && route === '') {
      return handleGetWallet(user);
    }

    // GET /api/wallet/transactions - Transaction history
    if (httpMethod === 'GET' && route === 'transactions') {
      return handleGetTransactions(user.id, queryStringParameters || {});
    }

    // GET /api/wallet/topup/status - Check if can claim daily topup
    if (httpMethod === 'GET' && route === 'topup/status') {
      return handleTopupStatus(user.id);
    }

    // POST /api/wallet/topup - Claim daily topup
    if (httpMethod === 'POST' && route === 'topup') {
      return handleClaimTopup(user);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Wallet handler error:', error);
    return response(500, { error: 'Internal server error' });
  }
}

async function handleGetWallet(user: typeof users.$inferSelect): Promise<APIGatewayProxyResultV2> {
  const statsResult = await db.select().from(userStats).where(eq(userStats.userId, user.id)).limit(1);
  const stats = statsResult[0];

  // Check topup status
  const canClaimTopup = stats?.lastTopupDate
    ? new Date().getTime() - new Date(stats.lastTopupDate).getTime() > 24 * 60 * 60 * 1000
    : true;

  return response(200, {
    coins: user.coins,
    stars: user.stars,
    gems: user.gems,
    subscriptionTier: user.subscriptionTier,
    canClaimDailyTopup: canClaimTopup,
    nextTopupAt: stats?.lastTopupDate
      ? new Date(new Date(stats.lastTopupDate).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : null,
  });
}

interface GetTransactionsParams {
  page?: string;
  pageSize?: string;
  type?: string;
  currency?: string;
}

async function handleGetTransactions(
  userId: string,
  params: GetTransactionsParams
): Promise<APIGatewayProxyResultV2> {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(params.pageSize || '20', 10)));
  const offset = (page - 1) * pageSize;

  // Count total
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(eq(transactions.userId, userId));
  const total = countResult[0]?.count || 0;

  // Fetch transactions
  const txns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(pageSize)
    .offset(offset);

  const data = txns.map((t) => ({
    id: t.id,
    type: t.type,
    currency: t.currency,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    description: t.description,
    createdAt: t.createdAt,
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

async function handleTopupStatus(userId: string): Promise<APIGatewayProxyResultV2> {
  const statsResult = await db.select().from(userStats).where(eq(userStats.userId, userId)).limit(1);
  const stats = statsResult[0];

  const now = new Date();
  const lastTopup = stats?.lastTopupDate ? new Date(stats.lastTopupDate) : null;
  const hoursElapsed = lastTopup ? (now.getTime() - lastTopup.getTime()) / (1000 * 60 * 60) : 999;
  const canClaim = hoursElapsed >= 24;

  const nextTopupAt = lastTopup
    ? new Date(lastTopup.getTime() + 24 * 60 * 60 * 1000)
    : null;

  return response(200, {
    canClaim,
    amount: DAILY_TOPUP_AMOUNT,
    lastClaimedAt: lastTopup?.toISOString() || null,
    nextClaimAt: canClaim ? null : nextTopupAt?.toISOString(),
    hoursUntilNextClaim: canClaim ? 0 : Math.max(0, 24 - hoursElapsed),
  });
}

async function handleClaimTopup(user: typeof users.$inferSelect): Promise<APIGatewayProxyResultV2> {
  const statsResult = await db.select().from(userStats).where(eq(userStats.userId, user.id)).limit(1);
  const stats = statsResult[0];

  const now = new Date();
  const lastTopup = stats?.lastTopupDate ? new Date(stats.lastTopupDate) : null;
  const hoursElapsed = lastTopup ? (now.getTime() - lastTopup.getTime()) / (1000 * 60 * 60) : 999;

  if (hoursElapsed < 24) {
    const nextTopupAt = new Date(lastTopup!.getTime() + 24 * 60 * 60 * 1000);
    return response(400, {
      error: 'Daily top-up not yet available',
      nextClaimAt: nextTopupAt.toISOString(),
      hoursRemaining: Math.ceil(24 - hoursElapsed),
    });
  }

  // Add coins
  const newCoins = user.coins + DAILY_TOPUP_AMOUNT;

  await db
    .update(users)
    .set({ coins: newCoins, updatedAt: now })
    .where(eq(users.id, user.id));

  // Update stats
  await db
    .update(userStats)
    .set({ lastTopupDate: now, updatedAt: now })
    .where(eq(userStats.userId, user.id));

  // Create transaction
  // Note: Using sql template to cast enum values for RDS Data API compatibility
  await db.insert(transactions).values({
    userId: user.id,
    type: sql`'daily_topup'::transaction_type` as unknown as 'daily_topup',
    currency: sql`'coins'::currency_type` as unknown as 'coins',
    amount: DAILY_TOPUP_AMOUNT,
    balanceAfter: newCoins,
    description: 'Daily coin top-up',
  });

  return response(200, {
    message: 'Daily top-up claimed successfully!',
    coinsAdded: DAILY_TOPUP_AMOUNT,
    newBalance: newCoins,
    nextClaimAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  });
}
