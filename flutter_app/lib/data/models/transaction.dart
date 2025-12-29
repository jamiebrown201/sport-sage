import 'package:equatable/equatable.dart';

/// Transaction type enum
enum TransactionType {
  welcomeBonus,
  dailyTopup,
  predictionStake,
  predictionWin,
  predictionRefund,
  referralBonus,
  challengeReward,
  achievementReward,
  purchase,
  subscription;

  static TransactionType fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'welcome_bonus':
        return TransactionType.welcomeBonus;
      case 'daily_topup':
        return TransactionType.dailyTopup;
      case 'prediction_stake':
        return TransactionType.predictionStake;
      case 'prediction_win':
        return TransactionType.predictionWin;
      case 'prediction_refund':
        return TransactionType.predictionRefund;
      case 'referral_bonus':
        return TransactionType.referralBonus;
      case 'challenge_reward':
        return TransactionType.challengeReward;
      case 'achievement_reward':
        return TransactionType.achievementReward;
      case 'purchase':
        return TransactionType.purchase;
      case 'subscription':
        return TransactionType.subscription;
      default:
        return TransactionType.dailyTopup;
    }
  }

  String get displayName {
    switch (this) {
      case TransactionType.welcomeBonus:
        return 'Welcome Bonus';
      case TransactionType.dailyTopup:
        return 'Daily Top-up';
      case TransactionType.predictionStake:
        return 'Prediction';
      case TransactionType.predictionWin:
        return 'Winnings';
      case TransactionType.predictionRefund:
        return 'Refund';
      case TransactionType.referralBonus:
        return 'Referral Bonus';
      case TransactionType.challengeReward:
        return 'Challenge Reward';
      case TransactionType.achievementReward:
        return 'Achievement';
      case TransactionType.purchase:
        return 'Purchase';
      case TransactionType.subscription:
        return 'Subscription';
    }
  }

  bool get isCredit {
    switch (this) {
      case TransactionType.predictionStake:
      case TransactionType.purchase:
      case TransactionType.subscription:
        return false;
      default:
        return true;
    }
  }
}

/// Currency type enum
enum CurrencyType {
  coins,
  stars,
  gems;

  static CurrencyType fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'stars':
        return CurrencyType.stars;
      case 'gems':
        return CurrencyType.gems;
      default:
        return CurrencyType.coins;
    }
  }

  String get displayName {
    switch (this) {
      case CurrencyType.coins:
        return 'Coins';
      case CurrencyType.stars:
        return 'Stars';
      case CurrencyType.gems:
        return 'Gems';
    }
  }

  String get symbol {
    switch (this) {
      case CurrencyType.coins:
        return '🪙';
      case CurrencyType.stars:
        return '⭐';
      case CurrencyType.gems:
        return '💎';
    }
  }
}

/// Transaction model
class Transaction extends Equatable {
  final String id;
  final String userId;
  final TransactionType type;
  final CurrencyType currency;
  final int amount;
  final int balanceAfter;
  final String? description;
  final String? referenceId;
  final DateTime createdAt;

  const Transaction({
    required this.id,
    required this.userId,
    required this.type,
    required this.currency,
    required this.amount,
    required this.balanceAfter,
    this.description,
    this.referenceId,
    required this.createdAt,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] as String,
      userId: json['userId'] as String? ?? '',
      type: TransactionType.fromString(json['type'] as String?),
      currency: CurrencyType.fromString(json['currency'] as String?),
      amount: json['amount'] as int,
      balanceAfter: json['balanceAfter'] as int,
      description: json['description'] as String?,
      referenceId: json['referenceId'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'type': type.name,
      'currency': currency.name,
      'amount': amount,
      'balanceAfter': balanceAfter,
      'description': description,
      'referenceId': referenceId,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  /// Check if this is a credit (positive) transaction
  bool get isCredit => type.isCredit;

  /// Get signed amount (positive or negative)
  int get signedAmount => isCredit ? amount : -amount;

  /// Get display amount with sign
  String get displayAmount => isCredit ? '+$amount' : '-$amount';

  @override
  List<Object?> get props => [
        id,
        userId,
        type,
        currency,
        amount,
        balanceAfter,
        description,
        referenceId,
        createdAt,
      ];
}
