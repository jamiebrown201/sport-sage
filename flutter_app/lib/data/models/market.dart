import 'package:equatable/equatable.dart';

/// Market type enum
enum MarketType {
  matchWinner,
  doubleChance,
  bothTeamsScore,
  overUnderGoals,
  overUnderPoints,
  correctScore,
  firstScorer,
  handicap,
  setWinner,
  gameWinner,
  frameWinner,
  toQualify;

  static MarketType fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'match_winner':
        return MarketType.matchWinner;
      case 'double_chance':
        return MarketType.doubleChance;
      case 'both_teams_score':
        return MarketType.bothTeamsScore;
      case 'over_under_goals':
        return MarketType.overUnderGoals;
      case 'over_under_points':
        return MarketType.overUnderPoints;
      case 'correct_score':
        return MarketType.correctScore;
      case 'first_scorer':
        return MarketType.firstScorer;
      case 'handicap':
        return MarketType.handicap;
      case 'set_winner':
        return MarketType.setWinner;
      case 'game_winner':
        return MarketType.gameWinner;
      case 'frame_winner':
        return MarketType.frameWinner;
      case 'to_qualify':
        return MarketType.toQualify;
      default:
        return MarketType.matchWinner;
    }
  }

  String get displayName {
    switch (this) {
      case MarketType.matchWinner:
        return 'Match Result';
      case MarketType.doubleChance:
        return 'Double Chance';
      case MarketType.bothTeamsScore:
        return 'Both Teams to Score';
      case MarketType.overUnderGoals:
        return 'Over/Under Goals';
      case MarketType.overUnderPoints:
        return 'Over/Under Points';
      case MarketType.correctScore:
        return 'Correct Score';
      case MarketType.firstScorer:
        return 'First Scorer';
      case MarketType.handicap:
        return 'Handicap';
      case MarketType.setWinner:
        return 'Set Winner';
      case MarketType.gameWinner:
        return 'Game Winner';
      case MarketType.frameWinner:
        return 'Frame Winner';
      case MarketType.toQualify:
        return 'To Qualify';
    }
  }
}

/// Market model (betting market for an event)
class Market extends Equatable {
  final String id;
  final MarketType type;
  final String name;
  final double? line;
  final List<Outcome> outcomes;
  final bool isSuspended;
  final bool isMainMarket;

  const Market({
    required this.id,
    required this.type,
    required this.name,
    this.line,
    this.outcomes = const [],
    this.isSuspended = false,
    this.isMainMarket = false,
  });

  factory Market.fromJson(Map<String, dynamic> json) {
    return Market(
      id: json['id'] as String,
      type: MarketType.fromString(json['type'] as String?),
      name: json['name'] as String,
      line: (json['line'] as num?)?.toDouble(),
      outcomes: (json['outcomes'] as List<dynamic>?)
              ?.map((o) => Outcome.fromJson(o as Map<String, dynamic>))
              .toList() ??
          [],
      isSuspended: json['isSuspended'] as bool? ?? false,
      isMainMarket: json['isMainMarket'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type.name,
      'name': name,
      'line': line,
      'outcomes': outcomes.map((o) => o.toJson()).toList(),
      'isSuspended': isSuspended,
      'isMainMarket': isMainMarket,
    };
  }

  Market copyWith({
    String? id,
    MarketType? type,
    String? name,
    double? line,
    List<Outcome>? outcomes,
    bool? isSuspended,
    bool? isMainMarket,
  }) {
    return Market(
      id: id ?? this.id,
      type: type ?? this.type,
      name: name ?? this.name,
      line: line ?? this.line,
      outcomes: outcomes ?? this.outcomes,
      isSuspended: isSuspended ?? this.isSuspended,
      isMainMarket: isMainMarket ?? this.isMainMarket,
    );
  }

  /// Check if market has valid outcomes
  bool get hasOutcomes => outcomes.isNotEmpty;

  /// Get display name with line if applicable
  String get displayName {
    if (line != null) {
      return '$name $line';
    }
    return name;
  }

  @override
  List<Object?> get props => [id, type, name, line, outcomes, isSuspended, isMainMarket];
}

/// Outcome model (betting outcome within a market)
class Outcome extends Equatable {
  final String id;
  final String name;
  final double odds;
  final double? previousOdds;
  final bool? isWinner;
  final bool isSuspended;

  const Outcome({
    required this.id,
    required this.name,
    required this.odds,
    this.previousOdds,
    this.isWinner,
    this.isSuspended = false,
  });

  factory Outcome.fromJson(Map<String, dynamic> json) {
    return Outcome(
      id: json['id'] as String,
      name: json['name'] as String,
      odds: (json['odds'] as num).toDouble(),
      previousOdds: (json['previousOdds'] as num?)?.toDouble(),
      isWinner: json['isWinner'] as bool?,
      isSuspended: json['isSuspended'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'odds': odds,
      'previousOdds': previousOdds,
      'isWinner': isWinner,
      'isSuspended': isSuspended,
    };
  }

  Outcome copyWith({
    String? id,
    String? name,
    double? odds,
    double? previousOdds,
    bool? isWinner,
    bool? isSuspended,
  }) {
    return Outcome(
      id: id ?? this.id,
      name: name ?? this.name,
      odds: odds ?? this.odds,
      previousOdds: previousOdds ?? this.previousOdds,
      isWinner: isWinner ?? this.isWinner,
      isSuspended: isSuspended ?? this.isSuspended,
    );
  }

  /// Check if odds have increased (drifted)
  bool get hasDrifted {
    if (previousOdds == null) return false;
    return odds > previousOdds!;
  }

  /// Check if odds have decreased (shortened)
  bool get hasShortened {
    if (previousOdds == null) return false;
    return odds < previousOdds!;
  }

  /// Get odds movement direction
  OddsMovement get movement {
    if (previousOdds == null) return OddsMovement.stable;
    if (odds > previousOdds!) return OddsMovement.drifting;
    if (odds < previousOdds!) return OddsMovement.shortening;
    return OddsMovement.stable;
  }

  /// Get a short name (truncated to fit in UI)
  String get shortName {
    if (name.length <= 10) return name;
    // Common abbreviations
    if (name == 'Home') return 'H';
    if (name == 'Draw') return 'D';
    if (name == 'Away') return 'A';
    if (name == 'Over') return 'O';
    if (name == 'Under') return 'U';
    if (name == 'Yes') return 'Y';
    if (name == 'No') return 'N';
    // Truncate long names
    return '${name.substring(0, 8)}..';
  }

  @override
  List<Object?> get props => [id, name, odds, previousOdds, isWinner, isSuspended];
}

/// Odds movement direction
enum OddsMovement {
  stable,
  drifting,
  shortening,
}
