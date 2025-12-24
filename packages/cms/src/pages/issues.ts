/**
 * Issues Page - Centralized issue detection and tracking
 *
 * Issue Types:
 * - stuck_events: Events that should be live but are still scheduled
 * - stale_live_events: Live events not updated recently
 * - unsettled_predictions: Predictions for finished events that aren't settled
 * - unmatched_teams: Teams with no aliases causing matching issues
 * - scraper_failures: Recent scraper failures needing attention
 * - missing_odds: Events without odds data
 * - data_quality: Events with suspicious data
 */

import { getDb, events, predictions, teams, teamAliases, scraperRuns, scraperAlerts, markets } from '@sport-sage/database';
import { desc, eq, sql, count, gte, and, lt, isNull } from 'drizzle-orm';
import { layout, timeAgo, tooltip } from '../ui/layout.js';

export interface Issue {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  count: number;
  actionUrl: string;
  actionLabel: string;
  detectedAt: Date;
}

export async function detectIssues(): Promise<Issue[]> {
  const db = getDb();
  const issues: Issue[] = [];
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Stuck Events - scheduled but past start time
  const [stuckEvents] = await db
    .select({ count: count() })
    .from(events)
    .where(and(
      sql`${events.status}::text = 'scheduled'`,
      lt(events.startTime, now)
    ));

  if (stuckEvents?.count > 0) {
    issues.push({
      id: 'stuck_events',
      type: 'critical',
      category: 'Events',
      title: 'Stuck Events',
      description: `${stuckEvents.count} events are scheduled but past their start time`,
      count: stuckEvents.count,
      actionUrl: '/lifecycle',
      actionLabel: 'View Lifecycle',
      detectedAt: now,
    });
  }

  // 2. Stale Live Events - live but not updated in 15+ minutes
  const [staleLiveEvents] = await db
    .select({ count: count() })
    .from(events)
    .where(and(
      sql`${events.status}::text = 'live'`,
      lt(events.updatedAt, fifteenMinutesAgo)
    ));

  if (staleLiveEvents?.count > 0) {
    issues.push({
      id: 'stale_live_events',
      type: 'warning',
      category: 'Events',
      title: 'Stale Live Events',
      description: `${staleLiveEvents.count} live events haven't been updated in 15+ minutes`,
      count: staleLiveEvents.count,
      actionUrl: '/live-scores',
      actionLabel: 'View Live Scores',
      detectedAt: now,
    });
  }

  // 3. Unsettled Predictions - predictions on finished events still pending
  const unsettledPredictions = await db
    .select({ count: count() })
    .from(predictions)
    .innerJoin(events, eq(predictions.eventId, events.id))
    .where(and(
      sql`${predictions.status}::text = 'pending'`,
      sql`${events.status}::text = 'finished'`
    ));

  if (unsettledPredictions[0]?.count > 0) {
    issues.push({
      id: 'unsettled_predictions',
      type: 'critical',
      category: 'Predictions',
      title: 'Unsettled Predictions',
      description: `${unsettledPredictions[0].count} predictions need settlement (events finished)`,
      count: unsettledPredictions[0].count,
      actionUrl: '/predictions?status=pending',
      actionLabel: 'Settle Predictions',
      detectedAt: now,
    });
  }

  // 4. Events Without Markets - upcoming events with no betting markets
  const [eventsWithoutMarkets] = await db
    .select({ count: count() })
    .from(events)
    .leftJoin(markets, eq(events.id, markets.eventId))
    .where(and(
      sql`${events.status}::text = 'scheduled'`,
      gte(events.startTime, now),
      lt(events.startTime, new Date(now.getTime() + 24 * 60 * 60 * 1000)),
      isNull(markets.id)
    ));

  if (eventsWithoutMarkets?.count > 5) {
    issues.push({
      id: 'events_without_markets',
      type: 'warning',
      category: 'Data Quality',
      title: 'Events Without Odds',
      description: `${eventsWithoutMarkets.count} events starting within 24h have no markets`,
      count: eventsWithoutMarkets.count,
      actionUrl: '/events?status=scheduled',
      actionLabel: 'View Events',
      detectedAt: now,
    });
  }

  // 5. Recent Scraper Failures
  const [recentFailures] = await db
    .select({ count: count() })
    .from(scraperRuns)
    .where(and(
      sql`${scraperRuns.status}::text = 'failed'`,
      gte(scraperRuns.startedAt, oneHourAgo)
    ));

  if (recentFailures?.count >= 3) {
    issues.push({
      id: 'scraper_failures',
      type: 'warning',
      category: 'Scrapers',
      title: 'Scraper Failures',
      description: `${recentFailures.count} scraper runs failed in the last hour`,
      count: recentFailures.count,
      actionUrl: '/logs?status=failed&hours=1',
      actionLabel: 'View Logs',
      detectedAt: now,
    });
  }

  // 6. Unacknowledged Alerts
  const [pendingAlerts] = await db
    .select({ count: count() })
    .from(scraperAlerts)
    .where(isNull(scraperAlerts.acknowledgedAt));

  if (pendingAlerts?.count > 0) {
    issues.push({
      id: 'pending_alerts',
      type: pendingAlerts.count >= 5 ? 'critical' : 'warning',
      category: 'Monitoring',
      title: 'Pending Alerts',
      description: `${pendingAlerts.count} alerts need acknowledgement`,
      count: pendingAlerts.count,
      actionUrl: '/monitoring',
      actionLabel: 'View Alerts',
      detectedAt: now,
    });
  }

  // 7. Teams Without Aliases (potential matching issues)
  const teamsWithoutAliases = await db
    .select({ count: count() })
    .from(teams)
    .leftJoin(teamAliases, eq(teams.id, teamAliases.teamId))
    .where(isNull(teamAliases.id));

  if (teamsWithoutAliases[0]?.count > 50) {
    issues.push({
      id: 'teams_without_aliases',
      type: 'info',
      category: 'Data Quality',
      title: 'Teams Without Aliases',
      description: `${teamsWithoutAliases[0].count} teams have no source aliases configured`,
      count: teamsWithoutAliases[0].count,
      actionUrl: '/source-mapping',
      actionLabel: 'Configure Mapping',
      detectedAt: now,
    });
  }

  // 8. No Recent Scraper Activity
  const [recentActivity] = await db
    .select({ count: count() })
    .from(scraperRuns)
    .where(gte(scraperRuns.startedAt, fifteenMinutesAgo));

  if (recentActivity?.count === 0) {
    issues.push({
      id: 'no_scraper_activity',
      type: 'critical',
      category: 'Scrapers',
      title: 'No Scraper Activity',
      description: 'No scraper runs in the last 15 minutes',
      count: 0,
      actionUrl: '/scraper',
      actionLabel: 'Check Scraper',
      detectedAt: now,
    });
  }

  // Sort by severity: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);

  return issues;
}

