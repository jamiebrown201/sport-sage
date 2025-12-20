import type { APIGatewayProxyResult } from 'aws-lambda';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

export function success<T>(data: T, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify({ data }),
  };
}

export function successWithPagination<T>(
  data: T,
  pagination: ApiResponse['pagination'],
  statusCode = 200
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify({ data, pagination }),
  };
}

export function created<T>(data: T): APIGatewayProxyResult {
  return success(data, 201);
}

export function noContent(): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: corsHeaders(),
    body: '',
  };
}

export function error(
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify({
      error: { code, message, details },
    }),
  };
}

export function badRequest(message: string, details?: unknown): APIGatewayProxyResult {
  return error(400, 'BAD_REQUEST', message, details);
}

export function unauthorized(message = 'Authentication required'): APIGatewayProxyResult {
  return error(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'Access denied'): APIGatewayProxyResult {
  return error(403, 'FORBIDDEN', message);
}

export function notFound(resource = 'Resource'): APIGatewayProxyResult {
  return error(404, 'NOT_FOUND', `${resource} not found`);
}

export function conflict(message: string): APIGatewayProxyResult {
  return error(409, 'CONFLICT', message);
}

export function internalError(message = 'Internal server error'): APIGatewayProxyResult {
  return error(500, 'INTERNAL_ERROR', message);
}

function corsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  };
}
