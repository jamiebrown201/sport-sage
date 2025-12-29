import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import '../../../core/config/app_config.dart';
import '../storage/secure_storage.dart';

/// AWS Cognito authentication service
class CognitoService {
  late final CognitoUserPool _userPool;
  final SecureStorageService _secureStorage;

  CognitoUser? _cognitoUser;
  CognitoUserSession? _session;

  CognitoService(this._secureStorage) {
    _userPool = CognitoUserPool(
      AppConfig.cognitoUserPoolId,
      AppConfig.cognitoClientId,
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
      final username = await _secureStorage.getCognitoUsername();
      final refreshToken = await _secureStorage.getRefreshToken();

      if (username == null || refreshToken == null) {
        return false;
      }

      _cognitoUser = CognitoUser(username, _userPool);

      // Try to refresh the session
      final session = await _cognitoUser!.getSession();
      if (session != null && session.isValid()) {
        _session = session;
        await _cacheSession();
        return true;
      }

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
    _cognitoUser = CognitoUser(email, _userPool);

    final authDetails = AuthenticationDetails(
      username: email,
      password: password,
    );

    try {
      _session = await _cognitoUser!.authenticateUser(authDetails);
      await _cacheSession();
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

  /// Sign out
  Future<void> signOut() async {
    if (_cognitoUser != null) {
      await _cognitoUser!.signOut();
    }
    _session = null;
    _cognitoUser = null;
    await _secureStorage.clearTokens();
    await _secureStorage.delete('cognito_username');
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
      await _cacheSession();
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

  /// Cache session tokens to secure storage
  Future<void> _cacheSession() async {
    if (_session == null || _cognitoUser == null) return;

    await _secureStorage.saveTokens(
      accessToken: _session!.getAccessToken().getJwtToken()!,
      idToken: _session!.getIdToken().getJwtToken()!,
      refreshToken: _session!.getRefreshToken()!.getToken()!,
    );
    await _secureStorage.saveCognitoUsername(_cognitoUser!.username!);
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