export async function handleIssues(environment: string): Promise<string> {
  const issues = await detectIssues();

  const criticalCount = issues.filter(i => i.type === 'critical').length;
  const warningCount = issues.filter(i => i.type === 'warning').length;
  const infoCount = issues.filter(i => i.type === 'info').length;

  const issueRows = issues.map(issue => {
    const typeColor = issue.type === 'critical' ? 'error' : issue.type === 'warning' ? 'warning' : 'info';
    return `
      <tr>
        <td>
          <span class="badge badge-${typeColor}" style="text-transform: uppercase; font-size: 0.75em;">
            ${issue.type}
          </span>
        </td>
        <td><span class="badge badge-info">${issue.category}</span></td>
        <td>
          <strong>${issue.title}</strong>
          <div style="font-size: 0.85em; color: var(--text-muted);">${issue.description}</div>
        </td>
        <td style="text-align: center;">
          ${issue.count > 0 ? `<span style="font-size: 1.5em; font-weight: bold; color: var(--${typeColor});">${issue.count}</span>` : '-'}
        </td>
        <td>
          <a href="${issue.actionUrl}" class="btn btn-sm">${issue.actionLabel}</a>
        </td>
      </tr>
    `;
  }).join('');

  const overallStatus = criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'healthy';
  const statusColor = overallStatus === 'critical' ? 'error' : overallStatus === 'warning' ? 'warning' : 'success';
  const statusIcon = overallStatus === 'critical' ? '!' : overallStatus === 'warning' ? '!' : '✓';

  const content = `
    <h1>Issues ${tooltip('<strong>Issue Detection</strong>Automated health checks that run every page load.<br><br><strong>Severity Levels:</strong><ul><li><strong style="color: var(--error);">Critical</strong>: Immediate action needed (stuck events, no activity)</li><li><strong style="color: var(--warning);">Warning</strong>: Should be addressed soon (stale data, failures)</li><li><strong style="color: var(--info);">Info</strong>: Low priority improvements (data quality)</li></ul><br>Page auto-refreshes every 60 seconds.', 'right')}</h1>

    <!-- Overall Status -->
    <div class="card" style="border-color: var(--${statusColor}); margin-bottom: 30px;">
      <div style="display: flex; align-items: center; gap: 20px;">
        <div style="font-size: 3em; color: var(--${statusColor}); width: 60px; text-align: center;">
          ${statusIcon}
        </div>
        <div style="flex: 1;">
          <h2 style="margin: 0; color: var(--${statusColor});">
            ${overallStatus === 'critical' ? 'Critical Issues Detected' :
              overallStatus === 'warning' ? 'Warnings Need Attention' :
              'All Systems Healthy'}
          </h2>
          <p style="margin: 5px 0 0; color: var(--text-muted);">
            ${issues.length === 0 ? 'No issues detected' : `${issues.length} issue${issues.length === 1 ? '' : 's'} found`}
          </p>
        </div>
        <div style="display: flex; gap: 15px;">
          <div style="text-align: center;">
            <div style="font-size: 1.5em; font-weight: bold; color: var(--error);">${criticalCount}</div>
            <div style="font-size: 0.8em; color: var(--text-muted);">Critical</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 1.5em; font-weight: bold; color: var(--warning);">${warningCount}</div>
            <div style="font-size: 0.8em; color: var(--text-muted);">Warnings</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 1.5em; font-weight: bold; color: var(--info);">${infoCount}</div>
            <div style="font-size: 0.8em; color: var(--text-muted);">Info</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Issues Table -->
    <div class="card">
      <table>
        <thead>
          <tr>
            <th style="width: 100px;">Severity ${tooltip('<strong>Severity</strong><ul><li><strong>Critical</strong>: User-impacting or system-breaking</li><li><strong>Warning</strong>: Degraded but functional</li><li><strong>Info</strong>: Suggestions for improvement</li></ul>', 'bottom')}</th>
            <th style="width: 120px;">Category ${tooltip('<strong>Categories</strong><ul><li><strong>Events</strong>: Match status issues</li><li><strong>Predictions</strong>: Bet settlement issues</li><li><strong>Scrapers</strong>: Data collection issues</li><li><strong>Data Quality</strong>: Missing or incomplete data</li><li><strong>Monitoring</strong>: Alert acknowledgements</li></ul>', 'bottom')}</th>
            <th>Issue</th>
            <th style="width: 80px; text-align: center;">Count</th>
            <th style="width: 150px;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${issueRows || '<tr><td colspan="5" class="empty" style="color: var(--success);">No issues detected - all systems healthy!</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Quick Actions -->
    <div class="card" style="margin-top: 20px;">
      <h2 style="margin-top: 0;">Quick Actions</h2>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <a href="/lambdas/trigger/transition-events" class="btn btn-secondary">Trigger Event Transitions</a>
        <a href="/lambdas/trigger/settlement" class="btn btn-secondary">Trigger Settlement</a>
        <a href="/lambdas/trigger/sync-live-scores" class="btn btn-secondary">Sync Live Scores</a>
        <a href="/bulk-settle" class="btn btn-secondary">Bulk Settle Predictions</a>
        <a href="/health" class="btn btn-secondary">System Health Check</a>
      </div>
    </div>

    <div style="text-align: center; margin-top: 30px; color: var(--text-muted); font-size: 0.85em;">
      Last checked: ${new Date().toLocaleString()} | Auto-refreshes every 60 seconds
    </div>
    <script>setTimeout(() => location.reload(), 60000);</script>
  `;

  return layout('Issues', content, environment);
}

