/**
 * Tiered Data Fetcher - Tries FREE options first, then cheapest proxies
 *
 * Strategy (in order):
 * 1. Direct request (no proxy) - FREE
 * 2. Alternative data source (SofaScore API) - FREE
 * 3. ScraperAPI free tier - FREE (1000/month)
 * 4. PacketStream - $1/GB (cheapest)
 * 5. Other proxies - $6-17/GB
 */

import type { Browser, Page } from 'playwright-core';
import { logger } from './logger';
import { getProxyManager, formatProxyForPlaywright, ScraperAPIProvider, type ProxyConfig } from './proxy-manager';

export interface TieredFetchResult {
  success: boolean;
  data?: string;
  source: 'direct' | 'sofascore' | 'scraperapi' | 'proxy';
  proxyUsed?: string;
  error?: string;
  cost: 'free' | 'cheap' | 'expensive';
}

export interface TieredFetcherStats {
  directSuccesses: number;
  directFailures: number;
  sofascoreSuccesses: number;
  sofascoreFailures: number;
  scraperapiSuccesses: number;
  scraperapiFailures: number;
  proxySuccesses: number;
  proxyFailures: number;
  estimatedMonthlyCost: number;
}

const stats: TieredFetcherStats = {
  directSuccesses: 0,
  directFailures: 0,
  sofascoreSuccesses: 0,
  sofascoreFailures: 0,
  scraperapiSuccesses: 0,
  scraperapiFailures: 0,
  proxySuccesses: 0,
  proxyFailures: 0,
  estimatedMonthlyCost: 0,
};

// Average data per request (for cost estimation)
const AVG_MB_PER_REQUEST = 2;
const PACKETSTREAM_COST_PER_GB = 1;

/**
 * Known sites and their protection levels
 */
const SITE_PROTECTION_LEVELS: Record<string, 'low' | 'medium' | 'high'> = {
  'sofascore.com': 'medium',
  'api.sofascore.com': 'low', // API is less protected
  'flashscore.com': 'high',
  'oddschecker.com': 'high',
  'espn.com': 'low',
  'bbc.co.uk': 'low',
  'livescore.com': 'medium',
  'fotmob.com': 'medium',
};

/**
 * Get protection level for a URL
 */
function getProtectionLevel(url: string): 'low' | 'medium' | 'high' {
  for (const [domain, level] of Object.entries(SITE_PROTECTION_LEVELS)) {
    if (url.includes(domain)) {
      return level;
    }
  }
  return 'medium'; // Default to medium
}

/**
 * Check if a response indicates blocking
 */
function isBlocked(content: string, statusCode?: number): boolean {
  if (statusCode === 403 || statusCode === 429 || statusCode === 503) {
    return true;
  }

  const blockedPatterns = [
    'access denied',
    'blocked',
    'captcha',
    'cloudflare',
    'please verify',
    'rate limit',
    'too many requests',
    'ERR_INSUFFICIENT_RESOURCES',
    'robot check',
  ];

  const lowerContent = content.toLowerCase();
  return blockedPatterns.some(pattern => lowerContent.includes(pattern));
}

/**
 * Try direct fetch without proxy (FREE)
 */
