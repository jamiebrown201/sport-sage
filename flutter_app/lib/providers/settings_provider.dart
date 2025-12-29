import 'package:flutter/foundation.dart';
import '../data/services/storage/local_storage.dart';

/// Settings provider for managing app settings
class SettingsProvider extends ChangeNotifier {
  final LocalStorageService _localStorage;

  // Notification settings
  bool _pushNotifications = true;
  bool _predictionReminders = true;
  bool _resultNotifications = true;
  bool _promotionalNotifications = false;

  // Privacy settings
  bool _showOnLeaderboard = true;
  bool _showOnlineStatus = true;
  bool _allowFriendRequests = true;

  // Display settings
  bool _compactMode = false;
  bool _showOddsAsDecimal = true;

  bool _isLoading = false;

  SettingsProvider(this._localStorage);

  // Notification getters
  bool get pushNotifications => _pushNotifications;
  bool get predictionReminders => _predictionReminders;
  bool get resultNotifications => _resultNotifications;
  bool get promotionalNotifications => _promotionalNotifications;

  // Privacy getters
  bool get showOnLeaderboard => _showOnLeaderboard;
  bool get showOnlineStatus => _showOnlineStatus;
  bool get allowFriendRequests => _allowFriendRequests;

  // Display getters
  bool get compactMode => _compactMode;
  bool get showOddsAsDecimal => _showOddsAsDecimal;

  bool get isLoading => _isLoading;

  /// Load settings from storage
  Future<void> loadSettings() async {
    _isLoading = true;
    notifyListeners();

    try {
      // Notification settings
      _pushNotifications = await _localStorage.getBool('push_notifications') ?? true;
      _predictionReminders = await _localStorage.getBool('prediction_reminders') ?? true;
      _resultNotifications = await _localStorage.getBool('result_notifications') ?? true;
      _promotionalNotifications = await _localStorage.getBool('promotional_notifications') ?? false;

      // Privacy settings
      _showOnLeaderboard = await _localStorage.getBool('show_on_leaderboard') ?? true;
      _showOnlineStatus = await _localStorage.getBool('show_online_status') ?? true;
      _allowFriendRequests = await _localStorage.getBool('allow_friend_requests') ?? true;

      // Display settings
      _compactMode = await _localStorage.getBool('compact_mode') ?? false;
      _showOddsAsDecimal = await _localStorage.getBool('show_odds_as_decimal') ?? true;

      notifyListeners();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Notification setters
  Future<void> setPushNotifications(bool value) async {
    _pushNotifications = value;
    await _localStorage.setBool('push_notifications', value);
    notifyListeners();
  }

  Future<void> setPredictionReminders(bool value) async {
    _predictionReminders = value;
    await _localStorage.setBool('prediction_reminders', value);
    notifyListeners();
  }

  Future<void> setResultNotifications(bool value) async {
    _resultNotifications = value;
    await _localStorage.setBool('result_notifications', value);
    notifyListeners();
  }

  Future<void> setPromotionalNotifications(bool value) async {
    _promotionalNotifications = value;
    await _localStorage.setBool('promotional_notifications', value);
    notifyListeners();
  }

  // Privacy setters
  Future<void> setShowOnLeaderboard(bool value) async {
    _showOnLeaderboard = value;
    await _localStorage.setBool('show_on_leaderboard', value);
    notifyListeners();
  }

  Future<void> setShowOnlineStatus(bool value) async {
    _showOnlineStatus = value;
    await _localStorage.setBool('show_online_status', value);
    notifyListeners();
  }

  Future<void> setAllowFriendRequests(bool value) async {
    _allowFriendRequests = value;
    await _localStorage.setBool('allow_friend_requests', value);
    notifyListeners();
  }

  // Display setters
  Future<void> setCompactMode(bool value) async {
    _compactMode = value;
    await _localStorage.setBool('compact_mode', value);
    notifyListeners();
  }

  Future<void> setShowOddsAsDecimal(bool value) async {
    _showOddsAsDecimal = value;
    await _localStorage.setBool('show_odds_as_decimal', value);
    notifyListeners();
  }

  /// Reset all settings to defaults
  Future<void> resetToDefaults() async {
    _pushNotifications = true;
    _predictionReminders = true;
    _resultNotifications = true;
    _promotionalNotifications = false;
    _showOnLeaderboard = true;
    _showOnlineStatus = true;
    _allowFriendRequests = true;
    _compactMode = false;
    _showOddsAsDecimal = true;

    await Future.wait([
      _localStorage.setBool('push_notifications', true),
      _localStorage.setBool('prediction_reminders', true),
      _localStorage.setBool('result_notifications', true),
      _localStorage.setBool('promotional_notifications', false),
      _localStorage.setBool('show_on_leaderboard', true),
      _localStorage.setBool('show_online_status', true),
      _localStorage.setBool('allow_friend_requests', true),
      _localStorage.setBool('compact_mode', false),
      _localStorage.setBool('show_odds_as_decimal', true),
    ]);

    notifyListeners();
  }

  /// Clear settings (on logout)
  Future<void> clear() async {
    await resetToDefaults();
  }
}
