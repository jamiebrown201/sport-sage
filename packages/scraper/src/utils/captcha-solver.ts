/**
 * CAPTCHA Solving Service
 *
 * Supports multiple CAPTCHA solving providers:
 * - 2Captcha
 * - Anti-Captcha
 * - CapMonster Cloud
 *
 * Handles reCAPTCHA v2/v3, hCaptcha, and image CAPTCHAs
 */

import type { Page } from 'playwright-core';

export interface CaptchaSolver {
  name: string;
  solveRecaptchaV2(siteKey: string, pageUrl: string): Promise<string>;
  solveRecaptchaV3(siteKey: string, pageUrl: string, action?: string): Promise<string>;
  solveHCaptcha(siteKey: string, pageUrl: string): Promise<string>;
  solveImage(base64Image: string): Promise<string>;
  getBalance(): Promise<number>;
}

interface CaptchaResult {
  success: boolean;
  token?: string;
  error?: string;
  cost?: number;
}

/**
 * 2Captcha Implementation
 * https://2captcha.com/
 */
export class TwoCaptchaSolver implements CaptchaSolver {
  name = '2captcha';
  private apiKey: string;
  private baseUrl = 'https://2captcha.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async solveRecaptchaV2(siteKey: string, pageUrl: string): Promise<string> {
    // Submit the captcha
    const submitResponse = await fetch(
      `${this.baseUrl}/in.php?key=${this.apiKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`
    );
    const submitResult = await submitResponse.json();

    if (submitResult.status !== 1) {
      throw new Error(`2Captcha submit failed: ${submitResult.request}`);
    }

    const requestId = submitResult.request;

    // Poll for result
    return await this.pollForResult(requestId);
  }

  async solveRecaptchaV3(siteKey: string, pageUrl: string, action = 'verify'): Promise<string> {
    const submitResponse = await fetch(
      `${this.baseUrl}/in.php?key=${this.apiKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(pageUrl)}&version=v3&action=${action}&min_score=0.7&json=1`
    );
    const submitResult = await submitResponse.json();

    if (submitResult.status !== 1) {
      throw new Error(`2Captcha submit failed: ${submitResult.request}`);
    }

    return await this.pollForResult(submitResult.request);
  }

  async solveHCaptcha(siteKey: string, pageUrl: string): Promise<string> {
    const submitResponse = await fetch(
      `${this.baseUrl}/in.php?key=${this.apiKey}&method=hcaptcha&sitekey=${siteKey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`
    );
    const submitResult = await submitResponse.json();

    if (submitResult.status !== 1) {
      throw new Error(`2Captcha submit failed: ${submitResult.request}`);
    }

    return await this.pollForResult(submitResult.request);
  }

  async solveImage(base64Image: string): Promise<string> {
    const submitResponse = await fetch(`${this.baseUrl}/in.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `key=${this.apiKey}&method=base64&body=${encodeURIComponent(base64Image)}&json=1`,
    });
    const submitResult = await submitResponse.json();

    if (submitResult.status !== 1) {
      throw new Error(`2Captcha submit failed: ${submitResult.request}`);
    }

    return await this.pollForResult(submitResult.request);
  }

  async getBalance(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/res.php?key=${this.apiKey}&action=getbalance&json=1`);
    const result = await response.json();
    return parseFloat(result.request) || 0;
  }

  private async pollForResult(requestId: string, maxAttempts = 30): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const response = await fetch(
        `${this.baseUrl}/res.php?key=${this.apiKey}&action=get&id=${requestId}&json=1`
      );
      const result = await response.json();

      if (result.status === 1) {
        return result.request;
      }

      if (result.request !== 'CAPCHA_NOT_READY') {
        throw new Error(`2Captcha error: ${result.request}`);
      }
    }

    throw new Error('2Captcha timeout - max attempts reached');
  }
}

/**
 * Anti-Captcha Implementation
 * https://anti-captcha.com/
 */
