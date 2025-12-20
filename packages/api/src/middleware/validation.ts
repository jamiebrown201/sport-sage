import { z } from 'zod';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { badRequest } from '../utils/response';
import { logger } from '../utils/logger';

export function parseBody<T extends z.ZodType>(
  event: APIGatewayProxyEvent,
  schema: T
): { data: z.infer<T> } | { error: ReturnType<typeof badRequest> } {
  try {
    if (!event.body) {
      return { error: badRequest('Request body is required') };
    }

    const body = JSON.parse(event.body);
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      logger.warn('Validation failed', { errors });
      return { error: badRequest('Validation failed', errors) };
    }

    return { data: result.data };
  } catch (error) {
    logger.error('Error parsing request body', error);
    return { error: badRequest('Invalid JSON in request body') };
  }
}

export function parseQueryParams<T extends z.ZodType>(
  event: APIGatewayProxyEvent,
  schema: T
): { data: z.infer<T> } | { error: ReturnType<typeof badRequest> } {
  try {
    const params = event.queryStringParameters || {};
    const result = schema.safeParse(params);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      logger.warn('Query validation failed', { errors });
      return { error: badRequest('Invalid query parameters', errors) };
    }

    return { data: result.data };
  } catch (error) {
    logger.error('Error parsing query params', error);
    return { error: badRequest('Invalid query parameters') };
  }
}

export function parsePathParams<T extends z.ZodType>(
  event: APIGatewayProxyEvent,
  schema: T
): { data: z.infer<T> } | { error: ReturnType<typeof badRequest> } {
  try {
    const params = event.pathParameters || {};
    const result = schema.safeParse(params);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      logger.warn('Path validation failed', { errors });
      return { error: badRequest('Invalid path parameters', errors) };
    }

    return { data: result.data };
  } catch (error) {
    logger.error('Error parsing path params', error);
    return { error: badRequest('Invalid path parameters') };
  }
}
