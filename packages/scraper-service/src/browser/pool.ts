/**
 * Advanced Browser Pool with Lifecycle Management
 *
 * Key features:
 * - Persistent browser instances (no cold starts)
 * - Context rotation based on age, request count, and failure rate
 * - Automatic recycling to prevent fingerprint aging
 * - Health monitoring
 */

import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { logger } from '../logger.js';
import { getProxyRotator } from '../proxy/rotator.js';
import { applyStealthMode } from './stealth.js';
import { simulateHumanBehavior } from './behavior.js';

// Apply stealth plugin globally
chromium.use(StealthPlugin());

// Configuration
const MAX_CONTEXT_AGE_MS = 30 * 60 * 1000; // 30 minutes
const MAX_REQUESTS_PER_CONTEXT = 150;
const FAILURE_THRESHOLD = 5;
const MAX_CONTEXTS = 3;

interface ContextMetadata {
  context: BrowserContext;
  createdAt: number;
  requestCount: number;
  failureCount: number;
  proxyUrl: string | null;
  lastUsed: number;
}

class BrowserPool {
  private browser: Browser | null = null;
  private contexts: Map<string, ContextMetadata> = new Map();
  private idleContexts: string[] = [];
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    logger.info('Initializing browser pool');

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    // Pre-warm a context
    await this.createContext();
    logger.info('Browser pool initialized');
  }

  private async createContext(): Promise<string> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const proxyRotator = getProxyRotator();
    const proxy = proxyRotator.isEnabled() ? await proxyRotator.selectProxy() : null;

    const contextOptions: any = {
      userAgent: getRandomUserAgent(),
      viewport: getRandomViewport(),
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      extraHTTPHeaders: getRealisticHeaders(),
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
    };

    if (proxy) {
      contextOptions.proxy = {
        server: proxy.url,
        username: proxy.username,
        password: proxy.password,
      };
      logger.debug('Context using proxy', { server: proxy.url.split('@').pop() });
    }

    const context = await this.browser.newContext(contextOptions);
    const contextId = crypto.randomUUID();

    this.contexts.set(contextId, {
      context,
      createdAt: Date.now(),
      requestCount: 0,
      failureCount: 0,
      proxyUrl: proxy?.url || null,
      lastUsed: Date.now(),
    });

    this.idleContexts.push(contextId);
    logger.debug('Created new browser context', { contextId });

    return contextId;
  }

  private async getHealthyContext(): Promise<{ id: string; context: BrowserContext }> {
    // Try to find an idle, healthy context
    while (this.idleContexts.length > 0) {
      const contextId = this.idleContexts.shift()!;
      const meta = this.contexts.get(contextId);

      if (!meta) continue;

      // Check if context should be recycled
      if (this.shouldRecycle(meta)) {
        await this.recycleContext(contextId, 'health_check');
        continue;
      }

      meta.lastUsed = Date.now();
      return { id: contextId, context: meta.context };
    }

    // No idle contexts available, create new one if under limit
    if (this.contexts.size < MAX_CONTEXTS) {
      const contextId = await this.createContext();
      const meta = this.contexts.get(contextId)!;
      this.idleContexts = this.idleContexts.filter((id) => id !== contextId);
      return { id: contextId, context: meta.context };
    }

    // Wait for a context to become available
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return this.getHealthyContext();
  }

  private shouldRecycle(meta: ContextMetadata): boolean {
    const age = Date.now() - meta.createdAt;
    return (
      age > MAX_CONTEXT_AGE_MS ||
      meta.requestCount > MAX_REQUESTS_PER_CONTEXT ||
      meta.failureCount >= FAILURE_THRESHOLD
    );
  }

  async recycleContext(contextId: string, reason: string): Promise<void> {
    const meta = this.contexts.get(contextId);
    if (!meta) return;

    logger.info('Recycling browser context', {
      contextId,
      reason,
      age: Math.round((Date.now() - meta.createdAt) / 1000),
      requests: meta.requestCount,
      failures: meta.failureCount,
    });

    try {
      await meta.context.close();
    } catch (error) {
      logger.warn('Error closing context', { contextId, error });
    }

    this.contexts.delete(contextId);
    this.idleContexts = this.idleContexts.filter((id) => id !== contextId);

    // Create replacement context
    if (this.contexts.size < MAX_CONTEXTS) {
      await this.createContext();
    }
  }

  async recycleAllContexts(reason: string): Promise<void> {
    logger.info('Recycling all browser contexts', { reason, count: this.contexts.size });

    const contextIds = Array.from(this.contexts.keys());
    for (const contextId of contextIds) {
      await this.recycleContext(contextId, reason);
    }
  }

  async executeJob<T>(
    fn: (page: Page) => Promise<T>,
    options: { humanize?: boolean } = {}
  ): Promise<T> {
    await this.initialize();

    const { id: contextId, context } = await this.getHealthyContext();
    const meta = this.contexts.get(contextId)!;
    meta.requestCount++;

    const page = await context.newPage();
    await applyStealthMode(page);

    try {
      // Optionally simulate human behavior before the main action
      if (options.humanize) {
        await simulateHumanBehavior(page);
      }

      const result = await fn(page);

      // Report success to proxy rotator
      if (meta.proxyUrl) {
        getProxyRotator().recordSuccess(meta.proxyUrl);
      }

      return result;
    } catch (error) {
      meta.failureCount++;

      // Report failure to proxy rotator
      if (meta.proxyUrl) {
        getProxyRotator().recordFailure(meta.proxyUrl);
      }

      throw error;
    } finally {
      await page.close();
      this.idleContexts.push(contextId);
    }
  }

  async getPage(): Promise<{ page: Page; release: () => Promise<void> }> {
    await this.initialize();

    const { id: contextId, context } = await this.getHealthyContext();
    const meta = this.contexts.get(contextId)!;
    meta.requestCount++;

    const page = await context.newPage();
    await applyStealthMode(page);

    return {
      page,
      release: async () => {
        await page.close();
        this.idleContexts.push(contextId);
      },
    };
  }

  markPageSuccess(proxyUrl: string | null): void {
    if (proxyUrl) {
      getProxyRotator().recordSuccess(proxyUrl);
    }
  }

  markPageFailed(proxyUrl: string | null): void {
    if (proxyUrl) {
      getProxyRotator().recordFailure(proxyUrl);
    }
  }

  getStats(): {
    activeContexts: number;
    idleContexts: number;
    maxContexts: number;
    oldestContext: number | null;
  } {
    let oldestAge: number | null = null;

    for (const meta of this.contexts.values()) {
      const age = Date.now() - meta.createdAt;
      if (oldestAge === null || age > oldestAge) {
        oldestAge = age;
      }
    }

    return {
      activeContexts: this.contexts.size - this.idleContexts.length,
      idleContexts: this.idleContexts.length,
      maxContexts: MAX_CONTEXTS,
      oldestContext: oldestAge ? Math.round(oldestAge / 1000) : null,
    };
  }

  async close(): Promise<void> {
    logger.info('Closing browser pool');

    for (const meta of this.contexts.values()) {
      try {
        await meta.context.close();
      } catch {
        // Ignore errors during shutdown
      }
    }

    this.contexts.clear();
    this.idleContexts = [];

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.initPromise = null;
    logger.info('Browser pool closed');
  }
}

// Singleton instance
let browserPoolInstance: BrowserPool | null = null;

export function getBrowserPool(): BrowserPool {
  if (!browserPoolInstance) {
    browserPoolInstance = new BrowserPool();
  }
  return browserPoolInstance;
}

export function getBrowserPoolStats() {
  return getBrowserPool().getStats();
}

// Helper functions
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getRandomViewport(): { width: number; height: number } {
  return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

function getRealisticHeaders(): Record<string, string> {
  const languages = ['en-GB,en;q=0.9', 'en-US,en;q=0.9', 'en-GB,en-US;q=0.9,en;q=0.8'];

  return {
    'Accept-Language': languages[Math.floor(Math.random() * languages.length)],
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    DNT: Math.random() > 0.5 ? '1' : '0',
  };
}
