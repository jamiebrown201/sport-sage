import '../models/leaderboard_entry.dart';
import '../services/api/api_client.dart';
import '../services/api/api_endpoints.dart';

/// Leaderboard period
enum LeaderboardPeriod {
  daily,
  weekly,
  monthly,
  allTime;

  String get apiValue {
    switch (this) {
      case LeaderboardPeriod.daily:
        return 'daily';
      case LeaderboardPeriod.weekly:
        return 'weekly';
      case LeaderboardPeriod.monthly:
        return 'monthly';
      case LeaderboardPeriod.allTime:
        return 'all_time';
    }
  }
}

/// Leaderboard response
class LeaderboardResponse {
  final List<LeaderboardEntry> entries;
  final LeaderboardPosition? userPosition;
  final int page;
  final int pageSize;
  final int total;
  final bool hasMore;

  LeaderboardResponse({
    required this.entries,
    this.userPosition,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.hasMore,
  });
}

/// Repository for leaderboard operations
class LeaderboardRepository {
  final ApiClient _apiClient;

  LeaderboardRepository(this._apiClient);

  /// Get leaderboard entries
  Future<LeaderboardResponse> getLeaderboard({
    LeaderboardPeriod period = LeaderboardPeriod.weekly,
    int page = 1,
    int pageSize = 50,
    bool friendsOnly = false,
  }) async {
    final queryParams = <String, dynamic>{
      'period': period.apiValue,
      'page': page.toString(),
      'pageSize': pageSize.toString(),
    };

    if (friendsOnly) queryParams['friendsOnly'] = 'true';

    final response = await _apiClient.get(
      ApiEndpoints.leaderboard,
      queryParameters: queryParams,
      requiresAuth: true,
    );

    final entries = (response['data'] as List<dynamic>?)
            ?.map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    final pagination = response['pagination'] as Map<String, dynamic>?;

    LeaderboardPosition? userPosition;
    if (response['userPosition'] != null) {
      userPosition = LeaderboardPosition.fromJson(
        response['userPosition'] as Map<String, dynamic>,
      );
    }

    return LeaderboardResponse(
      entries: entries,
      userPosition: userPosition,
      page: pagination?['page'] as int? ?? page,
      pageSize: pagination?['pageSize'] as int? ?? pageSize,
      total: pagination?['total'] as int? ?? entries.length,
      hasMore: pagination?['hasMore'] as bool? ?? false,
    );
  }

  /// Get user's leaderboard position
  Future<LeaderboardPosition> getUserPosition({
    LeaderboardPeriod period = LeaderboardPeriod.weekly,
  }) async {
    final response = await _apiClient.get(
      ApiEndpoints.leaderboardPosition,
      queryParameters: {'period': period.apiValue},
      requiresAuth: true,
    );

    return LeaderboardPosition.fromJson(response);
  }

  /// Get top 10 for display
  Future<List<LeaderboardEntry>> getTopTen({
    LeaderboardPeriod period = LeaderboardPeriod.weekly,
  }) async {
    final response = await getLeaderboard(
      period: period,
      page: 1,
      pageSize: 10,
    );
    return response.entries;
  }

  /// Get friends leaderboard
  Future<List<LeaderboardEntry>> getFriendsLeaderboard({
    LeaderboardPeriod period = LeaderboardPeriod.weekly,
    int limit = 50,
  }) async {
    final response = await getLeaderboard(
      period: period,
      pageSize: limit,
      friendsOnly: true,
    );
    return response.entries;
  }
}
