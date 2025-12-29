import 'package:flutter/foundation.dart';
import '../data/models/mock_models.dart';
import '../data/repositories/mock_repository.dart';

/// Challenges provider for managing daily challenges state
class ChallengesProvider extends ChangeNotifier {
  final MockRepository _mockRepository;

  List<Challenge> _challenges = [];
  bool _isLoading = false;
  String? _error;

  ChallengesProvider(this._mockRepository);

  // Getters
  List<Challenge> get challenges => _challenges;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Filtered challenges
  List<Challenge> get activeChallenges =>
      _challenges.where((c) => !c.isCompleted && !c.isExpired).toList();

  List<Challenge> get completedChallenges =>
      _challenges.where((c) => c.isCompleted).toList();

  int get totalRewardCoins =>
      activeChallenges.fold(0, (sum, c) => sum + c.rewardCoins);

  int get totalRewardStars =>
      activeChallenges.fold(0, (sum, c) => sum + c.rewardStars);

  /// Load daily challenges
  Future<void> loadChallenges() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _challenges = await _mockRepository.getDailyChallenges();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Update challenge progress (mock - would be server-driven in production)
  void updateProgress(String challengeId, int newProgress) {
    final index = _challenges.indexWhere((c) => c.id == challengeId);
    if (index != -1) {
      final challenge = _challenges[index];
      _challenges[index] = Challenge(
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        difficulty: challenge.difficulty,
        rewardCoins: challenge.rewardCoins,
        rewardStars: challenge.rewardStars,
        targetCount: challenge.targetCount,
        currentProgress: newProgress,
        expiresAt: challenge.expiresAt,
        isCompleted: newProgress >= challenge.targetCount,
      );
      notifyListeners();
    }
  }

  /// Clear challenges (on logout)
  void clear() {
    _challenges = [];
    _error = null;
    notifyListeners();
  }
}
