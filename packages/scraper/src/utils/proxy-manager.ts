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
 * Main Proxy Manager - handles rotation across multiple providers
 */
export class ProxyManager {
  private providers: ProxyProvider[] = [];
  private currentProviderIndex = 0;
  private enabled = false;

  constructor() {
    this.initializeFromEnv();
  }

  private initializeFromEnv(): void {
    // Priority order: FREE options first, then cheapest paid options

    // 1. ScraperAPI - FREE tier (1000 requests/month)
    if (process.env.SCRAPERAPI_KEY) {
      this.providers.push(new ScraperAPIProvider({
        apiKey: process.env.SCRAPERAPI_KEY,
        country: process.env.PROXY_COUNTRY || 'gb',
        monthlyLimit: parseInt(process.env.SCRAPERAPI_LIMIT || '1000'),
      }));
      this.enabled = true;
      console.log('Proxy: ScraperAPI enabled (FREE tier: 1000 req/month)');
    }

    // 2. IPRoyal - CHEAP ($1.75/GB, low minimum)
    if (process.env.IPROYAL_USERNAME && process.env.IPROYAL_PASSWORD) {
      this.providers.push(new IPRoyalProvider({
        username: process.env.IPROYAL_USERNAME,
        password: process.env.IPROYAL_PASSWORD,
        country: process.env.PROXY_COUNTRY || 'gb',
      }));
      this.enabled = true;
      console.log('Proxy: IPRoyal enabled ($1.75/GB)');
    }

    // 3. PacketStream - CHEAPEST ($1/GB)
    if (process.env.PACKETSTREAM_API_KEY) {
      this.providers.push(new PacketStreamProvider({
        apiKey: process.env.PACKETSTREAM_API_KEY,
        country: process.env.PROXY_COUNTRY || 'GB',
      }));
      this.enabled = true;
      console.log('Proxy: PacketStream enabled ($1/GB)');
    }

    // 4. SmartProxy/Decodo (~$6-8/GB)
    if (process.env.SMARTPROXY_USERNAME && process.env.SMARTPROXY_PASSWORD) {
      this.providers.push(new SmartProxyProvider({
        username: process.env.SMARTPROXY_USERNAME,
        password: process.env.SMARTPROXY_PASSWORD,
        country: process.env.PROXY_COUNTRY || 'gb',
      }));
      this.enabled = true;
      console.log('Proxy: SmartProxy enabled (~$6-8/GB)');
    }

    // 5. Oxylabs (~$8/GB)
    if (process.env.OXYLABS_USERNAME && process.env.OXYLABS_PASSWORD) {
      this.providers.push(new OxylabsProvider({
        username: process.env.OXYLABS_USERNAME,
        password: process.env.OXYLABS_PASSWORD,
        country: process.env.PROXY_COUNTRY || 'gb',
      }));
      this.enabled = true;
      console.log('Proxy: Oxylabs enabled (~$8/GB)');
    }

    // 6. Bright Data - Premium (~$10-17/GB)
    if (process.env.BRIGHTDATA_USERNAME && process.env.BRIGHTDATA_PASSWORD) {
      this.providers.push(new BrightDataProvider({
        username: process.env.BRIGHTDATA_USERNAME,
        password: process.env.BRIGHTDATA_PASSWORD,
        country: process.env.PROXY_COUNTRY || 'gb',
      }));
      this.enabled = true;
      console.log('Proxy: Bright Data enabled (~$10-17/GB)');
    }

    // 7. Static proxy list (user-provided)
    if (process.env.PROXY_LIST) {
      const proxies = process.env.PROXY_LIST.split(',').map(p => {
        const [server, username, password] = p.trim().split('|');
        return { server, username, password } as ProxyConfig;
      });
      if (proxies.length > 0) {
        this.providers.push(new StaticProxyProvider(proxies));
        this.enabled = true;
        console.log(`Proxy: Static list enabled (${proxies.length} proxies)`);
      }
    }
  }

  addProvider(provider: ProxyProvider): void {
    this.providers.push(provider);
    this.enabled = true;
  }

  isEnabled(): boolean {
    return this.enabled && this.providers.length > 0;
  }

  async getProxy(): Promise<ProxyConfig | null> {
    if (!this.enabled || this.providers.length === 0) {
      return null;
    }

    // Round-robin through providers
    const provider = this.providers[this.currentProviderIndex];
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;

    try {
      return await provider.getProxy();
    } catch (error) {
      console.error(`Failed to get proxy from ${provider.name}:`, error);
      // Try next provider
      if (this.providers.length > 1) {
        const nextProvider = this.providers[this.currentProviderIndex];
        return await nextProvider.getProxy();
      }
      return null;
    }
  }

  markFailed(proxy: ProxyConfig): void {
    // Notify all providers (the right one will handle it)
    for (const provider of this.providers) {
      provider.markFailed(proxy);
    }
  }

  markSuccess(proxy: ProxyConfig): void {
    for (const provider of this.providers) {
      provider.markSuccess(proxy);
    }
  }

  getProviderNames(): string[] {
    return this.providers.map(p => p.name);
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