export class AntiCaptchaSolver implements CaptchaSolver {
  name = 'anti-captcha';
  private apiKey: string;
  private baseUrl = 'https://api.anti-captcha.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async solveRecaptchaV2(siteKey: string, pageUrl: string): Promise<string> {
    const taskId = await this.createTask({
      type: 'RecaptchaV2TaskProxyless',
      websiteURL: pageUrl,
      websiteKey: siteKey,
    });

    return await this.getTaskResult(taskId);
  }

  async solveRecaptchaV3(siteKey: string, pageUrl: string, action = 'verify'): Promise<string> {
    const taskId = await this.createTask({
      type: 'RecaptchaV3TaskProxyless',
      websiteURL: pageUrl,
      websiteKey: siteKey,
      minScore: 0.7,
      pageAction: action,
    });

    return await this.getTaskResult(taskId);
  }

  async solveHCaptcha(siteKey: string, pageUrl: string): Promise<string> {
    const taskId = await this.createTask({
      type: 'HCaptchaTaskProxyless',
      websiteURL: pageUrl,
      websiteKey: siteKey,
    });

    return await this.getTaskResult(taskId);
  }

  async solveImage(base64Image: string): Promise<string> {
    const taskId = await this.createTask({
      type: 'ImageToTextTask',
      body: base64Image,
    });

    return await this.getTaskResult(taskId);
  }

  async getBalance(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/getBalance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: this.apiKey }),
    });
    const result = await response.json();
    return result.balance || 0;
  }

  private async createTask(task: any): Promise<number> {
    const response = await fetch(`${this.baseUrl}/createTask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: this.apiKey,
        task,
      }),
    });
    const result = await response.json();

    if (result.errorId !== 0) {
      throw new Error(`Anti-Captcha error: ${result.errorDescription}`);
    }

    return result.taskId;
  }

  private async getTaskResult(taskId: number, maxAttempts = 30): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const response = await fetch(`${this.baseUrl}/getTaskResult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: this.apiKey,
          taskId,
        }),
      });
      const result = await response.json();

      if (result.errorId !== 0) {
        throw new Error(`Anti-Captcha error: ${result.errorDescription}`);
      }

      if (result.status === 'ready') {
        return result.solution.gRecaptchaResponse || result.solution.token || result.solution.text;
      }
    }

    throw new Error('Anti-Captcha timeout - max attempts reached');
  }
}

/**
 * CapMonster Cloud Implementation
 * https://capmonster.cloud/
 */
export class CapMonsterSolver implements CaptchaSolver {
  name = 'capmonster';
  private apiKey: string;
  private baseUrl = 'https://api.capmonster.cloud';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async solveRecaptchaV2(siteKey: string, pageUrl: string): Promise<string> {
    const taskId = await this.createTask({
      type: 'RecaptchaV2TaskProxyless',
      websiteURL: pageUrl,
      websiteKey: siteKey,
    });

    return await this.getTaskResult(taskId);
  }

  async solveRecaptchaV3(siteKey: string, pageUrl: string, action = 'verify'): Promise<string> {
    const taskId = await this.createTask({
      type: 'RecaptchaV3TaskProxyless',
      websiteURL: pageUrl,
      websiteKey: siteKey,
      minScore: 0.7,
      pageAction: action,
    });

    return await this.getTaskResult(taskId);
  }

  async solveHCaptcha(siteKey: string, pageUrl: string): Promise<string> {
    const taskId = await this.createTask({
      type: 'HCaptchaTaskProxyless',
      websiteURL: pageUrl,
      websiteKey: siteKey,
    });

    return await this.getTaskResult(taskId);
  }

  async solveImage(base64Image: string): Promise<string> {
    const taskId = await this.createTask({
      type: 'ImageToTextTask',
      body: base64Image,
    });

    return await this.getTaskResult(taskId);
  }

