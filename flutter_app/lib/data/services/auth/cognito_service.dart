import 'dart:convert';
import 'dart:io';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/config/app_config.dart';
import '../storage/secure_storage.dart';

/// Custom storage adapter for Cognito SDK
/// Uses in-memory cache with async persistence to SecureStorage
class _CognitoStorage extends CognitoStorage {
  final SecureStorageService _secureStorage;
  final Map<String, String> _cache = {};
  bool _initialized = false;

  _CognitoStorage(this._secureStorage);

  /// Load all Cognito keys from SecureStorage into memory cache
  Future<void> init() async {
    if (_initialized) return;

    // Load the keys we need for session restoration
    final prefix = 'CognitoIdentityServiceProvider.${AppConfig.cognitoClientId}';

    // First load LastAuthUser
    final lastAuthUserKey = '$prefix.LastAuthUser';
    final lastAuthUser = await _secureStorage.read(lastAuthUserKey);
    if (lastAuthUser != null) {
      _cache[lastAuthUserKey] = lastAuthUser;

      // Then load user-specific tokens
      final userKeys = [
        '$prefix.$lastAuthUser.idToken',
        '$prefix.$lastAuthUser.accessToken',
        '$prefix.$lastAuthUser.refreshToken',
        '$prefix.$lastAuthUser.clockDrift',
      ];

      for (final key in userKeys) {
        final value = await _secureStorage.read(key);
        if (value != null) {
          _cache[key] = value;
        }
      }
    }

    _initialized = true;
  }

  @override
  Future<String?> getItem(String key) async {
    return _cache[key];
  }

  @override
  Future<dynamic> setItem(String key, dynamic value) async {
    final stringValue = value.toString();
    _cache[key] = stringValue;
    // Persist to secure storage asynchronously
    await _secureStorage.write(key, stringValue);
  }

  @override
  Future<void> removeItem(String key) async {
    _cache.remove(key);
    await _secureStorage.delete(key);
  }

  @override
  Future<void> clear() async {
    // Clear only Cognito keys from cache
    final cognitoKeys = _cache.keys
        .where((k) => k.startsWith('CognitoIdentityServiceProvider'))
        .toList();
    for (final key in cognitoKeys) {
      _cache.remove(key);
      await _secureStorage.delete(key);
    }
  }
}

/// AWS Cognito authentication service
class CognitoService {
  late final CognitoUserPool _userPool;
  late final _CognitoStorage _cognitoStorage;
  final SecureStorageService _secureStorage;

  CognitoUser? _cognitoUser;
  CognitoUserSession? _session;

  CognitoService(this._secureStorage) {
    _cognitoStorage = _CognitoStorage(_secureStorage);
    _userPool = CognitoUserPool(
      AppConfig.cognitoUserPoolId,
      AppConfig.cognitoClientId,
      storage: _cognitoStorage,
    );
  }

  /// Get current session
  CognitoUserSession? get session => _session;

  /// Check if user is authenticated
  bool get isAuthenticated => _session != null && _session!.isValid();

  /// Check if user is signed in (alias for isAuthenticated, async)
  Future<bool> isSignedIn() async {
    if (_session != null && _session!.isValid()) {
      return true;
    }
    // Try to restore session from storage
    return await initialize();
  }

  /// Initialize and restore session from storage
  Future<bool> initialize() async {
    try {
      // First, load the storage cache from SecureStorage
      await _cognitoStorage.init();

      // Get the last authenticated user from Cognito storage
      final prefix = 'CognitoIdentityServiceProvider.${AppConfig.cognitoClientId}';
      final lastAuthUser = await _cognitoStorage.getItem('$prefix.LastAuthUser');

      if (lastAuthUser == null) {
        print('CognitoService.initialize: No LastAuthUser found');
        return false;
      }

      _cognitoUser = CognitoUser(lastAuthUser, _userPool, storage: _cognitoStorage);

      // Try to get/refresh the session
      final session = await _cognitoUser!.getSession();
      if (session != null && session.isValid()) {
        _session = session;
        print('CognitoService.initialize: Session restored successfully');
        return true;
      }

      print('CognitoService.initialize: Session invalid or null');
      return false;
    } catch (e) {
      print('CognitoService.initialize error: $e');
      return false;
    }
  }

  /// Sign up a new user
  Future<CognitoUserPoolData> signUp({
    required String email,
    required String password,
  }) async {
    final userAttributes = [
      AttributeArg(name: 'email', value: email),
    ];

    try {
      final result = await _userPool.signUp(
        email,
        password,
        userAttributes: userAttributes,
      );
      return result;
    } on CognitoClientException catch (e) {
      throw _mapCognitoError(e);
    }
  }

  /// Confirm sign up with verification code
  Future<bool> confirmSignUp({
    required String email,
    required String code,
  }) async {
    _cognitoUser = CognitoUser(email, _userPool);

    try {
      final result = await _cognitoUser!.confirmRegistration(code);
      return result;
    } on CognitoClientException catch (e) {
      throw _mapCognitoError(e);
    }
  }

