// Authenticated HTTP Client for Sport Sage API

import { API_CONFIG } from '../auth/config';
import { cognitoAuth } from '../auth/cognito';

// Debug logging for development
const DEBUG = __DEV__;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[API] ${message}`, data !== undefined ? data : '');
  }
};

export interface ApiResponse<T> {
  data: T;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  requiresAuth?: boolean;
  retries?: number;
}

class HttpClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor() {
    this.baseUrl = API_CONFIG.baseUrl;
    this.timeout = API_CONFIG.timeout;
    this.maxRetries = API_CONFIG.retryAttempts;
  }

  /**
   * Make a GET request
   */
  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   */
  async post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  /**
   * Make a PUT request
   */
  async put<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  /**
   * Make a PATCH request
   */
  async patch<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  /**
   * Core request method with authentication, retries, and error handling
   */
  private async request<T>(path: string, options: RequestOptions): Promise<T> {
    const {
      params,
      body,
      requiresAuth = true,
      retries = this.maxRetries,
      headers: customHeaders,
      ...fetchOptions
    } = options;

    // Build URL with query params
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    log(`${fetchOptions.method || 'GET'} ${path}`, { requiresAuth, hasBody: !!body });

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders as Record<string, string>),
    };

    // Add auth token if required
    if (requiresAuth) {
      log('Getting auth token...');
      const token = await cognitoAuth.getIdToken();
      if (!token) {
        log('No auth token available - user not authenticated');
        throw this.createError('NotAuthenticated', 'Please sign in to continue', 401);
      }
      log('Auth token obtained');
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Execute request with timeout and retries
    let lastError: ApiError | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...fetchOptions,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle response
        if (!response.ok) {
          log(`Request failed: ${response.status} ${response.statusText}`);
          // Handle 401 - try to refresh token once
          if (response.status === 401 && requiresAuth && attempt === 0) {
            log('Got 401, attempting token refresh...');
            try {
              await cognitoAuth.refreshSession();
              const newToken = await cognitoAuth.getIdToken();
              if (newToken) {
                log('Token refreshed, retrying request');
                headers['Authorization'] = `Bearer ${newToken}`;
                continue; // Retry with new token
              }
            } catch {
              // Refresh failed, throw auth error
              log('Token refresh failed');
              throw this.createError('SessionExpired', 'Your session has expired. Please sign in again.', 401);
            }
          }

          // Parse error response
          let errorBody: { message?: string; error?: string } = {};
          try {
            errorBody = await response.json();
          } catch {
            // Response body not JSON
          }

          const error = this.createError(
            this.getErrorCode(response.status),
            errorBody.message || errorBody.error || response.statusText,
            response.status
          );
          log('API error', error);
          throw error;
        }

        // Parse success response
        const contentType = response.headers.get('Content-Type');
        if (contentType?.includes('application/json')) {
          const data = await response.json();
          log(`Request successful: ${path}`);
          return data;
        }

        // No content (204) or non-JSON response
        log(`Request successful (no content): ${path}`);
        return {} as T;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = this.createError('Timeout', 'Request timed out', 408);
        } else if ((error as ApiError).statusCode) {
          lastError = error as ApiError;
          // Don't retry client errors (4xx) except 401/408/429
          const status = lastError.statusCode;
          if (status >= 400 && status < 500 && ![401, 408, 429].includes(status)) {
            throw lastError;
          }
        } else {
          lastError = this.createError('NetworkError', 'Unable to connect to server', 0);
        }

        // Exponential backoff before retry
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || this.createError('UnknownError', 'An unknown error occurred', 500);
  }

  private createError(code: string, message: string, statusCode: number): ApiError {
    return { code, message, statusCode };
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case 400:
        return 'BadRequest';
      case 401:
        return 'Unauthorized';
      case 403:
        return 'Forbidden';
      case 404:
        return 'NotFound';
      case 409:
        return 'Conflict';
      case 422:
        return 'ValidationError';
      case 429:
        return 'TooManyRequests';
      case 500:
        return 'InternalError';
      case 502:
      case 503:
      case 504:
        return 'ServiceUnavailable';
      default:
        return 'UnknownError';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const httpClient = new HttpClient();

// Export error helpers
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'statusCode' in error
  );
}

export function getApiErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
