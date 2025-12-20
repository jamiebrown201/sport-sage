export const colors = {
  // Backgrounds
  background: '#0D1B2A',
  card: '#1B263B',
  cardElevated: '#243447',

  // Accent
  primary: '#FFD600',
  primaryDim: 'rgba(255, 214, 0, 0.1)',
  primaryMuted: 'rgba(255, 214, 0, 0.3)',

  // Currency
  coins: '#FFD700',
  stars: '#FFF9C4',
  gems: '#E040FB',
  gemsDim: 'rgba(224, 64, 251, 0.1)',

  // Subscription tiers
  tierPro: '#4FC3F7',
  tierElite: '#FFD700',

  // Rarity colors (for cosmetics)
  rarityCommon: '#9E9E9E',
  rarityRare: '#2196F3',
  rarityEpic: '#9C27B0',
  rarityLegendary: '#FF9800',

  // Semantic
  success: '#4CAF50',
  error: '#EF5350',
  warning: '#FF9800',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0AEC0',
  textMuted: '#718096',

  // Odds coloring
  oddsHigh: '#FF6B6B',
  oddsMedium: '#FFD93D',
  oddsLow: '#6BCB77',

  // Sponsor
  sponsorBadge: '#00BCD4',

  // Borders
  border: '#2D3748',
  borderLight: '#4A5568',
} as const;

export type ColorName = keyof typeof colors;

export function getOddsColor(odds: number): string {
  if (odds >= 3.0) return colors.oddsHigh;
  if (odds >= 2.0) return colors.oddsMedium;
  return colors.oddsLow;
}

export function getRarityColor(rarity: 'common' | 'rare' | 'epic' | 'legendary'): string {
  const rarityColors = {
    common: colors.rarityCommon,
    rare: colors.rarityRare,
    epic: colors.rarityEpic,
    legendary: colors.rarityLegendary,
  };
  return rarityColors[rarity];
}
