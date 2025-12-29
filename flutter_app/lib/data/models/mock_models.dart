import 'package:equatable/equatable.dart';

/// Challenge difficulty
enum ChallengeDifficulty {
  easy,
  medium,
  hard;

  static ChallengeDifficulty fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'medium':
        return ChallengeDifficulty.medium;
      case 'hard':
        return ChallengeDifficulty.hard;
      default:
        return ChallengeDifficulty.easy;
    }
  }
}

/// Challenge model (mock data)
class Challenge extends Equatable {
  final String id;
  final String title;
  final String description;
  final ChallengeDifficulty difficulty;
  final int rewardCoins;
  final int rewardStars;
  final int targetCount;
  final int currentProgress;
  final DateTime expiresAt;
  final bool isCompleted;

  const Challenge({
    required this.id,
    required this.title,
    required this.description,
    required this.difficulty,
    required this.rewardCoins,
    required this.rewardStars,
    required this.targetCount,
    required this.currentProgress,
    required this.expiresAt,
    this.isCompleted = false,
  });

  factory Challenge.fromJson(Map<String, dynamic> json) {
    return Challenge(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      difficulty: ChallengeDifficulty.fromString(json['difficulty'] as String?),
      rewardCoins: json['rewardCoins'] as int? ?? 0,
      rewardStars: json['rewardStars'] as int? ?? 0,
      targetCount: json['targetCount'] as int,
      currentProgress: json['currentProgress'] as int? ?? 0,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      isCompleted: json['isCompleted'] as bool? ?? false,
    );
  }

  double get progressPercent =>
      targetCount > 0 ? (currentProgress / targetCount).clamp(0.0, 1.0) : 0.0;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  @override
  List<Object?> get props => [
        id,
        title,
        description,
        difficulty,
        rewardCoins,
        rewardStars,
        targetCount,
        currentProgress,
        expiresAt,
        isCompleted,
      ];
}

/// Achievement category
enum AchievementCategory {
  predictions,
  streaks,
  social,
  milestones,
  special;

  static AchievementCategory fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'streaks':
        return AchievementCategory.streaks;
      case 'social':
        return AchievementCategory.social;
      case 'milestones':
        return AchievementCategory.milestones;
      case 'special':
        return AchievementCategory.special;
      default:
        return AchievementCategory.predictions;
    }
  }
}

/// Achievement rarity
enum AchievementRarity {
  common,
  uncommon,
  rare,
  epic,
  legendary;

  static AchievementRarity fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'uncommon':
        return AchievementRarity.uncommon;
      case 'rare':
        return AchievementRarity.rare;
      case 'epic':
        return AchievementRarity.epic;
      case 'legendary':
        return AchievementRarity.legendary;
      default:
        return AchievementRarity.common;
    }
  }
}

/// Achievement model (mock data)
class Achievement extends Equatable {
  final String id;
  final String title;
  final String description;
  final String iconName;
  final AchievementCategory category;
  final AchievementRarity rarity;
  final int rewardCoins;
  final int rewardStars;
  final int rewardGems;
  final int targetCount;
  final int currentProgress;
  final bool isUnlocked;
  final DateTime? unlockedAt;

  const Achievement({
    required this.id,
    required this.title,
    required this.description,
    required this.iconName,
    required this.category,
    required this.rarity,
    this.rewardCoins = 0,
    this.rewardStars = 0,
    this.rewardGems = 0,
    required this.targetCount,
    required this.currentProgress,
    this.isUnlocked = false,
    this.unlockedAt,
  });

  factory Achievement.fromJson(Map<String, dynamic> json) {
    return Achievement(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      iconName: json['iconName'] as String? ?? 'trophy',
      category: AchievementCategory.fromString(json['category'] as String?),
      rarity: AchievementRarity.fromString(json['rarity'] as String?),
      rewardCoins: json['rewardCoins'] as int? ?? 0,
      rewardStars: json['rewardStars'] as int? ?? 0,
      rewardGems: json['rewardGems'] as int? ?? 0,
      targetCount: json['targetCount'] as int,
      currentProgress: json['currentProgress'] as int? ?? 0,
      isUnlocked: json['isUnlocked'] as bool? ?? false,
      unlockedAt: json['unlockedAt'] != null
          ? DateTime.parse(json['unlockedAt'] as String)
          : null,
    );
  }

  double get progressPercent =>
      targetCount > 0 ? (currentProgress / targetCount).clamp(0.0, 1.0) : 0.0;

  @override
  List<Object?> get props => [
        id,
        title,
        description,
        iconName,
        category,
        rarity,
        rewardCoins,
        rewardStars,
        rewardGems,
        targetCount,
        currentProgress,
        isUnlocked,
        unlockedAt,
      ];
}

/// Friend status
enum FriendStatus {
  pending,
  accepted,
  blocked;

  static FriendStatus fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'accepted':
        return FriendStatus.accepted;
      case 'blocked':
        return FriendStatus.blocked;
      default:
        return FriendStatus.pending;
    }
  }
}

/// Friend model (mock data)
class Friend extends Equatable {
  final String id;
  final String username;
  final String? avatarUrl;
  final FriendStatus status;
  final int totalStars;
  final int currentStreak;
  final double winRate;
  final bool isOnline;
  final DateTime? lastActiveAt;

