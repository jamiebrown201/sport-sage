/**
 * Source Registry - Tracks all available data sources and their capabilities
 *
 * Each source has:
 * - Sports it covers
 * - Protection level (how hard to scrape)
 * - Data types available (live scores, fixtures, odds)
 * - Test results (updated after testing)
 */

export type Sport = 'football' | 'tennis' | 'basketball' | 'cricket' | 'darts' | 'rugby' | 'hockey' | 'baseball' | 'handball' | 'volleyball' | 'esports';

export type DataType = 'live-scores' | 'fixtures' | 'results' | 'odds' | 'stats';

export type ProtectionLevel = 'none' | 'low' | 'medium' | 'high' | 'extreme';

export type TestStatus = 'untested' | 'working' | 'blocked' | 'partial' | 'error';

export interface DataSource {
  id: string;
  name: string;
  baseUrl: string;
  apiUrl?: string; // If has JSON API
  sports: Sport[];
  dataTypes: DataType[];
  protection: ProtectionLevel;
  notes: string;
  // Updated after testing
  testStatus: TestStatus;
  testDate?: string;
  testNotes?: string;
}

/**
 * Complete registry of all known data sources
 */
export const DATA_SOURCES: DataSource[] = [
  // === WORKING (tested 2024-12-21) ===
  {
    id: 'sofascore',
    name: 'SofaScore',
    baseUrl: 'https://www.sofascore.com',
    apiUrl: 'https://api.sofascore.com/api/v1',
    sports: ['football', 'tennis', 'basketball', 'cricket', 'darts', 'rugby', 'hockey', 'baseball', 'handball', 'volleyball', 'esports'],
    dataTypes: ['live-scores', 'fixtures', 'results', 'stats'],
    protection: 'low',
    notes: 'Best free source. API returns JSON, works without proxy.',
    testStatus: 'working',
    testDate: '2024-12-21',
    testNotes: '552 live events, 425 fixtures. API accessible directly.',
  },
  {
    id: 'espn',
    name: 'ESPN',
    baseUrl: 'https://www.espn.com',
    sports: ['football', 'basketball', 'baseball', 'hockey', 'tennis', 'rugby', 'cricket'],
    dataTypes: ['live-scores', 'fixtures', 'results', 'stats'],
    protection: 'low',
    notes: 'US-based, good coverage. Works without proxy.',
    testStatus: 'working',
    testDate: '2024-12-21',
    testNotes: '3896 items found. No blocking detected.',
  },

  // === BLOCKED (tested 2024-12-21) ===
  {
    id: 'flashscore',
    name: 'Flashscore',
    baseUrl: 'https://www.flashscore.com',
    sports: ['football', 'tennis', 'basketball', 'cricket', 'darts', 'rugby', 'hockey', 'baseball', 'handball', 'volleyball', 'esports'],
    dataTypes: ['live-scores', 'fixtures', 'results', 'odds'],
    protection: 'high',
    notes: 'Part of Livesport network. Excellent data but heavy protection.',
    testStatus: 'blocked',
    testDate: '2024-12-21',
    testNotes: 'Blocked from AWS IPs. Needs residential proxy.',
  },
  {
    id: 'fotmob',
    name: 'FotMob',
    baseUrl: 'https://www.fotmob.com',
    apiUrl: 'https://www.fotmob.com/api',
    sports: ['football'],
    dataTypes: ['live-scores', 'fixtures', 'results', 'stats'],
    protection: 'medium',
    notes: 'Football only. Has API but returns 404 from servers.',
    testStatus: 'blocked',
    testDate: '2024-12-21',
    testNotes: '404 error. May need specific headers or proxy.',
  },
  {
    id: 'understat',
    name: 'Understat',
    baseUrl: 'https://understat.com',
    sports: ['football'],
    dataTypes: ['fixtures', 'results', 'stats'],
    protection: 'medium',
    notes: 'Football only. Top 6 European leagues. Great xG data.',
    testStatus: 'blocked',
    testDate: '2024-12-21',
    testNotes: 'Page loads but data extraction failed.',
  },
  {
    id: 'livescore',
    name: 'LiveScore',
    baseUrl: 'https://www.livescore.com',
    sports: ['football', 'tennis', 'basketball', 'hockey', 'cricket'],
    dataTypes: ['live-scores', 'fixtures', 'results'],
    protection: 'medium',
    notes: 'Classic live scores site. Clean markup but some protection.',
    testStatus: 'blocked',
    testDate: '2024-12-21',
    testNotes: 'Blocked with Cloudflare challenge.',
  },

  // === UNTESTED - TO BE TESTED ===
  {
    id: 'livesport',
    name: 'Livesport.cz / Flashscore Network',
    baseUrl: 'https://www.livesport.cz',
    sports: ['football', 'tennis', 'basketball', 'cricket', 'darts', 'rugby', 'hockey', 'baseball', 'handball', 'volleyball'],
    dataTypes: ['live-scores', 'fixtures', 'results'],
    protection: 'high',
    notes: 'Same network as Flashscore. 30+ sports coverage.',
    testStatus: 'untested',
  },
  {
    id: '365scores',
    name: '365Scores',
    baseUrl: 'https://www.365scores.com',
    sports: ['football', 'basketball', 'tennis', 'baseball', 'hockey'],
    dataTypes: ['live-scores', 'fixtures', 'results'],
    protection: 'low',
    notes: '2000+ competitions. Works without proxy.',
    testStatus: 'working',
    testDate: '2024-12-21',
    testNotes: '63 items found. Works FREE without proxy.',
  },
  {
    id: 'aiscore',
    name: 'AiScore',
    baseUrl: 'https://m.aiscore.com',
    sports: ['football', 'basketball', 'tennis', 'cricket', 'baseball', 'hockey'],
    dataTypes: ['live-scores', 'fixtures', 'results', 'stats'],
    protection: 'medium',
    notes: 'Mobile-friendly. Needs proxy.',
    testStatus: 'blocked',
    testDate: '2024-12-21',
    testNotes: 'No items found - likely blocked or dynamic loading.',
  },
  {
    id: 'sportytrader',
    name: 'SportyTrader',
    baseUrl: 'https://www.sportytrader.com/en/livescore',
    sports: ['football', 'tennis', 'basketball', 'rugby', 'hockey', 'handball', 'volleyball'],
    dataTypes: ['live-scores', 'fixtures', 'results'],
    protection: 'low',
    notes: 'All sports on single page with filters.',
    testStatus: 'untested',
  },
  {
    id: 'livescorehunter',
    name: 'LiveScoreHunter',
    baseUrl: 'https://www.livescorehunter.com',
    sports: ['football', 'tennis', 'hockey', 'basketball', 'baseball', 'handball'],
    dataTypes: ['live-scores', 'fixtures', 'results', 'stats'],
    protection: 'medium',
    notes: 'Multi-sport. Needs proxy.',
    testStatus: 'blocked',
    testDate: '2024-12-21',
    testNotes: 'No items found - likely blocked.',
  },
  {
    id: 'livescore808',
    name: 'LiveScore808',
    baseUrl: 'https://www.livescore808.com',
    sports: ['football', 'basketball', 'tennis', 'baseball', 'hockey'],
    dataTypes: ['live-scores', 'fixtures'],
    protection: 'low',
    notes: 'Simple table format. Good for fixtures.',
    testStatus: 'untested',
  },
  {
    id: 'soccerway',
    name: 'Soccerway',
    baseUrl: 'https://www.soccerway.com',
    sports: ['football'],
    dataTypes: ['fixtures', 'results', 'stats'],
    protection: 'medium',
    notes: 'Football only. Needs proxy.',
    testStatus: 'blocked',
    testDate: '2024-12-21',
    testNotes: 'No items found - likely blocked.',
  },
  {
    id: 'whoscored',
    name: 'WhoScored',
    baseUrl: 'https://www.whoscored.com',
    sports: ['football'],
    dataTypes: ['live-scores', 'fixtures', 'results', 'stats'],
    protection: 'high',
    notes: 'Football only. Excellent stats but heavy protection.',
    testStatus: 'untested',
  },
  {
    id: 'oddschecker',
    name: 'Oddschecker',
    baseUrl: 'https://www.oddschecker.com',
    sports: ['football', 'tennis', 'basketball', 'cricket', 'darts', 'rugby', 'hockey'],
    dataTypes: ['odds'],
    protection: 'high',
    notes: 'Best for odds comparison. Heavy protection.',
    testStatus: 'untested',
  },
  {
    id: 'oddsportal',
    name: 'OddsPortal',
    baseUrl: 'https://www.oddsportal.com',
    sports: ['football', 'tennis', 'basketball', 'hockey', 'baseball', 'handball', 'volleyball'],
    dataTypes: ['odds', 'results'],
    protection: 'low',
    notes: 'Best FREE odds source! Works without proxy.',
    testStatus: 'working',
    testDate: '2024-12-21',
    testNotes: '187 items found. FREE odds comparison!',
  },
  {
    id: 'betexplorer',
    name: 'BetExplorer',
    baseUrl: 'https://www.betexplorer.com',
    sports: ['football', 'tennis', 'basketball', 'hockey', 'baseball', 'handball', 'volleyball'],
    dataTypes: ['odds', 'fixtures', 'results'],
    protection: 'medium',
    notes: 'Similar to OddsPortal. Good odds data.',
    testStatus: 'untested',
  },
];

