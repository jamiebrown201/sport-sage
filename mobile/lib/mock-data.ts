// lib/mock-data.ts

import {
  User,
  UserStats,
  Sport,
  Event,
  Prediction,
  Transaction,
  LeaderboardEntry,
  Challenge,
  UserChallengeProgress,
  Achievement,
  UserAchievement,
  Friend,
  FriendActivity,
  FriendPrediction,
  Referral,
  ReferralStats,
  PredictionInsights,
} from "@/types";

// ============================================================================
// SPORTS & COMPETITIONS
// ============================================================================

export const SPORTS: Sport[] = [
  { id: "sport_1", name: "Football", slug: "football", icon: "soccer" },
  { id: "sport_2", name: "Tennis", slug: "tennis", icon: "tennis" },
  { id: "sport_3", name: "Darts", slug: "darts", icon: "bullseye-arrow" },
  { id: "sport_4", name: "Cricket", slug: "cricket", icon: "cricket" },
  { id: "sport_5", name: "Basketball", slug: "basketball", icon: "basketball" },
  { id: "sport_6", name: "Golf", slug: "golf", icon: "golf" },
  { id: "sport_7", name: "Boxing", slug: "boxing", icon: "boxing-glove" },
  { id: "sport_8", name: "MMA", slug: "mma", icon: "mixed-martial-arts" },
];

// ============================================================================
// DATE HELPERS
// ============================================================================

const now = new Date();

