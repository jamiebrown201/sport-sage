import { getDb, teams, teamAliases } from '@sport-sage/database';
import { eq, and, ilike, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

/**
 * Scalable team/competitor name normalization system
 *
 * Design principles:
 * 1. Database-first: Aliases stored in DB, not code
 * 2. Auto-learning: High-confidence matches create new aliases
 * 3. Generic patterns: No sport/team-specific hardcoding
 * 4. Fuzzy matching: Falls back to similarity matching
 * 5. Caching: In-memory cache for performance at scale
 *
 * Works for ANY sport - football, tennis, darts, esports, etc.
 */

// ============ CACHING LAYER ============

interface TeamsCache {
  teams: Array<{ id: string; name: string }>;
  lastRefresh: number;
  ttl: number; // milliseconds
}

// Teams cache - refreshed every 5 minutes
const teamsCache: TeamsCache = {
  teams: [],
  lastRefresh: 0,
  ttl: 5 * 60 * 1000, // 5 minutes
};

// Alias cache - LRU-style map (alias:source -> teamId)
const aliasCache = new Map<string, string | null>();
const ALIAS_CACHE_MAX_SIZE = 1000;

function getAliasCacheKey(alias: string, source: string): string {
  return `${alias.toLowerCase()}:${source}`;
}

function setAliasCache(alias: string, source: string, teamId: string | null): void {
  // Simple LRU: if at max, delete oldest entry
  if (aliasCache.size >= ALIAS_CACHE_MAX_SIZE) {
    const firstKey = aliasCache.keys().next().value;
    if (firstKey) aliasCache.delete(firstKey);
  }
  aliasCache.set(getAliasCacheKey(alias, source), teamId);
}

function getAliasFromCache(alias: string, source: string): string | null | undefined {
  return aliasCache.get(getAliasCacheKey(alias, source));
}

async function getCachedTeams(): Promise<Array<{ id: string; name: string }>> {
  const now = Date.now();

  if (teamsCache.teams.length === 0 || now - teamsCache.lastRefresh > teamsCache.ttl) {
    const db = getDb();
    teamsCache.teams = await db.query.teams.findMany({
      columns: { id: true, name: true },
    });
    teamsCache.lastRefresh = now;
    logger.debug(`Refreshed teams cache: ${teamsCache.teams.length} teams`);
  }

  return teamsCache.teams;
}

/**
 * Invalidate caches (call after creating/merging teams)
 */
export function invalidateTeamCaches(): void {
  teamsCache.teams = [];
  teamsCache.lastRefresh = 0;
  aliasCache.clear();
  logger.debug('Team caches invalidated');
}

// ============ END CACHING ============

// Generic patterns that apply to ANY sport (not team-specific)
const GENERIC_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Common club prefixes (works across languages/countries)
  { pattern: /^(FC|AC|AS|SS|SC|SK|FK|NK|AEK|CD|CF|RC|CA|AD|UD|SD|US|SV|TSV|VfB|VfL|FSV|SpVgg|BSC|BVB|RCD|RSC)\s+/i, replacement: '' },

  // Common suffixes
  { pattern: /\s+(FC|CF|SC|AFC|BC|HC|KC|CC|RFC|SFC)$/i, replacement: '' },

  // Country/region qualifiers in brackets or parentheses
  { pattern: /\s*\([^)]+\)\s*$/i, replacement: '' },
  { pattern: /\s*\[[^\]]+\]\s*$/i, replacement: '' },

  // "The" prefix
  { pattern: /^The\s+/i, replacement: '' },

  // Year suffixes (e.g., "Team Name 2024")
  { pattern: /\s+\d{4}$/i, replacement: '' },

  // Multiple spaces to single
  { pattern: /\s+/g, replacement: ' ' },
];

/**
 * Apply generic normalization patterns
 * Makes names more comparable without losing identity
 */
export function normalizeTeamName(name: string): string {
  let normalized = name.trim();

  for (const rule of GENERIC_PATTERNS) {
    normalized = normalized.replace(rule.pattern, rule.replacement);
  }

  return normalized.trim();
}

/**
 * Create a search key for comparison
 * More aggressive normalization for matching purposes
 */
function createSearchKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, '')      // Remove apostrophes
    .replace(/[^\w\s-]/g, '')   // Keep only alphanumeric, spaces, hyphens
    .replace(/\s+/g, ' ')       // Normalize spaces
    .trim();
}

/**
 * Calculate similarity using Levenshtein distance (0-1 scale)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = createSearchKey(str1);
  const s2 = createSearchKey(str2);

  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;

  // Short-circuit for very different lengths
  if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.5) {
    return 0;
  }

  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : 1 - matrix[len1]![len2]! / maxLen;
}

/**
 * Token-based similarity (handles word reordering)
 * "Manchester United" matches "United Manchester"
 */
function calculateTokenSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(createSearchKey(str1).split(' ').filter(t => t.length > 2));
  const tokens2 = new Set(createSearchKey(str2).split(' ').filter(t => t.length > 2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = [...tokens1].filter(t => tokens2.has(t)).length;
  const union = new Set([...tokens1, ...tokens2]).size;

  return intersection / union; // Jaccard similarity
}

/**
 * Combined similarity score
 */
export function combinedSimilarity(str1: string, str2: string): number {
  const levenshtein = calculateSimilarity(str1, str2);
  const token = calculateTokenSimilarity(str1, str2);

  // Weight token similarity higher for multi-word names
  const wordCount = Math.max(str1.split(' ').length, str2.split(' ').length);
  const tokenWeight = Math.min(0.6, wordCount * 0.15);

  return levenshtein * (1 - tokenWeight) + token * tokenWeight;
}

/**
 * Find team by exact alias match (fastest path)
 * Uses in-memory cache for repeated lookups
 */
export async function findTeamByAlias(
  alias: string,
  source: string
): Promise<string | null> {
  // Check cache first
  const cached = getAliasFromCache(alias, source);
  if (cached !== undefined) {
    return cached;
  }

  const db = getDb();
  const result = await db.query.teamAliases.findFirst({
    where: and(eq(teamAliases.alias, alias), eq(teamAliases.source, source)),
  });

  const teamId = result?.teamId || null;
  setAliasCache(alias, source, teamId);
  return teamId;
}

/**
 * Find or create team with intelligent matching
 *
 * Flow:
 * 1. Exact alias match -> return immediately
 * 2. Normalized name match -> create alias, return
 * 3. Fuzzy match (>85% confidence) -> create alias, return
 * 4. No match -> create new team with alias
 */
export async function findOrCreateTeam(
  name: string,
  source: string
): Promise<string> {
  const db = getDb();
  const normalized = normalizeTeamName(name);

  // 1. Try exact alias match (fastest)
  const existingAlias = await findTeamByAlias(name, source);
  if (existingAlias) {
    return existingAlias;
  }

  // 2. Try normalized name match (case-insensitive)
  const exactMatch = await db.query.teams.findFirst({
    where: ilike(teams.name, normalized),
  });

  if (exactMatch) {
    // Auto-learn: Create alias for this source
    await createAliasIfNotExists(exactMatch.id, name, source);
    return exactMatch.id;
  }

  // 3. Try fuzzy matching with high confidence threshold
  const fuzzyMatch = await fuzzyMatchTeam(name, 0.85);
  if (fuzzyMatch) {
    // Auto-learn: Create alias for high-confidence match
    await createAliasIfNotExists(fuzzyMatch.id, name, source);
    logger.info(`Auto-learned alias: "${name}" -> team ${fuzzyMatch.id} (${fuzzyMatch.similarity.toFixed(2)} confidence)`);
    return fuzzyMatch.id;
  }

  // 4. No match - create new team
  const [newTeam] = await db.insert(teams).values({ name: normalized }).returning();

  // Create alias for the original name
  await db.insert(teamAliases).values({
    teamId: newTeam!.id,
    alias: name,
    source,
  });

  // Invalidate teams cache since we added a new team
  invalidateTeamCaches();

  logger.info(`Created new team: "${normalized}" from source ${source}`);
  return newTeam!.id;
}

/**
 * Helper to create alias if it doesn't exist
 */
async function createAliasIfNotExists(
  teamId: string,
  alias: string,
  source: string
): Promise<void> {
  const db = getDb();

  try {
    await db
      .insert(teamAliases)
      .values({ teamId, alias, source })
      .onConflictDoNothing();
  } catch (error) {
    // Ignore duplicate errors
  }
}

/**
 * Fuzzy match against all teams in database
 * Uses cached team list for performance (refreshed every 5 min)
 */
export async function fuzzyMatchTeam(
  name: string,
  threshold = 0.85
): Promise<{ id: string; similarity: number } | null> {
  const normalized = normalizeTeamName(name);

  // Use cached teams for performance
  const allTeams = await getCachedTeams();

  let bestMatch: { id: string; similarity: number } | null = null;

  for (const team of allTeams) {
    const similarity = combinedSimilarity(normalized, team.name);

    if (similarity >= threshold) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { id: team.id, similarity };
      }
    }
  }

  return bestMatch;
}

/**
 * Bulk match multiple names efficiently
 * Useful when syncing many fixtures at once
 */
export async function bulkFindOrCreateTeams(
  names: Array<{ name: string; source: string }>
): Promise<Map<string, string>> {
  const db = getDb();
  const results = new Map<string, string>();

  // First, try to resolve all from aliases in one query
  const aliasResults = await db.query.teamAliases.findMany({
    where: sql`(${teamAliases.alias}, ${teamAliases.source}) IN (${sql.raw(
      names.map(n => `('${n.name.replace(/'/g, "''")}', '${n.source}')`).join(', ')
    )})`,
  });

  for (const alias of aliasResults) {
    results.set(alias.alias, alias.teamId);
  }

  // Process remaining names individually
  for (const { name, source } of names) {
    if (!results.has(name)) {
      const teamId = await findOrCreateTeam(name, source);
      results.set(name, teamId);
    }
  }

  return results;
}

/**
 * Manual alias management - for admin use
 */
export async function addManualAlias(
  teamId: string,
  alias: string,
  source = 'manual'
): Promise<void> {
  const db = getDb();

  await db
    .insert(teamAliases)
    .values({ teamId, alias, source })
    .onConflictDoNothing();
}

/**
 * Merge duplicate teams - for admin use
 * Moves all aliases from source team to target team
 */
export async function mergeTeams(
  targetTeamId: string,
  sourceTeamId: string
): Promise<void> {
  const db = getDb();

  // Move all aliases to target team
  await db
    .update(teamAliases)
    .set({ teamId: targetTeamId })
    .where(eq(teamAliases.teamId, sourceTeamId));

  // Note: Events and other references need to be updated separately
  logger.info(`Merged team ${sourceTeamId} into ${targetTeamId}`);
}
