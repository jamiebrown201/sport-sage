/**
 * Scraper Page - Live status from Hetzner scraper service
 */

import { layout, timeAgo, formatDuration, tooltip } from '../ui/layout.js';

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL || 'http://77.42.42.185:3001';

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  database: { connected: boolean; latencyMs: number };
  browserPool: { activeContexts: number; idleContexts: number; maxContexts: number; oldestContext: number };
  jobs: Record<string, any>;
  metrics: { successRate: string; blockedRate: string; avgResponseTime: string; lastBlock: string | null };
}

interface JobStatus {
  name: string;
  lastRun: string | null;
  lastDuration: number | null;
  lastStatus: 'success' | 'failed' | 'running' | 'never';
  nextRun: string | null;
  runCount: number;
  failCount: number;
  nextScheduledRun?: string;
}

interface SourceStatus {
  enabled: boolean;
  priority: number;
  onCooldown: boolean;
  cooldownRemaining?: number;
  usage: {
    lastUsed: string | null;
    successCount: number;
    failureCount: number;
    consecutiveFailures: number;
    lastError?: string;
  };
  sportStats: Record<string, {
    successCount: number;
    failureCount: number;
    consecutiveFailures: number;
    lastSuccess: string | null;
    lastFailure: string | null;
  }>;
  avoidedSports: string[];
}

