#!/usr/bin/env node
/**
 * CLI Dashboard for Scraper Monitoring
 * Run: pnpm dashboard
 */

import { getDb, scraperRuns, scraperAlerts, events, sports } from '@sport-sage/database';
import { desc, gte, eq, sql, count } from 'drizzle-orm';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

function color(text: string, ...colors: string[]): string {
  return colors.join('') + text + COLORS.reset;
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function statusBadge(status: string): string {
  switch (status) {
    case 'success':
      return color(' ✓ SUCCESS ', COLORS.bgGreen, COLORS.white);
    case 'failed':
      return color(' ✗ FAILED ', COLORS.bgRed, COLORS.white);
    case 'partial':
      return color(' ⚠ PARTIAL ', COLORS.bgYellow, COLORS.white);
    case 'running':
      return color(' ◎ RUNNING ', COLORS.blue);
    default:
      return status;
  }
}

async function main() {
  console.log('\n' + color('═══════════════════════════════════════════════════════════════', COLORS.cyan));
  console.log(color('                    SPORT SAGE SCRAPER DASHBOARD', COLORS.bright, COLORS.cyan));
  console.log(color('═══════════════════════════════════════════════════════════════', COLORS.cyan) + '\n');

  const db = getDb();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get recent runs
  const recentRuns = await db
    .select()
    .from(scraperRuns)
    .where(gte(scraperRuns.startedAt, oneDayAgo))
    .orderBy(desc(scraperRuns.startedAt))
    .limit(20);

  // Summary stats
  const summary = {
    total: recentRuns.length,
    success: recentRuns.filter(r => r.status === 'success').length,
    failed: recentRuns.filter(r => r.status === 'failed').length,
    partial: recentRuns.filter(r => r.status === 'partial').length,
  };

  console.log(color('📊 LAST 24 HOURS', COLORS.bright));
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`  Total runs: ${color(String(summary.total), COLORS.bright)}`);
  console.log(`  Successful: ${color(String(summary.success), COLORS.green)} | Failed: ${color(String(summary.failed), COLORS.red)} | Partial: ${color(String(summary.partial), COLORS.yellow)}`);
  console.log();

  // Get fixture counts
  console.log(color('📅 FIXTURE COUNTS (Next 7 Days)', COLORS.bright));
  console.log('─────────────────────────────────────────────────────────────────');

  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  try {
    const fixtureCountsResult = await db.execute(sql`
      SELECT s.slug as sport_slug, s.name as sport_name, COUNT(e.id) as fixture_count
      FROM sports s
      LEFT JOIN events e ON e.sport_id = s.id
        AND e.start_time >= ${now.toISOString()}::timestamptz
        AND e.start_time <= ${nextWeek.toISOString()}::timestamptz
        AND e.status = 'scheduled'
      WHERE s.is_active = true
      GROUP BY s.id, s.slug, s.name
      ORDER BY fixture_count DESC
    `);

    const fixtureCounts = (fixtureCountsResult.rows || []) as Array<{ sport_slug: string; sport_name: string; fixture_count: number }>;

    const minExpected: Record<string, number> = {
      football: 50,
      basketball: 20,
      tennis: 5,
      darts: 2,
      cricket: 1,
    };

    for (const row of fixtureCounts) {
      const expected = minExpected[row.sport_slug] || 5;
      const countNum = Number(row.fixture_count);
      const isLow = countNum < expected;
      const icon = isLow ? '⚠️' : '✓';
      const countColor = isLow ? COLORS.yellow : COLORS.green;

      console.log(`  ${icon} ${row.sport_name.padEnd(15)} ${color(String(countNum).padStart(4), countColor)} fixtures`);
    }
  } catch (error) {
    console.log(color('  Could not fetch fixture counts', COLORS.dim));
  }
  console.log();

  // Recent runs table
  console.log(color('🔄 RECENT SCRAPER RUNS', COLORS.bright));
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(color('  Job Type          Status       Duration   Items    When', COLORS.dim));
  console.log('  ─────────────────────────────────────────────────────────────');

  for (const run of recentRuns.slice(0, 10)) {
    const jobType = run.jobType.replace('_', ' ').padEnd(16);
    const status = statusBadge(run.status);
    const duration = formatDuration(run.durationMs).padStart(8);
    const items = String(run.itemsProcessed || 0).padStart(5);
    const when = formatTimeAgo(run.startedAt).padStart(10);

    console.log(`  ${jobType} ${status} ${duration} ${items}  ${when}`);
  }
  console.log();

  // Alerts
  try {
    const activeAlerts = await db
      .select()
      .from(scraperAlerts)
      .where(sql`${scraperAlerts.acknowledgedAt} IS NULL`)
      .orderBy(desc(scraperAlerts.createdAt))
      .limit(5);

    if (activeAlerts.length > 0) {
      console.log(color('🚨 ACTIVE ALERTS', COLORS.bright, COLORS.red));
      console.log('─────────────────────────────────────────────────────────────────');
      for (const alert of activeAlerts) {
        const severity = alert.severity === 'critical' ? COLORS.red : alert.severity === 'error' ? COLORS.red : COLORS.yellow;
        console.log(`  ${color('●', severity)} [${alert.alertType}] ${alert.message}`);
        console.log(color(`    ${formatTimeAgo(alert.createdAt)}`, COLORS.dim));
      }
    } else {
      console.log(color('✓ No active alerts', COLORS.green));
    }
  } catch {
    // Alerts table might not exist yet
  }

  console.log('\n' + color('─────────────────────────────────────────────────────────────────', COLORS.dim));
  console.log(color(`  Generated at ${new Date().toISOString()}`, COLORS.dim));
  console.log();

  process.exit(0);
}

main().catch((error) => {
  console.error('Dashboard error:', error);
  process.exit(1);
});
