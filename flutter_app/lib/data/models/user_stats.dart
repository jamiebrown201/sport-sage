import 'package:equatable/equatable.dart';

/// User statistics model
class UserStats extends Equatable {
  final String userId;
  final int totalPredictions;
  final int totalWins;
  final int totalLosses;
  final int currentStreak;
  final int bestStreak;
  final int totalStarsEarned;
  final int totalCoinsWagered;
  final int totalAccumulatorsWon;
  final int biggestWin;
  final DateTime? lastTopupDate;
  final int adsWatchedToday;
  final bool hasPredictionBoost;
  final DateTime? predictionBoostExpiresAt;
  final int loginStreak;
  final DateTime? lastLoginDate;
  final DateTime createdAt;
  final DateTime updatedAt;

  const UserStats({
    required this.userId,
    this.totalPredictions = 0,
    this.totalWins = 0,
    this.totalLosses = 0,
    this.currentStreak = 0,
    this.bestStreak = 0,
    this.totalStarsEarned = 0,
    this.totalCoinsWagered = 0,
    this.totalAccumulatorsWon = 0,
    this.biggestWin = 0,
    this.lastTopupDate,
    this.adsWatchedToday = 0,
    this.hasPredictionBoost = false,
    this.predictionBoostExpiresAt,
    this.loginStreak = 0,
    this.lastLoginDate,
    required this.createdAt,
    required this.updatedAt,
  });

  factory UserStats.fromJson(Map<String, dynamic> json) {
    return UserStats(
      userId: json['userId'] as String,
      totalPredictions: json['totalPredictions'] as int? ?? 0,
      totalWins: json['totalWins'] as int? ?? 0,
      totalLosses: json['totalLosses'] as int? ?? 0,
      currentStreak: json['currentStreak'] as int? ?? 0,
      bestStreak: json['bestStreak'] as int? ?? 0,
      totalStarsEarned: json['totalStarsEarned'] as int? ?? 0,
      totalCoinsWagered: json['totalCoinsWagered'] as int? ?? 0,
      totalAccumulatorsWon: json['totalAccumulatorsWon'] as int? ?? 0,
      biggestWin: json['biggestWin'] as int? ?? 0,
      lastTopupDate: json['lastTopupDate'] != null
          ? DateTime.parse(json['lastTopupDate'] as String)
          : null,
      adsWatchedToday: json['adsWatchedToday'] as int? ?? 0,
      hasPredictionBoost: json['hasPredictionBoost'] as bool? ?? false,
      predictionBoostExpiresAt: json['predictionBoostExpiresAt'] != null
          ? DateTime.parse(json['predictionBoostExpiresAt'] as String)
          : null,
      loginStreak: json['loginStreak'] as int? ?? 0,
      lastLoginDate: json['lastLoginDate'] != null
          ? DateTime.parse(json['lastLoginDate'] as String)
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'totalPredictions': totalPredictions,
      'totalWins': totalWins,
      'totalLosses': totalLosses,
      'currentStreak': currentStreak,
      'bestStreak': bestStreak,
      'totalStarsEarned': totalStarsEarned,
      'totalCoinsWagered': totalCoinsWagered,
      'totalAccumulatorsWon': totalAccumulatorsWon,
      'biggestWin': biggestWin,
      'lastTopupDate': lastTopupDate?.toIso8601String(),
      'adsWatchedToday': adsWatchedToday,
      'hasPredictionBoost': hasPredictionBoost,
      'predictionBoostExpiresAt': predictionBoostExpiresAt?.toIso8601String(),
      'loginStreak': loginStreak,
      'lastLoginDate': lastLoginDate?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  UserStats copyWith({
    String? userId,
    int? totalPredictions,
    int? totalWins,
    int? totalLosses,
    int? currentStreak,
    int? bestStreak,
    int? totalStarsEarned,
    int? totalCoinsWagered,
    int? totalAccumulatorsWon,
    int? biggestWin,
    DateTime? lastTopupDate,
    int? adsWatchedToday,
    bool? hasPredictionBoost,
    DateTime? predictionBoostExpiresAt,
    int? loginStreak,
    DateTime? lastLoginDate,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return UserStats(
      userId: userId ?? this.userId,
      totalPredictions: totalPredictions ?? this.totalPredictions,
      totalWins: totalWins ?? this.totalWins,
      totalLosses: totalLosses ?? this.totalLosses,
      currentStreak: currentStreak ?? this.currentStreak,
      bestStreak: bestStreak ?? this.bestStreak,
      totalStarsEarned: totalStarsEarned ?? this.totalStarsEarned,
      totalCoinsWagered: totalCoinsWagered ?? this.totalCoinsWagered,
      totalAccumulatorsWon: totalAccumulatorsWon ?? this.totalAccumulatorsWon,
      biggestWin: biggestWin ?? this.biggestWin,
      lastTopupDate: lastTopupDate ?? this.lastTopupDate,
      adsWatchedToday: adsWatchedToday ?? this.adsWatchedToday,
      hasPredictionBoost: hasPredictionBoost ?? this.hasPredictionBoost,
      predictionBoostExpiresAt:
          predictionBoostExpiresAt ?? this.predictionBoostExpiresAt,
      loginStreak: loginStreak ?? this.loginStreak,
      lastLoginDate: lastLoginDate ?? this.lastLoginDate,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  /// Calculate win rate percentage
  double get winRate {
    if (totalWins + totalLosses == 0) return 0;
    return (totalWins / (totalWins + totalLosses)) * 100;
  }

  /// Get win rate as integer
  int get winRateInt => winRate.round();

  /// Check if daily topup is available
  bool get canClaimDailyTopup {
    if (lastTopupDate == null) return true;
    final now = DateTime.now();
    final hoursSinceTopup = now.difference(lastTopupDate!).inHours;
    return hoursSinceTopup >= 24;
  }

  /// Get hours until next topup
  int get hoursUntilTopup {
    if (canClaimDailyTopup) return 0;
    final now = DateTime.now();
    final nextTopup = lastTopupDate!.add(const Duration(hours: 24));
    return nextTopup.difference(now).inHours + 1;
  }

  /// Check if prediction boost is active
  bool get isPredictionBoostActive {
    if (!hasPredictionBoost) return false;
    if (predictionBoostExpiresAt == null) return false;
    return predictionBoostExpiresAt!.isAfter(DateTime.now());
  }

  /// Get total stars (alias for totalStarsEarned)
  int get totalStars => totalStarsEarned;

  /// Get longest streak (alias for bestStreak)
  int get longestStreak => bestStreak;

  @override
  List<Object?> get props => [
        userId,
        totalPredictions,
        totalWins,
        totalLosses,
        currentStreak,
        bestStreak,
        totalStarsEarned,
        totalCoinsWagered,
        totalAccumulatorsWon,
        biggestWin,
        lastTopupDate,
        adsWatchedToday,
        hasPredictionBoost,
        predictionBoostExpiresAt,
        loginStreak,
        lastLoginDate,
        createdAt,
        updatedAt,
      ];
}
