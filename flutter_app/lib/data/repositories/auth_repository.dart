import '../models/user.dart';
import '../models/user_stats.dart';
import '../services/api/api_client.dart';
import '../services/api/api_endpoints.dart';
import '../services/auth/cognito_service.dart';

/// Authentication result containing user and stats
class AuthResult {
  final User user;
  final UserStats? stats;
  final String? message;

  AuthResult({
    required this.user,
    this.stats,
    this.message,
  });
}

/// Repository for authentication operations
class AuthRepository {
  final ApiClient _apiClient;
  final CognitoService _cognitoService;

  AuthRepository(this._apiClient, this._cognitoService);

  /// Sign up a new user with Cognito
  Future<void> signUp({
    required String email,
    required String password,
  }) async {
    await _cognitoService.signUp(email: email, password: password);
  }

  /// Confirm sign up with verification code
  Future<void> confirmSignUp({
    required String email,
    required String code,
  }) async {
    await _cognitoService.confirmSignUp(email: email, code: code);
  }

  /// Resend confirmation code
  Future<void> resendConfirmationCode(String email) async {
    await _cognitoService.resendConfirmationCode(email);
  }

  /// Sign in with email and password
  Future<void> signIn({
    required String email,
    required String password,
  }) async {
    await _cognitoService.signIn(email: email, password: password);
  }

  /// Sign in with Google
  /// Opens browser for OAuth flow
  Future<void> signInWithGoogle() async {
    await _cognitoService.signInWithGoogle();
  }

  /// Sign in with Apple
  /// Opens browser for OAuth flow
  Future<void> signInWithApple() async {
    await _cognitoService.signInWithApple();
  }

  /// Handle OAuth callback from social sign-in
  Future<void> handleAuthCallback(Uri uri) async {
    await _cognitoService.handleAuthCallback(uri);
  }

  /// Sign out
  Future<void> signOut() async {
    await _cognitoService.signOut();
  }

  /// Register user in database (after Cognito signup)
  Future<AuthResult> register({required String username}) async {
    final response = await _apiClient.post(
      ApiEndpoints.authRegister,
      data: {'username': username},
      requiresAuth: true,
    );

    return AuthResult(
      user: User.fromJson(response['user'] as Map<String, dynamic>),
      stats: response['stats'] != null
          ? UserStats.fromJson(response['stats'] as Map<String, dynamic>)
          : null,
      message: response['message'] as String?,
    );
  }

  /// Get current user profile
  Future<AuthResult> getMe() async {
    final response = await _apiClient.get(
      ApiEndpoints.authMe,
      requiresAuth: true,
    );

    return AuthResult(
      user: User.fromJson(response['user'] as Map<String, dynamic>),
      stats: response['stats'] != null
          ? UserStats.fromJson(response['stats'] as Map<String, dynamic>)
          : null,
    );
  }

  /// Update user profile
  Future<AuthResult> updateProfile({
    bool? isOver18,
    bool? showAffiliates,
    String? avatarUrl,
  }) async {
    final data = <String, dynamic>{};
    if (isOver18 != null) data['isOver18'] = isOver18;
    if (showAffiliates != null) data['showAffiliates'] = showAffiliates;
    if (avatarUrl != null) data['avatarUrl'] = avatarUrl;

    final response = await _apiClient.patch(
      ApiEndpoints.authMe,
      data: data,
      requiresAuth: true,
    );

    return AuthResult(
      user: User.fromJson(response['user'] as Map<String, dynamic>),
      stats: response['stats'] != null
          ? UserStats.fromJson(response['stats'] as Map<String, dynamic>)
          : null,
    );
  }

  /// Check if username is available
  Future<bool> checkUsernameAvailable(String username) async {
    final response = await _apiClient.get(
      ApiEndpoints.authCheckUsername(username),
      requiresAuth: false,
    );

    return response['available'] as bool? ?? false;
  }

  /// Initiate forgot password flow
  Future<void> forgotPassword(String email) async {
    await _cognitoService.forgotPassword(email);
  }

  /// Confirm forgot password with code and new password
  Future<void> confirmForgotPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    await _cognitoService.confirmForgotPassword(
      email: email,
      code: code,
      newPassword: newPassword,
    );
  }

  /// Check if user is authenticated
  Future<bool> isAuthenticated() async {
    return await _cognitoService.isSignedIn();
  }

  /// Get current session tokens
  Future<String?> getIdToken() async {
    return await _cognitoService.getIdToken();
  }

  /// Refresh session
  Future<void> refreshSession() async {
    await _cognitoService.refreshSession();
  }
}
