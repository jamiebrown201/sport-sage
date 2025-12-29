import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure storage service for sensitive data (tokens, credentials)
class SecureStorageService {
  final FlutterSecureStorage _storage;

  SecureStorageService()
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(
            encryptedSharedPreferences: true,
          ),
          iOptions: IOSOptions(
            accessibility: KeychainAccessibility.first_unlock_this_device,
          ),
        );

  // Storage keys
  static const String _accessTokenKey = 'access_token';
  static const String _idTokenKey = 'id_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _cognitoUsernameKey = 'cognito_username';

  /// Save access token
  Future<void> saveAccessToken(String token) async {
    await _storage.write(key: _accessTokenKey, value: token);
  }

  /// Get access token
  Future<String?> getAccessToken() async {
    return await _storage.read(key: _accessTokenKey);
  }

  /// Save ID token
  Future<void> saveIdToken(String token) async {
    await _storage.write(key: _idTokenKey, value: token);
  }

  /// Get ID token
  Future<String?> getIdToken() async {
    return await _storage.read(key: _idTokenKey);
  }

  /// Save refresh token
  Future<void> saveRefreshToken(String token) async {
    await _storage.write(key: _refreshTokenKey, value: token);
  }

  /// Get refresh token
  Future<String?> getRefreshToken() async {
    return await _storage.read(key: _refreshTokenKey);
  }

  /// Save all tokens at once
  Future<void> saveTokens({
    required String accessToken,
    required String idToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      saveAccessToken(accessToken),
      saveIdToken(idToken),
      saveRefreshToken(refreshToken),
    ]);
  }

  /// Save Cognito username
  Future<void> saveCognitoUsername(String username) async {
    await _storage.write(key: _cognitoUsernameKey, value: username);
  }

  /// Get Cognito username
  Future<String?> getCognitoUsername() async {
    return await _storage.read(key: _cognitoUsernameKey);
  }

  /// Clear all tokens
  Future<void> clearTokens() async {
    await Future.wait([
      _storage.delete(key: _accessTokenKey),
      _storage.delete(key: _idTokenKey),
      _storage.delete(key: _refreshTokenKey),
    ]);
  }

  /// Clear all stored data
  Future<void> clearAll() async {
    await _storage.deleteAll();
  }

  /// Check if user has stored tokens
  Future<bool> hasTokens() async {
    final idToken = await getIdToken();
    return idToken != null && idToken.isNotEmpty;
  }

  /// Generic write
  Future<void> write(String key, String value) async {
    await _storage.write(key: key, value: value);
  }

  /// Generic read
  Future<String?> read(String key) async {
    return await _storage.read(key: key);
  }

  /// Generic delete
  Future<void> delete(String key) async {
    await _storage.delete(key: key);
  }
}
