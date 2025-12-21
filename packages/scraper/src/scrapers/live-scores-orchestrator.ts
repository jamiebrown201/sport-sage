import type { Browser, Page } from 'playwright-core';
import { logger } from '../utils/logger';
import { FlashscoreLiveScoresScraper, type LiveScore } from './flashscore/live-scores';
import { SofascoreLiveScoresScraper } from './sofascore/live-scores';
import { FotMobLiveScoresScraper } from './fotmob/live-scores';
import { LiveScoreLiveScoresScraper } from './livescore/live-scores';
import { ESPNLiveScoresScraper } from './espn/live-scores';
import { Scores365LiveScoresScraper } from './365scores/live-scores';
import { launchBrowser, createPage, markPageProxySuccess, markPageProxyFailed } from '../utils/browser';
import { getProxyManager } from '../utils/proxy-manager';
import {
  recordSuccess,
  recordFailure,
  isSourceDown,
  checkAndAlertBotDetection,
  getSourceHealth,
} from '../utils/bot-detection';

export interface ScraperSource {
  name: string;
  priority: number; // Lower = try first
  needsProxy: boolean; // true = usually blocked without proxy
  scraper: (page: Page) => LiveScoresScraper;
}

interface LiveScoresScraper {
  getLiveScores(externalIds: string[]): Promise<Map<string, LiveScore>>;
}

/**
 * Multi-source live scores orchestrator with ROTATION
 *
 * Sources (tested 2024-12-21):
 * - SofaScore API: WORKS without proxy (552 live events) ✅
 * - ESPN: WORKS without proxy (huge data) ✅
 * - 365Scores: WORKS without proxy (63 items) ✅
 * - Flashscore: Original source, blocked without proxy but try occasionally
 * - FotMob: BLOCKED (404)
 * - LiveScore: BLOCKED
 *
 * Strategy:
 * 1. ROTATE between free working sources to avoid detection
 * 2. Track last used time to spread load
 * 3. Fall back to proxy sources if needed
 */
export class LiveScoresOrchestrator {
  private sources: ScraperSource[] = [
    // === FREE WORKING SOURCES (rotate between these) ===
    {
      name: 'sofascore',
      priority: 1,
      needsProxy: false,
      scraper: (page) => new SofascoreLiveScoresScraper(page),
    },
    {
      name: 'espn',
      priority: 1, // Same priority = rotation candidates
      needsProxy: false,
      scraper: (page) => new ESPNLiveScoresScraper(page),
    },
    {
      name: '365scores',
      priority: 1, // Same priority = rotation candidates
      needsProxy: false,
      scraper: (page) => new Scores365LiveScoresScraper(page),
    },
    // === TRY OCCASIONALLY (might work without proxy sometimes) ===
    {
      name: 'flashscore',
      priority: 2, // Original source - try occasionally
      needsProxy: false, // Try without proxy first, might get lucky
      scraper: (page) => new FlashscoreLiveScoresScraper(page),
    },
    // === BLOCKED SOURCES (only with proxy) ===
    {
      name: 'fotmob',
      priority: 3,
      needsProxy: true,
      scraper: (page) => new FotMobLiveScoresScraper(page),
    },
    {
      name: 'livescore',
      priority: 3,
      needsProxy: true,
      scraper: (page) => new LiveScoreLiveScoresScraper(page),
    },
  ];

  // Track when each source was last used (for rotation)
  private lastUsed: Record<string, number> = {
    sofascore: 0,
    espn: 0,
    '365scores': 0,
    flashscore: 0,
    fotmob: 0,
    livescore: 0,
  };

  private stats = {
    sofascore: { success: 0, fail: 0 },
    espn: { success: 0, fail: 0 },
    '365scores': { success: 0, fail: 0 },
    flashscore: { success: 0, fail: 0 },
    fotmob: { success: 0, fail: 0 },
    livescore: { success: 0, fail: 0 },
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
    externalIds: string[]
  ): Promise<{
    scores: Map<string, LiveScore>;
    sourcesUsed: string[];
    stats: typeof this.stats;
  }> {
    const allScores = new Map<string, LiveScore>();
    const sourcesUsed: string[] = [];
    const remainingIds = new Set(externalIds);

    // Use ROTATED sources (spreads load, avoids detection)
    const rotatedSources = this.getRotatedSources();

    logger.info(`Source rotation order: ${rotatedSources.map(s => s.name).join(' → ')}`);

    for (const source of rotatedSources) {
      if (remainingIds.size === 0) {
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

      try {
        logger.info(`Trying ${source.name} for ${remainingIds.size} events...`);

        // Mark this source as used NOW (for rotation tracking)
        this.lastUsed[source.name] = Date.now();

        // Create page (with proxy if needed)
        const page = await createPage(browser);

        try {
          const scraper = source.scraper(page);
          const scores = await scraper.getLiveScores(Array.from(remainingIds));

          if (scores.size > 0) {
            this.stats[source.name as keyof typeof this.stats].success++;
            sourcesUsed.push(source.name);
            markPageProxySuccess(page);

            // Record success for bot detection
            recordSuccess(source.name);

            // Add to results and remove from remaining
            for (const [id, score] of scores) {
              allScores.set(id, score);
              remainingIds.delete(id);
            }

            logger.info(`${source.name}: Got ${scores.size} scores, ${remainingIds.size} remaining`);

            // If we got good results from a free source, we can stop
            // (don't hammer multiple sources unnecessarily)
            if (!source.needsProxy && allScores.size >= externalIds.length * 0.8) {
              logger.info(`Got 80%+ coverage from ${source.name}, stopping rotation`);
              break;
            }
          } else {
            // No scores could mean blocking or just no live events
            logger.debug(`${source.name}: No scores found`);
            recordFailure(source.name, 'No data returned');
          }
        } finally {
          await page.context().close();
        }
      } catch (error) {
        this.stats[source.name as keyof typeof this.stats].fail++;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Record failure for bot detection
        recordFailure(source.name, errorMessage);

        // Check if we need to create an alert
        await checkAndAlertBotDetection(source.name);

        logger.warn(`${source.name} failed:`, { error: errorMessage });
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
  externalIds: string[]
): Promise<Map<string, LiveScore>> {
  const browser = await launchBrowser();

  try {
    const orchestrator = new LiveScoresOrchestrator();
    const result = await orchestrator.getLiveScores(browser, externalIds);

    logger.info(`Multi-source live scores: ${result.scores.size}/${externalIds.length} found`);
    logger.info(`Sources used: ${result.sourcesUsed.join(', ') || 'none'}`);

    return result.scores;
  } finally {
    await browser.close();
  }
}