  /// Resend confirmation code
  Future<void> resendConfirmationCode(String email) async {
    _cognitoUser = CognitoUser(email, _userPool);

    try {
      await _cognitoUser!.resendConfirmationCode();
    } on CognitoClientException catch (e) {
      throw _mapCognitoError(e);
    }
  }

  /// Sign in with email and password
  Future<CognitoUserSession> signIn({
    required String email,
    required String password,
  }) async {
    _cognitoUser = CognitoUser(email, _userPool, storage: _cognitoStorage);

    final authDetails = AuthenticationDetails(
      username: email,
      password: password,
    );

    try {
      _session = await _cognitoUser!.authenticateUser(authDetails);
      // Session is automatically cached by the SDK via our storage adapter
      return _session!;
    } on CognitoUserNewPasswordRequiredException {
      throw AuthException('Please set a new password');
    } on CognitoUserMfaRequiredException {
      throw AuthException('MFA required');
    } on CognitoUserSelectMfaTypeException {
      throw AuthException('Please select MFA type');
    } on CognitoUserMfaSetupException {
      throw AuthException('MFA setup required');
    } on CognitoUserTotpRequiredException {
      throw AuthException('TOTP required');
    } on CognitoUserCustomChallengeException {
      throw AuthException('Custom challenge required');
    } on CognitoUserConfirmationNecessaryException {
      throw AuthException(
        'Please verify your email first',
        code: 'UserNotConfirmed',
      );
    } on CognitoClientException catch (e) {
      throw _mapCognitoError(e);
    }
  }

  /// Sign in with Google via Cognito Hosted UI
  /// Opens the browser for OAuth flow and returns when callback is received
  Future<void> signInWithGoogle() async {
    await _launchHostedUI(identityProvider: 'Google');
  }

  /// Sign in with Apple via Cognito Hosted UI
  /// Opens the browser for OAuth flow and returns when callback is received
  Future<void> signInWithApple() async {
    await _launchHostedUI(identityProvider: 'SignInWithApple');
  }

  /// Launch Cognito Hosted UI for social sign-in
  Future<void> _launchHostedUI({required String identityProvider}) async {
    final cognitoDomain = 'sport-sage-dev'; // From CDK auth stack
    final redirectUri = 'sportsage://auth/callback';

    final authUrl = Uri.parse(
      'https://$cognitoDomain.auth.${AppConfig.cognitoRegion}.amazoncognito.com/oauth2/authorize'
      '?identity_provider=$identityProvider'
      '&redirect_uri=${Uri.encodeComponent(redirectUri)}'
      '&response_type=code'
      '&client_id=${AppConfig.cognitoClientId}'
      '&scope=email+openid+profile',
    );

    if (await canLaunchUrl(authUrl)) {
      await launchUrl(
        authUrl,
        mode: LaunchMode.externalApplication,
      );
    } else {
      throw AuthException('Could not launch sign-in page');
    }
  }

  /// Handle OAuth callback from Cognito Hosted UI
  /// Call this when the app receives a deep link with authorization code
  Future<void> handleAuthCallback(Uri uri) async {
    final code = uri.queryParameters['code'];
    if (code == null) {
      final error = uri.queryParameters['error'];
      throw AuthException(error ?? 'Authentication failed');
    }

    // Exchange authorization code for tokens
    await _exchangeCodeForTokens(code);
  }

  /// Exchange authorization code for Cognito tokens
  Future<void> _exchangeCodeForTokens(String code) async {
    final cognitoDomain = 'sport-sage-dev';
    final redirectUri = 'sportsage://auth/callback';

    final tokenUrl = Uri.parse(
      'https://$cognitoDomain.auth.${AppConfig.cognitoRegion}.amazoncognito.com/oauth2/token',
    );

    // Make HTTP request to token endpoint
    final response = await _postTokenRequest(
      tokenUrl,
      {
        'grant_type': 'authorization_code',
        'client_id': AppConfig.cognitoClientId,
        'code': code,
        'redirect_uri': redirectUri,
      },
    );

    if (response == null) {
      throw AuthException('Failed to exchange authorization code');
    }

    // Parse tokens and create session
    final idToken = CognitoIdToken(response['id_token'] as String);
    final accessToken = CognitoAccessToken(response['access_token'] as String);
    final refreshToken = CognitoRefreshToken(response['refresh_token'] as String?);

    _session = CognitoUserSession(idToken, accessToken, refreshToken: refreshToken);

    // Get username from token and set up CognitoUser
    final payload = idToken.payload;
    final username = payload['cognito:username'] as String? ?? payload['sub'] as String;

    _cognitoUser = CognitoUser(username, _userPool, storage: _cognitoStorage);

    // Cache the session
    final prefix = 'CognitoIdentityServiceProvider.${AppConfig.cognitoClientId}';
    await _cognitoStorage.setItem('$prefix.LastAuthUser', username);
    await _cognitoStorage.setItem('$prefix.$username.idToken', idToken.getJwtToken());
    await _cognitoStorage.setItem('$prefix.$username.accessToken', accessToken.getJwtToken());
    if (refreshToken.getToken() != null) {
      await _cognitoStorage.setItem('$prefix.$username.refreshToken', refreshToken.getToken()!);
    }
  }

