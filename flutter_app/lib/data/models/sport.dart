import 'package:equatable/equatable.dart';

/// Sport model
class Sport extends Equatable {
  final String id;
  final String name;
  final String slug;
  final String iconName;
  final bool isActive;
  final int sortOrder;
  final int eventCount;

  const Sport({
    required this.id,
    required this.name,
    required this.slug,
    required this.iconName,
    this.isActive = true,
    this.sortOrder = 0,
    this.eventCount = 0,
  });

  factory Sport.fromJson(Map<String, dynamic> json) {
    return Sport(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      iconName: json['iconName'] as String? ?? json['slug'] as String,
      isActive: json['isActive'] as bool? ?? true,
      sortOrder: json['sortOrder'] as int? ?? 0,
      eventCount: json['eventCount'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'slug': slug,
      'iconName': iconName,
      'isActive': isActive,
      'sortOrder': sortOrder,
      'eventCount': eventCount,
    };
  }

  Sport copyWith({
    String? id,
    String? name,
    String? slug,
    String? iconName,
    bool? isActive,
    int? sortOrder,
    int? eventCount,
  }) {
    return Sport(
      id: id ?? this.id,
      name: name ?? this.name,
      slug: slug ?? this.slug,
      iconName: iconName ?? this.iconName,
      isActive: isActive ?? this.isActive,
      sortOrder: sortOrder ?? this.sortOrder,
      eventCount: eventCount ?? this.eventCount,
    );
  }

  /// Get all predefined sports (static accessor for convenience)
  static List<Sport> get allSports => Sports.all;

  @override
  List<Object?> get props => [id, name, slug, iconName, isActive, sortOrder, eventCount];
}

/// Predefined list of sports
class Sports {
  static const Sport football = Sport(
    id: 'football',
    name: 'Football',
    slug: 'football',
    iconName: 'football',
    sortOrder: 1,
  );

  static const Sport basketball = Sport(
    id: 'basketball',
    name: 'Basketball',
    slug: 'basketball',
    iconName: 'basketball',
    sortOrder: 2,
  );

  static const Sport tennis = Sport(
    id: 'tennis',
    name: 'Tennis',
    slug: 'tennis',
    iconName: 'tennis',
    sortOrder: 3,
  );

  static const Sport cricket = Sport(
    id: 'cricket',
    name: 'Cricket',
    slug: 'cricket',
    iconName: 'cricket',
    sortOrder: 4,
  );

  static const Sport darts = Sport(
    id: 'darts',
    name: 'Darts',
    slug: 'darts',
    iconName: 'darts',
    sortOrder: 5,
  );

  static const Sport iceHockey = Sport(
    id: 'ice_hockey',
    name: 'Ice Hockey',
    slug: 'ice_hockey',
    iconName: 'ice_hockey',
    sortOrder: 6,
  );

  static const Sport baseball = Sport(
    id: 'baseball',
    name: 'Baseball',
    slug: 'baseball',
    iconName: 'baseball',
    sortOrder: 7,
  );

  static const List<Sport> all = [
    football,
    basketball,
    tennis,
    cricket,
    darts,
    iceHockey,
    baseball,
  ];

  static Sport? getBySlug(String slug) {
    try {
      return all.firstWhere((s) => s.slug == slug);
    } catch (_) {
      return null;
    }
  }
}