const today = (hours: number, minutes: number = 0): string => {
  const d = new Date(now);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

const tomorrow = (hours: number, minutes: number = 0): string => {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

const yesterday = (hours: number, minutes: number = 0): string => {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

const daysAgo = (days: number, hours: number = 12): string => {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(hours, 0, 0, 0);
  return d.toISOString();
};

const daysFromNow = (days: number, hours: number = 18): string => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hours, 0, 0, 0);
  return d.toISOString();
};

// ============================================================================
// EVENTS
// ============================================================================

export const EVENTS: Event[] = [
  // Live event
  {
    id: "event_live_1",
    sport: SPORTS[0],
    competition: "Premier League",
    homeTeam: "Manchester United",
    awayTeam: "Tottenham",
    startTime: today(12, 30),
    status: "live",
    liveScore: {
      home: 2,
      away: 1,
      time: "67'",
    },
    markets: [
      {
        id: "market_live_1",
        type: "match_winner",
        outcomes: [
          { id: "out_live_1a", name: "Manchester United", odds: 1.35 },
          { id: "out_live_1b", name: "Draw", odds: 4.5 },
          { id: "out_live_1c", name: "Tottenham", odds: 8.0 },
        ],
      },
    ],
  },
  // Today's events
  {
    id: "event_1",
    sport: SPORTS[0],
    competition: "Premier League",
    homeTeam: "Manchester City",
    awayTeam: "Liverpool",
    startTime: today(15, 0),
    status: "scheduled",
    markets: [
      {
        id: "market_1",
        type: "match_winner",
        outcomes: [
          { id: "out_1a", name: "Manchester City", odds: 1.95 },
          { id: "out_1b", name: "Draw", odds: 3.6 },
          { id: "out_1c", name: "Liverpool", odds: 3.8 },
        ],
      },
    ],
  },
  {
    id: "event_2",
    sport: SPORTS[0],
    competition: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    startTime: today(17, 30),
    status: "scheduled",
    markets: [
      {
        id: "market_2",
        type: "match_winner",
        outcomes: [
          { id: "out_2a", name: "Arsenal", odds: 2.1 },
          { id: "out_2b", name: "Draw", odds: 3.4 },
          { id: "out_2c", name: "Chelsea", odds: 3.2 },
        ],
      },
    ],
  },
  {
    id: "event_3",
    sport: SPORTS[1],
    competition: "ATP Finals",
    player1: "Novak Djokovic",
    player2: "Carlos Alcaraz",
    startTime: today(19, 0),
    status: "scheduled",
    markets: [
      {
        id: "market_3",
        type: "match_winner",
        outcomes: [
          { id: "out_3a", name: "Novak Djokovic", odds: 1.75 },
          { id: "out_3b", name: "Carlos Alcaraz", odds: 2.1 },
        ],
      },
    ],
  },
  {
    id: "event_4",
    sport: SPORTS[2],
    competition: "PDC World Championship",
    player1: "Luke Littler",
    player2: "Michael Smith",
    startTime: today(20, 0),
    status: "scheduled",
    markets: [
      {
        id: "market_4",
        type: "match_winner",
        outcomes: [
          { id: "out_4a", name: "Luke Littler", odds: 1.55 },
          { id: "out_4b", name: "Michael Smith", odds: 2.4 },
        ],
      },
    ],
  },
  // Tomorrow's events
  {
    id: "event_5",
    sport: SPORTS[2],
    competition: "PDC World Championship",
    player1: "Michael van Gerwen",
    player2: "Gary Anderson",
    startTime: tomorrow(14, 0),
    status: "scheduled",
    markets: [
      {
        id: "market_5",
        type: "match_winner",
        outcomes: [
          { id: "out_5a", name: "Michael van Gerwen", odds: 1.45 },
          { id: "out_5b", name: "Gary Anderson", odds: 2.75 },
        ],
      },
    ],
  },
  {
    id: "event_6",
    sport: SPORTS[0],
    competition: "Premier League",
    homeTeam: "Tottenham",
    awayTeam: "Newcastle",
    startTime: tomorrow(16, 0),
    status: "scheduled",
    markets: [
      {
        id: "market_6",
        type: "match_winner",
        outcomes: [
          { id: "out_6a", name: "Tottenham", odds: 2.3 },
          { id: "out_6b", name: "Draw", odds: 3.5 },
          { id: "out_6c", name: "Newcastle", odds: 2.9 },
        ],
      },
    ],
  },
  {
    id: "event_7",
    sport: SPORTS[1],
    competition: "ATP Finals",
    player1: "Jannik Sinner",
    player2: "Daniil Medvedev",
    startTime: tomorrow(18, 0),
    status: "scheduled",
    markets: [
      {
        id: "market_7",
        type: "match_winner",
        outcomes: [
          { id: "out_7a", name: "Jannik Sinner", odds: 1.65 },
          { id: "out_7b", name: "Daniil Medvedev", odds: 2.25 },
        ],
      },
    ],
  },
  {
    id: "event_8",
    sport: SPORTS[0],
    competition: "Champions League",
    homeTeam: "Real Madrid",
    awayTeam: "Bayern Munich",
    startTime: tomorrow(20, 0),
    status: "scheduled",
    markets: [
      {
        id: "market_8",
        type: "match_winner",
        outcomes: [
          { id: "out_8a", name: "Real Madrid", odds: 2.2 },
          { id: "out_8b", name: "Draw", odds: 3.4 },
          { id: "out_8c", name: "Bayern Munich", odds: 3.1 },
        ],
      },
    ],
  },
  // Basketball - NBA
  {
    id: "event_9",
    sport: SPORTS[4],
    competition: "NBA",
    homeTeam: "LA Lakers",
    awayTeam: "Golden State Warriors",
    startTime: today(21, 0),
    status: "scheduled",
    markets: [
      {
        id: "market_9",
        type: "match_winner",
        outcomes: [
          { id: "out_9a", name: "LA Lakers", odds: 1.85 },
          { id: "out_9b", name: "Golden State Warriors", odds: 1.95 },
        ],
      },
    ],
  },
  {
    id: "event_10",
    sport: SPORTS[4],
    competition: "NBA",
    homeTeam: "Boston Celtics",
    awayTeam: "Miami Heat",
    startTime: tomorrow(19, 30),
    status: "scheduled",
    markets: [
      {
        id: "market_10",
        type: "match_winner",
        outcomes: [
          { id: "out_10a", name: "Boston Celtics", odds: 1.55 },
          { id: "out_10b", name: "Miami Heat", odds: 2.45 },
        ],
      },
    ],
  },
  // Boxing
  {
    id: "event_11",
    sport: SPORTS[6],
    competition: "World Heavyweight Championship",
    player1: "Tyson Fury",
    player2: "Oleksandr Usyk",
    startTime: daysFromNow(3, 22),
    status: "scheduled",
    markets: [
      {
        id: "market_11",
        type: "match_winner",
        outcomes: [
          { id: "out_11a", name: "Tyson Fury", odds: 2.25 },
          { id: "out_11b", name: "Oleksandr Usyk", odds: 1.75 },
          { id: "out_11c", name: "Draw", odds: 15.0 },
        ],
      },
    ],
  },
  // MMA - UFC
  {
    id: "event_12",
    sport: SPORTS[7],
    competition: "UFC 310",
    player1: "Islam Makhachev",
    player2: "Dustin Poirier",
    startTime: daysFromNow(5, 23),
    status: "scheduled",
    markets: [
      {
        id: "market_12",
        type: "match_winner",
        outcomes: [
          { id: "out_12a", name: "Islam Makhachev", odds: 1.35 },
          { id: "out_12b", name: "Dustin Poirier", odds: 3.25 },
        ],
      },
    ],
  },
  {
    id: "event_13",
    sport: SPORTS[7],
    competition: "UFC 310",
    player1: "Jon Jones",
    player2: "Stipe Miocic",
    startTime: daysFromNow(5, 23),
    status: "scheduled",
    markets: [
      {
        id: "market_13",
        type: "match_winner",
        outcomes: [
          { id: "out_13a", name: "Jon Jones", odds: 1.45 },
          { id: "out_13b", name: "Stipe Miocic", odds: 2.85 },
        ],
      },
    ],
  },
  // Cricket
  {
    id: "event_14",
    sport: SPORTS[3],
    competition: "The Ashes",
    homeTeam: "Australia",
    awayTeam: "England",
    startTime: daysFromNow(2, 10),
    status: "scheduled",
    markets: [
      {
        id: "market_14",
        type: "match_winner",
        outcomes: [
          { id: "out_14a", name: "Australia", odds: 1.65 },
          { id: "out_14b", name: "Draw", odds: 4.5 },
          { id: "out_14c", name: "England", odds: 3.5 },
        ],
      },
    ],
  },
  // More Football
  {
    id: "event_15",
    sport: SPORTS[0],
    competition: "La Liga",
    homeTeam: "Barcelona",
    awayTeam: "Real Madrid",
    startTime: daysFromNow(4, 20),
    status: "scheduled",
    markets: [
      {
        id: "market_15",
        type: "match_winner",
        outcomes: [
          { id: "out_15a", name: "Barcelona", odds: 2.4 },
          { id: "out_15b", name: "Draw", odds: 3.3 },
          { id: "out_15c", name: "Real Madrid", odds: 2.8 },
        ],
      },
    ],
  },
  {
    id: "event_16",
    sport: SPORTS[0],
    competition: "Serie A",
    homeTeam: "AC Milan",
    awayTeam: "Inter Milan",
    startTime: daysFromNow(6, 20),
    status: "scheduled",
    markets: [
      {
        id: "market_16",
        type: "match_winner",
        outcomes: [
          { id: "out_16a", name: "AC Milan", odds: 2.9 },
          { id: "out_16b", name: "Draw", odds: 3.2 },
          { id: "out_16c", name: "Inter Milan", odds: 2.35 },
        ],
      },
    ],
  },
];

// Finished events for settlement demo
export const FINISHED_EVENTS: Event[] = [
  {
    id: "event_f1",
    sport: SPORTS[0],
    competition: "Premier League",
    homeTeam: "Manchester United",
    awayTeam: "Brighton",
    startTime: yesterday(15, 0),
    status: "finished",
    homeScore: 1,
    awayScore: 3,
    markets: [
      {
        id: "market_f1",
        type: "match_winner",
        outcomes: [
          {
            id: "out_f1a",
            name: "Manchester United",
            odds: 1.6,
            isWinner: false,
          },
          { id: "out_f1b", name: "Draw", odds: 4.0, isWinner: false },
          { id: "out_f1c", name: "Brighton", odds: 4.5, isWinner: true },
        ],
      },
    ],
  },
  {
    id: "event_f2",
    sport: SPORTS[2],
    competition: "PDC World Championship",
    player1: "Gerwyn Price",
    player2: "Peter Wright",
    startTime: daysAgo(2, 20),
    status: "finished",
    homeScore: 6,
    awayScore: 4,
    markets: [
      {
        id: "market_f2",
        type: "match_winner",
        outcomes: [
          { id: "out_f2a", name: "Gerwyn Price", odds: 1.65, isWinner: true },
          { id: "out_f2b", name: "Peter Wright", odds: 2.25, isWinner: false },
        ],
      },
    ],
  },
  {
    id: "event_f3",
    sport: SPORTS[1],
    competition: "ATP Finals",
    player1: "Carlos Alcaraz",
    player2: "Alexander Zverev",
    startTime: daysAgo(3, 14),
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    markets: [
      {
        id: "market_f3",
        type: "match_winner",
        outcomes: [
          { id: "out_f3a", name: "Carlos Alcaraz", odds: 1.8, isWinner: true },
          {
            id: "out_f3b",
            name: "Alexander Zverev",
            odds: 2.0,
            isWinner: false,
          },
        ],
      },
    ],
  },
];

// ============================================================================
// USER
// ============================================================================

export const CURRENT_USER: User = {
  id: "user_1",
  username: "SportsFan123",
  email: "fan@example.com",
  coins: 2450,
  stars: 8350,
  gems: 0,
  subscriptionTier: "free",
  isAdsEnabled: true,
  isOver18: true,
  showAffiliates: false,
  createdAt: daysAgo(14),
};

export const CURRENT_USER_STATS: UserStats = {
  userId: "user_1",
  totalPredictions: 12,
  totalWins: 8,
  totalLosses: 4,
  winRate: 66.67,
  currentStreak: 3,
  bestStreak: 7,
  totalStarsEarned: 8350,
  totalCoinsWagered: 6200,
  adsWatchedToday: 0,
  hasPredictionBoost: false,
};

// ============================================================================
// PREDICTIONS
// ============================================================================

export const PREDICTIONS: Prediction[] = [
  // Pending
  {
    id: "pred_1",
    eventId: "event_2",
    event: EVENTS[1],
    outcomeId: "out_2a",
    outcome: { id: "out_2a", name: "Arsenal", odds: 2.1 },
    stake: 200,
    potentialCoins: 420,
    potentialStars: 220,
    starsMultiplier: 1.0,
    status: "pending",
    createdAt: today(8, 0),
  },
  {
    id: "pred_2",
    eventId: "event_3",
    event: EVENTS[2],
    outcomeId: "out_3b",
    outcome: { id: "out_3b", name: "Carlos Alcaraz", odds: 2.1 },
    stake: 150,
    potentialCoins: 315,
    potentialStars: 165,
    starsMultiplier: 1.0,
    status: "pending",
    createdAt: today(8, 30),
  },
  // Won
  {
    id: "pred_3",
    eventId: "event_f1",
    event: FINISHED_EVENTS[0],
    outcomeId: "out_f1c",
    outcome: { id: "out_f1c", name: "Brighton", odds: 4.5, isWinner: true },
    stake: 100,
    potentialCoins: 450,
    potentialStars: 350,
    starsMultiplier: 1.0,
    status: "won",
    settledAt: yesterday(17, 0),
    createdAt: yesterday(10, 0),
  },
  // Lost
  {
    id: "pred_4",
    eventId: "event_f2",
    event: FINISHED_EVENTS[1],
    outcomeId: "out_f2b",
    outcome: {
      id: "out_f2b",
      name: "Peter Wright",
      odds: 2.25,
      isWinner: false,
    },
    stake: 200,
    potentialCoins: 450,
    potentialStars: 250,
    starsMultiplier: 1.0,
    status: "lost",
    settledAt: daysAgo(2, 22),
    createdAt: daysAgo(2, 18),
  },
  // More won
  {
    id: "pred_5",
    eventId: "event_f3",
    event: FINISHED_EVENTS[2],
    outcomeId: "out_f3a",
    outcome: {
      id: "out_f3a",
      name: "Carlos Alcaraz",
      odds: 1.8,
      isWinner: true,
    },
    stake: 150,
    potentialCoins: 270,
    potentialStars: 120,
    starsMultiplier: 1.0,
    status: "won",
    settledAt: daysAgo(3, 16),
    createdAt: daysAgo(3, 10),
  },
];

// ============================================================================
// TRANSACTIONS
// ============================================================================

export const TRANSACTIONS: Transaction[] = [
  {
    id: "txn_1",
    type: "stake",
    coinsChange: -150,
    starsChange: 0,
    gemsChange: 0,
    coinsAfter: 2450,
    starsAfter: 8350,
    gemsAfter: 0,
    description: "Prediction: Djokovic vs Alcaraz",
    createdAt: today(8, 30),
  },
  {
    id: "txn_2",
    type: "stake",
    coinsChange: -200,
    starsChange: 0,
    gemsChange: 0,
    coinsAfter: 2600,
    starsAfter: 8350,
    gemsAfter: 0,
    description: "Prediction: Arsenal vs Chelsea",
    createdAt: today(8, 0),
  },
  {
    id: "txn_3",
    type: "win",
    coinsChange: 450,
    starsChange: 350,
    gemsChange: 0,
    coinsAfter: 2800,
    starsAfter: 8350,
    gemsAfter: 0,
    description: "Won! Brighton beat Man United",
    createdAt: yesterday(17, 0),
  },
  {
    id: "txn_4",
    type: "stake",
    coinsChange: -100,
    starsChange: 0,
    gemsChange: 0,
    coinsAfter: 2350,
    starsAfter: 8000,
    gemsAfter: 0,
    description: "Prediction: Man United vs Brighton",
    createdAt: yesterday(10, 0),
  },
  {
    id: "txn_5",
    type: "stake",
    coinsChange: -200,
    starsChange: 0,
    gemsChange: 0,
    coinsAfter: 2450,
    starsAfter: 8000,
    gemsAfter: 0,
    description: "Prediction: Price vs Wright",
    createdAt: daysAgo(2, 18),
  },
  {
    id: "txn_6",
    type: "win",
    coinsChange: 270,
    starsChange: 120,
    gemsChange: 0,
    coinsAfter: 2650,
    starsAfter: 8000,
    gemsAfter: 0,
    description: "Won! Alcaraz beat Zverev",
    createdAt: daysAgo(3, 16),
  },
  {
    id: "txn_7",
    type: "welcome",
    coinsChange: 1000,
    starsChange: 0,
    gemsChange: 0,
    coinsAfter: 1000,
    starsAfter: 0,
    gemsAfter: 0,
    description: "Welcome to Sport Sage!",
    createdAt: daysAgo(14),
  },
];

// ============================================================================
// LEADERBOARD
// ============================================================================

export const LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    userId: "user_top1",
    username: "PredictionKing",
    totalStarsEarned: 45230,
    winRate: 78,
  },
  {
    rank: 2,
    userId: "user_top2",
    username: "SportsMaster99",
    totalStarsEarned: 42100,
    winRate: 72,
  },
  {
    rank: 3,
    userId: "user_top3",
    username: "LuckyPunter",
    totalStarsEarned: 38900,
    winRate: 69,
  },
  {
    rank: 4,
    userId: "user_top4",
    username: "DartsQueen",
    totalStarsEarned: 35200,
    winRate: 74,
  },
  {
    rank: 5,
    userId: "user_top5",
    username: "TennisPro",
    totalStarsEarned: 32800,
    winRate: 65,
  },
  {
    rank: 6,
    userId: "user_top6",
    username: "FootyFanatic",
    totalStarsEarned: 28500,
    winRate: 61,
  },
  {
    rank: 7,
    userId: "user_top7",
    username: "OddsWizard",
    totalStarsEarned: 25200,
    winRate: 68,
  },
  {
    rank: 8,
    userId: "user_top8",
    username: "UpsetHunter",
    totalStarsEarned: 22100,
    winRate: 58,
  },
  {
    rank: 9,
    userId: "user_top9",
    username: "StatGeek2024",
    totalStarsEarned: 19800,
    winRate: 70,
  },
  {
    rank: 10,
    userId: "user_top10",
    username: "BettingBoss",
    totalStarsEarned: 17500,
    winRate: 64,
  },
  {
    rank: 11,
    userId: "user_11",
    username: "GoldenBoot",
    totalStarsEarned: 16200,
    winRate: 62,
  },
  {
    rank: 12,
    userId: "user_12",
    username: "AcePredictor",
    totalStarsEarned: 15100,
    winRate: 66,
  },
  // ... gap ...
  {
    rank: 40,
    userId: "user_40",
    username: "NearbyUser",
    totalStarsEarned: 8800,
    winRate: 64,
  },
  {
    rank: 41,
    userId: "user_41",
    username: "CloseOne",
    totalStarsEarned: 8600,
    winRate: 65,
  },
  {
    rank: 42,
    userId: "user_1",
    username: "SportsFan123",
    totalStarsEarned: 8350,
    winRate: 67,
    isCurrentUser: true,
  },
  {
    rank: 43,
    userId: "user_43",
    username: "JustBehind",
    totalStarsEarned: 8200,
    winRate: 62,
  },
  {
    rank: 44,
    userId: "user_44",
    username: "CatchingUp",
    totalStarsEarned: 8000,
    winRate: 61,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getEventById(id: string): Event | undefined {
  return [...EVENTS, ...FINISHED_EVENTS].find((e) => e.id === id);
}

export function getEventsBySport(slug: string): Event[] {
  return EVENTS.filter((e) => e.sport.slug === slug);
}

export function getEventTitle(event: Event): string {
  if (event.homeTeam && event.awayTeam) {
    return `${event.homeTeam} vs ${event.awayTeam}`;
  }
  if (event.player1 && event.player2) {
    return `${event.player1} vs ${event.player2}`;
  }
  return "Unknown Event";
}

export function getPendingPredictions(): Prediction[] {
  return PREDICTIONS.filter((p) => p.status === "pending");
}

export function getSettledPredictions(): Prediction[] {
  return PREDICTIONS.filter((p) => p.status === "won" || p.status === "lost");
}

export function canClaimTopup(coins: number, lastTopupDate?: string): boolean {
  if (coins >= 200) return false;
  if (!lastTopupDate) return true;
  const today = new Date().toDateString();
  const lastClaim = new Date(lastTopupDate).toDateString();
  return today !== lastClaim;
}

// ============================================================================
// DAILY CHALLENGES
// ============================================================================

const endOfToday = (): string => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

export const DAILY_CHALLENGES: Challenge[] = [
  {
    id: 'challenge_1',
    type: 'win_predictions',
    difficulty: 'easy',
    title: 'Win Streak Starter',
    description: 'Win 2 predictions today',
    iconName: 'trophy',
    targetValue: 2,
    rewardCoins: 100,
    rewardStars: 50,
    rewardGems: 0,
    expiresAt: endOfToday(),
  },
  {
    id: 'challenge_2',
    type: 'place_predictions',
    difficulty: 'easy',
    title: 'Active Predictor',
    description: 'Place 3 predictions today',
    iconName: 'target',
    targetValue: 3,
    rewardCoins: 75,
    rewardStars: 25,
    rewardGems: 0,
    expiresAt: endOfToday(),
  },
  {
    id: 'challenge_3',
    type: 'predict_sport',
    difficulty: 'medium',
    title: 'Darts Master',
    description: 'Win a prediction on darts',
    iconName: 'bullseye-arrow',
    targetValue: 1,
    sportSlug: 'darts',
    rewardCoins: 150,
    rewardStars: 100,
    rewardGems: 0,
    expiresAt: endOfToday(),
  },
  {
    id: 'challenge_4',
    type: 'high_odds',
    difficulty: 'hard',
    title: 'Underdog Hunter',
    description: 'Win a prediction with odds 3.0+',
    iconName: 'fire',
    targetValue: 1,
    minOdds: 3.0,
    rewardCoins: 250,
    rewardStars: 200,
    rewardGems: 5,
    expiresAt: endOfToday(),
  },
];

export const USER_CHALLENGE_PROGRESS: UserChallengeProgress[] = [
  {
    challengeId: 'challenge_1',
    challenge: DAILY_CHALLENGES[0],
    currentValue: 1,
    isCompleted: false,
    isClaimed: false,
  },
  {
    challengeId: 'challenge_2',
    challenge: DAILY_CHALLENGES[1],
    currentValue: 2,
    isCompleted: false,
    isClaimed: false,
  },
  {
    challengeId: 'challenge_3',
    challenge: DAILY_CHALLENGES[2],
    currentValue: 0,
    isCompleted: false,
    isClaimed: false,
  },
  {
    challengeId: 'challenge_4',
    challenge: DAILY_CHALLENGES[3],
    currentValue: 0,
    isCompleted: false,
    isClaimed: false,
  },
];

// ============================================================================
// ACHIEVEMENTS
// ============================================================================

export const ACHIEVEMENTS: Achievement[] = [
  // Predictions tier
  {
    id: 'ach_pred_bronze',
    category: 'predictions',
    tier: 'bronze',
    name: 'First Steps',
    description: 'Place 10 predictions',
    iconName: 'target',
    targetValue: 10,
    rewardCoins: 100,
    rewardStars: 50,
    rewardGems: 0,
    nextTierId: 'ach_pred_silver',
  },
  {
    id: 'ach_pred_silver',
    category: 'predictions',
    tier: 'silver',
    name: 'Getting Started',
    description: 'Place 50 predictions',
    iconName: 'target',
    targetValue: 50,
    rewardCoins: 250,
    rewardStars: 150,
    rewardGems: 5,
    nextTierId: 'ach_pred_gold',
  },
  {
    id: 'ach_pred_gold',
    category: 'predictions',
    tier: 'gold',
    name: 'Prediction Pro',
    description: 'Place 200 predictions',
    iconName: 'target',
    targetValue: 200,
    rewardCoins: 500,
    rewardStars: 300,
    rewardGems: 15,
    nextTierId: 'ach_pred_platinum',
  },
  // Wins tier
  {
    id: 'ach_wins_bronze',
    category: 'wins',
    tier: 'bronze',
    name: 'Winner',
    description: 'Win 5 predictions',
    iconName: 'trophy',
    targetValue: 5,
    rewardCoins: 150,
    rewardStars: 75,
    rewardGems: 0,
    nextTierId: 'ach_wins_silver',
  },
  {
    id: 'ach_wins_silver',
    category: 'wins',
    tier: 'silver',
    name: 'Consistent Winner',
    description: 'Win 25 predictions',
    iconName: 'trophy',
    targetValue: 25,
    rewardCoins: 350,
    rewardStars: 200,
    rewardGems: 10,
    nextTierId: 'ach_wins_gold',
  },
  {
    id: 'ach_wins_gold',
    category: 'wins',
    tier: 'gold',
    name: 'Champion',
    description: 'Win 100 predictions',
    iconName: 'trophy',
    targetValue: 100,
    rewardCoins: 750,
    rewardStars: 500,
    rewardGems: 25,
  },
  // Streaks tier
  {
    id: 'ach_streak_bronze',
    category: 'streaks',
    tier: 'bronze',
    name: 'Hot Streak',
    description: 'Achieve a 3-win streak',
    iconName: 'fire',
    targetValue: 3,
    rewardCoins: 200,
    rewardStars: 100,
    rewardGems: 0,
    nextTierId: 'ach_streak_silver',
  },
  {
    id: 'ach_streak_silver',
    category: 'streaks',
    tier: 'silver',
    name: 'On Fire',
    description: 'Achieve a 5-win streak',
    iconName: 'fire',
    targetValue: 5,
    rewardCoins: 400,
    rewardStars: 250,
    rewardGems: 10,
    nextTierId: 'ach_streak_gold',
  },
  {
    id: 'ach_streak_gold',
    category: 'streaks',
    tier: 'gold',
    name: 'Unstoppable',
    description: 'Achieve a 10-win streak',
    iconName: 'fire',
    targetValue: 10,
    rewardCoins: 1000,
    rewardStars: 750,
    rewardGems: 50,
  },
  // Sports tier
  {
    id: 'ach_sports_bronze',
    category: 'sports',
    tier: 'bronze',
    name: 'Sport Explorer',
    description: 'Win in 2 different sports',
    iconName: 'soccer',
    targetValue: 2,
    rewardCoins: 150,
    rewardStars: 100,
    rewardGems: 0,
    nextTierId: 'ach_sports_silver',
  },
  {
    id: 'ach_sports_silver',
    category: 'sports',
    tier: 'silver',
    name: 'Multi-Sport Master',
    description: 'Win in 4 different sports',
    iconName: 'soccer',
    targetValue: 4,
    rewardCoins: 400,
    rewardStars: 300,
    rewardGems: 15,
  },
];

export const USER_ACHIEVEMENTS: UserAchievement[] = [
  {
    achievementId: 'ach_pred_bronze',
    achievement: ACHIEVEMENTS[0],
    currentProgress: 12,
    isUnlocked: true,
    unlockedAt: daysAgo(7),
    isClaimed: true,
  },
  {
    achievementId: 'ach_pred_silver',
    achievement: ACHIEVEMENTS[1],
    currentProgress: 12,
    isUnlocked: false,
    isClaimed: false,
  },
  {
    achievementId: 'ach_wins_bronze',
    achievement: ACHIEVEMENTS[3],
    currentProgress: 8,
    isUnlocked: true,
    unlockedAt: daysAgo(5),
    isClaimed: true,
  },
  {
    achievementId: 'ach_wins_silver',
    achievement: ACHIEVEMENTS[4],
    currentProgress: 8,
    isUnlocked: false,
    isClaimed: false,
  },
  {
    achievementId: 'ach_streak_bronze',
    achievement: ACHIEVEMENTS[6],
    currentProgress: 3,
    isUnlocked: true,
    unlockedAt: daysAgo(2),
    isClaimed: false,
  },
  {
    achievementId: 'ach_streak_silver',
    achievement: ACHIEVEMENTS[7],
    currentProgress: 3,
    isUnlocked: false,
    isClaimed: false,
  },
  {
    achievementId: 'ach_sports_bronze',
    achievement: ACHIEVEMENTS[9],
    currentProgress: 2,
    isUnlocked: true,
    unlockedAt: daysAgo(4),
    isClaimed: false,
  },
];

// ============================================================================
// FRIENDS
// ============================================================================

export const FRIENDS: Friend[] = [
  {
    id: 'friend_1',
    userId: 'user_1',
    friendId: 'user_top2',
    username: 'SportsMaster99',
    avatarUrl: 'https://i.pravatar.cc/150?u=sportsmaster99',
    status: 'accepted',
    totalStarsEarned: 42100,
    winRate: 72,
    currentStreak: 5,
    bestStreak: 12,
    favoriteSport: 'football',
    isOnline: true,
    addedAt: daysAgo(10),
  },
  {
    id: 'friend_2',
    userId: 'user_1',
    friendId: 'user_top5',
    username: 'TennisPro',
    avatarUrl: 'https://i.pravatar.cc/150?u=tennispro',
    status: 'accepted',
    totalStarsEarned: 32800,
    winRate: 65,
    currentStreak: 2,
    bestStreak: 8,
    favoriteSport: 'tennis',
    isOnline: false,
    lastActive: daysAgo(0, 2),
    addedAt: daysAgo(7),
  },
  {
    id: 'friend_3',
    userId: 'user_1',
    friendId: 'user_top7',
    username: 'OddsWizard',
    avatarUrl: 'https://i.pravatar.cc/150?u=oddswizard',
    status: 'accepted',
    totalStarsEarned: 25200,
    winRate: 68,
    currentStreak: 8,
    bestStreak: 15,
    favoriteSport: 'darts',
    isOnline: true,
    addedAt: daysAgo(5),
  },
  {
    id: 'friend_4',
    userId: 'user_1',
    friendId: 'user_43',
    username: 'JustBehind',
    avatarUrl: 'https://i.pravatar.cc/150?u=justbehind',
    status: 'accepted',
    totalStarsEarned: 8200,
    winRate: 62,
    currentStreak: 1,
    bestStreak: 4,
    favoriteSport: 'football',
    isOnline: false,
    lastActive: daysAgo(1),
    addedAt: daysAgo(3),
  },
  {
    id: 'friend_5',
    userId: 'user_1',
    friendId: 'user_new',
    username: 'NewChallenger',
    avatarUrl: 'https://i.pravatar.cc/150?u=newchallenger',
    status: 'pending',
    totalStarsEarned: 1500,
    winRate: 55,
    currentStreak: 0,
    addedAt: today(10),
  },
];

export const FRIEND_ACTIVITY: FriendActivity[] = [
  {
    id: 'activity_1',
    friendId: 'user_top2',
    friendUsername: 'SportsMaster99',
    friendAvatarUrl: 'https://i.pravatar.cc/150?u=sportsmaster99',
    type: 'prediction_won',
    description: 'won their prediction',
    eventName: 'Man City vs Liverpool',
    outcome: 'Draw',
    odds: 3.6,
    coinsWon: 540,
    starsEarned: 390,
    createdAt: today(12, 30),
  },
  {
    id: 'activity_2',
    friendId: 'user_top7',
    friendUsername: 'OddsWizard',
    friendAvatarUrl: 'https://i.pravatar.cc/150?u=oddswizard',
    type: 'streak_milestone',
    description: 'reached an 8-win streak!',
    streakCount: 8,
    createdAt: today(11, 15),
  },
  {
    id: 'activity_3',
    friendId: 'user_top5',
    friendUsername: 'TennisPro',
    friendAvatarUrl: 'https://i.pravatar.cc/150?u=tennispro',
    type: 'accumulator_placed',
    description: 'placed a 4-fold accumulator',
    odds: 12.5,
    createdAt: today(10, 45),
  },
  {
    id: 'activity_4',
    friendId: 'user_top2',
    friendUsername: 'SportsMaster99',
    friendAvatarUrl: 'https://i.pravatar.cc/150?u=sportsmaster99',
    type: 'prediction_placed',
    description: 'placed a prediction',
    eventName: 'Arsenal vs Chelsea',
    outcome: 'Arsenal',
    odds: 2.1,
    createdAt: today(9, 30),
  },
  {
    id: 'activity_5',
    friendId: 'user_43',
    friendUsername: 'JustBehind',
    friendAvatarUrl: 'https://i.pravatar.cc/150?u=justbehind',
    type: 'achievement_unlocked',
    description: 'unlocked an achievement',
    achievementName: 'Hot Streak',
    createdAt: yesterday(18, 0),
  },
  {
    id: 'activity_6',
    friendId: 'user_top7',
    friendUsername: 'OddsWizard',
    friendAvatarUrl: 'https://i.pravatar.cc/150?u=oddswizard',
    type: 'prediction_won',
    description: 'won their prediction',
    eventName: 'Luke Littler vs Michael Smith',
    outcome: 'Luke Littler',
    odds: 1.55,
    coinsWon: 310,
    starsEarned: 110,
    createdAt: yesterday(14, 0),
  },
];

export const FRIEND_PREDICTIONS: FriendPrediction[] = [
  {
    id: 'fpred_1',
    friendId: 'user_top2',
    friendUsername: 'SportsMaster99',
    friendAvatarUrl: 'https://i.pravatar.cc/150?u=sportsmaster99',
    eventId: 'event_2',
    event: EVENTS[2], // Arsenal vs Chelsea (index shifted due to live event)
    outcome: { id: 'out_2a', name: 'Arsenal', odds: 2.1 },
    stake: 250,
    placedAt: today(9, 30),
  },
  {
    id: 'fpred_2',
    friendId: 'user_top5',
    friendUsername: 'TennisPro',
    friendAvatarUrl: 'https://i.pravatar.cc/150?u=tennispro',
    eventId: 'event_3',
    event: EVENTS[3],
    outcome: { id: 'out_3a', name: 'Novak Djokovic', odds: 1.75 },
    stake: 300,
    placedAt: today(10, 0),
  },
  {
    id: 'fpred_3',
    friendId: 'user_top7',
    friendUsername: 'OddsWizard',
    friendAvatarUrl: 'https://i.pravatar.cc/150?u=oddswizard',
    eventId: 'event_4',
    event: EVENTS[4],
    outcome: { id: 'out_4a', name: 'Luke Littler', odds: 1.55 },
    stake: 200,
    placedAt: today(11, 0),
  },
  {
    id: 'fpred_4',
    friendId: 'user_43',
    friendUsername: 'JustBehind',
    friendAvatarUrl: 'https://i.pravatar.cc/150?u=justbehind',
    eventId: 'event_1',
    event: EVENTS[1],
    outcome: { id: 'out_1c', name: 'Liverpool', odds: 3.8 },
    stake: 100,
    placedAt: today(8, 0),
  },
];

// ============================================================================
// REFERRALS
// ============================================================================

export const REFERRALS: Referral[] = [
  {
    id: 'ref_1',
    referrerId: 'user_1',
    referredUserId: 'user_ref1',
    referredUsername: 'MyMate123',
    bonusCoins: 500,
    bonusStars: 100,
    status: 'completed',
    createdAt: daysAgo(5),
    completedAt: daysAgo(4),
  },
  {
    id: 'ref_2',
    referrerId: 'user_1',
    referredUserId: 'user_ref2',
    referredUsername: 'FootyFriend',
    bonusCoins: 500,
    bonusStars: 100,
    status: 'pending',
    createdAt: daysAgo(1),
  },
];

export const REFERRAL_STATS: ReferralStats = {
  totalReferrals: 2,
  pendingReferrals: 1,
  completedReferrals: 1,
  totalCoinsEarned: 500,
  totalStarsEarned: 100,
  referralCode: 'SAGE-FAN123',
};

// ============================================================================
// PREDICTION INSIGHTS
// ============================================================================

export const PREDICTION_INSIGHTS: PredictionInsights = {
  overallWinRate: 66.67,
  totalProfit: 850,
  avgOdds: 2.35,
  favoriteTime: 'Evening (7-9pm)',
  sportInsights: [
    {
      sportSlug: 'football',
      sportName: 'Football',
      totalPredictions: 6,
      wins: 4,
      losses: 2,
      winRate: 66.67,
      profit: 420,
      avgOdds: 2.5,
      bestWin: {
        eventName: 'Brighton vs Man United',
        odds: 4.5,
        coinsWon: 450,
      },
    },
    {
      sportSlug: 'tennis',
      sportName: 'Tennis',
      totalPredictions: 3,
      wins: 2,
      losses: 1,
      winRate: 66.67,
      profit: 220,
      avgOdds: 1.9,
    },
    {
      sportSlug: 'darts',
      sportName: 'Darts',
      totalPredictions: 2,
      wins: 1,
      losses: 1,
      winRate: 50,
      profit: 65,
      avgOdds: 1.65,
    },
    {
      sportSlug: 'basketball',
      sportName: 'Basketball',
      totalPredictions: 1,
      wins: 1,
      losses: 0,
      winRate: 100,
      profit: 145,
      avgOdds: 1.85,
    },
  ],
  weeklyPerformance: [
    { week: 'This Week', winRate: 75, predictions: 4 },
    { week: 'Last Week', winRate: 60, predictions: 5 },
    { week: '2 Weeks Ago', winRate: 66, predictions: 3 },
  ],
};

// ============================================================================
// EXTENDED MARKETS (for events)
// ============================================================================

export function getExtendedMarketsForEvent(eventId: string): {
  overUnder?: { line: number; over: number; under: number };
  btts?: { yes: number; no: number };
  handicap?: { line: number; home: number; away: number };
} | null {
  // Only football events get extended markets
  const event = getEventById(eventId);
  if (!event || event.sport.slug !== 'football') return null;

  return {
    overUnder: { line: 2.5, over: 1.85, under: 1.95 },
    btts: { yes: 1.75, no: 2.05 },
    handicap: { line: -1, home: 2.4, away: 1.55 },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Aliases for store.tsx
export const mockUser = CURRENT_USER;
export const mockUserStats = CURRENT_USER_STATS;
export const mockPredictions = PREDICTIONS;
export const mockTransactions = TRANSACTIONS;
export const mockChallenges = USER_CHALLENGE_PROGRESS;
export const mockAchievements = USER_ACHIEVEMENTS;
export const mockFriends = FRIENDS;
export const mockFriendActivity = FRIEND_ACTIVITY;
export const mockFriendPredictions = FRIEND_PREDICTIONS;
export const mockReferrals = REFERRALS;
export const mockReferralStats = REFERRAL_STATS;
export const mockPredictionInsights = PREDICTION_INSIGHTS;
