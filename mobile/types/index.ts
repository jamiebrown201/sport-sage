// ============================================================================
// USER & AUTH
// ============================================================================

export type SubscriptionTier = 'free' | 'pro' | 'elite';

export interface User {
  id: string;
  username: string;
  email: string;
  coins: number;
  stars: number;
  gems: number;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt?: string;
  isAdsEnabled: boolean;
  isOver18: boolean;
  showAffiliates: boolean;
  createdAt: string;
}

export interface UserStats {
  userId: string;
  totalPredictions: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  totalStarsEarned: number;
  totalCoinsWagered: number;
  lastTopupDate?: string;
  lastAdDoubleTopup?: string;
  lastAdBonusStars?: string;
  lastAdPredictionBoost?: string;
  adsWatchedToday: number;
  hasPredictionBoost: boolean;
}

// ============================================================================
// SPORTS & EVENTS
// ============================================================================

export type SportSlug = 'football' | 'tennis' | 'darts' | 'cricket' | 'basketball' | 'golf' | 'boxing' | 'mma';

export interface Sport {
  id: string;
  name: string;
  slug: SportSlug;
  icon: string;
}

export type EventStatus = 'scheduled' | 'live' | 'finished' | 'cancelled';

export interface LiveScore {
  home: number;
  away: number;
  time?: string; // e.g., "45'" for football, "2nd Quarter" for basketball
  period?: string;
}

export interface Event {
  id: string;
  sport: Sport;
  competition: string;
  homeTeam?: string;
  awayTeam?: string;
  player1?: string;
  player2?: string;
  startTime: string;
  status: EventStatus;
  homeScore?: number;
  awayScore?: number;
  liveScore?: LiveScore;
  markets: Market[];
  sponsoredEvent?: SponsoredEvent;
}

export interface Market {
  id: string;
  type: 'match_winner';
  outcomes: Outcome[];
}

export interface Outcome {
  id: string;
  name: string;
  odds: number;
  isWinner?: boolean;
}

// ============================================================================
// PREDICTIONS
// ============================================================================

export type PredictionStatus = 'pending' | 'won' | 'lost' | 'void';

export interface Prediction {
  id: string;
  eventId: string;
  event: Event;
  outcomeId: string;
  outcome: Outcome;
  stake: number;
  potentialCoins: number;
  potentialStars: number;
  starsMultiplier: number;
  status: PredictionStatus;
  settledAt?: string;
  createdAt: string;
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export type TransactionType =
  | 'stake'
  | 'win'
  | 'topup'
  | 'welcome'
  | 'ad_reward'
  | 'gem_purchase'
  | 'gem_spend'
  | 'star_spend'
  | 'subscription';

export interface Transaction {
  id: string;
  type: TransactionType;
  coinsChange: number;
  starsChange: number;
  gemsChange: number;
  coinsAfter: number;
  starsAfter: number;
  gemsAfter: number;
  description: string;
  createdAt: string;
}

// ============================================================================
// LEADERBOARD
// ============================================================================

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalStarsEarned: number;
  winRate: number;
  avatarFrame?: string;
  isCurrentUser?: boolean;
}

// ============================================================================
// COSMETICS & SHOP
// ============================================================================

export type CosmeticCategory =
  | 'avatar_frame'
  | 'background'
  | 'card_skin'
  | 'victory_animation'
  | 'username_color'
  | 'emote'
  | 'badge';

export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CosmeticItem {
  id: string;
  name: string;
  description: string;
  category: CosmeticCategory;
  rarity: CosmeticRarity;
  starPrice?: number;
  gemPrice?: number;
  imageUrl: string;
  animationUrl?: string;
  isExclusive: boolean;
  isLimitedTime: boolean;
  availableUntil?: string;
}

export interface UserCosmetic {
  id: string;
  cosmeticId: string;
  cosmetic: CosmeticItem;
  currencyUsed: 'stars' | 'gems' | 'earned';
  pricePaid: number;
  isEquipped: boolean;
  equippedSlot?: CosmeticCategory;
  acquiredAt: string;
}

export interface EquippedCosmetics {
  avatarFrame?: CosmeticItem;
  background?: CosmeticItem;
  cardSkin?: CosmeticItem;
  victoryAnimation?: CosmeticItem;
  usernameColor?: string;
  badge?: CosmeticItem;
}

