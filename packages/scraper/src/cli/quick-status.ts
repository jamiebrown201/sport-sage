#!/usr/bin/env node
/**
 * Quick Status - Shows fixture counts without needing monitoring tables
 * Run: pnpm quick-status
 */

import { getDb, events, sports } from '@sport-sage/database';
import { sql, gte, lte, eq, and, count } from 'drizzle-orm';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function color(text: string, ...colors: string[]): string {
  return colors.join('') + text + COLORS.reset;
}

async function main() {
  console.log('\n' + color('═══════════════════════════════════════════════════════', COLORS.cyan));
  console.log(color('              SPORT SAGE - QUICK STATUS', COLORS.bright, COLORS.cyan));
  console.log(color('═══════════════════════════════════════════════════════', COLORS.cyan) + '\n');

  const db = getDb();
  const now = new Date();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get all sports
  const allSports = await db.select().from(sports).where(eq(sports.isActive, true));

  console.log(color('📅 FIXTURES BY SPORT', COLORS.bright));
  console.log('───────────────────────────────────────────────────────');
  console.log(color('  Sport           Scheduled   Today    Tomorrow', COLORS.dim));
  console.log('  ─────────────────────────────────────────────────────');

  const minExpected: Record<string, number> = {
    football: 50,
    basketball: 20,
    tennis: 5,
    darts: 2,
    cricket: 1,
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  let totalScheduled = 0;

  for (const sport of allSports) {
    // Count scheduled fixtures
    const scheduledResult = await db
      .select({ count: count() })
      .from(events)
      .where(
        and(
          eq(events.sportId, sport.id),
          eq(events.status, 'scheduled'),
          gte(events.startTime, now),
          lte(events.startTime, nextWeek)
        )
      );

    // Count today's fixtures
    const todayResult = await db
      .select({ count: count() })
      .from(events)
      .where(
        and(
          eq(events.sportId, sport.id),
          eq(events.status, 'scheduled'),
          gte(events.startTime, today),
          lte(events.startTime, tomorrow)
        )
      );

    // Count tomorrow's fixtures
    const tomorrowResult = await db
      .select({ count: count() })
      .from(events)
      .where(
        and(
          eq(events.sportId, sport.id),
          eq(events.status, 'scheduled'),
          gte(events.startTime, tomorrow),
          lte(events.startTime, dayAfter)
        )
      );

    const scheduled = Number(scheduledResult[0]?.count || 0);
    const todayCount = Number(todayResult[0]?.count || 0);
    const tomorrowCount = Number(tomorrowResult[0]?.count || 0);

    totalScheduled += scheduled;

    const expected = minExpected[sport.slug as string] || 5;
    const isLow = scheduled < expected;
    const icon = isLow ? '⚠️' : '✓ ';
    const scheduledColor = isLow ? COLORS.yellow : COLORS.green;

    console.log(
      `  ${icon} ${sport.name.padEnd(14)} ` +
      `${color(String(scheduled).padStart(6), scheduledColor)}   ` +
      `${String(todayCount).padStart(5)}   ` +
      `${String(tomorrowCount).padStart(7)}`
    );
  }

  console.log('  ─────────────────────────────────────────────────────');
  console.log(`     Total:        ${color(String(totalScheduled).padStart(6), COLORS.bright)}`);
  console.log();

  // Recent activity
  console.log(color('🕐 RECENT EVENTS', COLORS.bright));
  console.log('───────────────────────────────────────────────────────');

  // Count events created in last 24h
  const recentCreatedResult = await db
    .select({ count: count() })
    .from(events)
    .where(gte(events.createdAt, yesterday));

  const recentCreated = Number(recentCreatedResult[0]?.count || 0);

  // Count live events
  const liveResult = await db
    .select({ count: count() })
    .from(events)
    .where(eq(events.status, 'live'));

  const liveCount = Number(liveResult[0]?.count || 0);

  // Count finished events in last 24h
  const finishedResult = await db
    .select({ count: count() })
    .from(events)
    .where(
      and(
        eq(events.status, 'finished'),
        gte(events.updatedAt, yesterday)
      )
    );

  const finishedCount = Number(finishedResult[0]?.count || 0);

  console.log(`  Created (24h):  ${color(String(recentCreated), COLORS.green)}`);
  console.log(`  Live now:       ${color(String(liveCount), liveCount > 0 ? COLORS.cyan : COLORS.dim)}`);
  console.log(`  Finished (24h): ${String(finishedCount)}`);
  console.log();

  // Database health
  console.log(color('💾 DATABASE', COLORS.bright));
  console.log('───────────────────────────────────────────────────────');

  const totalEventsResult = await db.select({ count: count() }).from(events);
  const totalEvents = Number(totalEventsResult[0]?.count || 0);

  console.log(`  Total events:   ${totalEvents.toLocaleString()}`);
  console.log(`  Active sports:  ${allSports.length}`);
  console.log();

  console.log(color('───────────────────────────────────────────────────────', COLORS.dim));
  console.log(color(`  ${new Date().toISOString()}`, COLORS.dim));
  console.log();

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