// Compact issues widget for dashboard
export async function getIssuesWidget(): Promise<string> {
  const issues = await detectIssues();

  const criticalCount = issues.filter(i => i.type === 'critical').length;
  const warningCount = issues.filter(i => i.type === 'warning').length;

  if (issues.length === 0) {
    return `
      <div class="card" style="border-color: var(--success);">
        <div style="display: flex; align-items: center; gap: 15px;">
          <div style="font-size: 2em; color: var(--success);">✓</div>
          <div>
            <strong style="color: var(--success);">All Systems Healthy</strong>
            <div style="font-size: 0.85em; color: var(--text-muted);">No issues detected</div>
          </div>
          <a href="/issues" class="btn btn-sm btn-secondary" style="margin-left: auto;">View Details</a>
        </div>
      </div>
    `;
  }

  const topIssues = issues.slice(0, 3);
  const issueList = topIssues.map(issue => {
    const color = issue.type === 'critical' ? 'error' : issue.type === 'warning' ? 'warning' : 'info';
    return `
      <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border);">
        <span class="badge badge-${color}" style="text-transform: uppercase; font-size: 0.7em;">${issue.type}</span>
        <span style="flex: 1;">${issue.title}</span>
        <span style="color: var(--${color}); font-weight: bold;">${issue.count}</span>
        <a href="${issue.actionUrl}" class="btn btn-sm btn-secondary">Fix</a>
      </div>
    `;
  }).join('');

  const borderColor = criticalCount > 0 ? 'error' : 'warning';

  return `
    <div class="card" style="border-color: var(--${borderColor});">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0; color: var(--${borderColor});">
          ${criticalCount > 0 ? `${criticalCount} Critical Issue${criticalCount === 1 ? '' : 's'}` : `${warningCount} Warning${warningCount === 1 ? '' : 's'}`}
        </h2>
        <a href="/issues" class="btn btn-sm">View All (${issues.length})</a>
      </div>
      ${issueList}
      ${issues.length > 3 ? `<div style="text-align: center; padding-top: 10px; color: var(--text-muted); font-size: 0.85em;">+${issues.length - 3} more issues</div>` : ''}
    </div>
  `;
}