// ============================================================================
// MONETIZATION
// ============================================================================

export interface GemPack {
  id: string;
  name: string;
  gems: number;
  bonusPercent: number;
  priceGBP: number;
  priceUSD: number;
  storeProductId: string;
  isPopular?: boolean;
  isBestValue?: boolean;
}

export const GEM_PACKS: GemPack[] = [
  { id: 'gems_100', name: 'Starter', gems: 100, bonusPercent: 0, priceGBP: 1.99, priceUSD: 2.49, storeProductId: 'gems_100' },
  { id: 'gems_275', name: 'Popular', gems: 275, bonusPercent: 10, priceGBP: 4.99, priceUSD: 5.99, storeProductId: 'gems_275', isPopular: true },
  { id: 'gems_600', name: 'Best Value', gems: 600, bonusPercent: 20, priceGBP: 9.99, priceUSD: 12.99, storeProductId: 'gems_600', isBestValue: true },
  { id: 'gems_1300', name: 'Pro', gems: 1300, bonusPercent: 30, priceGBP: 19.99, priceUSD: 24.99, storeProductId: 'gems_1300' },
  { id: 'gems_3500', name: 'Ultimate', gems: 3500, bonusPercent: 40, priceGBP: 49.99, priceUSD: 64.99, storeProductId: 'gems_3500' },
];

export interface SubscriptionPlan {
  tier: 'pro' | 'elite';
  name: string;
  monthlyPriceGBP: number;
  yearlyPriceGBP: number;
  gemPriceMonthly: number;
  benefits: string[];
  starsMultiplier: number;
  dailyTopupAmount: number;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    tier: 'pro',
    name: 'Sage Pro',
    monthlyPriceGBP: 4.99,
    yearlyPriceGBP: 49.99,
    gemPriceMonthly: 500,
    benefits: [
      'Ad-free experience',
      '2x daily top-up (1,000 coins)',
      'Exclusive Pro badge',
      'Pro avatar frame',
    ],
    starsMultiplier: 1.0,
    dailyTopupAmount: 1000,
  },
  {
    tier: 'elite',
    name: 'Sage Elite',
    monthlyPriceGBP: 9.99,
    yearlyPriceGBP: 99.99,
    gemPriceMonthly: 900,
    benefits: [
      'Everything in Pro',
      '1.25x stars on all wins',
      'Animated Elite avatar frame',
      'Priority support',
      'Early access to features',
    ],
    starsMultiplier: 1.25,
    dailyTopupAmount: 1000,
  },
];

// ============================================================================
// REWARDED ADS
// ============================================================================

export type AdRewardType =
  | 'double_topup'
  | 'bonus_stars'
  | 'prediction_boost'
  | 'rescue_coins'
  | 'extra_events';

export interface AdReward {
  type: AdRewardType;
  title: string;
  description: string;
  rewardAmount: number;
  rewardCurrency: 'coins' | 'stars' | 'multiplier';
  dailyLimit: number;
  icon: string;
}

export const AD_REWARDS: AdReward[] = [
  { type: 'double_topup', title: 'Double Top-up', description: 'Get 1,000 coins instead of 500', rewardAmount: 500, rewardCurrency: 'coins', dailyLimit: 1, icon: '🪙' },
  { type: 'bonus_stars', title: 'Bonus Stars', description: 'Earn 50 free stars', rewardAmount: 50, rewardCurrency: 'stars', dailyLimit: 3, icon: '⭐' },
  { type: 'prediction_boost', title: 'Prediction Boost', description: '1.2x stars on your next win', rewardAmount: 1.2, rewardCurrency: 'multiplier', dailyLimit: 1, icon: '🚀' },
  { type: 'rescue_coins', title: 'Rescue Coins', description: 'Emergency 200 coins when broke', rewardAmount: 200, rewardCurrency: 'coins', dailyLimit: 1, icon: '🆘' },
];

// ============================================================================
// SPONSORED EVENTS
// ============================================================================

export interface SponsoredEvent {
  id: string;
  sponsorName: string;
  sponsorLogoUrl: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  prizeDescription: string;
  brandingColor: string;
}

