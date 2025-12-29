import 'package:equatable/equatable.dart';
import 'sport.dart';
import 'market.dart';

/// Event status enum
enum EventStatus {
  scheduled,
  live,
  finished,
  cancelled,
  postponed;

  static EventStatus fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'live':
        return EventStatus.live;
      case 'finished':
        return EventStatus.finished;
      case 'cancelled':
        return EventStatus.cancelled;
      case 'postponed':
        return EventStatus.postponed;
      default:
        return EventStatus.scheduled;
    }
  }

  String get displayName {
    switch (this) {
      case EventStatus.scheduled:
        return 'Scheduled';
      case EventStatus.live:
        return 'Live';
      case EventStatus.finished:
        return 'Finished';
      case EventStatus.cancelled:
        return 'Cancelled';
      case EventStatus.postponed:
        return 'Postponed';
    }
  }
}

/// Competition model
class Competition extends Equatable {
  final String id;
  final String name;
  final String? shortName;
  final String? country;

  const Competition({
    required this.id,
    required this.name,
    this.shortName,
    this.country,
  });

  factory Competition.fromJson(Map<String, dynamic> json) {
    return Competition(
      id: json['id'] as String,
      name: json['name'] as String,
      shortName: json['shortName'] as String?,
      country: json['country'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'shortName': shortName,
      'country': country,
    };
  }

  @override
  List<Object?> get props => [id, name, shortName, country];
}

/// Event model
class Event extends Equatable {
  final String id;
  final Sport sport;
  final Competition competition;
  final String? homeTeamName;
  final String? awayTeamName;
  final String? player1Name;
  final String? player2Name;
  final DateTime startTime;
  final EventStatus status;
  final int? homeScore;
  final int? awayScore;
  final String? period;
  final int? minute;
  final bool isFeatured;
  final int predictionCount;
  final List<Market> markets;
  final SponsoredEvent? sponsoredEvent;

  const Event({
    required this.id,
    required this.sport,
    required this.competition,
    this.homeTeamName,
    this.awayTeamName,
    this.player1Name,
    this.player2Name,
    required this.startTime,
    required this.status,
    this.homeScore,
    this.awayScore,
    this.period,
    this.minute,
    this.isFeatured = false,
    this.predictionCount = 0,
    this.markets = const [],
    this.sponsoredEvent,
  });

