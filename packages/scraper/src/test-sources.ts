#!/usr/bin/env npx tsx
/**
 * Test all data sources locally to see which ones work without proxies
 *
 * Usage: npx tsx packages/scraper/src/test-sources.ts
 */

import { chromium } from 'playwright-core';
import { DATA_SOURCES, printSourceSummary } from './scrapers/source-registry';

interface SourceResult {
  id: string;
  name: string;
  status: 'success' | 'blocked' | 'error';
  dataFound: number;
  responseTime: number;
  sports: string[];
  error?: string;
}

// Test endpoints for each source
const sources = [
  // === KNOWN WORKING ===
  {
    id: 'sofascore',
    name: 'SofaScore API (Live)',
    url: 'https://api.sofascore.com/api/v1/sport/football/events/live',
    type: 'json',
    sports: ['football', 'tennis', 'basketball', 'cricket', 'darts'],
  },
  {
    id: 'espn',
    name: 'ESPN Football',
    url: 'https://www.espn.com/soccer/scoreboard',
    type: 'html',
    checkFor: 'Scoreboard',
    sports: ['football', 'basketball', 'baseball', 'hockey'],
  },

  // === PREVIOUSLY BLOCKED - RETRY ===
  {
    id: 'flashscore',
    name: 'Flashscore',
    url: 'https://www.flashscore.com/football/',
    type: 'html',
    checkFor: 'event__match',
    sports: ['football', 'tennis', 'basketball', 'cricket', 'darts'],
  },
  {
    id: 'fotmob',
    name: 'FotMob API',
    url: `https://www.fotmob.com/api/matches?date=${new Date().toISOString().split('T')[0]}`,
    type: 'json',
    sports: ['football'],
  },
  {
    id: 'understat',
    name: 'Understat',
    url: 'https://understat.com/league/EPL/2024',
    type: 'html',
    checkFor: 'datesData',
    sports: ['football'],
  },
  {
    id: 'livescore',
    name: 'LiveScore',
    url: 'https://www.livescore.com/en/football/',
    type: 'html',
    checkFor: 'match',
    sports: ['football', 'tennis', 'basketball', 'hockey', 'cricket'],
  },

  // === NEW SOURCES TO TEST ===
  {
    id: 'livesport',
    name: 'Livesport.cz',
    url: 'https://www.livesport.cz/fotbal/',
    type: 'html',
    checkFor: 'event__match',
    sports: ['football', 'tennis', 'basketball', 'hockey'],
  },
  {
    id: '365scores',
    name: '365Scores',
    url: 'https://www.365scores.com/football',
    type: 'html',
    checkFor: 'game',
    sports: ['football', 'basketball', 'tennis', 'baseball', 'hockey'],
  },
  {
    id: 'aiscore',
    name: 'AiScore',
    url: 'https://m.aiscore.com/football/live',
    type: 'html',
    checkFor: 'match',
    sports: ['football', 'basketball', 'tennis', 'cricket'],
  },
  {
    id: 'sportytrader',
    name: 'SportyTrader',
    url: 'https://www.sportytrader.com/en/livescore/football/',
    type: 'html',
    checkFor: 'match',
    sports: ['football', 'tennis', 'basketball', 'rugby', 'hockey'],
  },
  {
    id: 'livescorehunter',
    name: 'LiveScoreHunter',
    url: 'https://www.livescorehunter.com/',
    type: 'html',
    checkFor: 'score',
    sports: ['football', 'tennis', 'hockey', 'basketball'],
  },
  {
    id: 'soccerway',
    name: 'Soccerway',
    url: 'https://int.soccerway.com/',
    type: 'html',
    checkFor: 'match',
    sports: ['football'],
  },
  {
    id: 'oddsportal',
    name: 'OddsPortal',
    url: 'https://www.oddsportal.com/football/',
    type: 'html',
    checkFor: 'odds',
    sports: ['football', 'tennis', 'basketball'],
  },
  {
    id: 'betexplorer',
    name: 'BetExplorer',
    url: 'https://www.betexplorer.com/football/',
    type: 'html',
    checkFor: 'match',
    sports: ['football', 'tennis', 'basketball', 'hockey'],
  },

  // === ADDITIONAL SPORTS SOURCES ===
  {
    id: 'sofascore-tennis',
    name: 'SofaScore Tennis',
    url: 'https://api.sofascore.com/api/v1/sport/tennis/events/live',
    type: 'json',
    sports: ['tennis'],
  },
  {
    id: 'sofascore-basketball',
    name: 'SofaScore Basketball',
    url: 'https://api.sofascore.com/api/v1/sport/basketball/events/live',
    type: 'json',
    sports: ['basketball'],
  },
  {
    id: 'sofascore-cricket',
    name: 'SofaScore Cricket',
    url: 'https://api.sofascore.com/api/v1/sport/cricket/events/live',
    type: 'json',
    sports: ['cricket'],
  },
  {
    id: 'sofascore-darts',
    name: 'SofaScore Darts',
    url: 'https://api.sofascore.com/api/v1/sport/darts/events/live',
    type: 'json',
    sports: ['darts'],
  },
  {
    id: 'espn-tennis',
    name: 'ESPN Tennis',
    url: 'https://www.espn.com/tennis/scoreboard',
    type: 'html',
    checkFor: 'Scoreboard',
    sports: ['tennis'],
  },
  {
    id: 'espn-basketball',
    name: 'ESPN Basketball',
    url: 'https://www.espn.com/nba/scoreboard',
    type: 'html',
    checkFor: 'Scoreboard',
    sports: ['basketball'],
  },
  {
    id: 'espn-cricket',
    name: 'ESPN Cricket',
    url: 'https://www.espn.com/cricket/scores',
    type: 'html',
    checkFor: 'score',
    sports: ['cricket'],
  },
];

