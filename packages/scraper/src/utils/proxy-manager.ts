/**
 * Proxy Manager for rotating residential proxies
 *
 * Supports multiple proxy providers and automatic rotation
 */

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
  protocol?: 'http' | 'https' | 'socks5';
}

export interface ProxyProvider {
  name: string;
  getProxy(): Promise<ProxyConfig>;
  markFailed(proxy: ProxyConfig): void;
  markSuccess(proxy: ProxyConfig): void;
}

// Proxy health tracking
interface ProxyHealth {
  proxy: ProxyConfig;
  successCount: number;
  failCount: number;
  lastUsed: number;
  lastFailed: number | null;
  avgResponseTime: number;
}

/**
 * Static list proxy provider - use your own list of proxies
 */
export class StaticProxyProvider implements ProxyProvider {
  name = 'static';
  private proxies: ProxyHealth[] = [];
  private currentIndex = 0;

  constructor(proxyList: ProxyConfig[]) {
    this.proxies = proxyList.map(proxy => ({
      proxy,
      successCount: 0,
      failCount: 0,
      lastUsed: 0,
      lastFailed: null,
      avgResponseTime: 0,
    }));
  }

  async getProxy(): Promise<ProxyConfig> {
    if (this.proxies.length === 0) {
      throw new Error('No proxies available');
    }

    // Filter out proxies that failed recently (within 5 minutes)
    const now = Date.now();
    const availableProxies = this.proxies.filter(
      p => !p.lastFailed || now - p.lastFailed > 5 * 60 * 1000
    );

    if (availableProxies.length === 0) {
      // All proxies are in cooldown, use the one that failed longest ago
      const sorted = [...this.proxies].sort(
        (a, b) => (a.lastFailed || 0) - (b.lastFailed || 0)
      );
      return sorted[0].proxy;
    }

    // Round-robin selection with preference for better performing proxies
    const sorted = availableProxies.sort((a, b) => {
      // Prefer proxies with better success rate
      const aRate = a.successCount / (a.successCount + a.failCount || 1);
      const bRate = b.successCount / (b.successCount + b.failCount || 1);
      if (Math.abs(aRate - bRate) > 0.1) {
        return bRate - aRate;
      }
      // If similar success rate, prefer least recently used
      return a.lastUsed - b.lastUsed;
    });

    const selected = sorted[0];
    selected.lastUsed = now;
    return selected.proxy;
  }

  markFailed(proxy: ProxyConfig): void {
    const health = this.proxies.find(p => p.proxy.server === proxy.server);
    if (health) {
      health.failCount++;
      health.lastFailed = Date.now();
    }
  }

  markSuccess(proxy: ProxyConfig): void {
    const health = this.proxies.find(p => p.proxy.server === proxy.server);
    if (health) {
      health.successCount++;
    }
  }

  getStats(): { server: string; successRate: number; failCount: number }[] {
    return this.proxies.map(p => ({
      server: p.proxy.server,
      successRate: p.successCount / (p.successCount + p.failCount || 1),
      failCount: p.failCount,
    }));
  }
}

/**
 * Bright Data (Luminati) residential proxy provider
 * Uses their rotating residential proxy endpoint
 */
export class BrightDataProvider implements ProxyProvider {
  name = 'brightdata';
  private username: string;
  private password: string;
  private zone: string;
  private country: string;
  private failedSessions = new Set<string>();

  constructor(options: {
    username: string;
    password: string;
    zone?: string;
    country?: string;
  }) {
    this.username = options.username;
    this.password = options.password;
    this.zone = options.zone || 'residential';
    this.country = options.country || 'gb'; // Default to UK
  }

  async getProxy(): Promise<ProxyConfig> {
    // Generate a random session ID for sticky sessions
    const sessionId = Math.random().toString(36).substring(2, 15);

    // Bright Data rotating residential proxy format
    const username = `${this.username}-zone-${this.zone}-country-${this.country}-session-${sessionId}`;

    return {
      server: 'http://brd.superproxy.io:22225',
      username,
      password: this.password,
      protocol: 'http',
    };
  }

  markFailed(proxy: ProxyConfig): void {
    // Extract session ID and mark as failed
    const match = proxy.username?.match(/session-(\w+)/);
    if (match) {
      this.failedSessions.add(match[1]);
    }
  }

  markSuccess(proxy: ProxyConfig): void {
    // Session worked, could track for analytics
  }
}

/**
 * Oxylabs residential proxy provider
 */
export class OxylabsProvider implements ProxyProvider {
  name = 'oxylabs';
  private username: string;
  private password: string;
  private country: string;