async function fetchJson<T>(endpoint: string): Promise<T | null> {
  try {
    const res = await fetch(`${SCRAPER_URL}${endpoint}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export async function handleScraper(environment: string, flash?: string): Promise<string> {
  const [health, jobs, sources] = await Promise.all([
    fetchJson<HealthResponse>('/health'),
    fetchJson<Record<string, JobStatus>>('/jobs'),
    fetchJson<Record<string, SourceStatus>>('/odds-sources'),
  ]);

  const isOnline = health?.status === 'ok';
  const uptime = health?.uptime ? formatDuration(health.uptime * 1000) : '-';

  // Health banner
  const healthBanner = `
    <div class="card" style="background: ${isOnline ? '#0d4d3a' : '#4d0d0d'}; border-color: ${isOnline ? 'var(--success)' : 'var(--error)'};">
      <div style="display: flex; align-items: center; gap: 15px;">
        <div style="width: 20px; height: 20px; border-radius: 50%; background: ${isOnline ? 'var(--success)' : 'var(--error)'}; ${!isOnline ? 'animation: pulse 2s infinite;' : ''}"></div>
        <div>
          <div style="font-size: 1.3em; font-weight: bold; color: ${isOnline ? 'var(--success)' : 'var(--error)'};">
            ${isOnline ? 'Scraper Online' : 'Scraper Offline'}
          </div>
          <div style="color: var(--text-muted); font-size: 0.9em;">
            ${isOnline ? `Uptime: ${uptime} | DB: ${health?.database.connected ? 'Connected' : 'Disconnected'} (${health?.database.latencyMs}ms)` : `Cannot connect to ${SCRAPER_URL}`}
          </div>
        </div>
      </div>
    </div>
  `;

  // Stats grid
  const statsHtml = isOnline && health ? `
    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value">${health.browserPool.activeContexts + health.browserPool.idleContexts}/${health.browserPool.maxContexts}</div>
        <div class="stat-label">Browsers ${tooltip('<strong>Browser Pool</strong>Playwright browser contexts used for scraping. Active = currently scraping, Idle = available. Max 5 concurrent.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: var(--success);">${health.metrics.successRate}</div>
        <div class="stat-label">Success Rate ${tooltip('<strong>Success Rate</strong>Percentage of scrape attempts that completed without errors. Target: >90%', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color: ${parseFloat(health.metrics.blockedRate) > 10 ? 'var(--error)' : 'var(--text-muted)'};">${health.metrics.blockedRate}</div>
        <div class="stat-label">Blocked ${tooltip('<strong>Block Rate</strong>Percentage of requests blocked by anti-bot measures. High rates trigger source cooldowns.', 'bottom')}</div>
      </div>
      <div class="stat">
        <div class="stat-value">${health.metrics.avgResponseTime}</div>
        <div class="stat-label">Avg Response ${tooltip('<strong>Average Response Time</strong>Mean time for scrape requests to complete. Higher times may indicate rate limiting.', 'bottom')}</div>
      </div>
    </div>
  ` : '';

  // Jobs table
  const jobsHtml = jobs ? Object.entries(jobs).map(([name, job]) => {
    const statusColor = job.lastStatus === 'success' ? 'success' : job.lastStatus === 'failed' ? 'error' : job.lastStatus === 'running' ? 'warning' : 'info';
    const lastRun = job.lastRun ? timeAgo(new Date(job.lastRun)) : 'Never';
    const nextRun = job.nextScheduledRun ? new Date(job.nextScheduledRun).toLocaleString() : '-';
    return `
      <tr>
        <td style="font-family: monospace;">${name}</td>
        <td><span class="badge badge-${statusColor}">${job.lastStatus}</span></td>
        <td>${job.runCount}</td>
        <td>${job.failCount}</td>
        <td>${job.lastDuration ? formatDuration(job.lastDuration) : '-'}</td>
        <td class="time-ago">${lastRun}</td>
        <td style="font-size: 0.85em; color: var(--text-muted);">${nextRun}</td>
        <td>
          <a href="/scraper/trigger/${name}" class="btn btn-sm btn-secondary">Trigger</a>
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="8" class="empty">Cannot fetch job status</td></tr>';

  // Sources cards
  const sourcesHtml = sources ? Object.entries(sources).map(([name, src]) => {
    const total = src.usage.successCount + src.usage.failureCount;
    const rate = total > 0 ? Math.round((src.usage.successCount / total) * 100) : 0;
    const status = !src.enabled ? 'disabled' : src.onCooldown ? 'cooldown' : src.usage.consecutiveFailures >= 3 ? 'failing' : rate >= 70 ? 'healthy' : 'degraded';
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      healthy: { bg: '#0d4d3a', border: 'var(--success)', text: 'var(--success)' },
      degraded: { bg: '#4d3d0d', border: 'var(--warning)', text: 'var(--warning)' },
      failing: { bg: '#4d0d0d', border: 'var(--error)', text: 'var(--error)' },
      cooldown: { bg: '#2d2d4d', border: 'var(--info)', text: 'var(--info)' },
      disabled: { bg: 'var(--bg-hover)', border: 'var(--border)', text: 'var(--text-muted)' },
    };
    const c = colors[status];
    const cooldownMin = src.cooldownRemaining ? Math.ceil(src.cooldownRemaining / 60000) : 0;
    const lastUsed = src.usage.lastUsed ? timeAgo(new Date(src.usage.lastUsed)) : 'Never';

    // Sport-specific stats
    const sportBadges = src.avoidedSports.length > 0
      ? src.avoidedSports.map(s => `<span class="badge badge-error" style="font-size: 0.7em; margin-right: 4px;">${s}</span>`).join('')
      : '';

    return `
      <div class="card" style="background: ${c.bg}; border-color: ${c.border}40; padding: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="font-weight: 600; color: ${c.text};">${name}</div>
          <span class="badge" style="background: ${c.border}30; color: ${c.text};">${status.toUpperCase()}</span>
        </div>
        <div style="font-size: 2em; font-weight: bold; color: ${c.text}; margin-bottom: 5px;">${rate}%</div>
        <div style="font-size: 0.85em; color: var(--text-muted);">
          ${src.usage.successCount}/${total} success | Priority ${src.priority}
        </div>
        <div style="font-size: 0.8em; color: #666; margin-top: 8px;">
          Last used: ${lastUsed}
          ${src.onCooldown ? `<br>Cooldown: ${cooldownMin}m remaining` : ''}
          ${src.usage.consecutiveFailures > 0 ? `<br>Consecutive failures: ${src.usage.consecutiveFailures}` : ''}
        </div>
        ${sportBadges ? `<div style="margin-top: 8px;"><span style="font-size: 0.75em; color: #666;">Avoided for:</span> ${sportBadges}</div>` : ''}
      </div>
    `;
  }).join('') : '<div class="empty">Cannot fetch source status</div>';

  const flashHtml = flash ? `<div class="flash flash-success">${flash}</div>` : '';

  const content = `
    <h1>Scraper Service ${tooltip('<strong>Hetzner Scraper</strong>Node.js service running on a Hetzner VPS (77.42.42.185:3001).<br><br><strong>Architecture:</strong><ul><li>Playwright browser pool for web scraping</li><li>Cron-based job scheduler</li><li>Round-robin source rotation with cooldowns</li><li>Direct PostgreSQL connection to Aurora</li></ul>', 'right')}</h1>
    ${flashHtml}
    ${healthBanner}
    ${statsHtml}

    <h2>Odds Sources (Round-Robin Rotation) ${tooltip('<strong>Source Rotation</strong>Odds are scraped from multiple sources using round-robin with intelligent rotation.<br><br><strong>How it works:</strong><ul><li>Sources rotate by priority within each sport</li><li>Failed sources get temporary cooldowns (8-15 min)</li><li>Sport-specific tracking avoids problematic combinations</li><li>Consecutive failures increase cooldown duration</li></ul><strong>Status meanings:</strong><ul><li>HEALTHY: >70% success rate</li><li>DEGRADED: 30-70% success rate</li><li>FAILING: 3+ consecutive failures</li><li>COOLDOWN: Temporarily resting</li></ul>', 'right')}</h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 30px;">
      ${sourcesHtml}
    </div>

    <div class="card">
      <h2 style="margin-top: 0;">Scheduled Jobs ${tooltip('<strong>Scheduled Jobs</strong>Cron-based jobs that run automatically.<br><br><strong>Jobs:</strong><ul><li><strong>sync-fixtures</strong>: Fetches upcoming matches from Flashscore (every 2h)</li><li><strong>sync-odds</strong>: Scrapes odds from various sources (every 5m)</li><li><strong>sync-live-scores</strong>: Updates live match scores (every 1m)</li><li><strong>transition-events</strong>: Moves events through lifecycle states (every 1m)</li></ul>', 'right')}</h2>
      <table>
        <thead>
          <tr>
            <th>Job</th>
            <th>Status</th>
            <th>Runs</th>
            <th>Fails</th>
            <th>Duration</th>
            <th>Last Run</th>
            <th>Next Run</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>${jobsHtml}</tbody>
      </table>
    </div>

    <div class="card">
      <h2 style="margin-top: 0;">Quick Actions</h2>
      <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <a href="/scraper/trigger/sync-fixtures" class="btn btn-secondary">Sync Fixtures</a>
        <a href="/scraper/trigger/sync-odds" class="btn btn-secondary">Sync Odds</a>
        <a href="/scraper/trigger/sync-live-scores" class="btn btn-secondary">Sync Live Scores</a>
        <a href="/scraper/trigger/transition-events" class="btn btn-secondary">Transition Events</a>
      </div>
    </div>

    <script>setTimeout(() => location.reload(), 30000);</script>
  `;

  return layout('Scraper', content, environment);
}

export async function triggerScraperJob(jobName: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${SCRAPER_URL}/trigger/${jobName}`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      return { success: true, message: `Job "${jobName}" triggered successfully` };
    }
    const text = await res.text();
    return { success: false, message: `Failed to trigger job: ${text}` };
  } catch (err: any) {
    return { success: false, message: `Error: ${err.message}` };
  }
}
