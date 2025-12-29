import 'package:flutter/foundation.dart';
import '../data/models/mock_models.dart';
import '../data/repositories/mock_repository.dart';

/// Achievements provider for managing user achievements state
class AchievementsProvider extends ChangeNotifier {
  final MockRepository _mockRepository;

  List<Achievement> _achievements = [];
  bool _isLoading = false;
  String? _error;

  AchievementsProvider(this._mockRepository);

  // Getters
  List<Achievement> get achievements => _achievements;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Filtered achievements
  List<Achievement> get unlockedAchievements =>
      _achievements.where((a) => a.isUnlocked).toList();

  List<Achievement> get lockedAchievements =>
      _achievements.where((a) => !a.isUnlocked).toList();

  List<Achievement> get inProgressAchievements => lockedAchievements
      .where((a) => a.currentProgress > 0)
      .toList()
    ..sort((a, b) => b.progressPercent.compareTo(a.progressPercent));

  // Stats
  int get totalUnlocked => unlockedAchievements.length;
  int get totalAchievements => _achievements.length;
  double get completionPercent =>
      totalAchievements > 0 ? totalUnlocked / totalAchievements : 0;

  // By category
  List<Achievement> getByCategory(AchievementCategory category) =>
      _achievements.where((a) => a.category == category).toList();

  // By rarity
  List<Achievement> getByRarity(AchievementRarity rarity) =>
      _achievements.where((a) => a.rarity == rarity).toList();

  /// Load achievements
  Future<void> loadAchievements() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _achievements = await _mockRepository.getAchievements();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Find achievement by ID
  Achievement? findById(String id) {
    try {
      return _achievements.firstWhere((a) => a.id == id);
    } catch (_) {
      return null;
    }
  }

  /// Clear achievements (on logout)
  void clear() {
    _achievements = [];
    _error = null;
    notifyListeners();
  }
}
