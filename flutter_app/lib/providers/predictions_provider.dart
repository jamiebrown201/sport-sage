import 'package:flutter/foundation.dart';
import '../data/models/prediction.dart';
import '../data/repositories/predictions_repository.dart';

/// Predictions provider for managing user predictions state
class PredictionsProvider extends ChangeNotifier {
  final PredictionsRepository _predictionsRepository;

  List<Prediction> _predictions = [];
  List<Prediction> _pendingPredictions = [];
  PredictionStats? _stats;
  bool _isLoading = false;
  bool _isLoadingMore = false;
  bool _isCreating = false;
  String? _error;
  int _currentPage = 1;
  bool _hasMore = true;
  String? _statusFilter;

  PredictionsProvider(this._predictionsRepository);

  // Getters
  List<Prediction> get predictions => _predictions;
  List<Prediction> get pendingPredictions => _pendingPredictions;
  PredictionStats? get stats => _stats;
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  bool get isCreating => _isCreating;
  String? get error => _error;
  bool get hasMore => _hasMore;
  String? get statusFilter => _statusFilter;

  // Filtered predictions
  List<Prediction> get wonPredictions =>
      _predictions.where((p) => p.status == PredictionStatus.won).toList();

  List<Prediction> get lostPredictions =>
      _predictions.where((p) => p.status == PredictionStatus.lost).toList();

  List<Prediction> get singlePredictions =>
      _predictions.where((p) => p.type == PredictionType.single).toList();

  List<Prediction> get accumulatorPredictions =>
      _predictions.where((p) => p.type == PredictionType.accumulator).toList();

  /// Load predictions
  Future<void> loadPredictions({
    bool refresh = false,
    String? status,
    String? type,
  }) async {
    if (refresh) {
      _currentPage = 1;
      _hasMore = true;
      _statusFilter = status;
    }

    if (!_hasMore && !refresh) return;

    if (refresh) {
      _isLoading = true;
    } else {
      _isLoadingMore = true;
    }
    _error = null;
    notifyListeners();

    try {
      final response = await _predictionsRepository.getPredictions(
        page: _currentPage,
        pageSize: 20,
        status: status ?? _statusFilter,
        type: type,
      );

      if (refresh) {
        _predictions = response.data;
      } else {
        _predictions = [..._predictions, ...response.data];
      }

      _hasMore = response.hasMore;
      _currentPage++;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    } finally {
      _isLoading = false;
      _isLoadingMore = false;
      notifyListeners();
    }
  }

  /// Load pending predictions
  Future<void> loadPendingPredictions() async {
    try {
      _pendingPredictions = await _predictionsRepository.getPendingPredictions();
      notifyListeners();
    } catch (e) {
      // Silently fail
    }
  }

  /// Load prediction stats
  Future<void> loadStats() async {
    try {
      _stats = await _predictionsRepository.getStats();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Create a single prediction
  Future<Prediction?> createSinglePrediction({
    required String eventId,
    required String marketId,
    required String outcomeId,
    required int stake,
    required double odds,
  }) async {
    _isCreating = true;
    _error = null;
    notifyListeners();

    try {
      final prediction = await _predictionsRepository.createSinglePrediction(
        eventId: eventId,
        marketId: marketId,
        outcomeId: outcomeId,
        stake: stake,
        odds: odds,
      );

      // Add to beginning of list
      _predictions = [prediction, ..._predictions];
      _pendingPredictions = [prediction, ..._pendingPredictions];

      notifyListeners();
      return prediction;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return null;
    } finally {
      _isCreating = false;
      notifyListeners();
    }
  }

  /// Create an accumulator prediction
  Future<Prediction?> createAccumulatorPrediction({
    required List<PredictionSelectionInput> selections,
    required int stake,
    required double totalOdds,
  }) async {
    _isCreating = true;
    _error = null;
    notifyListeners();

    try {
      final prediction = await _predictionsRepository.createAccumulatorPrediction(
        selections: selections,
        stake: stake,
        totalOdds: totalOdds,
      );

      // Add to beginning of list
      _predictions = [prediction, ..._predictions];
      _pendingPredictions = [prediction, ..._pendingPredictions];

      notifyListeners();
      return prediction;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return null;
    } finally {
      _isCreating = false;
      notifyListeners();
    }
  }

  /// Set status filter
  void setStatusFilter(String? status) {
    _statusFilter = status;
    loadPredictions(refresh: true, status: status);
  }

  /// Refresh all predictions
  Future<void> refresh() async {
    await Future.wait([
      loadPredictions(refresh: true),
      loadPendingPredictions(),
      loadStats(),
    ]);
  }

  /// Update prediction in list (for settlement updates)
  void updatePrediction(Prediction updatedPrediction) {
    final index = _predictions.indexWhere((p) => p.id == updatedPrediction.id);
    if (index != -1) {
      _predictions[index] = updatedPrediction;
    }

    // Remove from pending if settled
    if (updatedPrediction.isSettled) {
      _pendingPredictions.removeWhere((p) => p.id == updatedPrediction.id);
    }

    notifyListeners();
  }

  /// Clear all data (on logout)
  void clear() {
    _predictions = [];
    _pendingPredictions = [];
    _stats = null;
    _currentPage = 1;
    _hasMore = true;
    _statusFilter = null;
    _error = null;
    notifyListeners();
  }
}
