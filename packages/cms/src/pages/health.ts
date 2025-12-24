/**
 * Health Page - System health and infrastructure status
 */

import { getDb, scraperRuns, scraperAlerts, events } from '@sport-sage/database';
import { desc, eq, sql, count, gte, and } from 'drizzle-orm';
import { layout, timeAgo, formatDuration } from '../ui/layout.js';
import { LambdaClient, GetFunctionCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'eu-west-1' });

const HETZNER_API = 'http://77.42.42.185:3001';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  message: string;
  lastChecked?: Date;
  details?: Record<string, any>;
}

async function checkHetznerScraper(): Promise<HealthCheck> {
  try {
    const response = await fetch(`${HETZNER_API}/health`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const data = await response.json() as Record<string, any>;
      return {
        name: 'Hetzner Scraper Service',
        status: data.status === 'ok' ? 'healthy' : 'degraded',
        message: data.status === 'ok' ? 'Service is running' : 'Service degraded',
        lastChecked: new Date(),
        details: data,
      };
    }
    return { name: 'Hetzner Scraper Service', status: 'degraded', message: `HTTP ${response.status}` };
  } catch (error: any) {
    return { name: 'Hetzner Scraper Service', status: 'down', message: error.message || 'Connection failed' };
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  const db = getDb();
  try {
    const start = Date.now();
    await db.select({ count: count() }).from(events).limit(1);
    const duration = Date.now() - start;
    return {
      name: 'Database (Aurora)',
      status: duration < 1000 ? 'healthy' : 'degraded',
      message: `Query time: ${duration}ms`,
      lastChecked: new Date(),
      details: { queryTimeMs: duration },
    };
  } catch (error: any) {
    return { name: 'Database (Aurora)', status: 'down', message: error.message || 'Connection failed' };
  }
}

async function checkLambdas(environment: string): Promise<HealthCheck[]> {
  const lambdaNames = [
    { short: 'sync-fixtures', full: `SportSage-${environment}-sync-fixtures` },
    { short: 'sync-live-scores', full: `SportSage-${environment}-sync-live-scores` },
    { short: 'sync-odds', full: `SportSage-${environment}-sync-odds` },
    { short: 'settlement', full: `SportSage-${environment}-settlement` },
    { short: 'transition-events', full: `SportSage-${environment}-transition-events` },
  ];

  const checks: HealthCheck[] = [];

  for (const lambda of lambdaNames) {
    try {
      const command = new GetFunctionCommand({ FunctionName: lambda.full });
      const response = await lambdaClient.send(command);
      checks.push({
        name: `Lambda: ${lambda.short}`,
        status: response.Configuration?.State === 'Active' ? 'healthy' : 'degraded',
        message: response.Configuration?.State || 'Unknown',
        lastChecked: new Date(),
        details: {
          memory: response.Configuration?.MemorySize,
          runtime: response.Configuration?.Runtime,
          lastModified: response.Configuration?.LastModified,
        },
      });
    } catch (error: any) {
      checks.push({
        name: `Lambda: ${lambda.short}`,
        status: 'unknown',
        message: error.message || 'Could not check',
      });
    }
  }

  return checks;
}

export async function handleHealth(environment: string): Promise<string> {
  const db = getDb();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Run health checks
  const [hetznerCheck, dbCheck] = await Promise.all([
    checkHetznerScraper(),
    checkDatabase(),
  ]);

  // Check scraper activity
  const [recentRuns] = await db.select({ count: count() }).from(scraperRuns)
    .where(gte(scraperRuns.startedAt, oneHourAgo));
  const [failedRuns] = await db.select({ count: count() }).from(scraperRuns)
    .where(and(
      gte(scraperRuns.startedAt, oneHourAgo),
      sql`${scraperRuns.status}::text = 'failed'`
    ));
  const [pendingAlerts] = await db.select({ count: count() }).from(scraperAlerts)
    .where(sql`${scraperAlerts.acknowledgedAt} IS NULL`);

  // Check event flow
  const [liveEvents] = await db.select({ count: count() }).from(events)
    .where(sql`${events.status}::text = 'live'`);
  const [scheduledPastStart] = await db.select({ count: count() }).from(events)
    .where(and(
      sql`${events.status}::text = 'scheduled'`,
      sql`${events.startTime} < NOW()`
    ));

  // Determine overall status
  const allChecks: HealthCheck[] = [hetznerCheck, dbCheck];
  const overallStatus = allChecks.every(c => c.status === 'healthy') ? 'healthy' :
    allChecks.some(c => c.status === 'down') ? 'down' : 'degraded';

  const statusColor = overallStatus === 'healthy' ? 'success' : overallStatus === 'degraded' ? 'warning' : 'error';

  const checkRows = allChecks.map(c => {
    const color = c.status === 'healthy' ? 'success' : c.status === 'degraded' ? 'warning' : 'error';
    return `
      <tr>
        <td>${c.name}</td>
        <td><span class="badge badge-${color}">${c.status.toUpperCase()}</span></td>
        <td>${c.message}</td>
        <td class="time-ago">${c.lastChecked ? 'Just now' : '-'}</td>
      </tr>
    `;
  }).join('');

  const content = `
    <h1>System Health</h1>

    <!-- Overall Status -->
    <div class="card" style="border-color: var(--${statusColor}); margin-bottom: 30px;">
      <div style="display: flex; align-items: center; gap: 20px;">
        <div style="font-size: 3em; color: var(--${statusColor});">
          ${overallStatus === 'healthy' ? '✓' : overallStatus === 'degraded' ? '!' : '✕'}
        </div>
        <div>
          <h2 style="margin: 0; color: var(--${statusColor});">System ${overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1)}</h2>
          <p style="margin: 5px 0 0; color: var(--text-muted);">
            ${overallStatus === 'healthy' ? 'All systems operational' :
              overallStatus === 'degraded' ? 'Some systems experiencing issues' :
              'Critical systems are down'}
          </p>
        </div>
        <div style="margin-left: auto;">
          <a href="/health" class="btn btn-secondary">Refresh</a>
        </div>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value" style="color: ${recentRuns?.count > 0 ? 'var(--success)' : 'var(--error)'};">${recentRuns?.count || 0}</div>
        <div class="stat-label">Scraper Runs (1h)</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: ${failedRuns?.count === 0 ? 'var(--success)' : 'var(--error)'};">${failedRuns?.count || 0}</div>
        <div class="stat-label">Failed Runs (1h)</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: ${pendingAlerts?.count === 0 ? 'var(--success)' : 'var(--warning)'};">${pendingAlerts?.count || 0}</div>
        <div class="stat-label">Pending Alerts</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--warning);">${liveEvents?.count || 0}</div>
        <div class="stat-label">Live Events</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: ${scheduledPastStart?.count === 0 ? 'var(--success)' : 'var(--error)'};">${scheduledPastStart?.count || 0}</div>
        <div class="stat-label">Stuck Events</div>
      </div>
    </div>

    <!-- Health Checks -->
    <div class="card">
      <h2 style="margin-top: 0;">Service Health Checks</h2>
      <table>
        <thead><tr><th>Service</th><th>Status</th><th>Message</th><th>Checked</th></tr></thead>
        <tbody>${checkRows}</tbody>
      </table>
    </div>

    <!-- Hetzner Details -->
    ${hetznerCheck.status !== 'down' && hetznerCheck.details ? `
      <div class="card" style="margin-top: 20px;">
        <h2 style="margin-top: 0;">Hetzner Scraper Details</h2>
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
          <div class="stat">
            <div class="stat-value">${hetznerCheck.details.activeContexts || 0}</div>
            <div class="stat-label">Active Contexts</div>
          </div>
          <div class="stat">
            <div class="stat-value">${hetznerCheck.details.idleContexts || 0}</div>
            <div class="stat-label">Idle Contexts</div>
          </div>
          <div class="stat">
            <div class="stat-value">${hetznerCheck.details.successRate ? Math.round(hetznerCheck.details.successRate * 100) : 0}%</div>
            <div class="stat-label">Success Rate</div>
          </div>
          <div class="stat">
            <div class="stat-value">${hetznerCheck.details.blockedRate ? Math.round(hetznerCheck.details.blockedRate * 100) : 0}%</div>
            <div class="stat-label">Blocked Rate</div>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Database Details -->
    ${dbCheck.status !== 'down' && dbCheck.details ? `
      <div class="card" style="margin-top: 20px;">
        <h2 style="margin-top: 0;">Database Details</h2>
        <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr);">
          <div class="stat">
            <div class="stat-value" style="color: ${dbCheck.details.queryTimeMs < 500 ? 'var(--success)' : 'var(--warning)'};">${dbCheck.details.queryTimeMs}ms</div>
            <div class="stat-label">Query Time</div>
          </div>
          <div class="stat">
            <div class="stat-value" style="color: var(--success);">✓</div>
            <div class="stat-label">Connected</div>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Issues -->
    ${scheduledPastStart?.count > 0 ? `
      <div class="card" style="margin-top: 20px; border-color: var(--warning);">
        <h2 style="margin-top: 0; color: var(--warning);">Data Quality Issues</h2>
        <p style="margin-bottom: 15px;">There are ${scheduledPastStart.count} events that are still marked as "scheduled" but their start time has passed.</p>
        <a href="/lifecycle" class="btn">View Event Lifecycle</a>
        <a href="/lambdas/trigger/transition-events" class="btn btn-secondary">Trigger Transition Job</a>
      </div>
    ` : ''}

    ${pendingAlerts?.count > 0 ? `
      <div class="card" style="margin-top: 20px; border-color: var(--warning);">
        <h2 style="margin-top: 0; color: var(--warning);">Pending Alerts</h2>
        <p>There are ${pendingAlerts.count} unacknowledged alerts that need attention.</p>
        <a href="/monitoring" class="btn">View Alerts</a>
      </div>
    ` : ''}

    <!-- Quick Actions -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Quick Actions</h2>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <a href="/logs" class="btn btn-secondary">View Logs</a>
        <a href="/monitoring" class="btn btn-secondary">View Monitoring</a>
        <a href="/lambdas" class="btn btn-secondary">Manage Lambdas</a>
        <a href="/scraper" class="btn btn-secondary">Scraper Status</a>
      </div>
    </div>

    <div style="text-align: center; margin-top: 30px; color: var(--text-muted); font-size: 0.85em;">
      Last refreshed: ${new Date().toLocaleString()} | Auto-refreshes every 60 seconds
    </div>
    <script>setTimeout(() => location.reload(), 60000);</script>
  `;

  return layout('System Health', content, environment);
}
