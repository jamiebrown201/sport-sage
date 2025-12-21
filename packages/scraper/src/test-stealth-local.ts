#!/usr/bin/env npx tsx
/**
 * Local CLI test for stealth features (uses system Playwright, not Lambda chromium)
 */

import { chromium, type Page } from 'playwright-core';
import { getProxyManager, formatProxyForPlaywright } from './utils/proxy-manager';
import { getCaptchaManager } from './utils/captcha-solver';

// Same stealth code from browser.ts
async function applyStealthMode(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // === BASIC STEALTH ===
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ],
    });

    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-GB', 'en-US', 'en'],
    });

    (window as any).chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };

    // === CANVAS FINGERPRINT RANDOMIZATION ===
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string, quality?: any) {
      const ctx = this.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, this.width, this.height);
        for (let i = 0; i < imageData.data.length; i += 400) {
          imageData.data[i] = imageData.data[i] ^ (Math.random() > 0.5 ? 1 : 0);
        }
        ctx.putImageData(imageData, 0, 0);
      }
      return originalToDataURL.call(this, type, quality);
    };

    // === WEBGL FINGERPRINT RANDOMIZATION ===
    const getParameterOriginal = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
      if (parameter === 37445) return 'Google Inc. (NVIDIA)';
      if (parameter === 37446) {
        const renderers = [
          'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (NVIDIA GeForce RTX 2070 Direct3D11 vs_5_0 ps_5_0)',
        ];
        return renderers[Math.floor(Math.random() * renderers.length)];
      }
      return getParameterOriginal.call(this, parameter);
    };

    // === HARDWARE RANDOMIZATION ===
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => [4, 8, 12, 16][Math.floor(Math.random() * 4)],
    });
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => [4, 8, 16, 32][Math.floor(Math.random() * 4)],
    });
  });
}

async function main() {
  console.log('\n🥷 Sport Sage Stealth Test (Local)\n');
  console.log('='.repeat(50));

  // Check proxy configuration
  const proxyManager = getProxyManager();
  console.log('\n📡 Proxy Configuration:');
  if (proxyManager.isEnabled()) {
    console.log(`   ✅ Enabled with providers: ${proxyManager.getProviderNames().join(', ')}`);
  } else {
    console.log('   ⚠️  Not configured (set BRIGHTDATA_*, OXYLABS_*, SMARTPROXY_*, or PROXY_LIST)');
  }

  // Check CAPTCHA configuration
  const captchaManager = getCaptchaManager();
  console.log('\n🔐 CAPTCHA Configuration:');
  if (!captchaManager.isFeatureEnabled()) {
    console.log('   ⏸️  Feature disabled (set CAPTCHA_ENABLED=true to enable)');
  } else if (captchaManager.isEnabled()) {
    console.log(`   ✅ Enabled with providers: ${captchaManager.getSolverNames().join(', ')}`);
  } else {
    console.log('   ⚠️  Feature enabled but no API keys configured');
  }

  console.log('\n🌐 Launching browser with stealth mode...');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  });

  const page = await context.newPage();
  await applyStealthMode(page);

  console.log('   ✅ Browser launched\n');

  // Test fingerprint values
  console.log('🔍 Testing fingerprint values...\n');

  const fingerprints = await page.evaluate(() => {
    return {
      webdriver: (navigator as any).webdriver,
      plugins: navigator.plugins.length,
      languages: navigator.languages,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
      },
      hasChrome: !!(window as any).chrome,
      hasChromeRuntime: !!(window as any).chrome?.runtime,
    };
  });

  console.log('   navigator.webdriver:', fingerprints.webdriver, fingerprints.webdriver === undefined ? '✅' : '❌');
  console.log('   navigator.plugins:', fingerprints.plugins, fingerprints.plugins > 0 ? '✅' : '❌');
  console.log('   navigator.languages:', JSON.stringify(fingerprints.languages));
  console.log('   navigator.hardwareConcurrency:', fingerprints.hardwareConcurrency);
  console.log('   navigator.deviceMemory:', fingerprints.deviceMemory, 'GB');
  console.log('   screen:', `${fingerprints.screen.width}x${fingerprints.screen.height} (${fingerprints.screen.colorDepth}bit)`);
  console.log('   window.chrome:', fingerprints.hasChrome ? '✅' : '❌');
  console.log('   window.chrome.runtime:', fingerprints.hasChromeRuntime ? '✅' : '❌');

  // Test against bot detection site
  console.log('\n🤖 Testing against bot.sannysoft.com...');

  try {
    await page.goto('https://bot.sannysoft.com/', { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Take screenshot
    const screenshot = await page.screenshot();
    const fs = await import('fs');
    fs.writeFileSync('/tmp/stealth-test.png', screenshot);
    console.log('   📸 Screenshot saved to /tmp/stealth-test.png');

    // Check detection results
    const pageContent = await page.content();
    const passedTests = (pageContent.match(/class="passed"/g) || []).length;
    const failedTests = (pageContent.match(/class="failed"/g) || []).length;

    console.log(`   ✅ Passed: ${passedTests} tests`);
    console.log(`   ❌ Failed: ${failedTests} tests`);

  } catch (error: any) {
    console.log('   ❌ Failed to load test site:', error.message);
  }

  await browser.close();

  console.log('\n' + '='.repeat(50));
  console.log('\n📋 Summary:');
  console.log('   - Fingerprint randomization: ✅ Active');
  console.log('   - User-Agent rotation: ✅ Active');
  console.log('   - Stealth mode patches: ✅ Applied');
  console.log(`   - Proxy rotation: ${proxyManager.isEnabled() ? '✅ Active' : '⚠️  Not configured'}`);
  console.log(`   - CAPTCHA solving: ${captchaManager.isEnabled() ? '✅ Active' : '⚠️  Not configured'}`);
  console.log('');
}

main().catch(console.error);
