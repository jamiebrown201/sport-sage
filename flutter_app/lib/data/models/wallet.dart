import 'package:equatable/equatable.dart';

/// Wallet balance model
class Wallet extends Equatable {
  final int coins;
  final int stars;
  final int gems;
  final String subscriptionTier;
  final bool canClaimDailyTopup;
  final DateTime? nextTopupAt;

  const Wallet({
    required this.coins,
    required this.stars,
    required this.gems,
    required this.subscriptionTier,
    required this.canClaimDailyTopup,
    this.nextTopupAt,
  });

  factory Wallet.fromJson(Map<String, dynamic> json) {
    return Wallet(
      coins: json['coins'] as int? ?? 0,
      stars: json['stars'] as int? ?? 0,
      gems: json['gems'] as int? ?? 0,
      subscriptionTier: json['subscriptionTier'] as String? ?? 'free',
      canClaimDailyTopup: json['canClaimDailyTopup'] as bool? ?? false,
      nextTopupAt: json['nextTopupAt'] != null
          ? DateTime.parse(json['nextTopupAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'coins': coins,
      'stars': stars,
      'gems': gems,
      'subscriptionTier': subscriptionTier,
      'canClaimDailyTopup': canClaimDailyTopup,
      'nextTopupAt': nextTopupAt?.toIso8601String(),
    };
  }

  Wallet copyWith({
    int? coins,
    int? stars,
    int? gems,
    String? subscriptionTier,
    bool? canClaimDailyTopup,
    DateTime? nextTopupAt,
  }) {
    return Wallet(
      coins: coins ?? this.coins,
      stars: stars ?? this.stars,
      gems: gems ?? this.gems,
      subscriptionTier: subscriptionTier ?? this.subscriptionTier,
      canClaimDailyTopup: canClaimDailyTopup ?? this.canClaimDailyTopup,
      nextTopupAt: nextTopupAt ?? this.nextTopupAt,
    );
  }

  /// Check if user has enough coins for a stake
  bool canAfford(int amount) => coins >= amount;

  /// Get time until next topup
  Duration? get timeUntilTopup {
    if (nextTopupAt == null) return null;
    final now = DateTime.now();
    if (nextTopupAt!.isBefore(now)) return Duration.zero;
    return nextTopupAt!.difference(now);
  }

  @override
  List<Object?> get props => [
        coins,
        stars,
        gems,
        subscriptionTier,
        canClaimDailyTopup,
        nextTopupAt,
      ];
}

/// Daily topup status
class TopupStatus extends Equatable {
  final bool canClaim;
  final int amount;
  final DateTime? lastClaimedAt;
  final DateTime? nextClaimAt;
  final double hoursUntilNextClaim;

  const TopupStatus({
    required this.canClaim,
    required this.amount,
    this.lastClaimedAt,
    this.nextClaimAt,
    this.hoursUntilNextClaim = 0,
  });

  factory TopupStatus.fromJson(Map<String, dynamic> json) {
    return TopupStatus(
      canClaim: json['canClaim'] as bool? ?? false,
      amount: json['amount'] as int? ?? 500,
      lastClaimedAt: json['lastClaimedAt'] != null
          ? DateTime.parse(json['lastClaimedAt'] as String)
          : null,
      nextClaimAt: json['nextClaimAt'] != null
          ? DateTime.parse(json['nextClaimAt'] as String)
          : null,
      hoursUntilNextClaim: (json['hoursUntilNextClaim'] as num?)?.toDouble() ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'canClaim': canClaim,
      'amount': amount,
      'lastClaimedAt': lastClaimedAt?.toIso8601String(),
      'nextClaimAt': nextClaimAt?.toIso8601String(),
      'hoursUntilNextClaim': hoursUntilNextClaim,
    };
  }

  /// Get formatted time until next claim
  String get timeUntilNextClaimFormatted {
    if (canClaim) return 'Ready!';
    final hours = hoursUntilNextClaim.floor();
    final minutes = ((hoursUntilNextClaim - hours) * 60).floor();
    if (hours > 0) {
      return '${hours}h ${minutes}m';
    }
    return '${minutes}m';
  }

  @override
  List<Object?> get props => [
        canClaim,
        amount,
        lastClaimedAt,
        nextClaimAt,
        hoursUntilNextClaim,
      ];
}

/// Topup claim result
class TopupResult extends Equatable {
  final String message;
  final int coinsAdded;
  final int newBalance;
  final DateTime nextClaimAt;

  const TopupResult({
    required this.message,
    required this.coinsAdded,
    required this.newBalance,
    required this.nextClaimAt,
  });

  factory TopupResult.fromJson(Map<String, dynamic> json) {
    return TopupResult(
      message: json['message'] as String? ?? 'Top-up claimed!',
      coinsAdded: json['coinsAdded'] as int? ?? 0,
      newBalance: json['newBalance'] as int? ?? 0,
      nextClaimAt: DateTime.parse(json['nextClaimAt'] as String),
    );
  }

  @override
  List<Object?> get props => [message, coinsAdded, newBalance, nextClaimAt];
}
