import 'package:flutter/foundation.dart';
import '../data/models/leaderboard_entry.dart';
import '../data/repositories/leaderboard_repository.dart';

/// Leaderboard provider for managing leaderboard state
class LeaderboardProvider extends ChangeNotifier {
  final LeaderboardRepository _leaderboardRepository;

  List<LeaderboardEntry> _entries = [];
  List<LeaderboardEntry> _friendsEntries = [];
  LeaderboardPosition? _userPosition;
  LeaderboardPeriod _selectedPeriod = LeaderboardPeriod.weekly;
  bool _showFriendsOnly = false;
  bool _isLoading = false;
  bool _isLoadingMore = false;
  String? _error;
  int _currentPage = 1;
  bool _hasMore = true;

  LeaderboardProvider(this._leaderboardRepository);

  // Getters
  List<LeaderboardEntry> get entries => _showFriendsOnly ? _friendsEntries : _entries;
  List<LeaderboardEntry> get allEntries => _entries;
  List<LeaderboardEntry> get friendsEntries => _friendsEntries;
  LeaderboardPosition? get userPosition => _userPosition;
  LeaderboardPeriod get selectedPeriod => _selectedPeriod;
  bool get showFriendsOnly => _showFriendsOnly;
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  String? get error => _error;
  bool get hasMore => _hasMore;

  // Top 3 for podium display
  List<LeaderboardEntry> get topThree => _entries.take(3).toList();

  /// Load leaderboard
  Future<void> loadLeaderboard({
    bool refresh = false,
    LeaderboardPeriod? period,
    bool? friendsOnly,
  }) async {
    if (refresh) {
      _currentPage = 1;
      _hasMore = true;
    }

    if (period != null) {
      _selectedPeriod = period;
    }

    if (friendsOnly != null) {
      _showFriendsOnly = friendsOnly;
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
      final response = await _leaderboardRepository.getLeaderboard(
        period: _selectedPeriod,
        page: _currentPage,
        pageSize: 50,
        friendsOnly: _showFriendsOnly,
      );

      if (_showFriendsOnly) {
        if (refresh) {
          _friendsEntries = response.entries;
        } else {
          _friendsEntries = [..._friendsEntries, ...response.entries];
        }
      } else {
        if (refresh) {
          _entries = response.entries;
        } else {
          _entries = [..._entries, ...response.entries];
        }
      }

      _userPosition = response.userPosition ?? _userPosition;
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

  /// Load user's position
  Future<void> loadUserPosition() async {
    try {
      _userPosition = await _leaderboardRepository.getUserPosition(
        period: _selectedPeriod,
      );
      notifyListeners();
    } catch (e) {
      // Silently fail
    }
  }

  /// Set selected period
  void setSelectedPeriod(LeaderboardPeriod period) {
    if (_selectedPeriod != period) {
      _selectedPeriod = period;
      loadLeaderboard(refresh: true);
    }
  }

  /// Toggle friends only filter
  void toggleFriendsOnly() {
    _showFriendsOnly = !_showFriendsOnly;
    loadLeaderboard(refresh: true);
  }

  /// Set friends only filter
  void setShowFriendsOnly(bool value) {
    if (_showFriendsOnly != value) {
      _showFriendsOnly = value;
      loadLeaderboard(refresh: true);
    }
  }

  /// Refresh leaderboard
  Future<void> refresh() async {
    await Future.wait([
      loadLeaderboard(refresh: true),
      loadUserPosition(),
    ]);
  }

  /// Find entry by user ID
  LeaderboardEntry? findByUserId(String userId) {
    try {
      return _entries.firstWhere((e) => e.userId == userId);
    } catch (_) {
      return null;
    }
  }

  /// Clear all data (on logout)
  void clear() {
    _entries = [];
    _friendsEntries = [];
    _userPosition = null;
    _currentPage = 1;
    _hasMore = true;
    _error = null;
    notifyListeners();
  }
}
