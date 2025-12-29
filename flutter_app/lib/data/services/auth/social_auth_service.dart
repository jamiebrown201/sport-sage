import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import '../../../core/config/app_config.dart';
import 'cognito_service.dart';

/// Result of a social sign-in attempt
class SocialSignInResult {
  final String provider; // 'google' or 'apple'
  final String idToken;
  final String? accessToken;
  final String? email;
  final String? displayName;

  SocialSignInResult({
    required this.provider,
    required this.idToken,
    this.accessToken,
    this.email,
    this.displayName,
  });
}

/// Service for handling Google and Apple Sign-In
class SocialAuthService {
  late final GoogleSignIn _googleSignIn;

  SocialAuthService() {
    _googleSignIn = GoogleSignIn(
      clientId: AppConfig.googleClientIdIOS,
      scopes: ['email', 'profile', 'openid'],
    );
  }

  /// Sign in with Google
  /// Returns the ID token to exchange with Cognito
  Future<SocialSignInResult> signInWithGoogle() async {
    try {
      // Trigger the Google Sign-In flow
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();

      if (googleUser == null) {
        throw AuthException('Google sign-in was cancelled');
      }

      // Get the auth details from the request
      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      final idToken = googleAuth.idToken;
      if (idToken == null) {
        throw AuthException('Failed to get Google ID token');
      }

      return SocialSignInResult(
        provider: 'google',
        idToken: idToken,
        accessToken: googleAuth.accessToken,
        email: googleUser.email,
        displayName: googleUser.displayName,
      );
    } catch (e) {
      if (e is AuthException) rethrow;
      throw AuthException('Google sign-in failed: ${e.toString()}');
    }
  }

  /// Sign in with Apple
  /// Returns the ID token to exchange with Cognito
  Future<SocialSignInResult> signInWithApple() async {
    try {
      // Generate a secure nonce for the Apple Sign-In
      final rawNonce = _generateNonce();
      final nonce = _sha256ofString(rawNonce);

      // Request the Apple credential
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: nonce,
      );

      final idToken = credential.identityToken;
      if (idToken == null) {
        throw AuthException('Failed to get Apple ID token');
      }

      // Apple only returns the name on first sign-in
      String? displayName;
      if (credential.givenName != null || credential.familyName != null) {
        displayName =
            '${credential.givenName ?? ''} ${credential.familyName ?? ''}'
                .trim();
      }

      return SocialSignInResult(
        provider: 'apple',
        idToken: idToken,
        accessToken: credential.authorizationCode,
        email: credential.email,
        displayName: displayName,
      );
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        throw AuthException('Apple sign-in was cancelled');
      }
      throw AuthException('Apple sign-in failed: ${e.message}');
    } catch (e) {
      if (e is AuthException) rethrow;
      throw AuthException('Apple sign-in failed: ${e.toString()}');
    }
  }

  /// Sign out from Google (clears cached credentials)
  Future<void> signOutGoogle() async {
    try {
      await _googleSignIn.signOut();
    } catch (e) {
      // Ignore sign-out errors
    }
  }

  /// Check if Google Sign-In is available
  Future<bool> isGoogleSignInAvailable() async {
    try {
      return await _googleSignIn.isSignedIn() || true; // Always available on mobile
    } catch (e) {
      return false;
    }
  }

  /// Check if Apple Sign-In is available (iOS 13+, macOS 10.15+)
  Future<bool> isAppleSignInAvailable() async {
    return await SignInWithApple.isAvailable();
  }

  /// Generate a secure random nonce for Apple Sign-In
  String _generateNonce([int length = 32]) {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(length, (_) => charset[random.nextInt(charset.length)])
        .join();
  }

  /// Create SHA256 hash of the nonce
  String _sha256ofString(String input) {
    final bytes = utf8.encode(input);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }
}
