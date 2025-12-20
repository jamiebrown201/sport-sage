import type { APIGatewayProxyEvent } from 'aws-lambda';
import { unauthorized } from '../utils/response';
import { logger } from '../utils/logger';

export interface AuthContext {
  userId: string;
  cognitoId: string;
  email: string;
  username?: string;
}

export function extractAuthContext(event: APIGatewayProxyEvent): AuthContext | null {
  try {
    const claims = event.requestContext.authorizer?.claims;

    if (!claims) {
      logger.warn('No claims found in request context');
      return null;
    }

    const cognitoId = claims.sub as string;
    const email = claims.email as string;
    const username = claims['cognito:username'] as string | undefined;

    if (!cognitoId || !email) {
      logger.warn('Missing required claims', { cognitoId: !!cognitoId, email: !!email });
      return null;
    }

    // Note: userId is the database user ID, not the Cognito ID
    // The actual mapping is done in the handler after looking up the user
    return {
      userId: '', // Will be populated after DB lookup
      cognitoId,
      email,
      username,
    };
  } catch (error) {
    logger.error('Error extracting auth context', error);
    return null;
  }
}

type AuthResult =
  | { error: ReturnType<typeof unauthorized>; context?: never }
  | { error?: never; context: AuthContext };

export function requireAuth(event: APIGatewayProxyEvent): AuthResult {
  const context = extractAuthContext(event);
  if (!context) {
    return { error: unauthorized() };
  }
  return { context };
}
