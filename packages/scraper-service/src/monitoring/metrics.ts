/**
 * Metrics Collector for Monitoring
 *
 * Tracks:
 * - Success/failure rates
 * - Block detection
 * - Response times
 * - Job execution stats
 */

import { logger } from '../logger.js';

interface RequestMetrics {
  source: string;
  success: boolean;
  responseTimeMs: number;
  timestamp: number;
  blocked?: boolean;
  statusCode?: number;
}

interface JobMetrics {
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  success?: boolean;
  error?: string;
}

class MetricsCollector {
  private requests: RequestMetrics[] = [];
  private jobs: Map<string, JobMetrics> = new Map();
  private lastBlock: Date | null = null;

  // Keep only last 1000 requests for memory efficiency
  private readonly MAX_REQUESTS = 1000;

  recordRequest(
    source: string,
    success: boolean,
    responseTimeMs: number,
    options?: { blocked?: boolean; statusCode?: number }
  ): void {
    this.requests.push({
      source,
      success,
      responseTimeMs,
      timestamp: Date.now(),
      blocked: options?.blocked,
      statusCode: options?.statusCode,
    });

    // Track last block
    if (options?.blocked) {
      this.lastBlock = new Date();
    }

    // Trim old requests
    if (this.requests.length > this.MAX_REQUESTS) {
      this.requests = this.requests.slice(-this.MAX_REQUESTS);
    }
  }

  recordJobStart(jobName: string): void {
    this.jobs.set(jobName, {
      name: jobName,
      startTime: Date.now(),
    });
  }

  recordJobComplete(jobName: string, durationMs: number, success: boolean): void {
    const job = this.jobs.get(jobName);
    if (job) {
      job.endTime = Date.now();
      job.durationMs = durationMs;
      job.success = success;
    }
  }

  recordJobFailed(jobName: string, error: Error): void {
    const job = this.jobs.get(jobName);
    if (job) {
      job.endTime = Date.now();
      job.durationMs = Date.now() - job.startTime;
      job.success = false;
      job.error = error.message;
    }
  }

  getSuccessRate(windowMs?: number): number {
    const window = windowMs || 60 * 60 * 1000; // Default 1 hour
    const cutoff = Date.now() - window;
    const recent = this.requests.filter((r) => r.timestamp > cutoff);

    if (recent.length === 0) return 1;

    const successes = recent.filter((r) => r.success).length;
    return successes / recent.length;
  }

  getBlockedRate(windowMs?: number): number {
    const window = windowMs || 60 * 60 * 1000; // Default 1 hour
    const cutoff = Date.now() - window;
    const recent = this.requests.filter((r) => r.timestamp > cutoff);

    if (recent.length === 0) return 0;

    const blocked = recent.filter((r) => r.blocked).length;
    return blocked / recent.length;
  }

  getAverageResponseTime(windowMs?: number): number {
    const window = windowMs || 60 * 60 * 1000; // Default 1 hour
    const cutoff = Date.now() - window;
    const recent = this.requests.filter((r) => r.timestamp > cutoff && r.success);

    if (recent.length === 0) return 0;

    const total = recent.reduce((sum, r) => sum + r.responseTimeMs, 0);
    return Math.round(total / recent.length);
  }

  getSourceStats(source: string, windowMs?: number): {
    successRate: number;
    blockedRate: number;
    avgResponseTime: number;
    requestCount: number;
  } {
    const window = windowMs || 60 * 60 * 1000;
    const cutoff = Date.now() - window;
    const recent = this.requests.filter(
      (r) => r.source === source && r.timestamp > cutoff
    );

    if (recent.length === 0) {
      return {
        successRate: 1,
        blockedRate: 0,
        avgResponseTime: 0,
        requestCount: 0,
      };
    }

    const successes = recent.filter((r) => r.success).length;
    const blocked = recent.filter((r) => r.blocked).length;
    const responseTimes = recent
      .filter((r) => r.success)
      .map((r) => r.responseTimeMs);

    return {
      successRate: successes / recent.length,
      blockedRate: blocked / recent.length,
      avgResponseTime:
        responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : 0,
      requestCount: recent.length,
    };
  }

  health(): {
    successRate: string;
    blockedRate: string;
    avgResponseTime: string;
    lastBlock: string | null;
  } {
    return {
      successRate: `${(this.getSuccessRate() * 100).toFixed(1)}%`,
      blockedRate: `${(this.getBlockedRate() * 100).toFixed(1)}%`,
      avgResponseTime: `${this.getAverageResponseTime()}ms`,
      lastBlock: this.lastBlock?.toISOString() || null,
    };
  }

  // Alert if block rate exceeds threshold
  checkAlerts(): { alertType: string; message: string }[] {
    const alerts: { alertType: string; message: string }[] = [];

    const blockedRate = this.getBlockedRate();
    if (blockedRate > 0.2) {
      // More than 20% blocked
      alerts.push({
        alertType: 'high_block_rate',
        message: `High block rate detected: ${(blockedRate * 100).toFixed(1)}%`,
      });
      logger.error('High block rate detected', { blockedRate });
    }

    const successRate = this.getSuccessRate();
    if (successRate < 0.8) {
      // Less than 80% success
      alerts.push({
        alertType: 'low_success_rate',
        message: `Low success rate: ${(successRate * 100).toFixed(1)}%`,
      });
      logger.warn('Low success rate detected', { successRate });
    }

    return alerts;
  }

  getMetrics(): {
    successRate: string;
    blockedRate: string;
    avgResponseTime: string;
    lastBlock: string | null;
    requestCount: number;
    sourceStats: Record<string, any>;
    alerts: { alertType: string; message: string }[];
  } {
    // Get unique sources
    const sources = [...new Set(this.requests.map((r) => r.source))];
    const sourceStats: Record<string, any> = {};

    for (const source of sources) {
      sourceStats[source] = this.getSourceStats(source);
    }

    return {
      ...this.health(),
      requestCount: this.requests.length,
      sourceStats,
      alerts: this.checkAlerts(),
    };
  }

  reset(): void {
    this.requests = [];
    this.jobs.clear();
    this.lastBlock = null;
    logger.info('Metrics collector reset');
  }
}

// Singleton instance
let metricsInstance: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsInstance) {
    metricsInstance = new MetricsCollector();
  }
  return metricsInstance;
}

// Convenience exports
export function recordRequest(
  source: string,
  success: boolean,
  responseTimeMs: number,
  options?: { blocked?: boolean; statusCode?: number }
): void {
  getMetricsCollector().recordRequest(source, success, responseTimeMs, options);
}

export function recordJobStart(jobName: string): void {
  getMetricsCollector().recordJobStart(jobName);
}

export function recordJobComplete(jobName: string, durationMs: number, success: boolean): void {
  getMetricsCollector().recordJobComplete(jobName, durationMs, success);
}

export function recordJobFailed(jobName: string, error: Error): void {
  getMetricsCollector().recordJobFailed(jobName, error);
}

export function getMetrics() {
  return getMetricsCollector().getMetrics();
}