  /// Make POST request to Cognito token endpoint
  Future<Map<String, dynamic>?> _postTokenRequest(
    Uri url,
    Map<String, String> body,
  ) async {
    try {
      final request = await HttpClient().postUrl(url);
      request.headers.contentType = ContentType.parse('application/x-www-form-urlencoded');
      request.write(body.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&'));

      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();

      if (response.statusCode == 200) {
        return json.decode(responseBody) as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Sign out
  Future<void> signOut() async {
    if (_cognitoUser != null) {
      await _cognitoUser!.signOut();
    }
    _session = null;
    _cognitoUser = null;
    // Clear the Cognito storage
    await _cognitoStorage.clear();
  }

  /// Get current ID token
  Future<String?> getIdToken() async {
    if (_session == null) return null;

    // Check if session is expired
    if (!_session!.isValid()) {
      try {
        await refreshSession();
      } catch (e) {
        return null;
      }
    }

    return _session!.getIdToken().getJwtToken();
  }

  /// Get current access token
  Future<String?> getAccessToken() async {
    if (_session == null) return null;

    if (!_session!.isValid()) {
      try {
        await refreshSession();
      } catch (e) {
        return null;
      }
    }

    return _session!.getAccessToken().getJwtToken();
  }

  /// Refresh the session
  Future<void> refreshSession() async {
    if (_cognitoUser == null || _session == null) {
      throw AuthException('No session to refresh');
    }

    try {
      final refreshToken = _session!.getRefreshToken();
      if (refreshToken == null) {
        throw AuthException('No refresh token available');
      }
      _session = await _cognitoUser!.refreshSession(refreshToken);
      // Session is automatically cached by the SDK via our storage adapter
    } on CognitoClientException catch (e) {
      throw _mapCognitoError(e);
    }
  }

  /// Forgot password - send reset code
  Future<void> forgotPassword(String email) async {
    _cognitoUser = CognitoUser(email, _userPool);

    try {
      await _cognitoUser!.forgotPassword();
    } on CognitoClientException catch (e) {
      throw _mapCognitoError(e);
    }
  }

  /// Confirm forgot password - set new password
  Future<bool> confirmForgotPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    _cognitoUser = CognitoUser(email, _userPool);

    try {
      final result = await _cognitoUser!.confirmPassword(code, newPassword);
      return result;
    } on CognitoClientException catch (e) {
      throw _mapCognitoError(e);
    }
  }

  /// Change password (when signed in)
  Future<bool> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    if (_cognitoUser == null || _session == null) {
      throw AuthException('Not signed in');
    }

    try {
      final result = await _cognitoUser!.changePassword(oldPassword, newPassword);
      return result;
    } on CognitoClientException catch (e) {
      throw _mapCognitoError(e);
    }
  }

  /// Get user attributes
  Future<List<CognitoUserAttribute>?> getUserAttributes() async {
    if (_cognitoUser == null || _session == null) {
      return null;
    }

    try {
      return await _cognitoUser!.getUserAttributes();
    } catch (e) {
      return null;
    }
  }

  /// Get user email from token
  String? getEmailFromToken() {
    if (_session == null) return null;

    final idToken = _session!.getIdToken();
    final payload = idToken.payload;
    return payload['email'] as String?;
  }

  /// Get Cognito user ID (sub) from token
  String? getCognitoId() {
    if (_session == null) return null;

    final idToken = _session!.getIdToken();
    final payload = idToken.payload;
    return payload['sub'] as String?;
  }

  /// Map Cognito errors to user-friendly messages
  AuthException _mapCognitoError(CognitoClientException e) {
    final code = e.code;
    final message = e.message;

    switch (code) {
      case 'UserNotFoundException':
        return AuthException('No account found with this email', code: code);
      case 'NotAuthorizedException':
        return AuthException('Incorrect email or password', code: code);
      case 'UserNotConfirmedException':
        return AuthException('Please verify your email first', code: code);
      case 'UsernameExistsException':
        return AuthException('An account with this email already exists', code: code);
      case 'InvalidPasswordException':
        return AuthException('Password does not meet requirements', code: code);
      case 'CodeMismatchException':
        return AuthException('Invalid verification code', code: code);
      case 'ExpiredCodeException':
        return AuthException('Verification code has expired', code: code);
      case 'LimitExceededException':
        return AuthException('Too many attempts. Please try again later', code: code);
      case 'TooManyRequestsException':
        return AuthException('Too many requests. Please try again later', code: code);
      case 'InvalidParameterException':
        return AuthException(message ?? 'Invalid input', code: code);
      default:
        return AuthException(message ?? 'Authentication error', code: code);
    }
  }
}

/// Custom auth exception
class AuthException implements Exception {
  final String message;
  final String? code;

  AuthException(this.message, {this.code});

  @override
  String toString() => message;
}
