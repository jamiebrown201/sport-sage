import type { Browser, Page } from 'playwright-core';

// Dynamic import for playwright-aws-lambda
let playwrightLauncher: typeof import('playwright-aws-lambda') | null = null;

async function getPlaywright() {
  if (!playwrightLauncher) {
    playwrightLauncher = await import('playwright-aws-lambda');
  }
  return playwrightLauncher;
}

export interface BrowserConfig {
  headless?: boolean;
  timeout?: number;
}

export async function launchBrowser(config: BrowserConfig = {}): Promise<Browser> {
  const playwright = await getPlaywright();

  const browser = await playwright.launchChromium({
    headless: config.headless ?? true,
  });

  return browser;
}

export async function createPage(browser: Browser, config: BrowserConfig = {}): Promise<Page> {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(config.timeout ?? 30000);

  return page;
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
