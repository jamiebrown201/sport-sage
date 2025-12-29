import 'package:flutter/foundation.dart';
import '../data/models/user.dart';
import '../data/models/user_stats.dart';
import '../data/repositories/auth_repository.dart';
import '../data/services/api/api_client.dart';
import '../data/services/auth/cognito_service.dart';

/// Authentication state
enum AuthState {
  initial,
  loading,
  authenticated,
  needsRegistration,
  unauthenticated,
  error,
}

/// Auth provider for managing authentication state
class AuthProvider extends ChangeNotifier {
  final AuthRepository _authRepository;

  AuthState _state = AuthState.initial;
  User? _user;
  UserStats? _stats;
  String? _error;
  bool _isLoading = false;

  AuthProvider(this._authRepository);

  // Getters
  AuthState get state => _state;
  User? get user => _user;
  UserStats? get stats => _stats;
  String? get error => _error;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _state == AuthState.authenticated;
  bool get needsRegistration => _state == AuthState.needsRegistration;

  /// Initialize auth state on app start
  Future<void> initialize() async {
    _setLoading(true);

    try {
      final isSignedIn = await _authRepository.isAuthenticated();

      if (!isSignedIn) {
        _state = AuthState.unauthenticated;
        notifyListeners();
        return;
      }

      // Try to get user profile
      await _fetchUserProfile();
    } catch (e) {
      _state = AuthState.unauthenticated;
      _error = e.toString();
    } finally {
      _setLoading(false);
    }
  }

