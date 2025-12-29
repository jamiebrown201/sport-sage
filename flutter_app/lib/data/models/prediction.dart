import 'package:equatable/equatable.dart';
import 'event.dart';
import 'market.dart';

/// Prediction type enum
enum PredictionType {
  single,
  accumulator;

  static PredictionType fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'accumulator':
        return PredictionType.accumulator;
      default:
        return PredictionType.single;
    }
  }
}

/// Prediction status enum
enum PredictionStatus {
  pending,
  won,
  lost,
  voidStatus,
  cashout;

  static PredictionStatus fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'won':
        return PredictionStatus.won;
      case 'lost':
        return PredictionStatus.lost;
      case 'void':
        return PredictionStatus.voidStatus;
      case 'cashout':
        return PredictionStatus.cashout;
      default:
        return PredictionStatus.pending;
    }
  }

  String get displayName {
    switch (this) {
      case PredictionStatus.pending:
        return 'Pending';
      case PredictionStatus.won:
        return 'Won';
      case PredictionStatus.lost:
        return 'Lost';
      case PredictionStatus.voidStatus:
        return 'Void';
      case PredictionStatus.cashout:
        return 'Cashed Out';
    }
  }
}

/// Prediction model
class Prediction extends Equatable {
  final String id;
  final String userId;
  final PredictionType type;
  final String? eventId;
  final PredictionEvent? event;
  final String? marketId;
  final String? outcomeId;
  final PredictionOutcome? outcome;
  final List<PredictionSelection>? selections;
  final int stake;
  final double odds;
  final double totalOdds;
  final int potentialCoins;
  final int potentialStars;
  final double starsMultiplier;
  final PredictionStatus status;
  final int? settledCoins;
  final int? settledStars;
  final DateTime? settledAt;
  final DateTime createdAt;

  const Prediction({
    required this.id,
    required this.userId,
    required this.type,
    this.eventId,
    this.event,
    this.marketId,
    this.outcomeId,
    this.outcome,
    this.selections,
    required this.stake,
    required this.odds,
    required this.totalOdds,
    required this.potentialCoins,
    required this.potentialStars,
    this.starsMultiplier = 1.0,
    required this.status,
    this.settledCoins,
    this.settledStars,
    this.settledAt,
    required this.createdAt,
  });

