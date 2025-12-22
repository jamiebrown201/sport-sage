import type { Browser, Page } from 'playwright-core';
import { logger } from '../utils/logger';
import { FlashscoreLiveScoresScraper } from './flashscore/live-scores';
import { LiveScoreApiScraper } from './livescore/api-live-scores';
import { SofascoreLiveScoresScraper } from './sofascore/live-scores';
import { ESPNLiveScoresScraper } from './espn/live-scores';
import { Scores365LiveScoresScraper } from './365scores/live-scores';
import { FotMobLiveScoresScraper } from './fotmob/live-scores';
import { launchBrowser, createPage } from '../utils/browser';
import { getProxyManager } from '../utils/proxy-manager';
import {
  recordSuccess,
  recordFailure,
  isSourceDown,
  checkAndAlertBotDetection,
  getSourceHealth,
} from '../utils/bot-detection';
import type { LiveScoresScraper, EventToMatch, LiveScore, ScrapeResult } from './types';

export interface ScraperSource {
  name: string;
  priority: number; // Lower = try first
  needsProxy: boolean; // true = usually blocked without proxy
  scraper: (page: Page) => LiveScoresScraper;
}

/**
 * Multi-source live scores orchestrator
 *
 * Sources (updated 2024-12-22):
 *
 * WORKING FREE SOURCES (No proxy needed):
 * - LiveScore API: WORKS ✅ PRIMARY - public API, works from AWS IPs
 * - ESPN API: WORKS ✅ - public API, multi-sport (football, basketball, tennis, hockey, cricket)
 * - 365Scores API: WORKS ✅ - public API, multi-sport (football, basketball, tennis, hockey, baseball)
 *
 * BLOCKED FREE SOURCES:
 * - SofaScore API: ❌ BLOCKED - 403 Forbidden from AWS IPs
 * - FotMob API: ❌ BLOCKED - Returns 404 HTML page, API no longer accessible
 *
 * WORKING PROXY SOURCES:
 * - Flashscore: WORKS ✅ - requires proxy, uses DOM structure parsing (not CSS classes)
 *
 * Strategy:
 * 1. Try FREE API sources first (priority 1-5, no proxy needed)
 * 2. If FREE sources get 80%+ coverage, stop (no need to use proxy quota)
 * 3. Fall back to proxy sources only when needed (priority 10+)
 *
 * Matching Strategy:
 * All scrapers now match by team names instead of source-specific IDs.
 * This makes the system flexible and source-agnostic.
 */
export class LiveScoresOrchestrator {
  private sources: ScraperSource[] = [
    // === FREE API SOURCES - Priority 1-5 ===
    {
      name: 'livescore',
      priority: 1,
      needsProxy: false, // Uses public API, works from AWS IPs
      scraper: (page) => new LiveScoreApiScraper(page),
    },
    {
      name: 'sofascore',
      priority: 2,
      needsProxy: false, // Uses public API - may be blocked, will test
      scraper: (page) => new SofascoreLiveScoresScraper(page),
    },
    {
      name: 'espn',
      priority: 3,
      needsProxy: false, // Uses public API, works from AWS IPs
      scraper: (page) => new ESPNLiveScoresScraper(page),
    },
    {
      name: '365scores',
      priority: 4,
      needsProxy: false, // Uses public API, works from AWS IPs
      scraper: (page) => new Scores365LiveScoresScraper(page),
    },
    {
      name: 'fotmob',
      priority: 5,
      needsProxy: false, // Uses public API, FOOTBALL ONLY
      scraper: (page) => new FotMobLiveScoresScraper(page),
    },
    // === PROXY BACKUP SOURCES - Priority 10+ ===
    // Only used when free sources fail or for periodic health checks
    {
      name: 'flashscore',
      priority: 10,
      needsProxy: true, // Blocked from AWS IPs, uses obfuscated CSS
      scraper: (page) => new FlashscoreLiveScoresScraper(page),
    },
  ];

  // Track when each source was last used (for rotation)
  private lastUsed: Record<string, number> = {
    livescore: 0,
    sofascore: 0,
    espn: 0,
    '365scores': 0,
    fotmob: 0,
    flashscore: 0,
  };

  private stats = {
    livescore: { success: 0, fail: 0 },
    sofascore: { success: 0, fail: 0 },
    espn: { success: 0, fail: 0 },
    '365scores': { success: 0, fail: 0 },
    fotmob: { success: 0, fail: 0 },
    flashscore: { success: 0, fail: 0 },
  };

  /**
   * Get sources sorted by rotation strategy:
   * 1. Group by priority
   * 2. Within same priority, prefer least recently used
   * 3. Add randomness to avoid predictable patterns
   */
  private getRotatedSources(): ScraperSource[] {
    const now = Date.now();

    return [...this.sources].sort((a, b) => {
      // First sort by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Same priority: prefer least recently used
      const aLastUsed = this.lastUsed[a.name] || 0;
      const bLastUsed = this.lastUsed[b.name] || 0;

      // Add jitter (random factor) to avoid predictable patterns
      const jitter = (Math.random() - 0.5) * 60000; // ±30 seconds of randomness

      return (aLastUsed + jitter) - (bLastUsed + jitter);
    });
  }

