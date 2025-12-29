import '../models/prediction.dart';
import '../services/api/api_client.dart';
import '../services/api/api_endpoints.dart';

/// Prediction stats
class PredictionStats {
  final int totalPredictions;
  final int wins;
  final int losses;
  final int pending;
  final double winRate;
  final int totalStarsEarned;
  final int totalCoinsWon;
  final int currentStreak;
  final int longestStreak;

  PredictionStats({
    required this.totalPredictions,
    required this.wins,
    required this.losses,
    required this.pending,
    required this.winRate,
    required this.totalStarsEarned,
    required this.totalCoinsWon,
    required this.currentStreak,
    required this.longestStreak,
  });

  factory PredictionStats.fromJson(Map<String, dynamic> json) {
    final wins = json['wins'] as int? ?? json['totalWins'] as int? ?? 0;
    final losses = json['losses'] as int? ?? json['totalLosses'] as int? ?? 0;
    final total = wins + losses + (json['pending'] as int? ?? 0);

    return PredictionStats(
      totalPredictions: json['totalPredictions'] as int? ?? total,
      wins: wins,
      losses: losses,
      pending: json['pending'] as int? ?? 0,
      winRate: (json['winRate'] as num?)?.toDouble() ??
          (total > 0 ? (wins / total) * 100 : 0.0),
      totalStarsEarned: json['totalStarsEarned'] as int? ??
          json['totalStars'] as int? ?? 0,
      totalCoinsWon: json['totalCoinsWon'] as int? ?? 0,
      currentStreak: json['currentStreak'] as int? ?? 0,
      longestStreak: json['longestStreak'] as int? ?? 0,
    );
  }
}

/// Pagination wrapper
class PaginatedPredictions {
  final List<Prediction> data;
  final int page;
  final int pageSize;
  final int total;
  final bool hasMore;

  PaginatedPredictions({
    required this.data,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.hasMore,
  });
}

/// Selection for creating a prediction
class PredictionSelectionInput {
  final String eventId;
  final String marketId;
  final String outcomeId;
  final double odds;

  PredictionSelectionInput({
    required this.eventId,
    required this.marketId,
    required this.outcomeId,
    required this.odds,
  });

  Map<String, dynamic> toJson() {
    return {
      'eventId': eventId,
      'marketId': marketId,
      'outcomeId': outcomeId,
      'odds': odds,
    };
  }
}

/// Repository for predictions operations
class PredictionsRepository {
  final ApiClient _apiClient;

  PredictionsRepository(this._apiClient);

  /// Get user's predictions
  Future<PaginatedPredictions> getPredictions({
    int page = 1,
    int pageSize = 20,
    String? status,
    String? type,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page.toString(),
      'pageSize': pageSize.toString(),
    };

    if (status != null) queryParams['status'] = status;
    if (type != null) queryParams['type'] = type;

    final response = await _apiClient.get(
      ApiEndpoints.predictions,
      queryParameters: queryParams,
      requiresAuth: true,
    );

    final data = (response['data'] as List<dynamic>?)
            ?.map((p) => Prediction.fromJson(p as Map<String, dynamic>))
            .toList() ??
        [];

    final pagination = response['pagination'] as Map<String, dynamic>?;

    return PaginatedPredictions(
      data: data,
      page: pagination?['page'] as int? ?? page,
      pageSize: pagination?['pageSize'] as int? ?? pageSize,
      total: pagination?['total'] as int? ?? data.length,
      hasMore: pagination?['hasMore'] as bool? ?? false,
    );
  }

  /// Get prediction by ID
  Future<Prediction> getPredictionById(String id) async {
    final response = await _apiClient.get(
      ApiEndpoints.predictionById(id),
      requiresAuth: true,
    );

    return Prediction.fromJson(response as Map<String, dynamic>);
  }

  /// Get user's prediction stats
  Future<PredictionStats> getStats() async {
    final response = await _apiClient.get(
      ApiEndpoints.predictionsStats,
      requiresAuth: true,
    );

    return PredictionStats.fromJson(response as Map<String, dynamic>);
  }

  /// Create a single prediction
  Future<Prediction> createSinglePrediction({
    required String eventId,
    required String marketId,
    required String outcomeId,
    required int stake,
    required double odds,
  }) async {
    final response = await _apiClient.post(
      ApiEndpoints.predictions,
      data: {
        'type': 'single',
        'eventId': eventId,
        'marketId': marketId,
        'outcomeId': outcomeId,
        'stake': stake,
        'odds': odds,
      },
      requiresAuth: true,
    );

    return Prediction.fromJson(response['prediction'] as Map<String, dynamic>);
  }

  /// Create an accumulator prediction
  Future<Prediction> createAccumulatorPrediction({
    required List<PredictionSelectionInput> selections,
    required int stake,
    required double totalOdds,
  }) async {
    final response = await _apiClient.post(
      ApiEndpoints.predictions,
      data: {
        'type': 'accumulator',
        'selections': selections.map((s) => s.toJson()).toList(),
        'stake': stake,
        'totalOdds': totalOdds,
      },
      requiresAuth: true,
    );

    return Prediction.fromJson(response['prediction'] as Map<String, dynamic>);
  }

  /// Get pending predictions
  Future<List<Prediction>> getPendingPredictions({int limit = 50}) async {
    final response = await getPredictions(
      status: 'pending',
      pageSize: limit,
    );
    return response.data;
  }

  /// Get settled predictions (won/lost)
  Future<List<Prediction>> getSettledPredictions({
    int page = 1,
    int pageSize = 20,
  }) async {
    // Get both won and lost predictions
    final wonResponse = await getPredictions(
      status: 'won',
      page: page,
      pageSize: pageSize ~/ 2,
    );

    final lostResponse = await getPredictions(
      status: 'lost',
      page: page,
      pageSize: pageSize ~/ 2,
    );

    // Combine and sort by date
    final all = [...wonResponse.data, ...lostResponse.data];
    all.sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return all;
  }
}
