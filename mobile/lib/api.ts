// API interface for Sport Sage
// Uses real AWS endpoints with Cognito authentication

import { httpClient, ApiError, isApiError, getApiErrorMessage } from './api/client';

// Re-export error utilities
export { isApiError, getApiErrorMessage };
export type { ApiError };

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  cognitoId: string;
  username: string;
  email: string;
  coins: number;
  stars: number;
  gems: number;
  subscriptionTier: 'free' | 'pro' | 'elite';
  isAdsEnabled: boolean;
  isOver18: boolean;
  showAffiliates: boolean;
  avatarUrl: string | null;
  referralCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  userId?: string;
  totalPredictions: number;
  totalWins: number;
  totalLosses: number;
  winRate?: number;
  currentStreak: number;
  bestStreak: number;
  totalStarsEarned: number;
  totalCoinsWagered: number;
}

export interface Sport {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  eventCount?: number;
}

export interface Competition {
  id: string;
  name: string;
  shortName: string | null;
  country: string | null;
}

export interface Outcome {
  id: string;
  name: string;
  odds: number;
  previousOdds: number | null;
  isSuspended: boolean;
  isWinner?: boolean | null;
}

export interface Market {
  id: string;
  type: string;
  name: string | null;
  line: number | null;
  isSuspended: boolean;
  isMainMarket: boolean;
  outcomes: Outcome[];
}

export interface Event {
  id: string;
  sport: Sport | null;
  competition: Competition | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  player1Name: string | null;
  player2Name: string | null;
  startTime: string;
  status: 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed';
  homeScore: number | null;
  awayScore: number | null;
  period: string | null;
  minute: number | null;
  isFeatured: boolean;
  predictionCount: number;
  markets: Market[];
  sponsoredEvent?: {
    sponsorName: string;
    sponsorLogoUrl: string;
    title: string;
    description: string | null;
    bonusStarsMultiplier: number;
  } | null;
}

export interface Prediction {
  id: string;
  type: 'single' | 'accumulator';
  stake: number;
  odds: number;
  totalOdds: number;
  potentialCoins: number;
  potentialStars: number;
  status: 'pending' | 'won' | 'lost' | 'void' | 'cashout';
  settledCoins: number | null;
  settledStars: number | null;
  settledAt: string | null;
  createdAt: string;
  event: {
    id: string;
    homeTeamName: string | null;
    awayTeamName: string | null;
    player1Name: string | null;
    player2Name: string | null;
    startTime: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
  } | null;
  outcome: {
    id: string;
    name: string;
    odds: number;
    isWinner: boolean | null;
  } | null;
}