  /// Sign up with email and password
  Future<void> signUp({
    required String email,
    required String password,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      await _authRepository.signUp(email: email, password: password);
    } on AuthException catch (e) {
      _setError(e.message);
      rethrow;
    } catch (e) {
      _setError('Failed to sign up. Please try again.');
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  /// Confirm sign up with verification code
  Future<void> confirmSignUp({
    required String email,
    required String code,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      await _authRepository.confirmSignUp(email: email, code: code);
    } on AuthException catch (e) {
      _setError(e.message);
      rethrow;
    } catch (e) {
      _setError('Failed to verify code. Please try again.');
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  /// Resend confirmation code
  Future<void> resendConfirmationCode(String email) async {
    _setLoading(true);
    _clearError();

    try {
      await _authRepository.resendConfirmationCode(email);
    } on AuthException catch (e) {
      _setError(e.message);
      rethrow;
    } catch (e) {
      _setError('Failed to resend code. Please try again.');
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  /// Sign in with email and password
  Future<void> signIn({
    required String email,
    required String password,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      await _authRepository.signIn(email: email, password: password);

      // Fetch user profile after sign in
      await _fetchUserProfile();
    } on AuthException catch (e) {
      _setError(e.message);
      _state = AuthState.error;
      notifyListeners();
      rethrow;
    } catch (e) {
      _setError('Failed to sign in. Please try again.');
      _state = AuthState.error;
      notifyListeners();
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  /// Sign in with Google
  /// Opens browser for OAuth flow - callback handled separately
  Future<void> signInWithGoogle() async {
    _setLoading(true);
    _clearError();

    try {
      await _authRepository.signInWithGoogle();
      // OAuth flow will redirect to app - callback handles the rest
    } catch (e) {
      _setLoading(false);
      _setError('Failed to start Google sign-in');
      rethrow;
    }
  }

  /// Sign in with Apple
  /// Opens browser for OAuth flow - callback handled separately
  Future<void> signInWithApple() async {
    _setLoading(true);
    _clearError();

    try {
      await _authRepository.signInWithApple();
      // OAuth flow will redirect to app - callback handles the rest
    } catch (e) {
      _setLoading(false);
      _setError('Failed to start Apple sign-in');
      rethrow;
    }
  }

  /// Handle OAuth callback from social sign-in
  Future<void> handleAuthCallback(Uri uri) async {
    _setLoading(true);
    _clearError();

    try {
      await _authRepository.handleAuthCallback(uri);

      // Fetch user profile after successful OAuth
      await _fetchUserProfile();
    } on AuthException catch (e) {
      _setError(e.message);
      _state = AuthState.error;
      notifyListeners();
      rethrow;
    } catch (e) {
      _setError('Failed to complete sign-in. Please try again.');
      _state = AuthState.error;
      notifyListeners();
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  /// Complete registration with username
  Future<void> completeRegistration(String username) async {
    _setLoading(true);
    _clearError();

    try {
      final result = await _authRepository.register(username: username);
      _user = result.user;
      _stats = result.stats;
      _state = AuthState.authenticated;
      notifyListeners();
    } on ApiException catch (e) {
      _setError(e.message);
      rethrow;
    } catch (e) {
      _setError('Failed to complete registration. Please try again.');
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  /// Check if username is available
  Future<bool> checkUsernameAvailable(String username) async {
    try {
      return await _authRepository.checkUsernameAvailable(username);
    } catch (e) {
      return false;
    }
  }

  /// Sign out
  Future<void> signOut() async {
    _setLoading(true);

    try {
      await _authRepository.signOut();
      _user = null;
      _stats = null;
      _state = AuthState.unauthenticated;
      notifyListeners();
    } catch (e) {
      // Still clear local state even if sign out fails
      _user = null;
      _stats = null;
      _state = AuthState.unauthenticated;
      notifyListeners();
    } finally {
      _setLoading(false);
    }
  }

  /// Initiate forgot password
  Future<void> forgotPassword(String email) async {
    _setLoading(true);
    _clearError();

    try {
      await _authRepository.forgotPassword(email);
    } on AuthException catch (e) {
      _setError(e.message);
      rethrow;
    } catch (e) {
      _setError('Failed to send reset code. Please try again.');
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  /// Confirm forgot password with code and new password
  Future<void> confirmForgotPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      await _authRepository.confirmForgotPassword(
        email: email,
        code: code,
        newPassword: newPassword,
      );
    } on AuthException catch (e) {
      _setError(e.message);
      rethrow;
    } catch (e) {
      _setError('Failed to reset password. Please try again.');
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  /// Update user profile
  Future<void> updateProfile({
    bool? isOver18,
    bool? showAffiliates,
    String? avatarUrl,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      final result = await _authRepository.updateProfile(
        isOver18: isOver18,
        showAffiliates: showAffiliates,
        avatarUrl: avatarUrl,
      );
      _user = result.user;
      _stats = result.stats;
      notifyListeners();
    } on ApiException catch (e) {
      _setError(e.message);
      rethrow;
    } catch (e) {
      _setError('Failed to update profile. Please try again.');
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  /// Refresh user profile
  Future<void> refreshProfile() async {
    try {
      await _fetchUserProfile();
    } catch (e) {
      // Silently fail on refresh
    }
  }

  /// Update local user coins (after prediction or topup)
  void updateCoins(int newBalance) {
    if (_user != null) {
      _user = _user!.copyWith(coins: newBalance);
      notifyListeners();
    }
  }

  /// Update local user stars
  void updateStars(int newBalance) {
    if (_user != null) {
      _user = _user!.copyWith(stars: newBalance);
      notifyListeners();
    }
  }

  /// Update local stats
  void updateStats(UserStats newStats) {
    _stats = newStats;
    notifyListeners();
  }

  // Private helpers

  Future<void> _fetchUserProfile() async {
    try {
      final result = await _authRepository.getMe();
      _user = result.user;
      _stats = result.stats;
      _state = AuthState.authenticated;
      notifyListeners();
    } on ApiException catch (e) {
      if (e.isNotFound) {
        // User exists in Cognito but not in DB - needs registration
        _state = AuthState.needsRegistration;
        notifyListeners();
      } else {
        rethrow;
      }
    }
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setError(String message) {
    _error = message;
    notifyListeners();
  }

  void _clearError() {
    _error = null;
  }
}