  factory Prediction.fromJson(Map<String, dynamic> json) {
    return Prediction(
      id: json['id'] as String,
      userId: json['userId'] as String? ?? '',
      type: PredictionType.fromString(json['type'] as String?),
      eventId: json['eventId'] as String?,
      event: json['event'] != null
          ? PredictionEvent.fromJson(json['event'] as Map<String, dynamic>)
          : null,
      marketId: json['marketId'] as String?,
      outcomeId: json['outcomeId'] as String?,
      outcome: json['outcome'] != null
          ? PredictionOutcome.fromJson(json['outcome'] as Map<String, dynamic>)
          : null,
      selections: (json['selections'] as List<dynamic>?)
          ?.map((s) => PredictionSelection.fromJson(s as Map<String, dynamic>))
          .toList(),
      stake: json['stake'] as int,
      odds: (json['odds'] as num).toDouble(),
      totalOdds: (json['totalOdds'] as num).toDouble(),
      potentialCoins: json['potentialCoins'] as int,
      potentialStars: json['potentialStars'] as int,
      starsMultiplier: (json['starsMultiplier'] as num?)?.toDouble() ?? 1.0,
      status: PredictionStatus.fromString(json['status'] as String?),
      settledCoins: json['settledCoins'] as int?,
      settledStars: json['settledStars'] as int?,
      settledAt: json['settledAt'] != null
          ? DateTime.parse(json['settledAt'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'type': type.name,
      'eventId': eventId,
      'event': event?.toJson(),
      'marketId': marketId,
      'outcomeId': outcomeId,
      'outcome': outcome?.toJson(),
      'selections': selections?.map((s) => s.toJson()).toList(),
      'stake': stake,
      'odds': odds,
      'totalOdds': totalOdds,
      'potentialCoins': potentialCoins,
      'potentialStars': potentialStars,
      'starsMultiplier': starsMultiplier,
      'status': status.name,
      'settledCoins': settledCoins,
      'settledStars': settledStars,
      'settledAt': settledAt?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
    };
  }

  Prediction copyWith({
    String? id,
    String? userId,
    PredictionType? type,
    String? eventId,
    PredictionEvent? event,
    String? marketId,
    String? outcomeId,
    PredictionOutcome? outcome,
    List<PredictionSelection>? selections,
    int? stake,
    double? odds,
    double? totalOdds,
    int? potentialCoins,
    int? potentialStars,
    double? starsMultiplier,
    PredictionStatus? status,
    int? settledCoins,
    int? settledStars,
    DateTime? settledAt,
    DateTime? createdAt,
  }) {
    return Prediction(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      type: type ?? this.type,
      eventId: eventId ?? this.eventId,
      event: event ?? this.event,
      marketId: marketId ?? this.marketId,
      outcomeId: outcomeId ?? this.outcomeId,
      outcome: outcome ?? this.outcome,
      selections: selections ?? this.selections,
      stake: stake ?? this.stake,
      odds: odds ?? this.odds,
      totalOdds: totalOdds ?? this.totalOdds,
      potentialCoins: potentialCoins ?? this.potentialCoins,
      potentialStars: potentialStars ?? this.potentialStars,
      starsMultiplier: starsMultiplier ?? this.starsMultiplier,
      status: status ?? this.status,
      settledCoins: settledCoins ?? this.settledCoins,
      settledStars: settledStars ?? this.settledStars,
      settledAt: settledAt ?? this.settledAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  /// Check if prediction is settled
  bool get isSettled => status != PredictionStatus.pending;

  /// Check if prediction is a single bet
  bool get isSingle => type == PredictionType.single;

  /// Check if prediction is an accumulator
  bool get isAccumulator => type == PredictionType.accumulator;

  /// Get selection count for accumulators
  int get selectionCount => selections?.length ?? 1;

  /// Get profit (actual winnings minus stake)
  int get profit => (settledCoins ?? 0) - stake;

  /// Get display title
  String get title {
    if (isSingle && event != null) {
      return '${event!.homeName} vs ${event!.awayName}';
    }
    return '${selectionCount}-Fold Accumulator';
  }

  @override
  List<Object?> get props => [
        id,
        userId,
        type,
        eventId,
        event,
        marketId,
        outcomeId,
        outcome,
        selections,
        stake,
        odds,
        totalOdds,
        potentialCoins,
        potentialStars,
        starsMultiplier,
        status,
        settledCoins,
        settledStars,
        settledAt,
        createdAt,
      ];
}

/// Simplified event model for predictions
class PredictionEvent extends Equatable {
  final String id;
  final String? homeTeamName;
  final String? awayTeamName;
  final String? player1Name;
  final String? player2Name;
  final DateTime startTime;
  final EventStatus? status;
  final int? homeScore;
  final int? awayScore;

  const PredictionEvent({
    required this.id,
    this.homeTeamName,
    this.awayTeamName,
    this.player1Name,
    this.player2Name,
    required this.startTime,
    this.status,
    this.homeScore,
    this.awayScore,
  });

  factory PredictionEvent.fromJson(Map<String, dynamic> json) {
    return PredictionEvent(
      id: json['id'] as String,
      homeTeamName: json['homeTeamName'] as String?,
      awayTeamName: json['awayTeamName'] as String?,
      player1Name: json['player1Name'] as String?,
      player2Name: json['player2Name'] as String?,
      startTime: DateTime.parse(json['startTime'] as String),
      status: json['status'] != null
          ? EventStatus.fromString(json['status'] as String?)
          : null,
      homeScore: json['homeScore'] as int?,
      awayScore: json['awayScore'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'homeTeamName': homeTeamName,
      'awayTeamName': awayTeamName,
      'player1Name': player1Name,
      'player2Name': player2Name,
      'startTime': startTime.toIso8601String(),
      'status': status?.name,
      'homeScore': homeScore,
      'awayScore': awayScore,
    };
  }

  String get homeName => homeTeamName ?? player1Name ?? 'Home';
  String get awayName => awayTeamName ?? player2Name ?? 'Away';
  String get title => '$homeName vs $awayName';

  @override
  List<Object?> get props => [
        id,
        homeTeamName,
        awayTeamName,
        player1Name,
        player2Name,
        startTime,
        status,
        homeScore,
        awayScore,
      ];
}

/// Simplified outcome model for predictions
class PredictionOutcome extends Equatable {
  final String id;
  final String name;
  final double odds;
  final bool? isWinner;

  const PredictionOutcome({
    required this.id,
    required this.name,
    required this.odds,
    this.isWinner,
  });

  factory PredictionOutcome.fromJson(Map<String, dynamic> json) {
    return PredictionOutcome(
      id: json['id'] as String,
      name: json['name'] as String,
      odds: (json['odds'] as num).toDouble(),
      isWinner: json['isWinner'] as bool?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'odds': odds,
      'isWinner': isWinner,
    };
  }

  @override
  List<Object?> get props => [id, name, odds, isWinner];
}

/// Selection within an accumulator
class PredictionSelection extends Equatable {
  final String id;
  final String eventId;
  final PredictionEvent event;
  final String marketId;
  final String outcomeId;
  final PredictionOutcome outcome;
  final double odds;
  final PredictionStatus status;
  final DateTime? settledAt;

  const PredictionSelection({
    required this.id,
    required this.eventId,
    required this.event,
    required this.marketId,
    required this.outcomeId,
    required this.outcome,
    required this.odds,
    required this.status,
    this.settledAt,
  });

  factory PredictionSelection.fromJson(Map<String, dynamic> json) {
    return PredictionSelection(
      id: json['id'] as String,
      eventId: json['eventId'] as String,
      event: PredictionEvent.fromJson(json['event'] as Map<String, dynamic>),
      marketId: json['marketId'] as String,
      outcomeId: json['outcomeId'] as String,
      outcome: PredictionOutcome.fromJson(json['outcome'] as Map<String, dynamic>),
      odds: (json['odds'] as num).toDouble(),
      status: PredictionStatus.fromString(json['status'] as String?),
      settledAt: json['settledAt'] != null
          ? DateTime.parse(json['settledAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'eventId': eventId,
      'event': event.toJson(),
      'marketId': marketId,
      'outcomeId': outcomeId,
      'outcome': outcome.toJson(),
      'odds': odds,
      'status': status.name,
      'settledAt': settledAt?.toIso8601String(),
    };
  }

  @override
  List<Object?> get props => [
        id,
        eventId,
        event,
        marketId,
        outcomeId,
        outcome,
        odds,
        status,
        settledAt,
      ];
}
