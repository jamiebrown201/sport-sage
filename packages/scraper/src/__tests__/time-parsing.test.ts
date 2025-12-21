import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to test the parseTime logic - extract it for testing
// This tests the time parsing patterns used by the Flashscore scraper

describe('Time Parsing', () => {
  // Simulate the live indicators check
  const liveIndicators = [
    /^\d{1,3}['+]?\d*$/, // "45", "45+", "45+2", "67'"
    /^HT$/i,
    /^Half\s*Time$/i,
    /^FT$/i,
    /^Finished$/i,
    /^AET$/i,
    /^Pen\.?$/i,
    /^Break$/i,
    /^\d+(st|nd|rd|th)$/i,
    /^Q[1-4]$/i,
    /^Set\s?\d$/i,
    /^Live$/i,
    /^Playing$/i,
    /^Postp\.?$/i,
    /^Canc\.?$/i,
    /^Awarded$/i,
    /^W\.?O\.?$/i,
    /^Not Started$/i,
    /^Delayed$/i,
    /^Interrupted$/i,
    /^Abandoned$/i,
  ];

  function isLiveIndicator(text: string): boolean {
    const trimmed = text.trim();
    return liveIndicators.some((pattern) => pattern.test(trimmed));
  }

  function cleanTimeText(text: string): string {
    return text.replace(/^(\d{1,2}:\d{2}(?:\s+\d{1,2}\.\d{1,2}\.?)?).*$/, '$1').trim();
  }

  describe('Live indicator detection', () => {
    it('should detect minute indicators as live', () => {
      expect(isLiveIndicator('45')).toBe(true);
      expect(isLiveIndicator('45+')).toBe(true);
      expect(isLiveIndicator('45+2')).toBe(true);
      expect(isLiveIndicator("67'")).toBe(true);
      expect(isLiveIndicator('90')).toBe(true);
    });

    it('should detect half time indicators', () => {
      expect(isLiveIndicator('HT')).toBe(true);
      expect(isLiveIndicator('ht')).toBe(true);
      expect(isLiveIndicator('Half Time')).toBe(true);
      expect(isLiveIndicator('HalfTime')).toBe(true);
    });

    it('should detect full time/finished indicators', () => {
      expect(isLiveIndicator('FT')).toBe(true);
      expect(isLiveIndicator('Finished')).toBe(true);
      expect(isLiveIndicator('AET')).toBe(true);
    });

    it('should detect other match states', () => {
      expect(isLiveIndicator('Pen')).toBe(true);
      expect(isLiveIndicator('Pen.')).toBe(true);
      expect(isLiveIndicator('Break')).toBe(true);
      expect(isLiveIndicator('1st')).toBe(true);
      expect(isLiveIndicator('2nd')).toBe(true);
      expect(isLiveIndicator('Q1')).toBe(true);
      expect(isLiveIndicator('Set 1')).toBe(true);
      expect(isLiveIndicator('Live')).toBe(true);
      expect(isLiveIndicator('Postp.')).toBe(true);
      expect(isLiveIndicator('Canc.')).toBe(true);
    });

    it('should NOT detect scheduled times as live', () => {
      expect(isLiveIndicator('13:00')).toBe(false);
      expect(isLiveIndicator('20:45')).toBe(false);
      expect(isLiveIndicator('09:30')).toBe(false);
    });
  });

  describe('Time text cleaning', () => {
    it('should extract time from text with trailing content', () => {
      expect(cleanTimeText('13:00FRO')).toBe('13:00');
      expect(cleanTimeText('16:30Postponed')).toBe('16:30');
      expect(cleanTimeText('20:45abc')).toBe('20:45');
    });

    it('should preserve clean time text', () => {
      expect(cleanTimeText('13:00')).toBe('13:00');
      expect(cleanTimeText('09:30')).toBe('09:30');
      expect(cleanTimeText('23:59')).toBe('23:59');
    });

    it('should handle date+time format', () => {
      expect(cleanTimeText('21.12. 15:00')).toBe('21.12. 15:00');
      // Note: The regex is designed for simpler cases - complex trailing text
      // is handled by the live indicator check in the actual implementation
      expect(cleanTimeText('25.12. 20:30')).toBe('25.12. 20:30');
    });
  });
});

describe('CET Timezone Handling', () => {
  function getCETOffset(date: Date): number {
    const year = date.getUTCFullYear();

    // Find last Sunday of March
    const marchLast = new Date(Date.UTC(year, 2, 31));
    const dstStart = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay(), 1, 0));

    // Find last Sunday of October
    const octLast = new Date(Date.UTC(year, 9, 31));
    const dstEnd = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay(), 1, 0));

    if (date >= dstStart && date < dstEnd) {
      return 2 * 60 * 60 * 1000; // CEST: +2 hours
    }
    return 1 * 60 * 60 * 1000; // CET: +1 hour
  }

  it('should return CET (+1) offset in winter', () => {
    const winterDate = new Date(Date.UTC(2024, 0, 15, 12, 0)); // January 15
    expect(getCETOffset(winterDate)).toBe(1 * 60 * 60 * 1000);
  });

  it('should return CEST (+2) offset in summer', () => {
    const summerDate = new Date(Date.UTC(2024, 6, 15, 12, 0)); // July 15
    expect(getCETOffset(summerDate)).toBe(2 * 60 * 60 * 1000);
  });

  it('should handle DST transition in March', () => {
    // 2024: Last Sunday of March is March 31
    const beforeDST = new Date(Date.UTC(2024, 2, 31, 0, 0)); // Before 1:00 UTC
    const afterDST = new Date(Date.UTC(2024, 2, 31, 2, 0)); // After 1:00 UTC

    expect(getCETOffset(beforeDST)).toBe(1 * 60 * 60 * 1000); // Still CET
    expect(getCETOffset(afterDST)).toBe(2 * 60 * 60 * 1000); // Now CEST
  });

  it('should handle DST transition in October', () => {
    // 2024: Last Sunday of October is October 27
    const beforeDST = new Date(Date.UTC(2024, 9, 27, 0, 0)); // Before 1:00 UTC
    const afterDST = new Date(Date.UTC(2024, 9, 27, 2, 0)); // After 1:00 UTC

    expect(getCETOffset(beforeDST)).toBe(2 * 60 * 60 * 1000); // Still CEST
    expect(getCETOffset(afterDST)).toBe(1 * 60 * 60 * 1000); // Now CET
  });
});