  constructor(options: {
    username: string;
    password: string;
    country?: string;
  }) {
    this.username = options.username;
    this.password = options.password;
    this.country = options.country || 'gb';
  }

  async getProxy(): Promise<ProxyConfig> {
    // Generate session for sticky IP
    const sessionId = Math.random().toString(36).substring(2, 15);

    return {
      server: 'http://pr.oxylabs.io:7777',
      username: `customer-${this.username}-cc-${this.country}-sessid-${sessionId}`,
      password: this.password,
      protocol: 'http',
    };
  }

  markFailed(proxy: ProxyConfig): void {}
  markSuccess(proxy: ProxyConfig): void {}
}

/**
 * SmartProxy residential proxy provider
 */
export class SmartProxyProvider implements ProxyProvider {
  name = 'smartproxy';
  private username: string;
  private password: string;
  private country: string;

  constructor(options: {
    username: string;
    password: string;
    country?: string;
  }) {
    this.username = options.username;
    this.password = options.password;
    this.country = options.country || 'gb';
  }

  async getProxy(): Promise<ProxyConfig> {
    const sessionId = Math.random().toString(36).substring(2, 15);

    return {
      server: `http://gate.smartproxy.com:7000`,
      username: `user-${this.username}-country-${this.country}-session-${sessionId}`,
      password: this.password,
      protocol: 'http',
    };
  }

  markFailed(proxy: ProxyConfig): void {}
  markSuccess(proxy: ProxyConfig): void {}
}

/**
 * IPRoyal - Cheap residential proxies at $1.75/GB
 * Low minimum, pay-as-you-go
 */
export class IPRoyalProvider implements ProxyProvider {
  name = 'iproyal';
  private username: string;
  private password: string;
  private country: string;

  constructor(options: {
    username: string;
    password: string;
    country?: string;
  }) {
    this.username = options.username;
    this.password = options.password;
    this.country = options.country || 'gb';
  }

  async getProxy(): Promise<ProxyConfig> {
    // Generate session for sticky IP (optional, helps avoid re-auth)
    const sessionId = Math.random().toString(36).substring(2, 10);

    // IPRoyal residential proxy format
    // Password format: password_country-xx_session-xxx_lifetime-5m
    const passwordWithOptions = `${this.password}_country-${this.country}_session-${sessionId}_lifetime-5m`;

    return {
      server: 'http://geo.iproyal.com:12321',
      username: this.username,
      password: passwordWithOptions,
      protocol: 'http',
    };
  }

  markFailed(proxy: ProxyConfig): void {}
  markSuccess(proxy: ProxyConfig): void {}
}

/**
 * PacketStream - CHEAPEST option at $1/GB
 * Peer-to-peer residential proxy network
 */
export class PacketStreamProvider implements ProxyProvider {
  name = 'packetstream';
  private apiKey: string;
  private country: string;

  constructor(options: {
    apiKey: string;
    country?: string;
  }) {
    this.apiKey = options.apiKey;
    this.country = options.country || 'GB';
  }

  async getProxy(): Promise<ProxyConfig> {
    // PacketStream proxy format
    return {
      server: 'http://proxy.packetstream.io:31112',
      username: this.apiKey,
      password: this.country, // Country code is passed as password
      protocol: 'http',
    };
  }

  markFailed(proxy: ProxyConfig): void {}
  markSuccess(proxy: ProxyConfig): void {}
}

/**
 * DataImpulse - $1/GB residential proxies
 * Great value, reliable for scraping
 *
 * Gateway: gw.dataimpulse.com:823 (HTTP) or :824 (HTTPS)
 *
 * Basic format: login:password@gw.dataimpulse.com:823
 * With options: login:password_country-gb_session-xxx@gw.dataimpulse.com:823
 *
 * Options (appended to password with underscores):
 * - country-XX: Target specific country (e.g., country-gb, country-us)
 * - session-XXX: Sticky session ID (same IP for rotation interval)
 * - anonymous-true: Only anonymous proxies
 */
export class DataImpulseProvider implements ProxyProvider {
  name = 'dataimpulse';
  private username: string;
  private password: string;
  private country: string;
  private failCount = 0;
  private successCount = 0;
  private lastFailedAt: number | null = null;

  constructor(options: {
    username: string;
    password: string;
    country?: string;
  }) {
    this.username = options.username;
    this.password = options.password;
    this.country = options.country || 'gb';
  }

