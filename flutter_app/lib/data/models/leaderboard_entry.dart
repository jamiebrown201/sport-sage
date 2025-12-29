import 'package:equatable/equatable.dart';

/// Leaderboard entry model
class LeaderboardEntry extends Equatable {
  final String id;
  final String userId;
  final String username;
  final String? avatarUrl;
  final int rank;
  final int previousRank;
  final int totalStars;
  final int wins;
  final int losses;
  final int currentStreak;
  final int longestStreak;
  final double winRate;
  final bool isCurrentUser;

  const LeaderboardEntry({
    required this.id,
    required this.userId,
    required this.username,
    this.avatarUrl,
    required this.rank,
    this.previousRank = 0,
    required this.totalStars,
    required this.wins,
    required this.losses,
    this.currentStreak = 0,
    this.longestStreak = 0,
    required this.winRate,
    this.isCurrentUser = false,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json, {bool isCurrentUser = false}) {
    final wins = json['wins'] as int? ?? json['totalWins'] as int? ?? 0;
    final losses = json['losses'] as int? ?? json['totalLosses'] as int? ?? 0;
    final winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0.0;

    return LeaderboardEntry(
      id: json['id'] as String? ?? json['userId'] as String? ?? '',
      userId: json['userId'] as String? ?? json['id'] as String? ?? '',
      username: json['username'] as String? ?? 'Anonymous',
      avatarUrl: json['avatarUrl'] as String?,
      rank: json['rank'] as int? ?? 0,
      previousRank: json['previousRank'] as int? ?? 0,
      totalStars: json['totalStars'] as int? ?? json['stars'] as int? ?? 0,
      wins: wins,
      losses: losses,
      currentStreak: json['currentStreak'] as int? ?? 0,
      longestStreak: json['longestStreak'] as int? ?? 0,
      winRate: (json['winRate'] as num?)?.toDouble() ?? winRate,
      isCurrentUser: isCurrentUser,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'username': username,
      'avatarUrl': avatarUrl,
      'rank': rank,
      'previousRank': previousRank,
      'totalStars': totalStars,
      'wins': wins,
      'losses': losses,
      'currentStreak': currentStreak,
      'longestStreak': longestStreak,
      'winRate': winRate,
    };
  }

  LeaderboardEntry copyWith({
    String? id,
    String? userId,
    String? username,
    String? avatarUrl,
    int? rank,
    int? previousRank,
    int? totalStars,
    int? wins,
    int? losses,
    int? currentStreak,
    int? longestStreak,
    double? winRate,
    bool? isCurrentUser,
  }) {
    return LeaderboardEntry(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      username: username ?? this.username,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      rank: rank ?? this.rank,
      previousRank: previousRank ?? this.previousRank,
      totalStars: totalStars ?? this.totalStars,
      wins: wins ?? this.wins,
      losses: losses ?? this.losses,
      currentStreak: currentStreak ?? this.currentStreak,
      longestStreak: longestStreak ?? this.longestStreak,
      winRate: winRate ?? this.winRate,
      isCurrentUser: isCurrentUser ?? this.isCurrentUser,
    );
  }

  /// Get rank change since previous period
  int get rankChange => previousRank - rank;

  /// Check if rank improved
  bool get isRankUp => rankChange > 0;

  /// Check if rank dropped
  bool get isRankDown => rankChange < 0;

  /// Get total predictions
  int get totalPredictions => wins + losses;

  @override
  List<Object?> get props => [
        id,
        userId,
        username,
        avatarUrl,
        rank,
        previousRank,
        totalStars,
        wins,
        losses,
        currentStreak,
        longestStreak,
        winRate,
        isCurrentUser,
      ];
}

/// User's leaderboard position
class LeaderboardPosition extends Equatable {
  final int rank;
  final int totalUsers;
  final int totalStars;
  final double percentile;

  const LeaderboardPosition({
    required this.rank,
    required this.totalUsers,
    required this.totalStars,
    required this.percentile,
  });

  factory LeaderboardPosition.fromJson(Map<String, dynamic> json) {
    return LeaderboardPosition(
      rank: json['rank'] as int? ?? 0,
      totalUsers: json['totalUsers'] as int? ?? 0,
      totalStars: json['totalStars'] as int? ?? 0,
      percentile: (json['percentile'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'rank': rank,
      'totalUsers': totalUsers,
      'totalStars': totalStars,
      'percentile': percentile,
    };
  }

  /// Check if user is in top 10
  bool get isTopTen => rank <= 10;

  /// Check if user is in top 100
  bool get isTopHundred => rank <= 100;

  /// Get rank display (e.g., "1st", "2nd", "3rd")
  String get rankDisplay {
    if (rank >= 11 && rank <= 13) return '${rank}th';
    switch (rank % 10) {
      case 1:
        return '${rank}st';
      case 2:
        return '${rank}nd';
      case 3:
        return '${rank}rd';
      default:
        return '${rank}th';
    }
  }

  @override
  List<Object?> get props => [rank, totalUsers, totalStars, percentile];
}
