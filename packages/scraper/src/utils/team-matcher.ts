/**
 * Team Name Matcher
 *
 * Matches events from any scraper source to database events by comparing
 * home and away team names. This makes the system source-agnostic.
 */

// Common suffixes/prefixes to remove for normalization
const TEAM_SUFFIXES = [
  'fc', 'cf', 'sc', 'ac', 'afc', 'ssc', 'rfc',
  'united', 'utd', 'city', 'town', 'rovers', 'wanderers',
  'athletic', 'albion', 'hotspur', 'argyle',
  'de', 'del', 'la', 'las', 'el', 'los', // Spanish articles
  'real', 'atlético', 'atletico', 'sporting', 'deportivo',
  'inter', 'juventus', 'milan', 'roma', 'napoli', 'lazio',
  'dynamo', 'spartak', 'cska', 'zenit',
  'club', 'fk', 'sk', 'bk', 'if', // Nordic/Eastern European
];

// Common abbreviations mapping
const ABBREVIATIONS: Record<string, string[]> = {
  'manchester united': ['man utd', 'man united', 'manchester utd'],
  'manchester city': ['man city'],
  'tottenham hotspur': ['tottenham', 'spurs'],
  'wolverhampton wanderers': ['wolves', 'wolverhampton'],
  'brighton & hove albion': ['brighton', 'brighton hove'],
  'west ham united': ['west ham'],
  'newcastle united': ['newcastle'],
  'nottingham forest': ["nott'm forest", 'nottm forest', 'notts forest'],
  'sheffield united': ['sheffield utd', 'sheff utd'],
  'crystal palace': ['c palace', 'c. palace'],
  'queens park rangers': ['qpr'],
  'west bromwich albion': ['west brom', 'wba'],
  'paris saint-germain': ['psg', 'paris sg', 'paris saint germain'],
  'bayern munich': ['bayern münchen', 'fc bayern', 'bayern munchen'],
  'borussia dortmund': ['dortmund', 'bvb'],
  'borussia mönchengladbach': ['gladbach', 'mönchengladbach', 'monchengladbach'],
  'rb leipzig': ['rasenballsport leipzig', 'leipzig'],
  'bayer leverkusen': ['leverkusen', 'bayer 04'],
  'atletico madrid': ['atlético madrid', 'atl madrid', 'atletico de madrid'],
  'real madrid': ['r madrid'],
  'real betis': ['betis'],
  'real sociedad': ['sociedad', 'real soc'],
  'athletic bilbao': ['athletic club', 'ath bilbao'],
  'inter milan': ['internazionale', 'inter'],
  'ac milan': ['milan'],
  'as roma': ['roma'],
  'napoli': ['ssc napoli'],
};

// Build reverse lookup for abbreviations
const ABBREVIATION_LOOKUP: Map<string, string> = new Map();
for (const [canonical, abbrevs] of Object.entries(ABBREVIATIONS)) {
  for (const abbrev of abbrevs) {
    ABBREVIATION_LOOKUP.set(normalize(abbrev), canonical);
  }
}

/**
 * Normalize a team name for comparison
 */
