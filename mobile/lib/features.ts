// Feature flags for Sport Sage
// Enables gradual rollout of features and "Coming Soon" states

export const FEATURES = {
  // ============================================================================
  // MVP - Enabled Features
  // ============================================================================
  auth: true,
  events: true,
  predictions: true,
  wallet: true,
  leaderboard: true,
  dailyTopup: true,

  // ============================================================================
  // Coming Soon - Disabled Features
  // ============================================================================
  accumulators: false,
  challenges: false,
  achievements: false,
  friends: false,
  shop: false,
  ads: false,
  socialLogin: false,
  pushNotifications: false,
  referrals: false,
  streakBonuses: false,
  liveScores: false,
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isFeatureEnabled(feature: FeatureName): boolean {
  return FEATURES[feature] === true;
}

export function isComingSoon(feature: FeatureName): boolean {
  return FEATURES[feature] === false;
}

// Feature descriptions for Coming Soon UI
export const FEATURE_INFO: Record<FeatureName, { title: string; description: string }> = {
  auth: {
    title: 'Authentication',
    description: 'Sign in with email and password',
  },
  events: {
    title: 'Events',
    description: 'Browse and predict on sports events',
  },
  predictions: {
    title: 'Predictions',
    description: 'Make predictions and track your results',
  },
  wallet: {
    title: 'Wallet',
    description: 'Manage your coins, stars, and gems',
  },
  leaderboard: {
    title: 'Leaderboard',
    description: 'See how you rank against other players',
  },
  dailyTopup: {
    title: 'Daily Top-up',
    description: 'Get free coins every day',
  },
  accumulators: {
    title: 'Accumulators',
    description: 'Build multi-bet parlays for bigger wins',
  },
  challenges: {
    title: 'Daily Challenges',
    description: 'Complete challenges for bonus rewards',
  },
  achievements: {
    title: 'Achievements',
    description: 'Unlock achievements as you play',
  },
  friends: {
    title: 'Friends',
    description: 'Connect with friends and compete',
  },
  shop: {
    title: 'Shop',
    description: 'Purchase gems and cosmetic items',
  },
  ads: {
    title: 'Rewarded Ads',
    description: 'Watch ads for bonus coins and boosts',
  },
  socialLogin: {
    title: 'Social Login',
    description: 'Sign in with Apple or Google',
  },
  pushNotifications: {
    title: 'Notifications',
    description: 'Get notified about your predictions',
  },
  referrals: {
    title: 'Referrals',
    description: 'Invite friends for bonus rewards',
  },
  streakBonuses: {
    title: 'Streak Bonuses',
    description: 'Earn extra rewards for winning streaks',
  },
  liveScores: {
    title: 'Live Scores',
    description: 'Real-time score updates during matches',
  },
};
