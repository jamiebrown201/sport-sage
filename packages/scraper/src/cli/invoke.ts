#!/usr/bin/env npx ts-node
/**
 * Local CLI to invoke scraper jobs
 *
 * Usage:
 *   npx ts-node src/cli/invoke.ts live-scores
 *   npx ts-node src/cli/invoke.ts fixtures
 *   npx ts-node src/cli/invoke.ts odds
 *   npx ts-node src/cli/invoke.ts test-sources
 *   npx ts-node src/cli/invoke.ts test-matching "Manchester United" "Man Utd"
 */

import { printSourceSummary } from '../scrapers/source-registry';

const JOBS = {
  'live-scores': async () => {
    const { handler } = await import('../jobs/sync-live-scores');
    console.log('\n=== Sync Live Scores ===\n');
    await handler({} as any, {} as any, () => {});
  },

  'fixtures': async () => {
    const { handler } = await import('../jobs/sync-fixtures');
    console.log('\n=== Sync Fixtures ===\n');
    await handler({} as any, {} as any, () => {});
  },

  'odds': async () => {
    const { handler } = await import('../jobs/sync-odds');
    console.log('\n=== Sync Odds ===\n');
    await handler({} as any, {} as any, () => {});
  },

  'test-sources': async () => {
    console.log('\n=== Testing All Sources ===\n');
    console.log('Running test-sources.ts script...\n');
    // Run the test-sources script directly
    const { spawn } = await import('child_process');
    const path = await import('path');
    const scriptPath = path.join(__dirname, '..', 'test-sources.ts');

    return new Promise<void>((resolve, reject) => {
      const child = spawn('npx', ['tsx', scriptPath], {
        stdio: 'inherit',
        shell: true,
      });
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Script exited with code ${code}`));
      });
    });
  },

  'sources': async () => {
    console.log('\n=== Source Registry ===\n');
    printSourceSummary();
  },

  'test-matching': async (args: string[]) => {
    const { normalizeTeamName, combinedSimilarity, findOrCreateTeam } = await import('../normalization/team-names');

    if (args.length < 2) {
      console.log('Usage: test-matching "Team Name 1" "Team Name 2"');
      return;
    }

    const [name1, name2] = args;
    console.log('\n=== Team Name Matching Test ===\n');
    console.log(`Input 1: "${name1}"`);
    console.log(`Input 2: "${name2}"`);
    console.log('');
    console.log(`Normalized 1: "${normalizeTeamName(name1!)}"`);
    console.log(`Normalized 2: "${normalizeTeamName(name2!)}"`);
    console.log('');
    const similarity = combinedSimilarity(name1!, name2!);
    console.log(`Similarity: ${(similarity * 100).toFixed(1)}%`);
    console.log(`Would auto-match: ${similarity >= 0.85 ? 'YES' : 'NO'} (threshold: 85%)`);
  },

  'test-team-lookup': async (args: string[]) => {
    const { findOrCreateTeam, fuzzyMatchTeam, normalizeTeamName } = await import('../normalization/team-names');

    if (args.length < 1) {
      console.log('Usage: test-team-lookup "Team Name" [source]');
      return;
    }

    const [name, source = 'test'] = args;
    console.log('\n=== Team Lookup Test ===\n');
    console.log(`Looking up: "${name}" from source: ${source}`);
    console.log(`Normalized: "${normalizeTeamName(name!)}"`);
    console.log('');

    // Try fuzzy match first (without creating)
    const fuzzyMatch = await fuzzyMatchTeam(name!, 0.7);
    if (fuzzyMatch) {
      console.log(`Fuzzy match found: Team ID ${fuzzyMatch.id} (${(fuzzyMatch.similarity * 100).toFixed(1)}% confidence)`);
    } else {
      console.log('No fuzzy match found (would create new team)');
    }
  },

  'test-live-rotation': async () => {
    const { launchBrowser } = await import('../utils/browser');
    const { LiveScoresOrchestrator } = await import('../scrapers/live-scores-orchestrator');

    console.log('\n=== Live Scores Rotation Test ===\n');
    console.log('Testing source rotation with sample events...\n');

    // Sample events for testing (these are popular teams that are likely to have live games)
    const testEvents = [
      {
        id: 'test-1',
        homeTeamName: 'Manchester United',
        awayTeamName: 'Liverpool',
        startTime: new Date(),
        sportSlug: 'football',
      },
      {
        id: 'test-2',
        homeTeamName: 'Arsenal',
        awayTeamName: 'Chelsea',
        startTime: new Date(),
        sportSlug: 'football',
      },
    ];

    const browser = await launchBrowser();
    try {
      const orchestrator = new LiveScoresOrchestrator();
      const result = await orchestrator.getLiveScores(browser, testEvents);

      console.log('\nResults:');
      console.log(`- Scores found: ${result.scores.size}`);
      console.log(`- Sources used: ${result.sourcesUsed.join(', ') || 'none'}`);
      console.log('\nStats:');
      for (const [source, stats] of Object.entries(result.stats) as [string, { success: number; fail: number }][]) {
        if (stats.success + stats.fail > 0) {
          console.log(`  ${source}: ${stats.success} success, ${stats.fail} fail`);
        }
      }
    } finally {
      await browser.close();
    }
  },

  'test-odds': async () => {
    const { launchBrowser } = await import('../utils/browser');
    const { OddsOrchestrator } = await import('../scrapers/odds-orchestrator');

    console.log('\n=== Odds Scraping Test ===\n');

    const browser = await launchBrowser();
    try {
      const orchestrator = new OddsOrchestrator();

      for (const sport of ['football', 'basketball', 'tennis']) {
        console.log(`\nTesting ${sport}...`);
        const result = await orchestrator.getOddsForSport(browser, sport);
        console.log(`  Found: ${result.odds.length} events with odds`);
        console.log(`  Sources: ${result.sourcesUsed.join(', ') || 'none'}`);

        // Show first 3 examples
        if (result.odds.length > 0) {
          console.log('  Examples:');
          for (const odds of result.odds.slice(0, 3)) {
            console.log(`    ${odds.homeTeam} vs ${odds.awayTeam}: ${odds.homeWin}/${odds.draw || '-'}/${odds.awayWin}`);
          }
        }
      }

      orchestrator.logSummary();
    } finally {
      await browser.close();
    }
  },

  'help': async () => {
    console.log(`
Sport Sage Scraper CLI

Usage: npx ts-node src/cli/invoke.ts <command> [args]

Commands:
  live-scores          Sync live scores from all sources (with rotation)
  fixtures             Sync upcoming fixtures
  odds                 Sync odds from OddsPortal/Oddschecker
  test-sources         Test all configured sources
  sources              Show source registry summary
  test-matching        Test team name matching (usage: test-matching "Name1" "Name2")
  test-team-lookup     Test team lookup in DB (usage: test-team-lookup "Name" [source])
  test-live-rotation   Test live scores with source rotation
  test-odds            Test odds scraping for multiple sports
  help                 Show this help

Examples:
  npx ts-node src/cli/invoke.ts test-matching "Man Utd" "Manchester United"
  npx ts-node src/cli/invoke.ts test-sources
  npx ts-node src/cli/invoke.ts live-scores
`);
  },
};

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command || !(command in JOBS)) {
    await JOBS.help();
    process.exit(command ? 1 : 0);
  }

  try {
    await JOBS[command as keyof typeof JOBS](args);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