  async getLiveScores(
    browser: Browser,
    events: EventToMatch[]
  ): Promise<{
    scores: Map<string, LiveScore>;
    sourcesUsed: string[];
    stats: typeof this.stats;
  }> {
    const allScores = new Map<string, LiveScore>();
    const sourcesUsed: string[] = [];
    const remainingEventIds = new Set(events.map(e => e.id));

    // Use ROTATED sources (spreads load, avoids detection)
    const rotatedSources = this.getRotatedSources();

    logger.info(`Source rotation order: ${rotatedSources.map(s => s.name).join(' → ')}`);

    for (const source of rotatedSources) {
      if (remainingEventIds.size === 0) {
        break; // Got all scores
      }

      // Skip sources that are currently down (bot detected)
      if (isSourceDown(source.name)) {
        logger.debug(`Skipping ${source.name} - currently marked as down`);
        continue;
      }

      // Skip proxy-required sources if no proxy configured
      const proxyManager = getProxyManager();
      if (source.needsProxy && !proxyManager.isEnabled()) {
        logger.debug(`Skipping ${source.name} - needs proxy but none configured`);
        continue;
      }

      let page: Page | null = null;
      let proxyBrowser: Browser | null = null;

      try {
        logger.info(`Trying ${source.name} for ${remainingEventIds.size} events...`);

        // Mark this source as used NOW (for rotation tracking)
        this.lastUsed[source.name] = Date.now();

        // Create page - use separate browser for proxy to avoid context conflicts in Lambda
        if (source.needsProxy) {
          // Launch separate browser for proxy sources
          proxyBrowser = await launchBrowser();
          page = await createPage(proxyBrowser, { useProxy: true });
          logger.debug(`Created separate browser for ${source.name} with proxy`);
        } else {
          // Use shared browser for non-proxy sources
          page = await createPage(browser, { useProxy: false });
        }

        const scraper = source.scraper(page);

        // Filter events to only those we still need scores for
        const eventsToMatch = events.filter(e => remainingEventIds.has(e.id));
        const result = await scraper.getLiveScores(eventsToMatch);

        if (result.scores.size > 0) {
          if (source.name in this.stats) {
            this.stats[source.name as keyof typeof this.stats].success++;
          }
          sourcesUsed.push(source.name);

          // Record success for bot detection
          recordSuccess(source.name);

          // Add to results and remove from remaining
          for (const [id, score] of result.scores) {
            allScores.set(id, score);
            remainingEventIds.delete(id);
          }

          logger.info(`${source.name}: Got ${result.scores.size} scores (matched: ${result.matchedCount}, unmatched: ${result.unmatchedCount}), ${remainingEventIds.size} remaining`);

          // If we got good results from a free source, we can stop
          // (don't hammer multiple sources unnecessarily)
          if (!source.needsProxy && allScores.size >= events.length * 0.8) {
            logger.info(`Got 80%+ coverage from ${source.name}, stopping rotation`);
            break;
          }
        } else {
          // No scores could mean blocking or just no live events
          logger.debug(`${source.name}: No scores found`);
          recordFailure(source.name, 'No data returned');
        }
      } catch (error) {
        if (source.name in this.stats) {
          this.stats[source.name as keyof typeof this.stats].fail++;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Record failure for bot detection
        recordFailure(source.name, errorMessage);

        // Check if we need to create an alert
        await checkAndAlertBotDetection(source.name);

        logger.warn(`${source.name} failed:`, { error: errorMessage });
      } finally {
        // Close page
        if (page) {
          await page.close().catch(() => {});
        }
        // Close proxy browser if we created one
        if (proxyBrowser) {
          await proxyBrowser.close().catch(() => {});
          logger.debug('Closed proxy browser');
        }
      }
    }

    return {
      scores: allScores,
      sourcesUsed,
      stats: this.stats,
    };
  }

  /**
   * Log summary of source usage
   */
  logSummary(): void {
    logger.info('=== Live Scores Sources Summary ===');
    for (const [source, { success, fail }] of Object.entries(this.stats)) {
      const total = success + fail;
      if (total > 0) {
        const rate = Math.round((success / total) * 100);
        logger.info(`${source}: ${success}/${total} (${rate}% success)`);
      }
    }

    // Log source health status
    const health = getSourceHealth();
    const downSources = Object.entries(health)
      .filter(([_, h]) => h.status === 'down')
      .map(([name]) => name);

    if (downSources.length > 0) {
      logger.warn(`⚠️ Sources marked as DOWN: ${downSources.join(', ')}`);
    }
  }

  /**
   * Get current source health status
   */
  getHealth(): ReturnType<typeof getSourceHealth> {
    return getSourceHealth();
  }
}

/**
 * Get live scores using the tiered orchestrator
 *
 * This is the main function to use - it handles all the complexity of
 * trying multiple sources and falling back appropriately.
 */
export async function getMultiSourceLiveScores(
  events: EventToMatch[]
): Promise<Map<string, LiveScore>> {
  const browser = await launchBrowser();

  try {
    const orchestrator = new LiveScoresOrchestrator();
    const result = await orchestrator.getLiveScores(browser, events);

    logger.info(`Multi-source live scores: ${result.scores.size}/${events.length} found`);
    logger.info(`Sources used: ${result.sourcesUsed.join(', ') || 'none'}`);

    return result.scores;
  } finally {
    await browser.close();
  }
}

// Re-export types for convenience
export type { LiveScore, EventToMatch, ScrapeResult } from './types';