  factory Event.fromJson(Map<String, dynamic> json) {
    return Event(
      id: json['id'] as String,
      sport: Sport.fromJson(json['sport'] as Map<String, dynamic>),
      competition: Competition.fromJson(json['competition'] as Map<String, dynamic>),
      homeTeamName: json['homeTeamName'] as String?,
      awayTeamName: json['awayTeamName'] as String?,
      player1Name: json['player1Name'] as String?,
      player2Name: json['player2Name'] as String?,
      startTime: DateTime.parse(json['startTime'] as String),
      status: EventStatus.fromString(json['status'] as String?),
      homeScore: json['homeScore'] as int?,
      awayScore: json['awayScore'] as int?,
      period: json['period'] as String?,
      minute: json['minute'] as int?,
      isFeatured: json['isFeatured'] as bool? ?? false,
      predictionCount: json['predictionCount'] as int? ?? 0,
      markets: (json['markets'] as List<dynamic>?)
              ?.map((m) => Market.fromJson(m as Map<String, dynamic>))
              .toList() ??
          [],
      sponsoredEvent: json['sponsoredEvent'] != null
          ? SponsoredEvent.fromJson(json['sponsoredEvent'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sport': sport.toJson(),
      'competition': competition.toJson(),
      'homeTeamName': homeTeamName,
      'awayTeamName': awayTeamName,
      'player1Name': player1Name,
      'player2Name': player2Name,
      'startTime': startTime.toIso8601String(),
      'status': status.name,
      'homeScore': homeScore,
      'awayScore': awayScore,
      'period': period,
      'minute': minute,
      'isFeatured': isFeatured,
      'predictionCount': predictionCount,
      'markets': markets.map((m) => m.toJson()).toList(),
      'sponsoredEvent': sponsoredEvent?.toJson(),
    };
  }

  Event copyWith({
    String? id,
    Sport? sport,
    Competition? competition,
    String? homeTeamName,
    String? awayTeamName,
    String? player1Name,
    String? player2Name,
    DateTime? startTime,
    EventStatus? status,
    int? homeScore,
    int? awayScore,
    String? period,
    int? minute,
    bool? isFeatured,
    int? predictionCount,
    List<Market>? markets,
    SponsoredEvent? sponsoredEvent,
  }) {
    return Event(
      id: id ?? this.id,
      sport: sport ?? this.sport,
      competition: competition ?? this.competition,
      homeTeamName: homeTeamName ?? this.homeTeamName,
      awayTeamName: awayTeamName ?? this.awayTeamName,
      player1Name: player1Name ?? this.player1Name,
      player2Name: player2Name ?? this.player2Name,
      startTime: startTime ?? this.startTime,
      status: status ?? this.status,
      homeScore: homeScore ?? this.homeScore,
      awayScore: awayScore ?? this.awayScore,
      period: period ?? this.period,
      minute: minute ?? this.minute,
      isFeatured: isFeatured ?? this.isFeatured,
      predictionCount: predictionCount ?? this.predictionCount,
      markets: markets ?? this.markets,
      sponsoredEvent: sponsoredEvent ?? this.sponsoredEvent,
    );
  }

  /// Check if this is a team sport event
  bool get isTeamEvent => homeTeamName != null && awayTeamName != null;

  /// Check if this is an individual sport event
  bool get isIndividualEvent => player1Name != null && player2Name != null;

  /// Get home side name
  String get homeName => homeTeamName ?? player1Name ?? 'Home';

  /// Get away side name
  String get awayName => awayTeamName ?? player2Name ?? 'Away';

  /// Get display title
  String get title => '$homeName vs $awayName';

  /// Check if event is live
  bool get isLive => status == EventStatus.live;

  /// Check if event is finished
  bool get isFinished => status == EventStatus.finished;

  /// Check if event is open for predictions
  bool get isOpenForPredictions =>
      status == EventStatus.scheduled &&
      startTime.isAfter(DateTime.now());

  /// Get main market (match winner)
  Market? get mainMarket {
    try {
      return markets.firstWhere((m) => m.isMainMarket);
    } catch (_) {
      return markets.isNotEmpty ? markets.first : null;
    }
  }

  /// Get score display string
  String get scoreDisplay {
    if (homeScore == null || awayScore == null) return '';
    return '$homeScore - $awayScore';
  }

  @override
  List<Object?> get props => [
        id,
        sport,
        competition,
        homeTeamName,
        awayTeamName,
        player1Name,
        player2Name,
        startTime,
        status,
        homeScore,
        awayScore,
        period,
        minute,
        isFeatured,
        predictionCount,
        markets,
        sponsoredEvent,
      ];
}

/// Sponsored event model
class SponsoredEvent extends Equatable {
  final String id;
  final String eventId;
  final String sponsorName;
  final String? sponsorLogoUrl;
  final String title;
  final String description;
  final String prizeDescription;
  final String? brandingColor;
  final double bonusStarsMultiplier;
  final DateTime startDate;
  final DateTime endDate;

  const SponsoredEvent({
    required this.id,
    required this.eventId,
    required this.sponsorName,
    this.sponsorLogoUrl,
    required this.title,
    required this.description,
    required this.prizeDescription,
    this.brandingColor,
    this.bonusStarsMultiplier = 1.0,
    required this.startDate,
    required this.endDate,
  });

  factory SponsoredEvent.fromJson(Map<String, dynamic> json) {
    return SponsoredEvent(
      id: json['id'] as String,
      eventId: json['eventId'] as String,
      sponsorName: json['sponsorName'] as String,
      sponsorLogoUrl: json['sponsorLogoUrl'] as String?,
      title: json['title'] as String,
      description: json['description'] as String,
      prizeDescription: json['prizeDescription'] as String,
      brandingColor: json['brandingColor'] as String?,
      bonusStarsMultiplier: (json['bonusStarsMultiplier'] as num?)?.toDouble() ?? 1.0,
      startDate: DateTime.parse(json['startDate'] as String),
      endDate: DateTime.parse(json['endDate'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'eventId': eventId,
      'sponsorName': sponsorName,
      'sponsorLogoUrl': sponsorLogoUrl,
      'title': title,
      'description': description,
      'prizeDescription': prizeDescription,
      'brandingColor': brandingColor,
      'bonusStarsMultiplier': bonusStarsMultiplier,
      'startDate': startDate.toIso8601String(),
      'endDate': endDate.toIso8601String(),
    };
  }

  bool get isActive {
    final now = DateTime.now();
    return now.isAfter(startDate) && now.isBefore(endDate);
  }

  @override
  List<Object?> get props => [
        id,
        eventId,
        sponsorName,
        sponsorLogoUrl,
        title,
        description,
        prizeDescription,
        brandingColor,
        bonusStarsMultiplier,
        startDate,
        endDate,
      ];
}