  async getBalance(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/getBalance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: this.apiKey }),
    });
    const result = await response.json();
    return result.balance || 0;
  }

  private async createTask(task: any): Promise<number> {
    const response = await fetch(`${this.baseUrl}/createTask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: this.apiKey,
        task,
      }),
    });
    const result = await response.json();

    if (result.errorId !== 0) {
      throw new Error(`CapMonster error: ${result.errorDescription}`);
    }

    return result.taskId;
  }

  private async getTaskResult(taskId: number, maxAttempts = 30): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // CapMonster is faster

      const response = await fetch(`${this.baseUrl}/getTaskResult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: this.apiKey,
          taskId,
        }),
      });
      const result = await response.json();

      if (result.errorId !== 0) {
        throw new Error(`CapMonster error: ${result.errorDescription}`);
      }

      if (result.status === 'ready') {
        return result.solution.gRecaptchaResponse || result.solution.token || result.solution.text;
      }
    }

    throw new Error('CapMonster timeout - max attempts reached');
  }
}

/**
 * Main CAPTCHA Manager - handles solver selection and fallback
 *
 * Feature flag: Set CAPTCHA_ENABLED=true to enable (default: false)
 */
export class CaptchaManager {
  private solvers: CaptchaSolver[] = [];
  private enabled = false;
  private featureEnabled = false;

  constructor() {
    this.initializeFromEnv();
  }

  private initializeFromEnv(): void {
    // Feature flag - must be explicitly enabled
    this.featureEnabled = process.env.CAPTCHA_ENABLED === 'true';

    if (!this.featureEnabled) {
      console.log('CAPTCHA solving disabled (set CAPTCHA_ENABLED=true to enable)');
      return;
    }

    // 2Captcha
    if (process.env.TWOCAPTCHA_API_KEY) {
      this.solvers.push(new TwoCaptchaSolver(process.env.TWOCAPTCHA_API_KEY));
      this.enabled = true;
    }

    // Anti-Captcha
    if (process.env.ANTICAPTCHA_API_KEY) {
      this.solvers.push(new AntiCaptchaSolver(process.env.ANTICAPTCHA_API_KEY));
      this.enabled = true;
    }

    // CapMonster
    if (process.env.CAPMONSTER_API_KEY) {
      this.solvers.push(new CapMonsterSolver(process.env.CAPMONSTER_API_KEY));
      this.enabled = true;
    }
  }

  addSolver(solver: CaptchaSolver): void {
    this.solvers.push(solver);
    this.enabled = true;
  }

  isEnabled(): boolean {
    return this.featureEnabled && this.enabled && this.solvers.length > 0;
  }

  isFeatureEnabled(): boolean {
    return this.featureEnabled;
  }

  getSolverNames(): string[] {
    return this.solvers.map(s => s.name);
  }

  /**
   * Try to solve a CAPTCHA with fallback to other providers
   */
  async solveRecaptchaV2(siteKey: string, pageUrl: string): Promise<CaptchaResult> {
    for (const solver of this.solvers) {
      try {
        console.log(`Attempting reCAPTCHA v2 solve with ${solver.name}...`);
        const token = await solver.solveRecaptchaV2(siteKey, pageUrl);
        return { success: true, token };
      } catch (error: any) {
        console.error(`${solver.name} failed: ${error.message}`);
      }
    }
    return { success: false, error: 'All CAPTCHA solvers failed' };
  }

  async solveRecaptchaV3(siteKey: string, pageUrl: string, action?: string): Promise<CaptchaResult> {
    for (const solver of this.solvers) {
      try {
        console.log(`Attempting reCAPTCHA v3 solve with ${solver.name}...`);
        const token = await solver.solveRecaptchaV3(siteKey, pageUrl, action);
        return { success: true, token };
      } catch (error: any) {
        console.error(`${solver.name} failed: ${error.message}`);
      }
    }
    return { success: false, error: 'All CAPTCHA solvers failed' };
  }