  async getProxy(): Promise<ProxyConfig> {
    // DataImpulse uses dashboard configuration for targeting
    // Basic format: login:password@gw.dataimpulse.com:823
    // Country and session settings are configured in the DataImpulse dashboard
    return {
      server: 'http://gw.dataimpulse.com:823',
      username: this.username,
      password: this.password,
      protocol: 'http',
    };
  }

  markFailed(proxy: ProxyConfig): void {
    this.failCount++;
    this.lastFailedAt = Date.now();
  }

  markSuccess(proxy: ProxyConfig): void {
    this.successCount++;
  }

  getStats(): { successRate: number; failCount: number; isHealthy: boolean } {
    const total = this.successCount + this.failCount;
    const successRate = total > 0 ? this.successCount / total : 1;
    // Consider unhealthy if >50% failure rate in last 10 requests or failed in last minute
    const recentlyFailed = this.lastFailedAt && Date.now() - this.lastFailedAt < 60000;
    const isHealthy = successRate > 0.5 && !recentlyFailed;
    return { successRate, failCount: this.failCount, isHealthy };
  }
}

/**
 * ScraperAPI - 1000 FREE requests/month, then $49/100k
 * Handles proxies, CAPTCHAs, and JavaScript for you
 */
export class ScraperAPIProvider implements ProxyProvider {
  name = 'scraperapi';
  private apiKey: string;
  private country: string;
  private requestCount = 0;
  private monthlyLimit: number;

  constructor(options: {
    apiKey: string;
    country?: string;
    monthlyLimit?: number;
  }) {
    this.apiKey = options.apiKey;
    this.country = options.country || 'gb';
    this.monthlyLimit = options.monthlyLimit || 1000; // Free tier
  }

  async getProxy(): Promise<ProxyConfig> {
    // ScraperAPI uses a special proxy format
    // The actual proxy URL with API key embedded
    return {
      server: `http://proxy-server.scraperapi.com:8001`,
      username: `scraperapi.country_code=${this.country}`,
      password: this.apiKey,
      protocol: 'http',
    };
  }

  /**
   * Get the direct ScraperAPI URL for fetch-based requests
   */
  getApiUrl(targetUrl: string): string {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      url: targetUrl,
      country_code: this.country,
    });
    return `http://api.scraperapi.com/?${params}`;
  }

  getRemainingRequests(): number {
    return Math.max(0, this.monthlyLimit - this.requestCount);
  }

  incrementRequestCount(): void {
    this.requestCount++;
  }

  markFailed(proxy: ProxyConfig): void {}
  markSuccess(proxy: ProxyConfig): void {
    this.requestCount++;
  }
}

/**
 * Provider health tracking for intelligent failover
 */
interface ProviderHealth {
  provider: ProxyProvider;
  successCount: number;
  failCount: number;
  consecutiveFailures: number;
  lastFailedAt: number | null;
  lastUsedAt: number;
  cooldownUntil: number | null;
}

/**
 * Main Proxy Manager - handles rotation across multiple providers with intelligent failover
 *
 * Features:
 * - Automatic failover when a provider fails
 * - Cooldown period for failing providers
 * - Priority-based provider selection (cheapest first)
 * - Health tracking per provider
 */
export class ProxyManager {
  private providerHealth: ProviderHealth[] = [];
  private enabled = false;
  private readonly COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cooldown after failures
  private readonly MAX_CONSECUTIVE_FAILURES = 3; // Trigger cooldown after 3 failures

  constructor() {
    this.initializeFromEnv();
  }

  private addProviderWithHealth(provider: ProxyProvider): void {
    this.providerHealth.push({
      provider,
      successCount: 0,
      failCount: 0,
      consecutiveFailures: 0,
      lastFailedAt: null,
      lastUsedAt: 0,
      cooldownUntil: null,
    });
    this.enabled = true;
  }

