// API interface for Sport Sage
// Currently uses mock data, but designed to easily swap to real AWS endpoints

import {
  User,
  UserStats,
  Event,
  Prediction,
  Transaction,
  LeaderboardEntry,
  CosmeticItem,
  GemPack,
} from '@/types';
import {
  CURRENT_USER,
  CURRENT_USER_STATS,
  EVENTS,
  PREDICTIONS,
  TRANSACTIONS,
  LEADERBOARD,
} from './mock-data';

// Simulated API delay
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// AUTH
// ============================================================================

export async function login(email: string, password: string): Promise<{ user: User; stats: UserStats }> {
  await delay(500);
  // Mock: Accept any credentials
  return {
    user: { ...CURRENT_USER, email },
    stats: { ...CURRENT_USER_STATS },
  };
}

export async function register(
  username: string,
  email: string,
  password: string
): Promise<{ user: User; stats: UserStats }> {
  await delay(500);
  const newUser: User = {
    id: `user_${Date.now()}`,
    username,
    email,
    coins: 1000,
    stars: 0,
    gems: 0,
    subscriptionTier: 'free',
    isAdsEnabled: true,
    isOver18: true,
    showAffiliates: false,
    createdAt: new Date().toISOString(),
  };
  const newStats: UserStats = {
    userId: newUser.id,
    totalPredictions: 0,
    totalWins: 0,
    totalLosses: 0,
    winRate: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalStarsEarned: 0,
    totalCoinsWagered: 0,
    adsWatchedToday: 0,
    hasPredictionBoost: false,
  };
  return { user: newUser, stats: newStats };
}

export async function logout(): Promise<void> {
  await delay(200);
}

// ============================================================================
// EVENTS
// ============================================================================

export async function getEvents(): Promise<Event[]> {
  await delay(300);
  return EVENTS;
}

export async function getEventById(id: string): Promise<Event | null> {
  await delay(200);
  return EVENTS.find((e) => e.id === id) ?? null;
}

export async function getEventsBySport(sportSlug: string): Promise<Event[]> {
  await delay(300);
  return EVENTS.filter((e) => e.sport.slug === sportSlug);
}

// ============================================================================
// PREDICTIONS
// ============================================================================

export async function createPrediction(
  eventId: string,
  outcomeId: string,
  stake: number
): Promise<Prediction> {
  await delay(500);
  const event = EVENTS.find((e) => e.id === eventId);
  if (!event) throw new Error('Event not found');

  const outcome = event.markets[0]?.outcomes.find((o) => o.id === outcomeId);
  if (!outcome) throw new Error('Outcome not found');

  const potentialCoins = Math.floor(stake * outcome.odds);
  const potentialStars = Math.floor(potentialCoins - stake);

  const prediction: Prediction = {
    id: `pred_${Date.now()}`,
    eventId,
    event,
    outcomeId,
    outcome,
    stake,
    potentialCoins,
    potentialStars,
    starsMultiplier: 1.0,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  return prediction;
}

export async function getPredictions(): Promise<Prediction[]> {
  await delay(300);
  return PREDICTIONS;
}

export async function getPendingPredictions(): Promise<Prediction[]> {
  await delay(200);
  return PREDICTIONS.filter((p) => p.status === 'pending');
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export async function getTransactions(): Promise<Transaction[]> {
  await delay(300);
  return TRANSACTIONS;
}

export async function createTransaction(
  type: Transaction['type'],
  coinsChange: number,
  starsChange: number,
  description: string
): Promise<Transaction> {
  await delay(200);
  const transaction: Transaction = {
    id: `txn_${Date.now()}`,
    type,
    coinsChange,
    starsChange,
    gemsChange: 0,
    coinsAfter: 0, // Would be calculated server-side
    starsAfter: 0,
    gemsAfter: 0,
    description,
    createdAt: new Date().toISOString(),
  };
  return transaction;
}

// ============================================================================
// LEADERBOARD
// ============================================================================

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  await delay(300);
  return LEADERBOARD;
}

// ============================================================================
// SHOP (Mock)
// ============================================================================

export async function purchaseGemPack(packId: string): Promise<{ success: boolean; gems: number }> {
  await delay(1000); // Simulate payment processing
  const pack = require('@/types').GEM_PACKS.find((p: GemPack) => p.id === packId);
  if (!pack) throw new Error('Pack not found');
  return { success: true, gems: pack.gems };
}

export async function purchaseCosmetic(
  cosmeticId: string,
  currency: 'stars' | 'gems'
): Promise<{ success: boolean }> {
  await delay(500);
  return { success: true };
}

// ============================================================================
// ADS (Mock)
// ============================================================================

export async function watchRewardedAd(adType: string): Promise<{ success: boolean; reward: number }> {
  // Simulate watching an ad
  await delay(3000);
  const rewards: Record<string, number> = {
    double_topup: 500,
    bonus_stars: 50,
    prediction_boost: 1.2,
    rescue_coins: 200,
  };
  return { success: true, reward: rewards[adType] ?? 0 };
}

// ============================================================================
// USER PROFILE
// ============================================================================

export async function updateProfile(updates: Partial<User>): Promise<User> {
  await delay(300);
  return { ...CURRENT_USER, ...updates };
}

export async function claimDailyTopup(): Promise<{ coinsAdded: number }> {
  await delay(300);
  return { coinsAdded: 500 };
}