export interface Transaction {
  id: string;
  type: string;
  currency: 'coins' | 'stars' | 'gems';
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  stars: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  isCurrentUser: boolean;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// ============================================================================
// AUTH
// ============================================================================

export async function register(username: string): Promise<{ user: User; stats: UserStats }> {
  return httpClient.post('/api/auth/register', { username });
}

export async function getMe(): Promise<{ user: User; stats: UserStats }> {
  return httpClient.get('/api/auth/me');
}

export async function updateProfile(updates: Partial<Pick<User, 'isOver18' | 'showAffiliates' | 'avatarUrl'>>): Promise<{ user: User; stats: UserStats }> {
  return httpClient.patch('/api/auth/me', updates);
}

export async function checkUsername(username: string): Promise<{ username: string; available: boolean }> {
  return httpClient.get(`/api/auth/check-username/${username}`, { requiresAuth: false });
}

// ============================================================================
// EVENTS
// ============================================================================

export interface GetEventsParams {
  sport?: string;
  status?: string;
  date?: string;
  page?: number;
  pageSize?: number;
}

export async function getEvents(params?: GetEventsParams): Promise<{ data: Event[]; pagination: Pagination }> {
  return httpClient.get('/api/events', { params: params as Record<string, string | number | undefined> });
}

export async function getEventById(id: string): Promise<{ data: Event }> {
  return httpClient.get(`/api/events/${id}`);
}

export async function getEventsBySport(sportSlug: string): Promise<{ data: Event[]; pagination: Pagination }> {
  return getEvents({ sport: sportSlug });
}

export async function getFeaturedEvents(): Promise<{ data: Event[] }> {
  return httpClient.get('/api/events/featured');
}

export async function getSports(): Promise<{ data: Sport[] }> {
  return httpClient.get('/api/events/sports');
}

// ============================================================================
// PREDICTIONS
// ============================================================================

export interface CreatePredictionParams {
  eventId: string;
  outcomeId: string;
  stake: number;
}

export async function createPrediction(params: CreatePredictionParams): Promise<{ prediction: Prediction; newBalance: number }> {
  return httpClient.post('/api/predictions', params);
}

export async function getPredictions(params?: { status?: string; page?: number; pageSize?: number }): Promise<{ data: Prediction[]; pagination: Pagination }> {
  return httpClient.get('/api/predictions', { params: params as Record<string, string | number | undefined> });
}

export async function getPendingPredictions(): Promise<{ data: Prediction[]; pagination: Pagination }> {
  return getPredictions({ status: 'pending' });
}

export async function getPredictionById(id: string): Promise<{ data: Prediction }> {
  return httpClient.get(`/api/predictions/${id}`);
}

export async function getPredictionStats(): Promise<UserStats> {
  return httpClient.get('/api/predictions/stats');
}

// ============================================================================
// WALLET
// ============================================================================

export interface Wallet {
  coins: number;
  stars: number;
  gems: number;
  subscriptionTier: 'free' | 'pro' | 'elite';
  canClaimDailyTopup: boolean;
  nextTopupAt: string | null;
}

export async function getWallet(): Promise<Wallet> {
  return httpClient.get('/api/wallet');
}

export async function getTransactions(params?: { page?: number; pageSize?: number }): Promise<{ data: Transaction[]; pagination: Pagination }> {
  return httpClient.get('/api/wallet/transactions', { params: params as Record<string, string | number | undefined> });
}

export async function getTopupStatus(): Promise<{ canClaim: boolean; amount: number; lastClaimedAt: string | null; nextClaimAt: string | null; hoursUntilNextClaim: number }> {
  return httpClient.get('/api/wallet/topup/status');
}

export async function claimDailyTopup(): Promise<{ message: string; coinsAdded: number; newBalance: number; nextClaimAt: string }> {
  return httpClient.post('/api/wallet/topup');
}

// ============================================================================
// LEADERBOARD
// ============================================================================

export async function getLeaderboard(params?: { page?: number; pageSize?: number; sortBy?: 'stars' | 'wins' | 'streak' }): Promise<{ data: LeaderboardEntry[]; pagination: Pagination; sortBy: string }> {
  return httpClient.get('/api/leaderboard', { params: params as Record<string, string | number | undefined> });
}

export async function getLeaderboardPosition(): Promise<{
  rank: number | null;
  totalUsers: number;
  stars: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  percentile: number;
  percentileMessage: string;
}> {
  return httpClient.get('/api/leaderboard/position');
}

// ============================================================================
// COMING SOON - Placeholder functions that return errors
// ============================================================================

export async function purchaseGemPack(_packId: string): Promise<never> {
  throw new Error('Shop is coming soon!');
}

export async function purchaseCosmetic(_cosmeticId: string, _currency: 'stars' | 'gems'): Promise<never> {
  throw new Error('Shop is coming soon!');
}

export async function watchRewardedAd(_adType: string): Promise<never> {
  throw new Error('Ads & rewards are coming soon!');
}

// These will remain for backwards compatibility but should be updated when used
export async function login(_email: string, _password: string): Promise<{ user: User; stats: UserStats }> {
  throw new Error('Use cognitoAuth.signIn() directly instead of api.login()');
}

export async function logout(): Promise<void> {
  throw new Error('Use cognitoAuth.signOut() directly instead of api.logout()');
}