  private initializeFromEnv(): void {
    // Priority order: Cheapest first, with failover to more expensive options

    // 1. DataImpulse - CHEAPEST ($1/GB) - PRIMARY
    if (process.env.DATAIMPULSE_USERNAME && process.env.DATAIMPULSE_PASSWORD) {
      this.addProviderWithHealth(new DataImpulseProvider({
        username: process.env.DATAIMPULSE_USERNAME,
        password: process.env.DATAIMPULSE_PASSWORD,
        country: process.env.PROXY_COUNTRY || 'gb',
      }));
      console.log('Proxy: DataImpulse enabled ($1/GB) [PRIMARY]');
    }

    // 2. PacketStream - CHEAPEST ($1/GB) - BACKUP
    if (process.env.PACKETSTREAM_API_KEY) {
      this.addProviderWithHealth(new PacketStreamProvider({
        apiKey: process.env.PACKETSTREAM_API_KEY,
        country: process.env.PROXY_COUNTRY || 'GB',
      }));
      console.log('Proxy: PacketStream enabled ($1/GB)');
    }

    // 3. IPRoyal - CHEAP ($1.75/GB) - BACKUP
    if (process.env.IPROYAL_USERNAME && process.env.IPROYAL_PASSWORD) {
      this.addProviderWithHealth(new IPRoyalProvider({
        username: process.env.IPROYAL_USERNAME,
        password: process.env.IPROYAL_PASSWORD,
        country: process.env.PROXY_COUNTRY || 'gb',
      }));
      console.log('Proxy: IPRoyal enabled ($1.75/GB)');
    }

    // 4. ScraperAPI - FREE tier (1000 requests/month) - FALLBACK
    if (process.env.SCRAPERAPI_KEY) {
      this.addProviderWithHealth(new ScraperAPIProvider({
        apiKey: process.env.SCRAPERAPI_KEY,
        country: process.env.PROXY_COUNTRY || 'gb',
        monthlyLimit: parseInt(process.env.SCRAPERAPI_LIMIT || '1000'),
      }));
      console.log('Proxy: ScraperAPI enabled (FREE tier: 1000 req/month)');
    }

    // 5. SmartProxy/Decodo (~$6-8/GB)
    if (process.env.SMARTPROXY_USERNAME && process.env.SMARTPROXY_PASSWORD) {
      this.addProviderWithHealth(new SmartProxyProvider({
        username: process.env.SMARTPROXY_USERNAME,
        password: process.env.SMARTPROXY_PASSWORD,
        country: process.env.PROXY_COUNTRY || 'gb',
      }));
      console.log('Proxy: SmartProxy enabled (~$6-8/GB)');
    }

    // 6. Oxylabs (~$8/GB)
    if (process.env.OXYLABS_USERNAME && process.env.OXYLABS_PASSWORD) {
      this.addProviderWithHealth(new OxylabsProvider({
        username: process.env.OXYLABS_USERNAME,
        password: process.env.OXYLABS_PASSWORD,
        country: process.env.PROXY_COUNTRY || 'gb',
      }));
      console.log('Proxy: Oxylabs enabled (~$8/GB)');
    }

    // 7. Bright Data - Premium (~$10-17/GB)
    if (process.env.BRIGHTDATA_USERNAME && process.env.BRIGHTDATA_PASSWORD) {
      this.addProviderWithHealth(new BrightDataProvider({
        username: process.env.BRIGHTDATA_USERNAME,
        password: process.env.BRIGHTDATA_PASSWORD,
        country: process.env.PROXY_COUNTRY || 'gb',
      }));
      console.log('Proxy: Bright Data enabled (~$10-17/GB)');
    }

    // 8. Static proxy list (user-provided)
    if (process.env.PROXY_LIST) {
      const proxies = process.env.PROXY_LIST.split(',').map(p => {
        const [server, username, password] = p.trim().split('|');
        return { server, username, password } as ProxyConfig;
      });
      if (proxies.length > 0) {
        this.addProviderWithHealth(new StaticProxyProvider(proxies));
        console.log(`Proxy: Static list enabled (${proxies.length} proxies)`);
      }
    }

    if (this.providerHealth.length > 0) {
      console.log(`Proxy Manager: ${this.providerHealth.length} provider(s) configured with failover`);
    }
  }

  addProvider(provider: ProxyProvider): void {
    this.addProviderWithHealth(provider);
  }

  isEnabled(): boolean {
    return this.enabled && this.providerHealth.length > 0;
  }

  /**
   * Get a proxy from the best available provider
   * Uses intelligent selection with failover
   */
  async getProxy(): Promise<ProxyConfig | null> {
    if (!this.enabled || this.providerHealth.length === 0) {
      return null;
    }

    const now = Date.now();

    // Find available providers (not in cooldown)
    const availableProviders = this.providerHealth.filter(
      ph => !ph.cooldownUntil || now > ph.cooldownUntil
    );

    if (availableProviders.length === 0) {
      // All providers in cooldown - use the one with earliest cooldown end
      console.warn('All proxy providers in cooldown, using least-recently-failed');
      const sorted = [...this.providerHealth].sort(
        (a, b) => (a.cooldownUntil || 0) - (b.cooldownUntil || 0)
      );
      const health = sorted[0];
      health.cooldownUntil = null; // Reset cooldown
      health.lastUsedAt = now;
      try {
        return await health.provider.getProxy();
      } catch (error) {
        console.error(`Failed to get proxy from ${health.provider.name}:`, error);
        return null;
      }
    }

    // Try providers in order (they're already sorted by priority/cost)
    for (const health of availableProviders) {
      try {
        health.lastUsedAt = now;
        const proxy = await health.provider.getProxy();

        // Tag proxy with provider name for tracking
        (proxy as any).__providerName = health.provider.name;

        return proxy;
      } catch (error) {
        console.error(`Failed to get proxy from ${health.provider.name}:`, error);
        health.consecutiveFailures++;
        health.failCount++;
        health.lastFailedAt = now;

        // Put provider in cooldown if too many failures
        if (health.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          health.cooldownUntil = now + this.COOLDOWN_MS;
          console.warn(`Provider ${health.provider.name} in cooldown for ${this.COOLDOWN_MS / 1000}s`);
        }
        // Continue to next provider
      }
    }

    console.error('All proxy providers failed');
    return null;
  }