  async solveHCaptcha(siteKey: string, pageUrl: string): Promise<CaptchaResult> {
    for (const solver of this.solvers) {
      try {
        console.log(`Attempting hCaptcha solve with ${solver.name}...`);
        const token = await solver.solveHCaptcha(siteKey, pageUrl);
        return { success: true, token };
      } catch (error: any) {
        console.error(`${solver.name} failed: ${error.message}`);
      }
    }
    return { success: false, error: 'All CAPTCHA solvers failed' };
  }

  async solveImage(base64Image: string): Promise<CaptchaResult> {
    for (const solver of this.solvers) {
      try {
        console.log(`Attempting image CAPTCHA solve with ${solver.name}...`);
        const token = await solver.solveImage(base64Image);
        return { success: true, token };
      } catch (error: any) {
        console.error(`${solver.name} failed: ${error.message}`);
      }
    }
    return { success: false, error: 'All CAPTCHA solvers failed' };
  }

  /**
   * Get balance from all providers
   */
  async getBalances(): Promise<{ provider: string; balance: number }[]> {
    const balances: { provider: string; balance: number }[] = [];

    for (const solver of this.solvers) {
      try {
        const balance = await solver.getBalance();
        balances.push({ provider: solver.name, balance });
      } catch (error: any) {
        balances.push({ provider: solver.name, balance: -1 });
      }
    }

    return balances;
  }
}

// Singleton instance
let captchaManagerInstance: CaptchaManager | null = null;

export function getCaptchaManager(): CaptchaManager {
  if (!captchaManagerInstance) {
    captchaManagerInstance = new CaptchaManager();
  }
  return captchaManagerInstance;
}

/**
 * Helper function to detect and solve CAPTCHAs on a page
 */
export async function detectAndSolveCaptcha(page: Page): Promise<boolean> {
  const manager = getCaptchaManager();

  if (!manager.isEnabled()) {
    console.log('CAPTCHA solving not enabled - no API keys configured');
    return false;
  }

  const url = page.url();

  // Check for reCAPTCHA
  const recaptchaSiteKey = await page.evaluate(() => {
    const recaptchaDiv = document.querySelector('.g-recaptcha, [data-sitekey]');
    return recaptchaDiv?.getAttribute('data-sitekey') || null;
  });

  if (recaptchaSiteKey) {
    console.log(`Detected reCAPTCHA with sitekey: ${recaptchaSiteKey}`);
    const result = await manager.solveRecaptchaV2(recaptchaSiteKey, url);

    if (result.success && result.token) {
      // Inject the token
      await page.evaluate((token) => {
        const textarea = document.querySelector('#g-recaptcha-response, [name="g-recaptcha-response"]');
        if (textarea) {
          (textarea as HTMLTextAreaElement).value = token;
        }

        // Trigger callback if present
        const callback = (window as any).___grecaptcha_cfg?.clients?.[0]?.callback;
        if (callback) callback(token);
      }, result.token);

      return true;
    }
  }

  // Check for hCaptcha
  const hcaptchaSiteKey = await page.evaluate(() => {
    const hcaptchaDiv = document.querySelector('.h-captcha, [data-sitekey]');
    if (hcaptchaDiv?.classList.contains('h-captcha')) {
      return hcaptchaDiv.getAttribute('data-sitekey');
    }
    return null;
  });

  if (hcaptchaSiteKey) {
    console.log(`Detected hCaptcha with sitekey: ${hcaptchaSiteKey}`);
    const result = await manager.solveHCaptcha(hcaptchaSiteKey, url);

    if (result.success && result.token) {
      await page.evaluate((token) => {
        const textarea = document.querySelector('[name="h-captcha-response"], [name="g-recaptcha-response"]');
        if (textarea) {
          (textarea as HTMLTextAreaElement).value = token;
        }
      }, result.token);

      return true;
    }
  }

  return false;
}
