import 'package:flutter/foundation.dart';
import '../data/models/mock_models.dart';
import '../data/repositories/mock_repository.dart';

/// Friends provider for managing friends list state
class FriendsProvider extends ChangeNotifier {
  final MockRepository _mockRepository;

  List<Friend> _friends = [];
  List<Friend> _pendingRequests = [];
  bool _isLoading = false;
  String? _error;

  FriendsProvider(this._mockRepository);

  // Getters
  List<Friend> get friends => _friends;
  List<Friend> get pendingRequests => _pendingRequests;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Filtered friends
  List<Friend> get onlineFriends =>
      _friends.where((f) => f.isOnline).toList();

  List<Friend> get offlineFriends =>
      _friends.where((f) => !f.isOnline).toList();

  int get friendCount => _friends.length;
  int get pendingCount => _pendingRequests.length;

  /// Load friends
  Future<void> loadFriends() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _friends = await _mockRepository.getFriends();
      _pendingRequests = await _mockRepository.getPendingFriendRequests();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Accept friend request (mock)
  void acceptRequest(String friendId) {
    final index = _pendingRequests.indexWhere((f) => f.id == friendId);
    if (index != -1) {
      final friend = _pendingRequests[index];
      _pendingRequests.removeAt(index);
      _friends.add(Friend(
        id: friend.id,
        username: friend.username,
        avatarUrl: friend.avatarUrl,
        status: FriendStatus.accepted,
        totalStars: friend.totalStars,
        currentStreak: friend.currentStreak,
        winRate: friend.winRate,
        isOnline: friend.isOnline,
      ));
      notifyListeners();
    }
  }

  /// Decline friend request (mock)
  void declineRequest(String friendId) {
    _pendingRequests.removeWhere((f) => f.id == friendId);
    notifyListeners();
  }

  /// Remove friend (mock)
  void removeFriend(String friendId) {
    _friends.removeWhere((f) => f.id == friendId);
    notifyListeners();
  }

  /// Find friend by ID
  Friend? findById(String id) {
    try {
      return _friends.firstWhere((f) => f.id == id);
    } catch (_) {
      return null;
    }
  }

  /// Clear friends (on logout)
  void clear() {
    _friends = [];
    _pendingRequests = [];
    _error = null;
    notifyListeners();
  }
}
