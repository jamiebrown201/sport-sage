import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, users, userStats, transactions, WELCOME_BONUS_COINS } from '@sport-sage/database';
import { eq } from 'drizzle-orm';

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

function getCognitoId(event: APIGatewayProxyEvent): string | null {
  // The Cognito ID comes from the JWT claims set by API Gateway authorizer
  const claims = event.requestContext.authorizer?.claims;
  if (claims?.sub) return claims.sub as string;

  // Also check jwt claims (HTTP API format)
  const jwt = event.requestContext.authorizer?.jwt?.claims;
  if (jwt?.sub) return jwt.sub as string;

  return null;
}

function getEmail(event: APIGatewayProxyEvent): string | null {
  const claims = event.requestContext.authorizer?.claims;
  if (claims?.email) return claims.email as string;

  const jwt = event.requestContext.authorizer?.jwt?.claims;
  if (jwt?.email) return jwt.email as string;

  return null;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path, pathParameters } = event;
  const route = path.replace(/^\/api\/auth\/?/, '').replace(/\/$/, '') || '';

  try {
    // POST /api/auth/register - Create user in DB after Cognito signup
    if (httpMethod === 'POST' && route === 'register') {
      return handleRegister(event);
    }

    // GET /api/auth/me - Get current user and stats
    if (httpMethod === 'GET' && route === 'me') {
      return handleGetMe(event);
    }

    // PATCH /api/auth/me - Update user profile
    if (httpMethod === 'PATCH' && route === 'me') {
      return handleUpdateMe(event);
    }

    // GET /api/auth/check-username/:username - Check if username is available
    if (httpMethod === 'GET' && route.startsWith('check-username')) {
      const username = pathParameters?.proxy?.replace('check-username/', '') ||
                       route.replace('check-username/', '');
      if (!username) {
        return response(400, { error: 'Username is required' });
      }
      return handleCheckUsername(username);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Auth handler error:', error);
    return response(500, { error: 'Internal server error' });
  }
}

async function handleRegister(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const cognitoId = getCognitoId(event);
  const email = getEmail(event);

  if (!cognitoId) {
    return response(401, { error: 'Unauthorized' });
  }

  if (!email) {
    return response(400, { error: 'Email not found in token' });
  }

  // Parse body for username
  let body: { username?: string };
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return response(400, { error: 'Invalid JSON body' });
  }

  const { username } = body;
  if (!username || username.length < 3 || username.length > 20) {
    return response(400, { error: 'Username must be between 3 and 20 characters' });
  }

  // Validate username format (alphanumeric and underscores only)
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return response(400, { error: 'Username can only contain letters, numbers, and underscores' });
  }

  // Check if user already exists
  const existingUser = await db.select().from(users).where(eq(users.cognitoId, cognitoId)).limit(1);
  if (existingUser.length > 0) {
    // User already registered, return existing user
    const stats = await db.select().from(userStats).where(eq(userStats.userId, existingUser[0].id)).limit(1);
    return response(200, {
      user: existingUser[0],
      stats: stats[0] || null,
      message: 'User already registered',
    });
  }

  // Check if username is taken
  const usernameTaken = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (usernameTaken.length > 0) {
    return response(409, { error: 'Username is already taken' });
  }

  // Check if email is taken (shouldn't happen, but safety check)
  const emailTaken = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (emailTaken.length > 0) {
    return response(409, { error: 'Email is already registered' });
  }

  // Generate referral code
  const referralCode = generateReferralCode();

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      cognitoId,
      username,
      email,
      coins: WELCOME_BONUS_COINS,
      stars: 0,
      gems: 0,
      referralCode,
    })
    .returning();

  // Create user stats
  const [newStats] = await db
    .insert(userStats)
    .values({
      userId: newUser.id,
    })
    .returning();

  // Create welcome bonus transaction
  await db.insert(transactions).values({
    userId: newUser.id,
    type: 'welcome_bonus',
    currency: 'coins',
    amount: WELCOME_BONUS_COINS,
    balanceAfter: WELCOME_BONUS_COINS,
    description: 'Welcome to Sport Sage! Here are your starting coins.',
  });

  return response(201, {
    user: newUser,
    stats: newStats,
    message: 'Registration successful',
  });
}

async function handleGetMe(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const cognitoId = getCognitoId(event);

  if (!cognitoId) {
    return response(401, { error: 'Unauthorized' });
  }

  const userResult = await db.select().from(users).where(eq(users.cognitoId, cognitoId)).limit(1);

  if (userResult.length === 0) {
    return response(404, { error: 'User not found. Please complete registration.' });
  }

  const user = userResult[0];
  const statsResult = await db.select().from(userStats).where(eq(userStats.userId, user.id)).limit(1);

  return response(200, {
    user,
    stats: statsResult[0] || null,
  });
}

async function handleUpdateMe(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const cognitoId = getCognitoId(event);

  if (!cognitoId) {
    return response(401, { error: 'Unauthorized' });
  }

  let body: { isOver18?: boolean; showAffiliates?: boolean; avatarUrl?: string };
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return response(400, { error: 'Invalid JSON body' });
  }

  // Only allow updating certain fields
  const allowedUpdates: Partial<typeof users.$inferInsert> = {};
  if (typeof body.isOver18 === 'boolean') allowedUpdates.isOver18 = body.isOver18;
  if (typeof body.showAffiliates === 'boolean') allowedUpdates.showAffiliates = body.showAffiliates;
  if (typeof body.avatarUrl === 'string') allowedUpdates.avatarUrl = body.avatarUrl;

  if (Object.keys(allowedUpdates).length === 0) {
    return response(400, { error: 'No valid updates provided' });
  }

  allowedUpdates.updatedAt = new Date();

  const [updated] = await db
    .update(users)
    .set(allowedUpdates)
    .where(eq(users.cognitoId, cognitoId))
    .returning();

  if (!updated) {
    return response(404, { error: 'User not found' });
  }

  const statsResult = await db.select().from(userStats).where(eq(userStats.userId, updated.id)).limit(1);

  return response(200, {
    user: updated,
    stats: statsResult[0] || null,
  });
}

async function handleCheckUsername(username: string): Promise<APIGatewayProxyResult> {
  if (!username || username.length < 3 || username.length > 20) {
    return response(400, { error: 'Username must be between 3 and 20 characters' });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return response(400, { error: 'Username can only contain letters, numbers, and underscores' });
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);

  return response(200, {
    username,
    available: existing.length === 0,
  });
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
