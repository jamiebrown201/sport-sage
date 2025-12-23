/**
 * Session Management with Preemptive Rotation
 *
 * Features:
 * - Track request count per session
 * - Detect fingerprint suspicion (challenges, CAPTCHAs)
 * - Preemptive rotation before detection
 * - Cloudflare challenge handling
 */

import type { Page } from 'playwright';
import { logger } from '../logger.js';

interface SessionMetadata {
  id: string;
  createdAt: number;
  requestCount: number;
  successCount: number;
  failureCount: number;
  lastChallengeAt: number | null;
  challengeCount: number;
}

const PREEMPTIVE_ROTATION_THRESHOLD = 100; // Rotate after 100 requests
const CHALLENGE_ROTATION_THRESHOLD = 2; // Rotate after 2 challenges

class SessionManager {
  private sessions: Map<string, SessionMetadata> = new Map();

  createSession(): string {
    const id = crypto.randomUUID();
    this.sessions.set(id, {
      id,
      createdAt: Date.now(),
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      lastChallengeAt: null,
      challengeCount: 0,
    });
    return id;
  }

  getSession(id: string): SessionMetadata | undefined {
    return this.sessions.get(id);
  }

  recordRequest(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.requestCount++;
    }
  }

  recordSuccess(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.successCount++;
    }
  }

  recordFailure(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.failureCount++;
    }
  }

  recordChallenge(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.challengeCount++;
      session.lastChallengeAt = Date.now();
      logger.warn('Challenge detected for session', {
        sessionId,
        challengeCount: session.challengeCount,
      });
    }
  }

  /**
   * Check if session should be rotated (preemptive or reactive)
   */
  shouldRotate(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return true;

    // Preemptive rotation after threshold requests
    if (session.requestCount >= PREEMPTIVE_ROTATION_THRESHOLD) {
      logger.info('Preemptive session rotation', {
        sessionId,
        requestCount: session.requestCount,
      });
      return true;
    }

    // Rotate after too many challenges
    if (session.challengeCount >= CHALLENGE_ROTATION_THRESHOLD) {
      logger.info('Session rotation due to challenges', {
        sessionId,
        challengeCount: session.challengeCount,
      });
      return true;
    }

    return false;
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  cleanupOldSessions(maxAgeMs: number = 60 * 60 * 1000): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > maxAgeMs) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old sessions', { cleaned });
    }
  }

  getStats(): {
    totalSessions: number;
    totalRequests: number;
    totalChallenges: number;
  } {
    let totalRequests = 0;
    let totalChallenges = 0;

    for (const session of this.sessions.values()) {
      totalRequests += session.requestCount;
      totalChallenges += session.challengeCount;
    }

    return {
      totalSessions: this.sessions.size,
      totalRequests,
      totalChallenges,
    };
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}

/**
 * Detect if page is showing a fingerprint challenge
 */
export async function detectFingerprintSuspicion(page: Page): Promise<{
  isChallenged: boolean;
  challengeType?: string;
}> {
  const url = page.url();

  // Check URL for challenge indicators
  if (url.includes('challenge') || url.includes('captcha')) {
    return { isChallenged: true, challengeType: 'url_challenge' };
  }

  // Check page content for common challenge patterns
  try {
    const content = await page.content();
    const lowerContent = content.toLowerCase();

    const challengePatterns = [
      { pattern: 'cf-challenge', type: 'cloudflare_challenge' },
      { pattern: 'captcha', type: 'captcha' },
      { pattern: 'recaptcha', type: 'recaptcha' },
      { pattern: 'hcaptcha', type: 'hcaptcha' },
      { pattern: 'please verify', type: 'verification' },
      { pattern: 'unusual traffic', type: 'traffic_detection' },
      { pattern: 'are you human', type: 'human_check' },
      { pattern: 'bot detection', type: 'bot_detection' },
      { pattern: 'access denied', type: 'access_denied' },
      { pattern: '403 forbidden', type: 'forbidden' },
    ];

    for (const { pattern, type } of challengePatterns) {
      if (lowerContent.includes(pattern)) {
        return { isChallenged: true, challengeType: type };
      }
    }
  } catch {
    // Page might be closed or in navigation
  }

  return { isChallenged: false };
}

/**
 * Handle Cloudflare challenge (wait for JS challenge to auto-solve)
 */
export async function handleCloudflareChallenge(page: Page): Promise<boolean> {
  try {
    // Wait for navigation (JS challenge solving)
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 });

    // Check for cf_clearance cookie (success indicator)
    const cookies = await page.context().cookies();
    const hasClearance = cookies.some((c) => c.name === 'cf_clearance');

    if (hasClearance) {
      logger.info('Cloudflare challenge passed');
      return true;
    }

    return false;
  } catch (error) {
    logger.warn('Cloudflare challenge handling failed', { error });
    return false;
  }
}

/**
 * Check if page shows Cloudflare block
 */
export async function detectCloudflareBlock(page: Page): Promise<boolean> {
  try {
    const content = await page.content();
    return (
      content.includes('1020') || // Cloudflare error code
      content.includes('cf_challenge') ||
      content.includes('cloudflare') ||
      content.includes('Checking your browser')
    );
  } catch {
    return false;
  }
}
