import 'package:equatable/equatable.dart';

/// Subscription tier levels
enum SubscriptionTier {
  free,
  pro,
  elite;

  static SubscriptionTier fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'pro':
        return SubscriptionTier.pro;
      case 'elite':
        return SubscriptionTier.elite;
      default:
        return SubscriptionTier.free;
    }
  }

  String get displayName {
    switch (this) {
      case SubscriptionTier.free:
        return 'Free';
      case SubscriptionTier.pro:
        return 'Pro';
      case SubscriptionTier.elite:
        return 'Elite';
    }
  }
}

/// User model
class User extends Equatable {
  final String id;
  final String cognitoId;
  final String username;
  final String email;
  final int coins;
  final int stars;
  final int gems;
  final SubscriptionTier subscriptionTier;
  final DateTime? subscriptionExpiresAt;
  final bool isAdsEnabled;
  final bool isOver18;
  final bool showAffiliates;
  final String? avatarUrl;
  final String referralCode;
  final DateTime createdAt;
  final DateTime updatedAt;

  const User({
    required this.id,
    required this.cognitoId,
    required this.username,
    required this.email,
    required this.coins,
    required this.stars,
    required this.gems,
    required this.subscriptionTier,
    this.subscriptionExpiresAt,
    required this.isAdsEnabled,
    required this.isOver18,
    required this.showAffiliates,
    this.avatarUrl,
    required this.referralCode,
    required this.createdAt,
    required this.updatedAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      cognitoId: json['cognitoId'] as String,
      username: json['username'] as String,
      email: json['email'] as String,
      coins: json['coins'] as int? ?? 0,
      stars: json['stars'] as int? ?? 0,
      gems: json['gems'] as int? ?? 0,
      subscriptionTier: SubscriptionTier.fromString(json['subscriptionTier'] as String?),
      subscriptionExpiresAt: json['subscriptionExpiresAt'] != null
          ? DateTime.parse(json['subscriptionExpiresAt'] as String)
          : null,
      isAdsEnabled: json['isAdsEnabled'] as bool? ?? true,
      isOver18: json['isOver18'] as bool? ?? false,
      showAffiliates: json['showAffiliates'] as bool? ?? false,
      avatarUrl: json['avatarUrl'] as String?,
      referralCode: json['referralCode'] as String? ?? '',
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'cognitoId': cognitoId,
      'username': username,
      'email': email,
      'coins': coins,
      'stars': stars,
      'gems': gems,
      'subscriptionTier': subscriptionTier.name,
      'subscriptionExpiresAt': subscriptionExpiresAt?.toIso8601String(),
      'isAdsEnabled': isAdsEnabled,
      'isOver18': isOver18,
      'showAffiliates': showAffiliates,
      'avatarUrl': avatarUrl,
      'referralCode': referralCode,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  User copyWith({
    String? id,
    String? cognitoId,
    String? username,
    String? email,
    int? coins,
    int? stars,
    int? gems,
    SubscriptionTier? subscriptionTier,
    DateTime? subscriptionExpiresAt,
    bool? isAdsEnabled,
    bool? isOver18,
    bool? showAffiliates,
    String? avatarUrl,
    String? referralCode,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return User(
      id: id ?? this.id,
      cognitoId: cognitoId ?? this.cognitoId,
      username: username ?? this.username,
      email: email ?? this.email,
      coins: coins ?? this.coins,
      stars: stars ?? this.stars,
      gems: gems ?? this.gems,
      subscriptionTier: subscriptionTier ?? this.subscriptionTier,
      subscriptionExpiresAt: subscriptionExpiresAt ?? this.subscriptionExpiresAt,
      isAdsEnabled: isAdsEnabled ?? this.isAdsEnabled,
      isOver18: isOver18 ?? this.isOver18,
      showAffiliates: showAffiliates ?? this.showAffiliates,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      referralCode: referralCode ?? this.referralCode,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  /// Get user initials for avatar fallback
  String get initials {
    if (username.isEmpty) return '?';
    if (username.length == 1) return username.toUpperCase();
    return username.substring(0, 2).toUpperCase();
  }

  /// Check if user has premium subscription
  bool get isPremium =>
      subscriptionTier != SubscriptionTier.free &&
      (subscriptionExpiresAt == null ||
          subscriptionExpiresAt!.isAfter(DateTime.now()));

  @override
  List<Object?> get props => [
        id,
        cognitoId,
        username,
        email,
        coins,
        stars,
        gems,
        subscriptionTier,
        subscriptionExpiresAt,
        isAdsEnabled,
        isOver18,
        showAffiliates,
        avatarUrl,
        referralCode,
        createdAt,
        updatedAt,
      ];
}