  /**
   * Mark a proxy request as failed - triggers failover logic
   */
  markFailed(proxy: ProxyConfig): void {
    const providerName = (proxy as any).__providerName;
    const health = providerName
      ? this.providerHealth.find(ph => ph.provider.name === providerName)
      : this.providerHealth.find(ph => proxy.server.includes(this.getProviderDomain(ph.provider.name)));

    if (health) {
      health.failCount++;
      health.consecutiveFailures++;
      health.lastFailedAt = Date.now();

      // Put provider in cooldown if too many consecutive failures
      if (health.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        health.cooldownUntil = Date.now() + this.COOLDOWN_MS;
        console.warn(`Provider ${health.provider.name} in cooldown after ${health.consecutiveFailures} failures`);
      }

      health.provider.markFailed(proxy);
    }
  }

  /**
   * Mark a proxy request as successful - resets failure counters
   */
  markSuccess(proxy: ProxyConfig): void {
    const providerName = (proxy as any).__providerName;
    const health = providerName
      ? this.providerHealth.find(ph => ph.provider.name === providerName)
      : this.providerHealth.find(ph => proxy.server.includes(this.getProviderDomain(ph.provider.name)));

    if (health) {
      health.successCount++;
      health.consecutiveFailures = 0; // Reset on success
      health.cooldownUntil = null; // Clear any cooldown
      health.provider.markSuccess(proxy);
    }
  }

  /**
   * Get domain hint for provider matching
   */
  private getProviderDomain(name: string): string {
    const domains: Record<string, string> = {
      dataimpulse: 'dataimpulse.com',
      iproyal: 'iproyal.com',
      packetstream: 'packetstream.io',
      smartproxy: 'smartproxy.com',
      oxylabs: 'oxylabs.io',
      brightdata: 'superproxy.io',
      scraperapi: 'scraperapi.com',
    };
    return domains[name] || name;
  }

  getProviderNames(): string[] {
    return this.providerHealth.map(ph => ph.provider.name);
  }

  /**
   * Get health stats for all providers
   */
  getStats(): Array<{
    name: string;
    successCount: number;
    failCount: number;
    successRate: number;
    inCooldown: boolean;
    consecutiveFailures: number;
  }> {
    return this.providerHealth.map(ph => {
      const total = ph.successCount + ph.failCount;
      return {
        name: ph.provider.name,
        successCount: ph.successCount,
        failCount: ph.failCount,
        successRate: total > 0 ? ph.successCount / total : 1,
        inCooldown: ph.cooldownUntil !== null && Date.now() < ph.cooldownUntil,
        consecutiveFailures: ph.consecutiveFailures,
      };
    });
  }

  /**
   * Log current provider health status
   */
  logStats(): void {
    const stats = this.getStats();
    console.log('Proxy Provider Health:');
    for (const stat of stats) {
      const status = stat.inCooldown ? '⏸️ COOLDOWN' : '✅ ACTIVE';
      console.log(
        `  ${stat.name}: ${status} | Success: ${stat.successCount}/${stat.successCount + stat.failCount} ` +
        `(${(stat.successRate * 100).toFixed(0)}%) | Consecutive failures: ${stat.consecutiveFailures}`
      );
    }
  }
}

// Singleton instance
let proxyManagerInstance: ProxyManager | null = null;

export function getProxyManager(): ProxyManager {
  if (!proxyManagerInstance) {
    proxyManagerInstance = new ProxyManager();
  }
  return proxyManagerInstance;
}

/**
 * Format proxy config for Playwright
 */
export function formatProxyForPlaywright(proxy: ProxyConfig): {
  server: string;
  username?: string;
  password?: string;
} {
  return {
    server: proxy.server,
    username: proxy.username,
    password: proxy.password,
  };
}