async function tryDirectFetch(
  page: Page,
  url: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    if (!response) {
      return { success: false, error: 'No response' };
    }

    const content = await page.content();
    const statusCode = response.status();

    if (isBlocked(content, statusCode)) {
      return { success: false, error: `Blocked (status: ${statusCode})` };
    }

    return { success: true, content };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Alternative endpoint mappings for free sources
 */
const ALTERNATIVE_SOURCES: Record<string, (url: string) => string | null> = {
  // Flashscore fixtures -> SofaScore API
  'flashscore.com/football': (url) => {
    // Extract date if present
    const dateMatch = url.match(/\/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
    return `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${date}`;
  },
  // Flashscore live -> SofaScore live API
  'flashscore.com/live': () => {
    return 'https://api.sofascore.com/api/v1/sport/football/events/live';
  },
};

/**
 * Try alternative free source
 */
async function tryAlternativeSource(
  page: Page,
  originalUrl: string
): Promise<{ success: boolean; content?: string; alternativeUrl?: string; error?: string }> {
  for (const [pattern, getAlternative] of Object.entries(ALTERNATIVE_SOURCES)) {
    if (originalUrl.includes(pattern)) {
      const alternativeUrl = getAlternative(originalUrl);
      if (alternativeUrl) {
        try {
          logger.debug(`Trying alternative source: ${alternativeUrl}`);

          const response = await page.goto(alternativeUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
          });

          if (!response || response.status() !== 200) {
            return { success: false, error: `Alternative source returned ${response?.status()}` };
          }

          const content = await page.content();

          if (isBlocked(content, response.status())) {
            return { success: false, error: 'Alternative source blocked' };
          }

          return { success: true, content, alternativeUrl };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      }
    }
  }

  return { success: false, error: 'No alternative source available' };
}

/**
 * Main tiered fetch function
 *
 * Tries options in order of cost:
 * 1. Direct (free)
 * 2. Alternative source like SofaScore API (free)
 * 3. ScraperAPI free tier (free, limited)
 * 4. Proxies (cheapest first)
 */
export async function tieredFetch(
  browser: Browser,
  url: string,
  options: {
    skipDirect?: boolean;
    skipAlternative?: boolean;
    forceProxy?: boolean;
  } = {}
): Promise<TieredFetchResult> {
  const protectionLevel = getProtectionLevel(url);
  logger.debug(`Tiered fetch for ${url} (protection: ${protectionLevel})`);

  // For low protection sites, try direct first
  if (!options.skipDirect && !options.forceProxy && protectionLevel === 'low') {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const result = await tryDirectFetch(page, url);

      if (result.success) {
        stats.directSuccesses++;
        await context.close();
        return {
          success: true,
          data: result.content,
          source: 'direct',
          cost: 'free',
        };
      }

      stats.directFailures++;
      logger.debug(`Direct fetch failed: ${result.error}`);
    } finally {
      await context.close();
    }
  }

  // Try alternative source (e.g., SofaScore API instead of Flashscore)
  if (!options.skipAlternative && !options.forceProxy) {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const result = await tryAlternativeSource(page, url);

      if (result.success) {
        stats.sofascoreSuccesses++;
        await context.close();
        return {
          success: true,
          data: result.content,
          source: 'sofascore',
          cost: 'free',
        };
      }

      if (result.alternativeUrl) {
        stats.sofascoreFailures++;
      }
      logger.debug(`Alternative source failed: ${result.error}`);
    } finally {
      await context.close();
    }
  }

  // Try ScraperAPI if available (free tier)
  const proxyManager = getProxyManager();
  const providers = proxyManager.getProviderNames();

  if (providers.includes('scraperapi')) {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const proxy = await proxyManager.getProxy();
      if (proxy && proxy.server.includes('scraperapi')) {
        const contextWithProxy = await browser.newContext({
          proxy: formatProxyForPlaywright(proxy),
        });
        const proxyPage = await contextWithProxy.newPage();

        try {
          const result = await tryDirectFetch(proxyPage, url);

          if (result.success) {
            stats.scraperapiSuccesses++;
            proxyManager.markSuccess(proxy);
            await contextWithProxy.close();
            await context.close();
            return {
              success: true,
              data: result.content,
              source: 'scraperapi',
              proxyUsed: 'scraperapi',
              cost: 'free',
            };
          }

          stats.scraperapiFailures++;
          proxyManager.markFailed(proxy);
        } finally {
          await contextWithProxy.close();
        }
      }
    } finally {
      await context.close();
    }
  }

  // Try other proxies (cheapest first - PacketStream, then others)
  if (proxyManager.isEnabled()) {
    const proxy = await proxyManager.getProxy();

    if (proxy) {
      const context = await browser.newContext({
        proxy: formatProxyForPlaywright(proxy),
      });
      const page = await context.newPage();

      try {
        const result = await tryDirectFetch(page, url);

        if (result.success) {
          stats.proxySuccesses++;
          proxyManager.markSuccess(proxy);

          // Estimate cost
          const isPacketStream = proxy.server.includes('packetstream');
          if (isPacketStream) {
            stats.estimatedMonthlyCost += (AVG_MB_PER_REQUEST / 1024) * PACKETSTREAM_COST_PER_GB;
          } else {
            stats.estimatedMonthlyCost += (AVG_MB_PER_REQUEST / 1024) * 8; // Assume $8/GB average
          }

          return {
            success: true,
            data: result.content,
            source: 'proxy',
            proxyUsed: proxy.server,
            cost: isPacketStream ? 'cheap' : 'expensive',
          };
        }

        stats.proxyFailures++;
        proxyManager.markFailed(proxy);
      } finally {
        await context.close();
      }
    }
  }

  return {
    success: false,
    source: 'direct',
    error: 'All fetch methods failed',
    cost: 'free',
  };
}

/**
 * Get current stats
 */
export function getTieredFetcherStats(): TieredFetcherStats {
  return { ...stats };
}

/**
 * Reset stats (for testing)
 */
export function resetTieredFetcherStats(): void {
  stats.directSuccesses = 0;
  stats.directFailures = 0;
  stats.sofascoreSuccesses = 0;
  stats.sofascoreFailures = 0;
  stats.scraperapiSuccesses = 0;
  stats.scraperapiFailures = 0;
  stats.proxySuccesses = 0;
  stats.proxyFailures = 0;
  stats.estimatedMonthlyCost = 0;
}

/**
 * Log summary of tiered fetcher usage
 */
export function logTieredFetcherSummary(): void {
  const total = stats.directSuccesses + stats.sofascoreSuccesses +
                stats.scraperapiSuccesses + stats.proxySuccesses;

  if (total === 0) {
    logger.info('Tiered Fetcher: No requests made yet');
    return;
  }

  const freeRequests = stats.directSuccesses + stats.sofascoreSuccesses + stats.scraperapiSuccesses;
  const paidRequests = stats.proxySuccesses;
  const freePercentage = Math.round((freeRequests / total) * 100);

  logger.info('=== Tiered Fetcher Summary ===');
  logger.info(`Total requests: ${total}`);
  logger.info(`Free requests: ${freeRequests} (${freePercentage}%)`);
  logger.info(`  - Direct: ${stats.directSuccesses}`);
  logger.info(`  - SofaScore API: ${stats.sofascoreSuccesses}`);
  logger.info(`  - ScraperAPI: ${stats.scraperapiSuccesses}`);
  logger.info(`Paid requests: ${paidRequests} (${100 - freePercentage}%)`);
  logger.info(`Estimated monthly cost: $${stats.estimatedMonthlyCost.toFixed(2)}`);
}
