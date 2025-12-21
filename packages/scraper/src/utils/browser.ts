import type { Browser, Page, BrowserContext } from 'playwright-core';
import { chromium } from 'playwright-core';
import { getProxyManager, formatProxyForPlaywright, type ProxyConfig } from './proxy-manager';

// Dynamic import for @sparticuz/chromium
let sparticuzChromium: any = null;

async function getChromium() {
  if (!sparticuzChromium) {
    sparticuzChromium = await import('@sparticuz/chromium');
  }
  return sparticuzChromium.default;
}

// Track current proxy for the page (for marking success/failure)
const pageProxyMap = new WeakMap<Page, ProxyConfig>();

// Rotate user agents to avoid detection
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
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface BrowserConfig {
  headless?: boolean;
  timeout?: number;
  proxy?: string; // e.g., "http://proxy:8080" or "socks5://proxy:1080"
}

// Rate limiting - track requests per domain
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 30;

export function checkRateLimit(domain: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(domain);

  if (!record || now > record.resetTime) {
    requestCounts.set(domain, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  record.count++;
  return true;
}

export async function waitForRateLimit(domain: string): Promise<void> {
  while (!checkRateLimit(domain)) {
    const record = requestCounts.get(domain);
    const waitTime = record ? record.resetTime - Date.now() : 1000;
    console.log(`Rate limit hit for ${domain}, waiting ${waitTime}ms`);
    await sleep(Math.max(waitTime, 1000));
  }
}

export async function launchBrowser(config: BrowserConfig = {}): Promise<Browser> {
  const chromiumModule = await getChromium();

  const browser = await chromium.launch({
    args: [
      ...chromiumModule.args,
      '--disable-blink-features=AutomationControlled', // Hide automation
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    executablePath: await chromiumModule.executablePath(),
    headless: true,
  });

  return browser;
}

export async function createPage(browser: Browser, config: BrowserConfig = {}): Promise<Page> {
  const userAgent = getRandomItem(USER_AGENTS);
  const viewport = getRandomItem(VIEWPORTS);

  const contextOptions: any = {
    userAgent,
    viewport,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    // Additional headers to appear more like a real browser
    extraHTTPHeaders: {
      'Accept-Language': 'en-GB,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    },
    // Emulate real device
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  };

  // Add proxy - prefer auto-rotation, fall back to manual config
  let currentProxy: ProxyConfig | null = null;
  const proxyManager = getProxyManager();

  if (proxyManager.isEnabled() && !config.proxy) {
    // Use rotating proxy from manager
    currentProxy = await proxyManager.getProxy();
    if (currentProxy) {
      contextOptions.proxy = formatProxyForPlaywright(currentProxy);
      console.log(`Using rotating proxy: ${currentProxy.server}`);
    }
  } else if (config.proxy) {
    // Use manually configured proxy
    contextOptions.proxy = { server: config.proxy };
  }

  const context = await browser.newContext(contextOptions);

  const page = await context.newPage();
  page.setDefaultTimeout(config.timeout ?? 30000);

  // Track proxy for this page
  if (currentProxy) {
    pageProxyMap.set(page, currentProxy);
  }

  // Apply stealth techniques
  await applyStealthMode(page);

  return page;
}

/**
 * Mark the proxy used by this page as successful
 */
export function markPageProxySuccess(page: Page): void {
  const proxy = pageProxyMap.get(page);
  if (proxy) {
    getProxyManager().markSuccess(proxy);
  }
}

/**
 * Mark the proxy used by this page as failed
 */
export function markPageProxyFailed(page: Page): void {
  const proxy = pageProxyMap.get(page);
  if (proxy) {
    getProxyManager().markFailed(proxy);
  }
}

/**
 * Apply stealth mode to avoid bot detection
 */
async function applyStealthMode(page: Page): Promise<void> {
  // Remove webdriver property and add comprehensive fingerprint randomization
  await page.addInitScript(() => {
    // === BASIC STEALTH ===
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ],
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-GB', 'en-US', 'en'],
    });

    // Mock permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : originalQuery(parameters);

    // Mock chrome runtime
    (window as any).chrome = {
      runtime: {},
      loadTimes: () => ({}),
      csi: () => ({}),
    };

    // === CANVAS FINGERPRINT RANDOMIZATION ===
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string, quality?: any) {
      // Add subtle noise to canvas data
      const ctx = this.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;
        // Add random noise to a few pixels
        for (let i = 0; i < data.length; i += 400) {
          data[i] = data[i] ^ (Math.random() > 0.5 ? 1 : 0);
        }
        ctx.putImageData(imageData, 0, 0);
      }
      return originalToDataURL.call(this, type, quality);
    };

    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(
      sx: number, sy: number, sw: number, sh: number
    ) {
      const imageData = originalGetImageData.call(this, sx, sy, sw, sh);
      // Add subtle noise
      for (let i = 0; i < imageData.data.length; i += 400) {
        imageData.data[i] = imageData.data[i] ^ (Math.random() > 0.5 ? 1 : 0);
      }
      return imageData;
    };

    // === WEBGL FINGERPRINT RANDOMIZATION ===
    const getParameterOriginal = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
      // Randomize renderer and vendor strings
      if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
        return 'Google Inc. (NVIDIA)';
      }
      if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
        const renderers = [
          'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (NVIDIA GeForce RTX 2070 Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
        ];
        return renderers[Math.floor(Math.random() * renderers.length)];
      }
      return getParameterOriginal.call(this, parameter);
    };

    // WebGL2 support
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const getParameter2Original = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(parameter: number) {
        if (parameter === 37445) {
          return 'Google Inc. (NVIDIA)';
        }
        if (parameter === 37446) {
          const renderers = [
            'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
            'ANGLE (NVIDIA GeForce RTX 2070 Direct3D11 vs_5_0 ps_5_0)',
            'ANGLE (Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)',
          ];
          return renderers[Math.floor(Math.random() * renderers.length)];
        }
        return getParameter2Original.call(this, parameter);
      };
    }

    // === AUDIO FINGERPRINT RANDOMIZATION ===
    const audioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (audioContext) {
      const originalCreateAnalyser = audioContext.prototype.createAnalyser;
      audioContext.prototype.createAnalyser = function() {
        const analyser = originalCreateAnalyser.call(this);
        const originalGetFloatFrequencyData = analyser.getFloatFrequencyData.bind(analyser);
        analyser.getFloatFrequencyData = function(array: Float32Array) {
          originalGetFloatFrequencyData(array);
          // Add subtle noise to audio data
          for (let i = 0; i < array.length; i += 10) {
            array[i] = array[i] + (Math.random() * 0.0001 - 0.00005);
          }
        };
        return analyser;
      };

      const originalCreateOscillator = audioContext.prototype.createOscillator;
      audioContext.prototype.createOscillator = function() {
        const oscillator = originalCreateOscillator.call(this);
        // Slightly randomize frequency
        const originalFrequencySet = Object.getOwnPropertyDescriptor(
          oscillator.frequency, 'value'
        )?.set;
        if (originalFrequencySet) {
          Object.defineProperty(oscillator.frequency, 'value', {
            set: function(val) {
              originalFrequencySet.call(this, val + (Math.random() * 0.001 - 0.0005));
            }
          });
        }
        return oscillator;
      };
    }

    // === HARDWARE CONCURRENCY RANDOMIZATION ===
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => [4, 8, 12, 16][Math.floor(Math.random() * 4)],
    });

    // === DEVICE MEMORY RANDOMIZATION ===
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => [4, 8, 16, 32][Math.floor(Math.random() * 4)],
    });

    // === SCREEN PROPERTIES ===
    const screenProps = [
      { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24 },
      { width: 2560, height: 1440, availWidth: 2560, availHeight: 1400, colorDepth: 24 },
      { width: 1366, height: 768, availWidth: 1366, availHeight: 728, colorDepth: 24 },
      { width: 1536, height: 864, availWidth: 1536, availHeight: 824, colorDepth: 24 },
    ];
    const selectedScreen = screenProps[Math.floor(Math.random() * screenProps.length)];

    Object.defineProperty(screen, 'width', { get: () => selectedScreen.width });
    Object.defineProperty(screen, 'height', { get: () => selectedScreen.height });
    Object.defineProperty(screen, 'availWidth', { get: () => selectedScreen.availWidth });
    Object.defineProperty(screen, 'availHeight', { get: () => selectedScreen.availHeight });
    Object.defineProperty(screen, 'colorDepth', { get: () => selectedScreen.colorDepth });
    Object.defineProperty(screen, 'pixelDepth', { get: () => selectedScreen.colorDepth });
  });
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function randomDelay(minMs = 1000, maxMs = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
  await sleep(delay);
}
