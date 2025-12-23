/**
 * Smart Proxy Rotator with Subnet Diversity
 *
 * Features:
 * - Weighted selection based on success rate
 * - Subnet diversity (avoid consecutive same /24 range)
 * - Recency penalty (don't reuse within 30s)
 * - Automatic failover with cooldown
 */

import { logger } from '../logger.js';

export interface ProxyProfile {
  url: string;
  username?: string;
  password?: string;
  subnet: string; // First 3 octets for /24 identification
  successCount: number;
  failCount: number;
  lastUsed: number;
  lastFailed: number | null;
  cooldownUntil: number | null;
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cooldown after failures
const MAX_CONSECUTIVE_FAILURES = 3;
const MIN_REUSE_INTERVAL_MS = 30 * 1000; // 30 seconds between uses of same proxy

class SmartProxyRotator {
  private proxies: ProxyProfile[] = [];
  private lastSubnet: string | null = null;
  private enabled = false;

  constructor() {
    this.initializeFromEnv();
  }

  private initializeFromEnv(): void {
    // DataImpulse - Primary ($1/GB)
    if (process.env.DATAIMPULSE_USERNAME && process.env.DATAIMPULSE_PASSWORD) {
      this.addRotatingProxy({
        name: 'dataimpulse',
        server: 'http://gw.dataimpulse.com:823',
        username: process.env.DATAIMPULSE_USERNAME,
        password: process.env.DATAIMPULSE_PASSWORD,
      });
      logger.info('Proxy: DataImpulse enabled ($1/GB) [PRIMARY]');
    }

    // PacketStream - Backup ($1/GB)
    if (process.env.PACKETSTREAM_API_KEY) {
      const country = process.env.PROXY_COUNTRY || 'GB';
      this.addRotatingProxy({
        name: 'packetstream',
        server: 'http://proxy.packetstream.io:31112',
        username: process.env.PACKETSTREAM_API_KEY,
        password: country,
      });
      logger.info('Proxy: PacketStream enabled ($1/GB)');
    }

    // IPRoyal - Backup ($1.75/GB)
    if (process.env.IPROYAL_USERNAME && process.env.IPROYAL_PASSWORD) {
      const country = process.env.PROXY_COUNTRY || 'gb';
      const sessionId = Math.random().toString(36).substring(2, 10);
      this.addRotatingProxy({
        name: 'iproyal',
        server: 'http://geo.iproyal.com:12321',
        username: process.env.IPROYAL_USERNAME,
        password: `${process.env.IPROYAL_PASSWORD}_country-${country}_session-${sessionId}_lifetime-5m`,
      });
      logger.info('Proxy: IPRoyal enabled ($1.75/GB)');
    }

    // SmartProxy/Decodo (~$6-8/GB)
    if (process.env.SMARTPROXY_USERNAME && process.env.SMARTPROXY_PASSWORD) {
      const country = process.env.PROXY_COUNTRY || 'gb';
      const sessionId = Math.random().toString(36).substring(2, 15);
      this.addRotatingProxy({
        name: 'smartproxy',
        server: 'http://gate.smartproxy.com:7000',
        username: `user-${process.env.SMARTPROXY_USERNAME}-country-${country}-session-${sessionId}`,
        password: process.env.SMARTPROXY_PASSWORD,
      });
      logger.info('Proxy: SmartProxy enabled (~$6-8/GB)');
    }

    // Bright Data - Premium (~$10-17/GB)
    if (process.env.BRIGHTDATA_USERNAME && process.env.BRIGHTDATA_PASSWORD) {
      const zone = process.env.BRIGHTDATA_ZONE || 'residential';
      const country = process.env.PROXY_COUNTRY || 'gb';
      const sessionId = Math.random().toString(36).substring(2, 15);
      this.addRotatingProxy({
        name: 'brightdata',
        server: 'http://brd.superproxy.io:22225',
        username: `${process.env.BRIGHTDATA_USERNAME}-zone-${zone}-country-${country}-session-${sessionId}`,
        password: process.env.BRIGHTDATA_PASSWORD,
      });
      logger.info('Proxy: Bright Data enabled (~$10-17/GB)');
    }

    if (this.proxies.length > 0) {
      this.enabled = true;
      logger.info(`Smart Proxy Rotator: ${this.proxies.length} provider(s) configured`);
    }
  }

  private addRotatingProxy(config: {
    name: string;
    server: string;
    username?: string;
    password?: string;
  }): void {
    // Extract subnet from server URL (for diversity tracking)
    const subnet = this.extractSubnet(config.server);

    this.proxies.push({
      url: config.server,
      username: config.username,
      password: config.password,
      subnet,
      successCount: 0,
      failCount: 0,
      lastUsed: 0,
      lastFailed: null,
      cooldownUntil: null,
    });
  }