// ============================================================================
// AFFILIATE
// ============================================================================

export interface AffiliatePartner {
  id: string;
  name: string;
  logoUrl: string;
  description: string;
  ctaText: string;
  url: string;
  category: 'betting' | 'fantasy' | 'streaming';
}

// ============================================================================
// CHALLENGES
// ============================================================================

export type ChallengeType =
  | 'win_predictions'
  | 'place_predictions'
  | 'win_accumulator'
  | 'predict_sport'
  | 'predict_live'
  | 'win_streak'
  | 'high_odds';

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

export interface Challenge {
  id: string;
  type: ChallengeType;
  difficulty: ChallengeDifficulty;
  title: string;
  description: string;
  iconName: string;
  targetValue: number;
  sportSlug?: SportSlug;
  minOdds?: number;
  rewardCoins: number;
  rewardStars: number;
  rewardGems: number;
  expiresAt: string;
}

export interface UserChallengeProgress {
  challengeId: string;
  challenge: Challenge;
  currentValue: number;
  isCompleted: boolean;
  isClaimed: boolean;
  completedAt?: string;
}

// ============================================================================
// ACHIEVEMENTS
// ============================================================================

export type AchievementCategory =
  | 'predictions'
  | 'wins'
  | 'streaks'
  | 'sports'
  | 'collector';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface Achievement {
  id: string;
  category: AchievementCategory;
  tier: AchievementTier;
  name: string;
  description: string;
  iconName: string;
  targetValue: number;
  rewardCoins: number;
  rewardStars: number;
  rewardGems: number;
  nextTierId?: string;
}

export interface UserAchievement {
  achievementId: string;
  achievement: Achievement;
  currentProgress: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  isClaimed: boolean;
}

// ============================================================================
// FRIENDS
// ============================================================================

export type FriendStatus = 'pending' | 'accepted' | 'blocked';

export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  username: string;
  avatarUrl?: string;
  status: FriendStatus;
  totalStarsEarned: number;
  winRate: number;
  currentStreak: number;
  bestStreak?: number;
  favoriteSport?: SportSlug;
  isOnline?: boolean;
  lastActive?: string;
  addedAt: string;
}

export type FriendActivityType =
  | 'prediction_placed'
  | 'prediction_won'
  | 'prediction_lost'
  | 'accumulator_placed'
  | 'accumulator_won'
  | 'achievement_unlocked'
  | 'streak_milestone';

export interface FriendActivity {
  id: string;
  friendId: string;
  friendUsername: string;
  friendAvatarUrl?: string;
  type: FriendActivityType;
  description: string;
  eventName?: string;
  outcome?: string;
  odds?: number;
  coinsWon?: number;
  starsEarned?: number;
  achievementName?: string;
  streakCount?: number;
  createdAt: string;
}

export interface FriendPrediction {
  id: string;
  friendId: string;
  friendUsername: string;
  friendAvatarUrl?: string;
  eventId: string;
  event: Event;
  outcome: Outcome;
  stake: number;
  placedAt: string;
}

// ============================================================================
// STREAK SHIELDS
// ============================================================================

export interface StreakShield {
  id: string;
  name: string;
  description: string;
  gemPrice: number;
  shieldsProvided: number;
  iconName: string;
}

export const STREAK_SHIELDS: StreakShield[] = [
  { id: 'shield_1', name: 'Single Shield', description: 'Protect your streak from 1 loss', gemPrice: 25, shieldsProvided: 1, iconName: 'shield' },
  { id: 'shield_3', name: 'Triple Shield', description: 'Protect your streak from 3 losses', gemPrice: 60, shieldsProvided: 3, iconName: 'shield-star' },
  { id: 'shield_7', name: 'Weekly Shield', description: 'Protect your streak for 7 losses', gemPrice: 120, shieldsProvided: 7, iconName: 'shield-crown' },
];

// ============================================================================
// PREDICTION INSIGHTS
// ============================================================================

export interface SportInsight {
  sportSlug: SportSlug;
  sportName: string;
  totalPredictions: number;
  wins: number;
  losses: number;
  winRate: number;
  profit: number;
  avgOdds: number;
  bestWin?: {
    eventName: string;
    odds: number;
    coinsWon: number;
  };
}

