import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  UserStats,
  AuthContextType,
  WalletContextType,
  Prediction,
  Transaction,
  UserChallengeProgress,
  UserAchievement,
  AccumulatorSelection,
  Accumulator,
  Event,
  Outcome,
  ACCUMULATOR_LIMITS,
} from '@/types';
import {
  mockUser,
  mockUserStats,
  mockPredictions,
  mockTransactions,
  mockChallenges,
  mockAchievements,
} from './mock-data';

// ============================================================================
// AUTH CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEYS = {
  USER: '@sport_sage_user',
  STATS: '@sport_sage_stats',
  PREDICTIONS: '@sport_sage_predictions',
  TRANSACTIONS: '@sport_sage_transactions',
  CHALLENGES: '@sport_sage_challenges',
  ACHIEVEMENTS: '@sport_sage_achievements',
  ACCUMULATORS: '@sport_sage_accumulators',
  CURRENT_ACCA: '@sport_sage_current_acca',
  ONBOARDING_COMPLETE: '@sport_sage_onboarding',
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [pendingSocialAuth, setPendingSocialAuth] = useState(false);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async (): Promise<void> => {
    try {
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const storedStats = await AsyncStorage.getItem(STORAGE_KEYS.STATS);
      const onboardingComplete = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE);

      setHasCompletedOnboarding(onboardingComplete === 'true');

      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setStats(storedStats ? JSON.parse(storedStats) : mockUserStats);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = useCallback(async (): Promise<void> => {
    setHasCompletedOnboarding(true);
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
  }, []);

  const saveUser = async (userData: User, statsData: UserStats): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
      await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(statsData));
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  };

  const login = useCallback(async (email: string, _password: string): Promise<void> => {
    // Mock login - in production this would hit an API
    const loggedInUser: User = {
      ...mockUser,
      email,
    };
    const userStats = { ...mockUserStats };

    setUser(loggedInUser);
    setStats(userStats);
    await saveUser(loggedInUser, userStats);
  }, []);

  const register = useCallback(async (username: string, email: string, _password: string): Promise<void> => {
    // Mock register - new user gets 1000 coins, 0 stars, 0 gems
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

    setUser(newUser);
    setStats(newStats);
    await saveUser(newUser, newStats);
  }, []);

  // Mock Apple Sign-In - creates a partial user pending username selection
  const loginWithApple = useCallback(async (): Promise<void> => {
    // In production: use expo-apple-authentication
    // For now, mock the flow - user will need to set username next
    const partialUser: User = {
      id: `apple_${Date.now()}`,
      username: '', // Empty - will be set in username selection screen
      email: 'user@privaterelay.appleid.com',
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
      userId: partialUser.id,
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

    setUser(partialUser);
    setStats(newStats);
    setPendingSocialAuth(true);
    // Don't save until username is set
  }, []);

  // Mock Google Sign-In - creates a partial user pending username selection
  const loginWithGoogle = useCallback(async (): Promise<void> => {
    // In production: use expo-auth-session with Google
    // For now, mock the flow - user will need to set username next
    const partialUser: User = {
      id: `google_${Date.now()}`,
      username: '', // Empty - will be set in username selection screen
      email: 'user@gmail.com',
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
      userId: partialUser.id,
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

    setUser(partialUser);
    setStats(newStats);
    setPendingSocialAuth(true);
    // Don't save until username is set
  }, []);

  // Set username after social auth
  const setUsername = useCallback(async (username: string): Promise<void> => {
    if (!user || !stats) return;

    const updatedUser = { ...user, username };
    setUser(updatedUser);
    setPendingSocialAuth(false);
    await saveUser(updatedUser, stats);
  }, [user, stats]);

  const logout = useCallback(async (): Promise<void> => {
    setUser(null);
    setStats(null);
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER,
        STORAGE_KEYS.STATS,
        STORAGE_KEYS.PREDICTIONS,
        STORAGE_KEYS.TRANSACTIONS,
      ]);
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }, []);

  const updateUser = useCallback((updates: Partial<User>): void => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateStats = useCallback((updates: Partial<UserStats>): void => {
    setStats(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value: AuthContextType = {
    user,
    stats,
    isLoading,
    isAuthenticated: !!user,
    hasCompletedOnboarding,
    pendingSocialAuth,
    login,
    register,
    loginWithApple,
    loginWithGoogle,
    setUsername,
    logout,
    updateUser,
    updateStats,
    completeOnboarding,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================================================
// WALLET CONTEXT
// ============================================================================

const WalletContext = createContext<WalletContextType | null>(null);

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps): React.ReactElement {
  const { user, updateUser } = useAuth();

  const coins = user?.coins ?? 0;
  const stars = user?.stars ?? 0;
  const gems = user?.gems ?? 0;

  const addCoins = useCallback((amount: number): void => {
    updateUser({ coins: coins + amount });
  }, [coins, updateUser]);

  const deductCoins = useCallback((amount: number): boolean => {
    if (coins < amount) return false;
    updateUser({ coins: coins - amount });
    return true;
  }, [coins, updateUser]);

  const addStars = useCallback((amount: number): void => {
    updateUser({ stars: stars + amount });
  }, [stars, updateUser]);

  const addGems = useCallback((amount: number): void => {
    updateUser({ gems: gems + amount });
  }, [gems, updateUser]);

  const deductGems = useCallback((amount: number): boolean => {
    if (gems < amount) return false;
    updateUser({ gems: gems - amount });
    return true;
  }, [gems, updateUser]);

  const canAfford = useCallback((amount: number): boolean => {
    return coins >= amount;
  }, [coins]);

  const value: WalletContextType = {
    coins,
    stars,
    gems,
    addCoins,
    deductCoins,
    addStars,
    addGems,
    deductGems,
    canAfford,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// ============================================================================
// PREDICTIONS CONTEXT
// ============================================================================

interface PredictionsContextType {
  predictions: Prediction[];
  addPrediction: (prediction: Prediction) => void;
  updatePrediction: (id: string, updates: Partial<Prediction>) => void;
  getPendingPredictions: () => Prediction[];
  getSettledPredictions: () => Prediction[];
}

const PredictionsContext = createContext<PredictionsContextType | null>(null);

interface PredictionsProviderProps {
  children: React.ReactNode;
}

export function PredictionsProvider({ children }: PredictionsProviderProps): React.ReactElement {
  const [predictions, setPredictions] = useState<Prediction[]>(mockPredictions);

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async (): Promise<void> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PREDICTIONS);
      if (stored) {
        setPredictions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load predictions:', error);
    }
  };

  const savePredictions = async (preds: Prediction[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PREDICTIONS, JSON.stringify(preds));
    } catch (error) {
      console.error('Failed to save predictions:', error);
    }
  };

  const addPrediction = useCallback((prediction: Prediction): void => {
    setPredictions(prev => {
      const updated = [prediction, ...prev];
      savePredictions(updated);
      return updated;
    });
  }, []);

  const updatePrediction = useCallback((id: string, updates: Partial<Prediction>): void => {
    setPredictions(prev => {
      const updated = prev.map(p => (p.id === id ? { ...p, ...updates } : p));
      savePredictions(updated);
      return updated;
    });
  }, []);

  const getPendingPredictions = useCallback((): Prediction[] => {
    return predictions.filter(p => p.status === 'pending');
  }, [predictions]);

  const getSettledPredictions = useCallback((): Prediction[] => {
    return predictions.filter(p => p.status !== 'pending');
  }, [predictions]);

  const value: PredictionsContextType = {
    predictions,
    addPrediction,
    updatePrediction,
    getPendingPredictions,
    getSettledPredictions,
  };

  return (
    <PredictionsContext.Provider value={value}>
      {children}
    </PredictionsContext.Provider>
  );
}

export function usePredictions(): PredictionsContextType {
  const context = useContext(PredictionsContext);
  if (!context) {
    throw new Error('usePredictions must be used within a PredictionsProvider');
  }
  return context;
}

// ============================================================================
// CHALLENGES CONTEXT
// ============================================================================

interface ChallengesContextType {
  challenges: UserChallengeProgress[];
  claimChallenge: (challengeId: string) => { coins: number; stars: number; gems: number } | null;
  updateChallengeProgress: (challengeId: string, newValue: number) => void;
  getActiveChallenges: () => UserChallengeProgress[];
  getCompletedChallenges: () => UserChallengeProgress[];
}

const ChallengesContext = createContext<ChallengesContextType | null>(null);

interface ChallengesProviderProps {
  children: React.ReactNode;
}

export function ChallengesProvider({ children }: ChallengesProviderProps): React.ReactElement {
  const [challenges, setChallenges] = useState<UserChallengeProgress[]>(mockChallenges);
  const { updateUser, user } = useAuth();

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async (): Promise<void> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CHALLENGES);
      if (stored) {
        setChallenges(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load challenges:', error);
    }
  };

  const saveChallenges = async (data: UserChallengeProgress[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CHALLENGES, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save challenges:', error);
    }
  };

  const claimChallenge = useCallback((challengeId: string): { coins: number; stars: number; gems: number } | null => {
    const challenge = challenges.find(c => c.challengeId === challengeId);
    if (!challenge || !challenge.isCompleted || challenge.isClaimed) {
      return null;
    }

    const rewards = {
      coins: challenge.challenge.rewardCoins,
      stars: challenge.challenge.rewardStars,
      gems: challenge.challenge.rewardGems,
    };

    // Update user balance
    if (user) {
      updateUser({
        coins: user.coins + rewards.coins,
        stars: user.stars + rewards.stars,
        gems: user.gems + rewards.gems,
      });
    }

    // Mark as claimed
    setChallenges(prev => {
      const updated = prev.map(c =>
        c.challengeId === challengeId
          ? { ...c, isClaimed: true }
          : c
      );
      saveChallenges(updated);
      return updated;
    });

    return rewards;
  }, [challenges, user, updateUser]);

  const updateChallengeProgress = useCallback((challengeId: string, newValue: number): void => {
    setChallenges(prev => {
      const updated = prev.map(c => {
        if (c.challengeId !== challengeId) return c;
        const isCompleted = newValue >= c.challenge.targetValue;
        return {
          ...c,
          currentValue: newValue,
          isCompleted,
          completedAt: isCompleted && !c.isCompleted ? new Date().toISOString() : c.completedAt,
        };
      });
      saveChallenges(updated);
      return updated;
    });
  }, []);

  const getActiveChallenges = useCallback((): UserChallengeProgress[] => {
    return challenges.filter(c => !c.isClaimed);
  }, [challenges]);

  const getCompletedChallenges = useCallback((): UserChallengeProgress[] => {
    return challenges.filter(c => c.isClaimed);
  }, [challenges]);

  const value: ChallengesContextType = {
    challenges,
    claimChallenge,
    updateChallengeProgress,
    getActiveChallenges,
    getCompletedChallenges,
  };

  return (
    <ChallengesContext.Provider value={value}>
      {children}
    </ChallengesContext.Provider>
  );
}

export function useChallenges(): ChallengesContextType {
  const context = useContext(ChallengesContext);
  if (!context) {
    throw new Error('useChallenges must be used within a ChallengesProvider');
  }
  return context;
}

// ============================================================================
// ACHIEVEMENTS CONTEXT
// ============================================================================

interface AchievementsContextType {
  achievements: UserAchievement[];
  claimAchievement: (achievementId: string) => { coins: number; stars: number; gems: number } | null;
  getUnlockedAchievements: () => UserAchievement[];
  getUnclaimedAchievements: () => UserAchievement[];
  getProgressAchievements: () => UserAchievement[];
}

const AchievementsContext = createContext<AchievementsContextType | null>(null);

interface AchievementsProviderProps {
  children: React.ReactNode;
}

export function AchievementsProvider({ children }: AchievementsProviderProps): React.ReactElement {
  const [achievements, setAchievements] = useState<UserAchievement[]>(mockAchievements);
  const { updateUser, user } = useAuth();

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async (): Promise<void> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
      if (stored) {
        setAchievements(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load achievements:', error);
    }
  };

  const saveAchievements = async (data: UserAchievement[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save achievements:', error);
    }
  };

  const claimAchievement = useCallback((achievementId: string): { coins: number; stars: number; gems: number } | null => {
    const achievement = achievements.find(a => a.achievementId === achievementId);
    if (!achievement || !achievement.isUnlocked || achievement.isClaimed) {
      return null;
    }

    const rewards = {
      coins: achievement.achievement.rewardCoins,
      stars: achievement.achievement.rewardStars,
      gems: achievement.achievement.rewardGems,
    };

    // Update user balance
    if (user) {
      updateUser({
        coins: user.coins + rewards.coins,
        stars: user.stars + rewards.stars,
        gems: user.gems + rewards.gems,
      });
    }

    // Mark as claimed
    setAchievements(prev => {
      const updated = prev.map(a =>
        a.achievementId === achievementId
          ? { ...a, isClaimed: true }
          : a
      );
      saveAchievements(updated);
      return updated;
    });

    return rewards;
  }, [achievements, user, updateUser]);

  const getUnlockedAchievements = useCallback((): UserAchievement[] => {
    return achievements.filter(a => a.isUnlocked);
  }, [achievements]);

  const getUnclaimedAchievements = useCallback((): UserAchievement[] => {
    return achievements.filter(a => a.isUnlocked && !a.isClaimed);
  }, [achievements]);

  const getProgressAchievements = useCallback((): UserAchievement[] => {
    return achievements.filter(a => !a.isUnlocked);
  }, [achievements]);

  const value: AchievementsContextType = {
    achievements,
    claimAchievement,
    getUnlockedAchievements,
    getUnclaimedAchievements,
    getProgressAchievements,
  };

  return (
    <AchievementsContext.Provider value={value}>
      {children}
    </AchievementsContext.Provider>
  );
}

export function useAchievements(): AchievementsContextType {
  const context = useContext(AchievementsContext);
  if (!context) {
    throw new Error('useAchievements must be used within an AchievementsProvider');
  }
  return context;
}

// ============================================================================
// ACCUMULATOR CONTEXT
// ============================================================================

interface AccumulatorContextType {
  // Current slip being built
  currentSelections: AccumulatorSelection[];
  addSelection: (event: Event, outcome: Outcome) => boolean;
  removeSelection: (eventId: string) => void;
  clearSelections: () => void;
  hasSelection: (eventId: string) => boolean;
  getSelectedOutcome: (eventId: string) => Outcome | null;

  // Calculated values
  totalOdds: number;
  bonusMultiplier: number;
  canPlace: boolean;

  // Place bet
  placeAccumulator: (stake: number) => Accumulator | null;

  // History
  accumulators: Accumulator[];
  getPendingAccumulators: () => Accumulator[];
  getSettledAccumulators: () => Accumulator[];
}

const AccumulatorContext = createContext<AccumulatorContextType | null>(null);

interface AccumulatorProviderProps {
  children: React.ReactNode;
}

export function AccumulatorProvider({ children }: AccumulatorProviderProps): React.ReactElement {
  const [currentSelections, setCurrentSelections] = useState<AccumulatorSelection[]>([]);
  const [accumulators, setAccumulators] = useState<Accumulator[]>([]);
  const { user, updateUser, stats, updateStats } = useAuth();

  useEffect(() => {
    loadAccumulatorData();
  }, []);

  const loadAccumulatorData = async (): Promise<void> => {
    try {
      const storedAccas = await AsyncStorage.getItem(STORAGE_KEYS.ACCUMULATORS);
      const storedCurrent = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_ACCA);

      if (storedAccas) {
        setAccumulators(JSON.parse(storedAccas));
      }
      if (storedCurrent) {
        setCurrentSelections(JSON.parse(storedCurrent));
      }
    } catch (error) {
      console.error('Failed to load accumulator data:', error);
    }
  };

  const saveAccumulators = async (accas: Accumulator[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCUMULATORS, JSON.stringify(accas));
    } catch (error) {
      console.error('Failed to save accumulators:', error);
    }
  };

  const saveCurrentSelections = async (selections: AccumulatorSelection[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_ACCA, JSON.stringify(selections));
    } catch (error) {
      console.error('Failed to save current selections:', error);
    }
  };

  // Calculate total odds (multiply all selection odds)
  const totalOdds = currentSelections.reduce((acc, sel) => acc * sel.odds, 1);

  // Get bonus multiplier based on number of selections
  const bonusMultiplier = ACCUMULATOR_LIMITS.bonusMultipliers[
    Math.min(currentSelections.length, 10)
  ] ?? 1.0;

  // Can place if we have at least min selections
  const canPlace = currentSelections.length >= ACCUMULATOR_LIMITS.minSelections;

  const addSelection = useCallback((event: Event, outcome: Outcome): boolean => {
    // Check if already have max selections
    if (currentSelections.length >= ACCUMULATOR_LIMITS.maxSelections) {
      return false;
    }

    // Check if already have a selection from this event
    if (currentSelections.some(s => s.eventId === event.id)) {
      return false;
    }

    const newSelection: AccumulatorSelection = {
      id: `sel_${Date.now()}_${event.id}`,
      eventId: event.id,
      event,
      outcomeId: outcome.id,
      outcome,
      odds: outcome.odds,
      status: 'pending',
    };

    setCurrentSelections(prev => {
      const updated = [...prev, newSelection];
      saveCurrentSelections(updated);
      return updated;
    });

    return true;
  }, [currentSelections]);

  const removeSelection = useCallback((eventId: string): void => {
    setCurrentSelections(prev => {
      const updated = prev.filter(s => s.eventId !== eventId);
      saveCurrentSelections(updated);
      return updated;
    });
  }, []);

  const clearSelections = useCallback((): void => {
    setCurrentSelections([]);
    saveCurrentSelections([]);
  }, []);

  const hasSelection = useCallback((eventId: string): boolean => {
    return currentSelections.some(s => s.eventId === eventId);
  }, [currentSelections]);

  const getSelectedOutcome = useCallback((eventId: string): Outcome | null => {
    const selection = currentSelections.find(s => s.eventId === eventId);
    return selection?.outcome ?? null;
  }, [currentSelections]);

  const placeAccumulator = useCallback((stake: number): Accumulator | null => {
    if (!user || !stats) return null;
    if (!canPlace) return null;
    if (stake < ACCUMULATOR_LIMITS.minStake || stake > ACCUMULATOR_LIMITS.maxStake) return null;
    if (user.coins < stake) return null;

    // Calculate potential returns
    const potentialCoins = Math.floor(stake * totalOdds * bonusMultiplier);

    // Stars calculation (base stars from odds, with multiplier from subscription)
    const baseStars = Math.floor((totalOdds - 1) * 10 * currentSelections.length);
    const starsMultiplier = user.subscriptionTier === 'elite' ? 1.25 : 1.0;
    const potentialStars = Math.floor(baseStars * starsMultiplier);

    const newAccumulator: Accumulator = {
      id: `acca_${Date.now()}`,
      selections: [...currentSelections],
      stake,
      totalOdds,
      potentialCoins,
      potentialStars,
      starsMultiplier,
      status: 'placed',
      placedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Deduct stake from user
    updateUser({ coins: user.coins - stake });

    // Update stats
    updateStats({
      totalPredictions: stats.totalPredictions + 1,
      totalCoinsWagered: stats.totalCoinsWagered + stake,
    });

    // Save accumulator
    setAccumulators(prev => {
      const updated = [newAccumulator, ...prev];
      saveAccumulators(updated);
      return updated;
    });

    // Clear current selections
    clearSelections();

    return newAccumulator;
  }, [user, stats, canPlace, totalOdds, bonusMultiplier, currentSelections, updateUser, updateStats, clearSelections]);

  const getPendingAccumulators = useCallback((): Accumulator[] => {
    return accumulators.filter(a => a.status === 'placed');
  }, [accumulators]);

  const getSettledAccumulators = useCallback((): Accumulator[] => {
    return accumulators.filter(a => ['won', 'lost', 'partial', 'void'].includes(a.status));
  }, [accumulators]);

  const value: AccumulatorContextType = {
    currentSelections,
    addSelection,
    removeSelection,
    clearSelections,
    hasSelection,
    getSelectedOutcome,
    totalOdds,
    bonusMultiplier,
    canPlace,
    placeAccumulator,
    accumulators,
    getPendingAccumulators,
    getSettledAccumulators,
  };

  return (
    <AccumulatorContext.Provider value={value}>
      {children}
    </AccumulatorContext.Provider>
  );
}

export function useAccumulator(): AccumulatorContextType {
  const context = useContext(AccumulatorContext);
  if (!context) {
    throw new Error('useAccumulator must be used within an AccumulatorProvider');
  }
  return context;
}

// ============================================================================
// COMBINED STORE PROVIDER
// ============================================================================

interface StoreProviderProps {
  children: React.ReactNode;
}

export function StoreProvider({ children }: StoreProviderProps): React.ReactElement {
  return (
    <AuthProvider>
      <WalletProviderWrapper>
        <PredictionsProvider>
          <ChallengesProviderWrapper>
            <AchievementsProviderWrapper>
              <AccumulatorProviderWrapper>{children}</AccumulatorProviderWrapper>
            </AchievementsProviderWrapper>
          </ChallengesProviderWrapper>
        </PredictionsProvider>
      </WalletProviderWrapper>
    </AuthProvider>
  );
}

function WalletProviderWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return <WalletProvider>{children}</WalletProvider>;
}

function ChallengesProviderWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return <ChallengesProvider>{children}</ChallengesProvider>;
}

function AchievementsProviderWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return <AchievementsProvider>{children}</AchievementsProvider>;
}

function AccumulatorProviderWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return <AccumulatorProvider>{children}</AccumulatorProvider>;
}