  private extractSubnet(url: string): string {
    try {
      // Extract host from URL
      const host = new URL(url).hostname;

      // For IP addresses, get first 3 octets
      const ipMatch = host.match(/^(\d+\.\d+\.\d+)/);
      if (ipMatch) {
        return ipMatch[1];
      }

      // For hostnames, use the hostname as "subnet" identifier
      return host;
    } catch {
      return 'unknown';
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.proxies.length > 0;
  }

  async selectProxy(): Promise<ProxyProfile | null> {
    if (!this.enabled || this.proxies.length === 0) {
      return null;
    }

    const now = Date.now();

    // Filter available proxies (not in cooldown)
    let available = this.proxies.filter(
      (p) => !p.cooldownUntil || now > p.cooldownUntil
    );

    if (available.length === 0) {
      // All in cooldown - use the one with earliest cooldown end
      logger.warn('All proxies in cooldown, using least-recently-failed');
      const sorted = [...this.proxies].sort(
        (a, b) => (a.cooldownUntil || 0) - (b.cooldownUntil || 0)
      );
      sorted[0].cooldownUntil = null;
      return sorted[0];
    }

    // Filter by recency (avoid reusing within 30s)
    const notRecentlyUsed = available.filter(
      (p) => now - p.lastUsed > MIN_REUSE_INTERVAL_MS
    );

    if (notRecentlyUsed.length > 0) {
      available = notRecentlyUsed;
    }

    // Prefer different subnet than last used
    const differentSubnet = available.filter((p) => p.subnet !== this.lastSubnet);
    if (differentSubnet.length > 0) {
      available = differentSubnet;
    }

    // Weighted selection by success rate
    const selected = this.weightedRandomSelect(available);
    selected.lastUsed = now;
    this.lastSubnet = selected.subnet;

    return selected;
  }

  private weightedRandomSelect(proxies: ProxyProfile[]): ProxyProfile {
    // Calculate weights based on success rate
    const weights = proxies.map((p) => {
      const total = p.successCount + p.failCount;
      if (total === 0) return 1; // Untested proxies get weight 1
      return p.successCount / total + 0.1; // +0.1 to avoid zero weight
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < proxies.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return proxies[i];
      }
    }

    return proxies[proxies.length - 1];
  }

  recordSuccess(proxyUrl: string): void {
    const proxy = this.proxies.find((p) => p.url === proxyUrl);
    if (proxy) {
      proxy.successCount++;
      proxy.cooldownUntil = null; // Clear any cooldown
      logger.debug('Proxy success recorded', {
        url: proxyUrl.split('@').pop(),
        successRate: this.getSuccessRate(proxy),
      });
    }
  }

  recordFailure(proxyUrl: string): void {
    const proxy = this.proxies.find((p) => p.url === proxyUrl);
    if (proxy) {
      proxy.failCount++;
      proxy.lastFailed = Date.now();

      // Check for consecutive failures (approximated by recent failure rate)
      const recentTotal = proxy.successCount + proxy.failCount;
      const recentFailRate = recentTotal > 0 ? proxy.failCount / recentTotal : 0;

      if (recentFailRate > 0.5 && proxy.failCount >= MAX_CONSECUTIVE_FAILURES) {
        proxy.cooldownUntil = Date.now() + COOLDOWN_MS;
        logger.warn('Proxy in cooldown', {
          url: proxyUrl.split('@').pop(),
          cooldownMs: COOLDOWN_MS,
          failCount: proxy.failCount,
        });
      }
    }
  }

  private getSuccessRate(proxy: ProxyProfile): string {
    const total = proxy.successCount + proxy.failCount;
    if (total === 0) return 'N/A';
    return `${((proxy.successCount / total) * 100).toFixed(0)}%`;
  }

  reset(): void {
    for (const proxy of this.proxies) {
      proxy.successCount = 0;
      proxy.failCount = 0;
      proxy.lastUsed = 0;
      proxy.lastFailed = null;
      proxy.cooldownUntil = null;
    }
    this.lastSubnet = null;
    logger.info('Proxy rotator reset');
  }

  getStats(): Array<{
    url: string;
    successCount: number;
    failCount: number;
    successRate: string;
    inCooldown: boolean;
    lastUsed: Date | null;
  }> {
    return this.proxies.map((p) => ({
      url: p.url.split('@').pop() || p.url, // Hide credentials
      successCount: p.successCount,
      failCount: p.failCount,
      successRate: this.getSuccessRate(p),
      inCooldown: p.cooldownUntil !== null && Date.now() < p.cooldownUntil,
      lastUsed: p.lastUsed > 0 ? new Date(p.lastUsed) : null,
    }));
  }
}

// Singleton instance
let rotatorInstance: SmartProxyRotator | null = null;

export function getProxyRotator(): SmartProxyRotator {
  if (!rotatorInstance) {
    rotatorInstance = new SmartProxyRotator();
  }
  return rotatorInstance;
}
