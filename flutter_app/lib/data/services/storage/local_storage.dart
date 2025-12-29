import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Local storage service for non-sensitive data (preferences, cache)
class LocalStorageService {
  SharedPreferences? _prefs;

  // Storage keys
  static const String _hasCompletedOnboardingKey = 'has_completed_onboarding';
  static const String _userDataKey = 'user_data';
  static const String _userStatsKey = 'user_stats';
  static const String _predictionsKey = 'predictions';
  static const String _accumulatorsKey = 'accumulators';
  static const String _currentAccumulatorKey = 'current_accumulator';
  static const String _settingsKey = 'settings';
  static const String _friendsKey = 'friends';
  static const String _challengesKey = 'challenges';
  static const String _achievementsKey = 'achievements';

  /// Initialize SharedPreferences
  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  /// Ensure preferences are initialized
  Future<SharedPreferences> get prefs async {
    if (_prefs == null) {
      await init();
    }
    return _prefs!;
  }

  // Onboarding

  /// Check if user has completed onboarding
  Future<bool> hasCompletedOnboarding() async {
    final p = await prefs;
    return p.getBool(_hasCompletedOnboardingKey) ?? false;
  }

  /// Mark onboarding as completed
  Future<void> setOnboardingCompleted(bool completed) async {
    final p = await prefs;
    await p.setBool(_hasCompletedOnboardingKey, completed);
  }

  // User Data

  /// Save user data as JSON
  Future<void> saveUserData(Map<String, dynamic> userData) async {
    final p = await prefs;
    await p.setString(_userDataKey, jsonEncode(userData));
  }

  /// Get user data
  Future<Map<String, dynamic>?> getUserData() async {
    final p = await prefs;
    final data = p.getString(_userDataKey);
    if (data == null) return null;
    return jsonDecode(data) as Map<String, dynamic>;
  }

  /// Save user stats as JSON
  Future<void> saveUserStats(Map<String, dynamic> stats) async {
    final p = await prefs;
    await p.setString(_userStatsKey, jsonEncode(stats));
  }

  /// Get user stats
  Future<Map<String, dynamic>?> getUserStats() async {
    final p = await prefs;
    final data = p.getString(_userStatsKey);
    if (data == null) return null;
    return jsonDecode(data) as Map<String, dynamic>;
  }

  // Predictions

  /// Save predictions as JSON list
  Future<void> savePredictions(List<Map<String, dynamic>> predictions) async {
    final p = await prefs;
    await p.setString(_predictionsKey, jsonEncode(predictions));
  }

  /// Get predictions
  Future<List<Map<String, dynamic>>> getPredictions() async {
    final p = await prefs;
    final data = p.getString(_predictionsKey);
    if (data == null) return [];
    final list = jsonDecode(data) as List<dynamic>;
    return list.cast<Map<String, dynamic>>();
  }

  // Accumulators

  /// Save accumulators as JSON list
  Future<void> saveAccumulators(List<Map<String, dynamic>> accumulators) async {
    final p = await prefs;
    await p.setString(_accumulatorsKey, jsonEncode(accumulators));
  }

  /// Get accumulators
  Future<List<Map<String, dynamic>>> getAccumulators() async {
    final p = await prefs;
    final data = p.getString(_accumulatorsKey);
    if (data == null) return [];
    final list = jsonDecode(data) as List<dynamic>;
    return list.cast<Map<String, dynamic>>();
  }

  /// Save current accumulator slip
  Future<void> saveCurrentAccumulator(Map<String, dynamic>? accumulator) async {
    final p = await prefs;
    if (accumulator == null) {
      await p.remove(_currentAccumulatorKey);
    } else {
      await p.setString(_currentAccumulatorKey, jsonEncode(accumulator));
    }
  }

  /// Get current accumulator slip
  Future<Map<String, dynamic>?> getCurrentAccumulator() async {
    final p = await prefs;
    final data = p.getString(_currentAccumulatorKey);
    if (data == null) return null;
    return jsonDecode(data) as Map<String, dynamic>;
  }

  // Settings

  /// Save settings as JSON
  Future<void> saveSettings(Map<String, dynamic> settings) async {
    final p = await prefs;
    await p.setString(_settingsKey, jsonEncode(settings));
  }

  /// Get settings
  Future<Map<String, dynamic>> getSettings() async {
    final p = await prefs;
    final data = p.getString(_settingsKey);
    if (data == null) {
      return {
        'notifyPredictions': true,
        'notifyChallenges': true,
        'notifyFriends': true,
        'notifyMarketing': false,
        'showOnLeaderboard': true,
        'showActivityToFriends': true,
        'allowFriendRequests': true,
      };
    }
    return jsonDecode(data) as Map<String, dynamic>;
  }

  // Friends (mock data)

  /// Save friends list
  Future<void> saveFriends(List<Map<String, dynamic>> friends) async {
    final p = await prefs;
    await p.setString(_friendsKey, jsonEncode(friends));
  }

  /// Get friends list
  Future<List<Map<String, dynamic>>> getFriends() async {
    final p = await prefs;
    final data = p.getString(_friendsKey);
    if (data == null) return [];
    final list = jsonDecode(data) as List<dynamic>;
    return list.cast<Map<String, dynamic>>();
  }

  // Generic methods

  /// Save string
  Future<void> setString(String key, String value) async {
    final p = await prefs;
    await p.setString(key, value);
  }

  /// Get string
  Future<String?> getString(String key) async {
    final p = await prefs;
    return p.getString(key);
  }

  /// Save bool
  Future<void> setBool(String key, bool value) async {
    final p = await prefs;
    await p.setBool(key, value);
  }

  /// Get bool
  Future<bool?> getBool(String key) async {
    final p = await prefs;
    return p.getBool(key);
  }

  /// Save int
  Future<void> setInt(String key, int value) async {
    final p = await prefs;
    await p.setInt(key, value);
  }

  /// Get int
  Future<int?> getInt(String key) async {
    final p = await prefs;
    return p.getInt(key);
  }

  /// Remove key
  Future<void> remove(String key) async {
    final p = await prefs;
    await p.remove(key);
  }

  /// Clear all data
  Future<void> clearAll() async {
    final p = await prefs;
    await p.clear();
  }

  /// Clear user-specific data (keep settings)
  Future<void> clearUserData() async {
    final p = await prefs;
    await Future.wait([
      p.remove(_userDataKey),
      p.remove(_userStatsKey),
      p.remove(_predictionsKey),
      p.remove(_accumulatorsKey),
      p.remove(_currentAccumulatorKey),
      p.remove(_friendsKey),
    ]);
  }
}