export function normalize(name: string): string {
  let normalized = name
    .toLowerCase()
    .trim()
    // Remove common punctuation
    .replace(/[''`´]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[.,:;!?()[\]{}]/g, '')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    // Remove leading/trailing articles
    .replace(/^(the|los|las|el|la|le|les|de|del)\s+/i, '')
    .replace(/\s+(the|los|las|el|la|le|les|de|del)$/i, '');

  // Remove common suffixes if they're at the end
  for (const suffix of TEAM_SUFFIXES) {
    const suffixPattern = new RegExp(`\\s+${suffix}$`, 'i');
    if (suffixPattern.test(normalized)) {
      normalized = normalized.replace(suffixPattern, '');
    }
  }

  return normalized.trim();
}

/**
 * Get the canonical name for a team (resolves abbreviations)
 */
export function getCanonical(name: string): string {
  const normalized = normalize(name);
  return ABBREVIATION_LOOKUP.get(normalized) || normalized;
}

/**
 * Calculate similarity between two strings (Levenshtein distance based)
 * Returns a score between 0 and 1 (1 = identical)
 */
export function similarity(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);

  if (normA === normB) return 1;

  // Check if one contains the other (common for short names)
  if (normA.includes(normB) || normB.includes(normA)) {
    const shorter = normA.length < normB.length ? normA : normB;
    const longer = normA.length < normB.length ? normB : normA;
    // Bonus for containment
    return 0.8 + (0.2 * shorter.length / longer.length);
  }

  // Levenshtein distance
  const matrix: number[][] = [];
  const lenA = normA.length;
  const lenB = normB.length;

  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = normA[i - 1] === normB[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[lenA][lenB];
  const maxLen = Math.max(lenA, lenB);
  return 1 - distance / maxLen;
}

/**
 * Check if two team names match
 * Returns confidence score (0-1) or 0 if no match
 */
export function matchTeamNames(name1: string, name2: string): number {
  // First try canonical names (handles known abbreviations)
  const canonical1 = getCanonical(name1);
  const canonical2 = getCanonical(name2);

  if (canonical1 === canonical2) return 1;

  // Try normalized comparison
  const norm1 = normalize(name1);
  const norm2 = normalize(name2);

  if (norm1 === norm2) return 1;

  // Calculate similarity
  const sim = similarity(name1, name2);

  // Also try canonical similarity
  const canonicalSim = similarity(canonical1, canonical2);

  return Math.max(sim, canonicalSim);
}

/**
 * Match threshold - names with similarity above this are considered a match
 */
const MATCH_THRESHOLD = 0.75;

export interface ScrapedEvent {
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  period?: string;
  minute?: number;
  isFinished?: boolean;
  startTime?: Date;
  competitionName?: string; // Competition name from source
  // Source-specific metadata (optional)
  sourceId?: string;
  sourceName?: string;
}

export interface DatabaseEvent {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  startTime: Date;
  externalFlashscoreId?: string | null;
  externalOddscheckerId?: string | null;
}

export interface MatchResult {
  dbEvent: DatabaseEvent;
  scrapedEvent: ScrapedEvent;
  confidence: number;
  homeConfidence: number;
  awayConfidence: number;
}

/**
 * Match scraped events to database events by team names
 *
 * @param scrapedEvents Events from any scraper source
 * @param dbEvents Events from our database
 * @param options Matching options
 * @returns Array of matched pairs with confidence scores
 */
export function matchEvents(
  scrapedEvents: ScrapedEvent[],
  dbEvents: DatabaseEvent[],
  options: {
    threshold?: number;
    requireBothTeams?: boolean;
    timeWindowMs?: number; // Only match events within this time window
  } = {}
): MatchResult[] {
  const {
    threshold = MATCH_THRESHOLD,
    requireBothTeams = true,
    timeWindowMs = 24 * 60 * 60 * 1000, // 24 hours default
  } = options;

  const results: MatchResult[] = [];
  const matchedDbIds = new Set<string>();

  for (const scraped of scrapedEvents) {
    let bestMatch: MatchResult | null = null;

    for (const dbEvent of dbEvents) {
      // Skip already matched events
      if (matchedDbIds.has(dbEvent.id)) continue;

      // Check time window if scraped event has start time
      if (scraped.startTime && timeWindowMs) {
        const timeDiff = Math.abs(scraped.startTime.getTime() - dbEvent.startTime.getTime());
        if (timeDiff > timeWindowMs) continue;
      }

      // Match team names
      const homeConfidence = matchTeamNames(scraped.homeTeam, dbEvent.homeTeamName);
      const awayConfidence = matchTeamNames(scraped.awayTeam, dbEvent.awayTeamName);

      // Calculate overall confidence
      let confidence: number;
      if (requireBothTeams) {
        // Both teams must match above threshold
        if (homeConfidence < threshold || awayConfidence < threshold) continue;
        confidence = (homeConfidence + awayConfidence) / 2;
      } else {
        // Average of both
        confidence = (homeConfidence + awayConfidence) / 2;
        if (confidence < threshold) continue;
      }

      // Track best match
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          dbEvent,
          scrapedEvent: scraped,
          confidence,
          homeConfidence,
          awayConfidence,
        };
      }
    }

    if (bestMatch) {
      results.push(bestMatch);
      matchedDbIds.add(bestMatch.dbEvent.id);
    }
  }

  return results;
}

/**
 * Debug helper - log matching details
 */
export function debugMatch(name1: string, name2: string): void {
  console.log(`Comparing: "${name1}" vs "${name2}"`);
  console.log(`  Normalized: "${normalize(name1)}" vs "${normalize(name2)}"`);
  console.log(`  Canonical: "${getCanonical(name1)}" vs "${getCanonical(name2)}"`);
  console.log(`  Similarity: ${similarity(name1, name2).toFixed(3)}`);
  console.log(`  Match score: ${matchTeamNames(name1, name2).toFixed(3)}`);
}
