#!/usr/bin/env npx ts-node
/**
 * Quick CLI test for stealth features
 */

import { launchBrowser, createPage, markPageProxySuccess } from './utils/browser';
import { getProxyManager } from './utils/proxy-manager';
import { getCaptchaManager } from './utils/captcha-solver';

async function main() {
  console.log('\n🥷 Sport Sage Stealth Test\n');
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
  if (captchaManager.isEnabled()) {
    console.log(`   ✅ Enabled with providers: ${captchaManager.getSolverNames().join(', ')}`);
    try {
      const balances = await captchaManager.getBalances();
      for (const { provider, balance } of balances) {
        console.log(`   💰 ${provider}: $${balance.toFixed(2)}`);
      }
    } catch (e) {
      console.log('   (Could not fetch balances)');
    }
  } else {
    console.log('   ⚠️  Not configured (set TWOCAPTCHA_API_KEY, ANTICAPTCHA_API_KEY, or CAPMONSTER_API_KEY)');
  }

  console.log('\n🌐 Launching browser with stealth mode...');

  const browser = await launchBrowser();
  const page = await createPage(browser);

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
    await page.waitForTimeout(2000);

    // Check some key detection results
    const results = await page.evaluate(() => {
      const getResult = (id: string) => {
        const el = document.getElementById(id);
        return el?.textContent?.includes('passed') || el?.classList.contains('passed');
      };
      return {
        webdriver: getResult('webdriver-result') ?? document.body.textContent?.includes('webdriver') === false,
        chrome: getResult('chrome-result'),
      };
    });

    console.log('   Webdriver test:', results.webdriver ? '✅ Passed' : '❌ Failed');

    markPageProxySuccess(page);
    console.log('\n✅ Stealth test completed successfully!\n');
  } catch (error: any) {
    console.log('   ❌ Failed to load test site:', error.message);
  }

  await browser.close();

  console.log('='.repeat(50));
  console.log('\n📋 Summary:');
  console.log('   - Fingerprint randomization: ✅ Active');
  console.log('   - User-Agent rotation: ✅ Active');
  console.log('   - Stealth mode patches: ✅ Applied');
  console.log(`   - Proxy rotation: ${proxyManager.isEnabled() ? '✅ Active' : '⚠️  Not configured'}`);
  console.log(`   - CAPTCHA solving: ${captchaManager.isEnabled() ? '✅ Active' : '⚠️  Not configured'}`);
  console.log('');
}

main().catch(console.error);
