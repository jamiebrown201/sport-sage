/**
 * Intelligent Rate Limit Detection
 *
 * Features:
 * - Adaptive delays based on response patterns
 * - Exponential backoff on 429 responses
 * - Gradual recovery on success
 * - Per-domain tracking
 */

import { logger } from '../logger.js';

interface DomainRateInfo {
  suggestedDelay: number;
  lastRequest: number;
  consecutiveFailures: number;
  cooldownUntil: number | null;
}

const DEFAULT_DELAY_MS = 3000;
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 60000;
const RECOVERY_FACTOR = 0.9; // Reduce delay by 10% on success
const BACKOFF_FACTOR = 1.5; // Increase delay by 50% on rate limit

class RateLimitDetector {
  private domains: Map<string, DomainRateInfo> = new Map();

  private getDomainInfo(domain: string): DomainRateInfo {
    let info = this.domains.get(domain);
    if (!info) {
      info = {
        suggestedDelay: DEFAULT_DELAY_MS,
        lastRequest: 0,
        consecutiveFailures: 0,
        cooldownUntil: null,
      };
      this.domains.set(domain, info);
    }
    return info;
  }

  /**
   * Get the suggested delay before making a request to this domain
   */
  getSuggestedDelay(domain: string): number {
    const info = this.getDomainInfo(domain);

    // Check if in cooldown
    if (info.cooldownUntil && Date.now() < info.cooldownUntil) {
      const remaining = info.cooldownUntil - Date.now();
      logger.debug(`Domain ${domain} in cooldown`, { remainingMs: remaining });
      return remaining;
    }

    // Time since last request
    const timeSinceLastRequest = Date.now() - info.lastRequest;

    // If we haven't waited long enough, return remaining time
    if (timeSinceLastRequest < info.suggestedDelay) {
      return info.suggestedDelay - timeSinceLastRequest;
    }

    return 0;
  }

  /**
   * Wait the suggested time before making a request
   */
  async waitForRateLimit(domain: string): Promise<void> {
    const delay = this.getSuggestedDelay(domain);
    if (delay > 0) {
      logger.debug(`Rate limiting: waiting ${delay}ms for ${domain}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Update last request time
    const info = this.getDomainInfo(domain);
    info.lastRequest = Date.now();
  }

  /**
   * Check response for rate limiting and adjust delays
   */
  checkRateLimit(
    domain: string,
    status: number,
    headers?: Record<string, string>
  ): { isRateLimited: boolean; retryAfter?: number } {
    const info = this.getDomainInfo(domain);

    if (status === 429) {
      info.consecutiveFailures++;

      // Check for Retry-After header
      const retryAfterHeader = headers?.['retry-after'];
      if (retryAfterHeader) {
        const retryAfterSec = parseInt(retryAfterHeader);
        if (!isNaN(retryAfterSec)) {
          info.suggestedDelay = Math.min(retryAfterSec * 1000, MAX_DELAY_MS);
          info.cooldownUntil = Date.now() + info.suggestedDelay;

          logger.warn(`Rate limit 429: using Retry-After header`, {
            domain,
            retryAfterSec,
            suggestedDelay: info.suggestedDelay,
          });

          return { isRateLimited: true, retryAfter: retryAfterSec };
        }
      }

      // Exponential backoff
      info.suggestedDelay = Math.min(info.suggestedDelay * BACKOFF_FACTOR, MAX_DELAY_MS);

      // Set cooldown for severe rate limiting
      if (info.consecutiveFailures >= 3) {
        info.cooldownUntil = Date.now() + info.suggestedDelay * 2;
        logger.warn(`Rate limit: multiple failures, entering cooldown`, {
          domain,
          consecutiveFailures: info.consecutiveFailures,
          cooldownMs: info.suggestedDelay * 2,
        });
      }

      return { isRateLimited: true };
    }

    // Handle other error status codes
    if (status === 403 || status === 503) {
      info.consecutiveFailures++;
      info.suggestedDelay = Math.min(info.suggestedDelay * BACKOFF_FACTOR, MAX_DELAY_MS);

      logger.warn(`HTTP ${status}: increasing delay`, {
        domain,
        newDelay: info.suggestedDelay,
      });

      return { isRateLimited: true };
    }

    // Success - gradually reduce delay
    if (status >= 200 && status < 300) {
      info.consecutiveFailures = 0;
      info.cooldownUntil = null;
      info.suggestedDelay = Math.max(info.suggestedDelay * RECOVERY_FACTOR, MIN_DELAY_MS);

      return { isRateLimited: false };
    }

    return { isRateLimited: false };
  }

  /**
   * Record success for a domain (call after successful scrape)
   */
  recordSuccess(domain: string): void {
    const info = this.getDomainInfo(domain);
    info.consecutiveFailures = 0;
    info.cooldownUntil = null;
    info.suggestedDelay = Math.max(info.suggestedDelay * RECOVERY_FACTOR, MIN_DELAY_MS);
  }

  /**
   * Record failure for a domain
   */
  recordFailure(domain: string, reason?: string): void {
    const info = this.getDomainInfo(domain);
    info.consecutiveFailures++;
    info.suggestedDelay = Math.min(info.suggestedDelay * BACKOFF_FACTOR, MAX_DELAY_MS);

    logger.debug(`Failure recorded for ${domain}`, {
      reason,
      consecutiveFailures: info.consecutiveFailures,
      newDelay: info.suggestedDelay,
    });
  }

  /**
   * Get stats for all tracked domains
   */
  getStats(): Record<
    string,
    {
      suggestedDelayMs: number;
      consecutiveFailures: number;
      inCooldown: boolean;
    }
  > {
    const stats: Record<string, any> = {};

    for (const [domain, info] of this.domains) {
      stats[domain] = {
        suggestedDelayMs: info.suggestedDelay,
        consecutiveFailures: info.consecutiveFailures,
        inCooldown: info.cooldownUntil !== null && Date.now() < info.cooldownUntil,
      };
    }

    return stats;
  }

  /**
   * Reset all tracking
   */
  reset(): void {
    this.domains.clear();
    logger.info('Rate limit detector reset');
  }
}

// Singleton instance
let detectorInstance: RateLimitDetector | null = null;

export function getRateLimitDetector(): RateLimitDetector {
  if (!detectorInstance) {
    detectorInstance = new RateLimitDetector();
  }
  return detectorInstance;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}