export interface PredictionInsights {
  overallWinRate: number;
  totalProfit: number;
  avgOdds: number;
  favoriteTime: string;
  sportInsights: SportInsight[];
  weeklyPerformance: {
    week: string;
    winRate: number;
    predictions: number;
  }[];
}

// ============================================================================
// REFERRALS
// ============================================================================

export interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  referredUsername: string;
  bonusCoins: number;
  bonusStars: number;
  status: 'pending' | 'completed';
  createdAt: string;
  completedAt?: string;
}

export interface ReferralStats {
  totalReferrals: number;
  pendingReferrals: number;
  completedReferrals: number;
  totalCoinsEarned: number;
  totalStarsEarned: number;
  referralCode: string;
}

export const REFERRAL_REWARDS = {
  referrerCoins: 500,
  referrerStars: 100,
  referredCoins: 1000,
  referredStars: 50,
};

// ============================================================================
// SETTINGS
// ============================================================================

export interface UserSettings {
  notifications: {
    predictions: boolean;
    challenges: boolean;
    friends: boolean;
    marketing: boolean;
  };
  appearance: {
    theme: 'dark' | 'light' | 'system';
  };
  privacy: {
    showOnLeaderboard: boolean;
    showActivityToFriends: boolean;
    allowFriendRequests: boolean;
  };
}

export const DEFAULT_SETTINGS: UserSettings = {
  notifications: {
    predictions: true,
    challenges: true,
    friends: true,
    marketing: false,
  },
  appearance: {
    theme: 'dark',
  },
  privacy: {
    showOnLeaderboard: true,
    showActivityToFriends: true,
    allowFriendRequests: true,
  },
};

// ============================================================================
// MARKET TYPES (Extended)
// ============================================================================

export type MarketType =
  | 'match_winner'
  | 'over_under'
  | 'both_teams_score'
  | 'handicap'
  | 'correct_score'
  | 'first_goalscorer';

export interface ExtendedMarket {
  id: string;
  type: MarketType;
  name: string;
  line?: number; // For over/under and handicap
  outcomes: Outcome[];
}

// ============================================================================
// ACCUMULATORS
// ============================================================================

export type AccumulatorStatus = 'building' | 'placed' | 'won' | 'lost' | 'partial' | 'void';

export interface AccumulatorSelection {
  id: string;
  eventId: string;
  event: Event;
  outcomeId: string;
  outcome: Outcome;
  odds: number;
  status: 'pending' | 'won' | 'lost' | 'void';
}

export interface Accumulator {
  id: string;
  selections: AccumulatorSelection[];
  stake: number;
  totalOdds: number;
  potentialCoins: number;
  potentialStars: number;
  starsMultiplier: number;
  status: AccumulatorStatus;
  placedAt?: string;
  settledAt?: string;
  createdAt: string;
}

// Accumulator limits
export const ACCUMULATOR_LIMITS = {
  minSelections: 2,
  maxSelections: 10,
  minStake: 10,
  maxStake: 500,
  bonusMultipliers: {
    2: 1.0,    // No bonus for 2-fold
    3: 1.05,   // 5% bonus for 3-fold
    4: 1.10,   // 10% bonus
    5: 1.15,   // 15% bonus
    6: 1.20,   // 20% bonus
    7: 1.30,   // 30% bonus
    8: 1.40,   // 40% bonus
    9: 1.50,   // 50% bonus
    10: 1.75,  // 75% bonus for max 10-fold
  } as Record<number, number>,
};

// ============================================================================
// AUTH CONTEXT
// ============================================================================

export interface AuthContextType {
  user: User | null;
  stats: UserStats | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  pendingSocialAuth: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  setUsername: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  updateStats: (updates: Partial<UserStats>) => void;
  completeOnboarding: () => Promise<void>;
}

// ============================================================================
// WALLET CONTEXT
// ============================================================================

export interface WalletContextType {
  coins: number;
  stars: number;
  gems: number;
  addCoins: (amount: number) => void;
  deductCoins: (amount: number) => boolean;
  addStars: (amount: number) => void;
  addGems: (amount: number) => void;
  deductGems: (amount: number) => boolean;
  canAfford: (amount: number) => boolean;
}
