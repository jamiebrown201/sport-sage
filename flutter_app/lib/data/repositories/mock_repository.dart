import '../models/mock_models.dart';

/// Repository for mock data (challenges, achievements, friends, shop)
/// In a production app, these would connect to real API endpoints
class MockRepository {
  /// Get daily challenges
  Future<List<Challenge>> getDailyChallenges() async {
    // Simulate API delay
    await Future.delayed(const Duration(milliseconds: 300));

    final now = DateTime.now();
    final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59);

    return [
      Challenge(
        id: 'challenge_1',
        title: 'Winning Streak',
        description: 'Win 3 predictions in a row',
        difficulty: ChallengeDifficulty.medium,
        rewardCoins: 200,
        rewardStars: 50,
        targetCount: 3,
        currentProgress: 1,
        expiresAt: endOfDay,
      ),
      Challenge(
        id: 'challenge_2',
        title: 'Football Fan',
        description: 'Place 5 predictions on football matches',
        difficulty: ChallengeDifficulty.easy,
        rewardCoins: 100,
        rewardStars: 25,
        targetCount: 5,
        currentProgress: 3,
        expiresAt: endOfDay,
      ),
      Challenge(
        id: 'challenge_3',
        title: 'High Roller',
        description: 'Place an accumulator with 4+ selections',
        difficulty: ChallengeDifficulty.hard,
        rewardCoins: 500,
        rewardStars: 100,
        targetCount: 1,
        currentProgress: 0,
        expiresAt: endOfDay,
      ),
    ];
  }

  /// Get user achievements
  Future<List<Achievement>> getAchievements() async {
    await Future.delayed(const Duration(milliseconds: 300));

    return [
      const Achievement(
        id: 'ach_first_win',
        title: 'First Victory',
        description: 'Win your first prediction',
        iconName: 'trophy',
        category: AchievementCategory.predictions,
        rarity: AchievementRarity.common,
        rewardCoins: 100,
        rewardStars: 10,
        targetCount: 1,
        currentProgress: 1,
        isUnlocked: true,
      ),
      const Achievement(
        id: 'ach_streak_5',
        title: 'On Fire',
        description: 'Achieve a 5-win streak',
        iconName: 'flame',
        category: AchievementCategory.streaks,
        rarity: AchievementRarity.uncommon,
        rewardCoins: 250,
        rewardStars: 50,
        targetCount: 5,
        currentProgress: 3,
      ),
      const Achievement(
        id: 'ach_streak_10',
        title: 'Unstoppable',
        description: 'Achieve a 10-win streak',
        iconName: 'fire',
        category: AchievementCategory.streaks,
        rarity: AchievementRarity.rare,
        rewardCoins: 500,
        rewardStars: 100,
        rewardGems: 10,
        targetCount: 10,
        currentProgress: 3,
      ),
      const Achievement(
        id: 'ach_predictions_100',
        title: 'Seasoned Predictor',
        description: 'Make 100 predictions',
        iconName: 'chart',
        category: AchievementCategory.milestones,
        rarity: AchievementRarity.uncommon,
        rewardCoins: 300,
        rewardStars: 75,
        targetCount: 100,
        currentProgress: 45,
      ),
      const Achievement(
        id: 'ach_acca_win',
        title: 'Acca Hero',
        description: 'Win an accumulator with 5+ selections',
        iconName: 'star',
        category: AchievementCategory.predictions,
        rarity: AchievementRarity.epic,
        rewardCoins: 1000,
        rewardStars: 200,
        rewardGems: 25,
        targetCount: 1,
        currentProgress: 0,
      ),
      const Achievement(
        id: 'ach_top_10',
        title: 'Elite Player',
        description: 'Reach top 10 on the leaderboard',
        iconName: 'crown',
        category: AchievementCategory.milestones,
        rarity: AchievementRarity.legendary,
        rewardCoins: 2000,
        rewardStars: 500,
        rewardGems: 50,
        targetCount: 1,
        currentProgress: 0,
      ),
    ];
  }

  /// Get friends list
  Future<List<Friend>> getFriends() async {
    await Future.delayed(const Duration(milliseconds: 300));

    return [
      Friend(
        id: 'friend_1',
        username: 'ProPlayer99',
        status: FriendStatus.accepted,
        totalStars: 4520,
        currentStreak: 7,
        winRate: 68.5,
        isOnline: true,
      ),
      Friend(
        id: 'friend_2',
        username: 'SoccerKing',
        status: FriendStatus.accepted,
        totalStars: 3200,
        currentStreak: 3,
        winRate: 62.0,
        isOnline: false,
        lastActiveAt: DateTime.now().subtract(const Duration(hours: 2)),
      ),
      Friend(
        id: 'friend_3',
        username: 'LuckyBettor',
        status: FriendStatus.accepted,
        totalStars: 2800,
        currentStreak: 0,
        winRate: 55.5,
        isOnline: false,
        lastActiveAt: DateTime.now().subtract(const Duration(days: 1)),
      ),
    ];
  }

  /// Get pending friend requests
  Future<List<Friend>> getPendingFriendRequests() async {
    await Future.delayed(const Duration(milliseconds: 200));

    return [
      Friend(
        id: 'pending_1',
        username: 'NewUser123',
        status: FriendStatus.pending,
        totalStars: 500,
        winRate: 50.0,
      ),
    ];
  }

  /// Get cosmetic items for shop
  Future<List<CosmeticItem>> getCosmeticItems() async {
    await Future.delayed(const Duration(milliseconds: 300));

    return [
      const CosmeticItem(
        id: 'avatar_gold',
        name: 'Golden Avatar',
        description: 'A prestigious golden avatar frame',
        type: CosmeticType.avatar,
        priceGems: 100,
      ),
      const CosmeticItem(
        id: 'badge_vip',
        name: 'VIP Badge',
        description: 'Show off your VIP status',
        type: CosmeticType.badge,
        priceGems: 50,
      ),
      const CosmeticItem(
        id: 'border_fire',
        name: 'Fire Border',
        description: 'An animated fire border effect',
        type: CosmeticType.border,
        priceGems: 150,
      ),
      const CosmeticItem(
        id: 'title_champion',
        name: 'Champion Title',
        description: 'Display "Champion" under your name',
        type: CosmeticType.title,
        priceGems: 75,
      ),
    ];
  }

  /// Get gem packs for shop
  Future<List<GemPack>> getGemPacks() async {
    await Future.delayed(const Duration(milliseconds: 200));

    return const [
      GemPack(
        id: 'gems_small',
        name: 'Small Pack',
        gems: 100,
        priceUsd: 0.99,
      ),
      GemPack(
        id: 'gems_medium',
        name: 'Medium Pack',
        gems: 500,
        priceUsd: 4.99,
        bonusGems: 50,
      ),
      GemPack(
        id: 'gems_large',
        name: 'Large Pack',
        gems: 1200,
        priceUsd: 9.99,
        bonusGems: 200,
        isBestValue: true,
      ),
      GemPack(
        id: 'gems_mega',
        name: 'Mega Pack',
        gems: 2500,
        priceUsd: 19.99,
        bonusGems: 500,
      ),
    ];
  }

  /// Get subscription plans
  Future<List<SubscriptionPlan>> getSubscriptionPlans() async {
    await Future.delayed(const Duration(milliseconds: 200));

    return const [
      SubscriptionPlan(
        id: 'free',
        name: 'Free',
        tier: 'free',
        monthlyPrice: 0,
        yearlyPrice: 0,
        dailyCoins: 500,
        features: [
          '500 daily coins',
          'Access to all sports',
          'Basic statistics',
        ],
      ),
      SubscriptionPlan(
        id: 'pro',
        name: 'Pro',
        tier: 'pro',
        monthlyPrice: 4.99,
        yearlyPrice: 39.99,
        dailyCoins: 1000,
        monthlyGems: 100,
        hasStreakShield: true,
        features: [
          '1,000 daily coins',
          '100 gems per month',
          'Streak shield protection',
          'Advanced statistics',
          'No ads',
        ],
      ),
      SubscriptionPlan(
        id: 'elite',
        name: 'Elite',
        tier: 'elite',
        monthlyPrice: 9.99,
        yearlyPrice: 79.99,
        dailyCoins: 2000,
        monthlyGems: 300,
        hasStreakShield: true,
        hasExclusiveCosmetics: true,
        hasInsights: true,
        features: [
          '2,000 daily coins',
          '300 gems per month',
          'Streak shield protection',
          'AI-powered insights',
          'Exclusive cosmetics',
          'Priority support',
          'No ads',
        ],
      ),
    ];
  }
}
