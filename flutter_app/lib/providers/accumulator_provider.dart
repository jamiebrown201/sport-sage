import 'package:flutter/foundation.dart';
import '../core/config/app_config.dart';
import '../data/models/event.dart';
import '../data/models/market.dart';

/// Selection in the accumulator slip
class AccumulatorSelection {
  final Event event;
  final Market market;
  final Outcome outcome;

  AccumulatorSelection({
    required this.event,
    required this.market,
    required this.outcome,
  });

  String get key => '${event.id}_${market.id}_${outcome.id}';

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is AccumulatorSelection && other.key == key;
  }

  @override
  int get hashCode => key.hashCode;
}

/// Accumulator provider for managing bet slip selections
class AccumulatorProvider extends ChangeNotifier {
  final List<AccumulatorSelection> _selections = [];
  int _stake = AppConfig.defaultStake;

  // Getters
  List<AccumulatorSelection> get selections => List.unmodifiable(_selections);
  int get stake => _stake;
  int get selectionCount => _selections.length;
  bool get isEmpty => _selections.isEmpty;
  bool get isValid => _selections.length >= 2;
  bool get isSingle => _selections.length == 1;

  /// Calculate total odds with accumulator bonus
  double get totalOdds {
    if (_selections.isEmpty) return 0;

    double odds = 1;
    for (final selection in _selections) {
      odds *= selection.outcome.odds;
    }
    return odds;
  }

  /// Get accumulator bonus percentage
  double get bonusPercentage {
    final count = _selections.length;
    return AppConfig.getAccumulatorBonus(count);
  }

  /// Calculate total odds with bonus applied
  double get totalOddsWithBonus {
    final odds = totalOdds;
    final bonus = bonusPercentage;
    return odds * (1 + bonus);
  }

  /// Calculate potential return
  int get potentialReturn => (stake * totalOddsWithBonus).floor();

  /// Calculate potential profit
  int get potentialProfit => potentialReturn - stake;

  /// Calculate potential stars (roughly 10% of odds)
  int get potentialStars => (totalOdds * 10).floor();

  /// Check if an outcome is selected
  bool isSelected(String eventId, String marketId, String outcomeId) {
    return _selections.any((s) =>
        s.event.id == eventId &&
        s.market.id == marketId &&
        s.outcome.id == outcomeId);
  }

  /// Check if any outcome from an event is selected
  bool hasEventSelection(String eventId) {
    return _selections.any((s) => s.event.id == eventId);
  }

  /// Get selection for an event (if any)
  AccumulatorSelection? getEventSelection(String eventId) {
    try {
      return _selections.firstWhere((s) => s.event.id == eventId);
    } catch (_) {
      return null;
    }
  }

  /// Add a selection
  void addSelection({
    required Event event,
    required Market market,
    required Outcome outcome,
  }) {
    // Remove any existing selection from the same event
    _selections.removeWhere((s) => s.event.id == event.id);

    // Add new selection
    _selections.add(AccumulatorSelection(
      event: event,
      market: market,
      outcome: outcome,
    ));

    notifyListeners();
  }

  /// Remove a selection
  void removeSelection(String eventId) {
    _selections.removeWhere((s) => s.event.id == eventId);
    notifyListeners();
  }

  /// Remove a specific selection
  void removeSelectionByKey(String key) {
    _selections.removeWhere((s) => s.key == key);
    notifyListeners();
  }

  /// Toggle a selection
  void toggleSelection({
    required Event event,
    required Market market,
    required Outcome outcome,
  }) {
    final key = '${event.id}_${market.id}_${outcome.id}';
    final existingIndex = _selections.indexWhere((s) => s.key == key);

    if (existingIndex != -1) {
      // Remove if already selected
      _selections.removeAt(existingIndex);
    } else {
      // Remove any other selection from the same event, then add
      _selections.removeWhere((s) => s.event.id == event.id);
      _selections.add(AccumulatorSelection(
        event: event,
        market: market,
        outcome: outcome,
      ));
    }

    notifyListeners();
  }

  /// Set stake amount
  void setStake(int amount) {
    _stake = amount.clamp(AppConfig.minStake, AppConfig.maxStake);
    notifyListeners();
  }

  /// Increase stake
  void increaseStake([int amount = 100]) {
    setStake(_stake + amount);
  }

  /// Decrease stake
  void decreaseStake([int amount = 100]) {
    setStake(_stake - amount);
  }

  /// Clear all selections
  void clear() {
    _selections.clear();
    _stake = AppConfig.defaultStake;
    notifyListeners();
  }

  /// Get selections as input for API
  List<Map<String, dynamic>> getSelectionsAsInput() {
    return _selections.map((s) => {
      'eventId': s.event.id,
      'marketId': s.market.id,
      'outcomeId': s.outcome.id,
      'odds': s.outcome.odds,
    }).toList();
  }

  /// Validate all selections are still valid
  bool validateSelections() {
    // Check all events are still open for predictions
    for (final selection in _selections) {
      if (!selection.event.isOpenForPredictions) {
        return false;
      }
    }
    return true;
  }

  /// Remove invalid selections (events that have started)
  void removeInvalidSelections() {
    _selections.removeWhere((s) => !s.event.isOpenForPredictions);
    notifyListeners();
  }
}