/**
 * Get sources that support a specific sport
 */
export function getSourcesForSport(sport: Sport): DataSource[] {
  return DATA_SOURCES.filter(s => s.sports.includes(sport));
}

/**
 * Get sources that provide a specific data type
 */
export function getSourcesForDataType(dataType: DataType): DataSource[] {
  return DATA_SOURCES.filter(s => s.dataTypes.includes(dataType));
}

/**
 * Get working sources (tested and confirmed working)
 */
export function getWorkingSources(): DataSource[] {
  return DATA_SOURCES.filter(s => s.testStatus === 'working');
}

/**
 * Get sources that need testing
 */
export function getUntestedSources(): DataSource[] {
  return DATA_SOURCES.filter(s => s.testStatus === 'untested');
}

/**
 * Print source summary
 */
export function printSourceSummary(): void {
  console.log('\n=== Data Source Registry ===\n');

  const byStatus = {
    working: DATA_SOURCES.filter(s => s.testStatus === 'working'),
    blocked: DATA_SOURCES.filter(s => s.testStatus === 'blocked'),
    untested: DATA_SOURCES.filter(s => s.testStatus === 'untested'),
  };

  console.log(`✅ Working (${byStatus.working.length}):`);
  byStatus.working.forEach(s => {
    console.log(`   - ${s.name}: ${s.sports.join(', ')}`);
  });

  console.log(`\n🚫 Blocked (${byStatus.blocked.length}):`);
  byStatus.blocked.forEach(s => {
    console.log(`   - ${s.name}: ${s.sports.join(', ')}`);
  });

  console.log(`\n❓ Untested (${byStatus.untested.length}):`);
  byStatus.untested.forEach(s => {
    console.log(`   - ${s.name}: ${s.sports.join(', ')}`);
  });
}