async function testSource(
  page: any,
  source: typeof sources[0]
): Promise<SourceResult> {
  const startTime = Date.now();

  try {
    console.log(`  Testing ${source.name}...`);

    const response = await page.goto(source.url, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    const responseTime = Date.now() - startTime;

    if (!response) {
      return {
        id: source.id,
        name: source.name,
        status: 'error',
        dataFound: 0,
        responseTime,
        sports: source.sports,
        error: 'No response',
      };
    }

    const statusCode = response.status();
    const content = await page.content();

    // Check for blocking
    const blockedPatterns = [
      'access denied',
      'blocked',
      'captcha',
      'cloudflare',
      'please verify',
      'rate limit',
      'too many requests',
      'robot check',
      '403 forbidden',
      '429 too many',
    ];

    const lowerContent = content.toLowerCase();
    const isBlocked =
      statusCode === 403 ||
      statusCode === 429 ||
      statusCode === 503 ||
      blockedPatterns.some((p) => lowerContent.includes(p));

    if (isBlocked) {
      return {
        id: source.id,
        name: source.name,
        status: 'blocked',
        dataFound: 0,
        responseTime,
        sports: source.sports,
        error: `Blocked (status: ${statusCode})`,
      };
    }

    // Check for expected data
    let dataFound = 0;

    if (source.type === 'json') {
      try {
        const bodyText = await page.evaluate(() => document.body.innerText);
        const json = JSON.parse(bodyText);

        // Count items in response
        if (json.events) dataFound = json.events.length;
        else if (json.leagues) {
          dataFound = json.leagues.reduce(
            (sum: number, l: any) => sum + (l.matches?.length || 0),
            0
          );
        } else if (Array.isArray(json)) {
          dataFound = json.length;
        } else {
          dataFound = Object.keys(json).length;
        }
      } catch {
        // Not valid JSON
      }
    } else if (source.checkFor) {
      // Count occurrences of expected pattern
      const matches = content.match(new RegExp(source.checkFor, 'gi'));
      dataFound = matches?.length || 0;
    }

    return {
      id: source.id,
      name: source.name,
      status: dataFound > 0 ? 'success' : 'error',
      dataFound,
      responseTime,
      sports: source.sports,
      error: dataFound === 0 ? 'No data found' : undefined,
    };
  } catch (error) {
    return {
      id: source.id,
      name: source.name,
      status: 'error',
      dataFound: 0,
      responseTime: Date.now() - startTime,
      sports: source.sports,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  console.log('\n🔍 Testing Data Sources (No Proxy)\n');
  console.log('='.repeat(60));
  console.log('This test checks which sources work without residential proxies.\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-GB',
  });

  const page = await context.newPage();
  const results: SourceResult[] = [];

  for (const source of sources) {
    const result = await testSource(page, source);
    results.push(result);

    // Status icon
    const icon =
      result.status === 'success'
        ? '✅'
        : result.status === 'blocked'
        ? '🚫'
        : '❌';

    console.log(
      `${icon} ${result.name}: ${result.status} (${result.dataFound} items, ${result.responseTime}ms)`
    );
    if (result.error) {
      console.log(`   └─ ${result.error}`);
    }

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  await browser.close();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:\n');

  const working = results.filter((r) => r.status === 'success');
  const blocked = results.filter((r) => r.status === 'blocked');
  const errors = results.filter((r) => r.status === 'error');

  console.log(`✅ Working without proxy: ${working.length}`);
  working.forEach((r) => console.log(`   - ${r.name} (${r.dataFound} items) [${r.sports.join(', ')}]`));

  console.log(`\n🚫 Blocked (need proxy): ${blocked.length}`);
  blocked.forEach((r) => console.log(`   - ${r.name} [${r.sports.join(', ')}]`));

  console.log(`\n❌ Errors: ${errors.length}`);
  errors.forEach((r) => console.log(`   - ${r.name}: ${r.error}`));

  // Summary by sport
  console.log('\n' + '='.repeat(60));
  console.log('\n⚽ Coverage by Sport:\n');

  const allSports = ['football', 'tennis', 'basketball', 'cricket', 'darts', 'hockey', 'rugby', 'baseball'];

  for (const sport of allSports) {
    const sportSources = working.filter(r => r.sports.includes(sport));
    if (sportSources.length > 0) {
      console.log(`   ${sport.toUpperCase()}: ${sportSources.map(s => s.name.split(' ')[0]).join(', ')}`);
    } else {
      const blockedSport = blocked.filter(r => r.sports.includes(sport));
      if (blockedSport.length > 0) {
        console.log(`   ${sport.toUpperCase()}: ⚠️ Only available with proxy (${blockedSport.map(s => s.name.split(' ')[0]).join(', ')})`);
      }
    }
  }

  console.log('\n💡 Recommendation:');
  if (working.length >= 2) {
    console.log(`   Use working sources as primary (FREE):`);
    working.slice(0, 5).forEach(w => {
      console.log(`     - ${w.name}: ${w.sports.join(', ')}`);
    });
    if (blocked.length > 0) {
      console.log(`\n   Only use proxies for blocked sources if needed.`);
    }
  } else {
    console.log('   Most sources are blocked - proxies recommended');
  }

  console.log('\n🔧 Proxy Options (cheapest first):');
  console.log('   1. ScraperAPI free tier: 1000 req/month FREE');
  console.log('   2. PacketStream: $1/GB');
  console.log('   3. SmartProxy: ~$6-8/GB');
  console.log('   4. Oxylabs: ~$8/GB');
  console.log('   5. Bright Data: ~$10-17/GB\n');
}

main().catch(console.error);
