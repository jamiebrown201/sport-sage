import { describe, it, expect } from 'vitest';
import {
  normalizeTeamName,
  calculateSimilarity,
  combinedSimilarity,
} from '../normalization/team-names';

describe('Team Name Normalization', () => {
  describe('normalizeTeamName', () => {
    it('should remove common prefixes', () => {
      expect(normalizeTeamName('FC Barcelona')).toBe('Barcelona');
      expect(normalizeTeamName('AC Milan')).toBe('Milan');
      expect(normalizeTeamName('AS Roma')).toBe('Roma');
      expect(normalizeTeamName('SC Freiburg')).toBe('Freiburg');
      expect(normalizeTeamName('NK Maribor')).toBe('Maribor');
    });

    it('should remove common suffixes', () => {
      expect(normalizeTeamName('Liverpool FC')).toBe('Liverpool');
      expect(normalizeTeamName('Chelsea FC')).toBe('Chelsea');
      expect(normalizeTeamName('Newcastle United AFC')).toBe('Newcastle United');
    });

    it('should remove brackets/parentheses', () => {
      expect(normalizeTeamName('Manchester United (ENG)')).toBe('Manchester United');
      expect(normalizeTeamName('Bayern Munich [GER]')).toBe('Bayern Munich');
    });

    it('should remove year suffixes', () => {
      expect(normalizeTeamName('Inter Miami 2024')).toBe('Inter Miami');
    });

    it('should normalize multiple spaces', () => {
      expect(normalizeTeamName('Manchester   United')).toBe('Manchester United');
    });

    it('should handle complex names', () => {
      expect(normalizeTeamName('FC Bayern Munich (GER)')).toBe('Bayern Munich');
      expect(normalizeTeamName('The Arsenal FC')).toBe('Arsenal');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(calculateSimilarity('Manchester United', 'Manchester United')).toBe(1);
    });

    it('should return high similarity for minor differences', () => {
      const sim = calculateSimilarity('Manchester Utd', 'Manchester United');
      expect(sim).toBeGreaterThan(0.7);
    });

    it('should return low similarity for different teams', () => {
      const sim = calculateSimilarity('Barcelona', 'Real Madrid');
      expect(sim).toBeLessThan(0.5);
    });

    it('should handle case insensitivity', () => {
      expect(calculateSimilarity('BARCELONA', 'barcelona')).toBe(1);
    });

    it('should handle apostrophes', () => {
      expect(calculateSimilarity("Queen's Park Rangers", 'Queens Park Rangers')).toBe(1);
    });
  });

  describe('combinedSimilarity', () => {
    it('should give some credit for token overlap', () => {
      // "Manchester United" vs "United Manchester" - same tokens, different order
      const sim = combinedSimilarity('Manchester United', 'United Manchester');
      // Token similarity helps but Levenshtein is still low
      expect(sim).toBeGreaterThan(0.3);
    });

    it('should handle partial name matches', () => {
      const sim = combinedSimilarity('Man United', 'Manchester United');
      // "Man" is a substring of "Manchester", so some similarity
      expect(sim).toBeGreaterThan(0.4);
    });

    it('should correctly identify clearly different teams', () => {
      expect(combinedSimilarity('Barcelona', 'Real Madrid')).toBeLessThan(0.3);
      expect(combinedSimilarity('Liverpool', 'Manchester City')).toBeLessThan(0.3);
    });

    it('should match when one name contains the other', () => {
      // When normalized, these should be close
      expect(combinedSimilarity('Arsenal', 'Arsenal FC')).toBeGreaterThan(0.7);
      expect(combinedSimilarity('Chelsea', 'Chelsea FC')).toBeGreaterThan(0.7);
    });
  });
});

describe('Cross-Source Matching', () => {
  // Test that names from different sources can be matched
  // Note: Low-similarity matches rely on database aliases, not the algorithm
  const testCases = [
    // [Flashscore name, Sofascore name, expected to pass 0.4 threshold (fuzzy), expected to pass 0.85 (high confidence)]
    ['Manchester United', 'Man United', true, false],
    ['FC Barcelona', 'Barcelona', true, true], // Same after normalization
    ['Borussia Dortmund', 'Dortmund', false, false], // Needs alias
    ['Paris Saint-Germain', 'Paris SG', false, false], // Needs alias
    ['Inter Milan', 'Internazionale', false, false], // Too different
    ['Bayern Munich', 'FC Bayern München', true, false], // Partial match
    ['Liverpool', 'Liverpool FC', true, true], // Same after normalization
  ];

  testCases.forEach(([name1, name2, shouldPassLow, shouldPassHigh]) => {
    it(`"${name1}" vs "${name2}" - fuzzy match: ${shouldPassLow}, high confidence: ${shouldPassHigh}`, () => {
      const normalized1 = normalizeTeamName(name1 as string);
      const normalized2 = normalizeTeamName(name2 as string);
      const similarity = combinedSimilarity(normalized1, normalized2);

      if (shouldPassHigh) {
        expect(similarity).toBeGreaterThanOrEqual(0.85);
      } else if (shouldPassLow) {
        expect(similarity).toBeGreaterThan(0.4);
      } else {
        expect(similarity).toBeLessThan(0.5);
      }
    });
  });

  it('should rely on database aliases for nicknames and abbreviations', () => {
    // These require manual aliases in the database
    const needAliases = [
      ['Spurs', 'Tottenham Hotspur'],
      ['Wolves', 'Wolverhampton Wanderers'],
      ['Man City', 'Manchester City'],
      ['PSG', 'Paris Saint-Germain'],
    ];

    needAliases.forEach(([alias, fullName]) => {
      const similarity = combinedSimilarity(alias, fullName);
      // Algorithm can't match these - that's expected
      expect(similarity).toBeLessThan(0.5);
    });
  });
});