  const Friend({
    required this.id,
    required this.username,
    this.avatarUrl,
    required this.status,
    required this.totalStars,
    this.currentStreak = 0,
    required this.winRate,
    this.isOnline = false,
    this.lastActiveAt,
  });

  factory Friend.fromJson(Map<String, dynamic> json) {
    return Friend(
      id: json['id'] as String,
      username: json['username'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      status: FriendStatus.fromString(json['status'] as String?),
      totalStars: json['totalStars'] as int? ?? 0,
      currentStreak: json['currentStreak'] as int? ?? 0,
      winRate: (json['winRate'] as num?)?.toDouble() ?? 0.0,
      isOnline: json['isOnline'] as bool? ?? false,
      lastActiveAt: json['lastActiveAt'] != null
          ? DateTime.parse(json['lastActiveAt'] as String)
          : null,
    );
  }

  @override
  List<Object?> get props => [
        id,
        username,
        avatarUrl,
        status,
        totalStars,
        currentStreak,
        winRate,
        isOnline,
        lastActiveAt,
      ];
}

/// Cosmetic item type
enum CosmeticType {
  avatar,
  badge,
  border,
  title;

  static CosmeticType fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'badge':
        return CosmeticType.badge;
      case 'border':
        return CosmeticType.border;
      case 'title':
        return CosmeticType.title;
      default:
        return CosmeticType.avatar;
    }
  }
}

/// Cosmetic item model (mock data for shop)
class CosmeticItem extends Equatable {
  final String id;
  final String name;
  final String? description;
  final CosmeticType type;
  final String? imageUrl;
  final int priceGems;
  final bool isOwned;
  final bool isEquipped;

  const CosmeticItem({
    required this.id,
    required this.name,
    this.description,
    required this.type,
    this.imageUrl,
    required this.priceGems,
    this.isOwned = false,
    this.isEquipped = false,
  });

  factory CosmeticItem.fromJson(Map<String, dynamic> json) {
    return CosmeticItem(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      type: CosmeticType.fromString(json['type'] as String?),
      imageUrl: json['imageUrl'] as String?,
      priceGems: json['priceGems'] as int? ?? 0,
      isOwned: json['isOwned'] as bool? ?? false,
      isEquipped: json['isEquipped'] as bool? ?? false,
    );
  }

  @override
  List<Object?> get props => [
        id,
        name,
        description,
        type,
        imageUrl,
        priceGems,
        isOwned,
        isEquipped,
      ];
}

/// Gem pack for shop
class GemPack extends Equatable {
  final String id;
  final String name;
  final int gems;
  final double priceUsd;
  final int bonusGems;
  final bool isBestValue;

  const GemPack({
    required this.id,
    required this.name,
    required this.gems,
    required this.priceUsd,
    this.bonusGems = 0,
    this.isBestValue = false,
  });

  factory GemPack.fromJson(Map<String, dynamic> json) {
    return GemPack(
      id: json['id'] as String,
      name: json['name'] as String,
      gems: json['gems'] as int,
      priceUsd: (json['priceUsd'] as num).toDouble(),
      bonusGems: json['bonusGems'] as int? ?? 0,
      isBestValue: json['isBestValue'] as bool? ?? false,
    );
  }

  int get totalGems => gems + bonusGems;
  double get pricePerGem => priceUsd / totalGems;

  @override
  List<Object?> get props => [id, name, gems, priceUsd, bonusGems, isBestValue];
}

/// Subscription plan for shop
class SubscriptionPlan extends Equatable {
  final String id;
  final String name;
  final String tier;
  final double monthlyPrice;
  final double yearlyPrice;
  final int dailyCoins;
  final int monthlyGems;
  final bool hasStreakShield;
  final bool hasExclusiveCosmetics;
  final bool hasInsights;
  final List<String> features;

  const SubscriptionPlan({
    required this.id,
    required this.name,
    required this.tier,
    required this.monthlyPrice,
    required this.yearlyPrice,
    required this.dailyCoins,
    this.monthlyGems = 0,
    this.hasStreakShield = false,
    this.hasExclusiveCosmetics = false,
    this.hasInsights = false,
    this.features = const [],
  });

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) {
    return SubscriptionPlan(
      id: json['id'] as String,
      name: json['name'] as String,
      tier: json['tier'] as String,
      monthlyPrice: (json['monthlyPrice'] as num).toDouble(),
      yearlyPrice: (json['yearlyPrice'] as num).toDouble(),
      dailyCoins: json['dailyCoins'] as int,
      monthlyGems: json['monthlyGems'] as int? ?? 0,
      hasStreakShield: json['hasStreakShield'] as bool? ?? false,
      hasExclusiveCosmetics: json['hasExclusiveCosmetics'] as bool? ?? false,
      hasInsights: json['hasInsights'] as bool? ?? false,
      features: (json['features'] as List<dynamic>?)
              ?.map((f) => f as String)
              .toList() ??
          [],
    );
  }

  double get yearlySavings => (monthlyPrice * 12) - yearlyPrice;
  int get yearlySavingsPercent =>
      ((yearlySavings / (monthlyPrice * 12)) * 100).round();

  @override
  List<Object?> get props => [
        id,
        name,
        tier,
        monthlyPrice,
        yearlyPrice,
        dailyCoins,
        monthlyGems,
        hasStreakShield,
        hasExclusiveCosmetics,
        hasInsights,
        features,
      ];
}
