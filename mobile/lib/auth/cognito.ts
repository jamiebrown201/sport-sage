// Cognito Authentication Service for Sport Sage

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
  ISignUpResult,
} from 'amazon-cognito-identity-js';
import * as SecureStore from 'expo-secure-store';
import { AUTH_CONFIG } from './config';

// Debug logging for development
const DEBUG = __DEV__;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[Cognito] ${message}`, data !== undefined ? data : '');
  }
};

// Initialize Cognito User Pool
const userPool = new CognitoUserPool({
  UserPoolId: AUTH_CONFIG.userPoolId,
  ClientId: AUTH_CONFIG.clientId,
});

// Custom storage using SecureStore for React Native
const secureStorage = {
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn('SecureStore setItem failed, using memory:', error);
    }
  },
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn('SecureStore getItem failed:', error);
      return null;
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn('SecureStore removeItem failed:', error);
    }
  },
};

export interface SignUpParams {
  email: string;
  password: string;
  username: string;
}

export interface SignInResult {
  session: CognitoUserSession;
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export interface CognitoError {
  code: string;
  message: string;
  name: string;
}

class CognitoAuthService {
  private currentUser: CognitoUser | null = null;

  /**
   * Sign up a new user with email and password
   * Note: User Pool is configured with email as alias, so we use the username
   * as the Cognito Username and pass email as an attribute
   */
  async signUp({ email, password, username }: SignUpParams): Promise<ISignUpResult> {
    log('signUp called', { email, username });
    return new Promise((resolve, reject) => {
      const attributeList: CognitoUserAttribute[] = [
        new CognitoUserAttribute({ Name: 'email', Value: email }),
      ];

      // Use username (not email) as the Cognito Username since the pool
      // is configured with email as an alias
      log('Calling Cognito signUp with username as Username, email as attribute');
      userPool.signUp(username, password, attributeList, [], (err, result) => {
        if (err) {
          const normalizedError = this.normalizeError(err);
          log('signUp error', normalizedError);
          reject(normalizedError);
          return;
        }
        if (!result) {
          log('signUp failed: no result returned');
          reject(new Error('Sign up failed: no result returned'));
          return;
        }
        log('signUp success', { userConfirmed: result.userConfirmed });
        resolve(result);
      });
    });
  }

  /**
   * Confirm sign up with verification code
   * @param username - The username (not email) used during signup
   */
  async confirmSignUp(username: string, code: string): Promise<void> {
    log('confirmSignUp called', { username });
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: username,
        Pool: userPool,
      });

      user.confirmRegistration(code, true, (err, result) => {
        if (err) {
          const normalizedError = this.normalizeError(err);
          log('confirmSignUp error', normalizedError);
          reject(normalizedError);
          return;
        }
        log('confirmSignUp success');
        resolve();
      });
    });
  }

  /**
   * Resend confirmation code
   * @param username - The username (not email) used during signup
   */
  async resendConfirmationCode(username: string): Promise<void> {
    log('resendConfirmationCode called', { username });
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: username,
        Pool: userPool,
      });

      user.resendConfirmationCode((err, result) => {
        if (err) {
          const normalizedError = this.normalizeError(err);
          log('resendConfirmationCode error', normalizedError);
          reject(normalizedError);
          return;
        }
        log('resendConfirmationCode success');
        resolve();
      });
    });
  }

  /**
   * Sign in with email or username and password
   * With email alias configured, users can sign in with either their username or email
   */
  async signIn(emailOrUsername: string, password: string): Promise<SignInResult> {
    log('signIn called', { emailOrUsername });
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: emailOrUsername,
        Pool: userPool,
      });

      const authDetails = new AuthenticationDetails({
        Username: emailOrUsername,
        Password: password,
      });

      user.authenticateUser(authDetails, {
        onSuccess: async (session) => {
          log('signIn success - storing tokens');
          this.currentUser = user;

          // Store tokens securely
          const idToken = session.getIdToken().getJwtToken();
          const accessToken = session.getAccessToken().getJwtToken();
          const refreshToken = session.getRefreshToken().getToken();

          // Get the actual username from the token (in case they signed in with email)
          const payload = session.getIdToken().payload;
          const actualUsername = payload['cognito:username'] || emailOrUsername;

          await secureStorage.setItem('cognito_id_token', idToken);
          await secureStorage.setItem('cognito_access_token', accessToken);
          await secureStorage.setItem('cognito_refresh_token', refreshToken);
          await secureStorage.setItem('cognito_username', actualUsername);
          log('Tokens stored successfully', { actualUsername });

          resolve({
            session,
            idToken,
            accessToken,
            refreshToken,
          });
        },
        onFailure: (err) => {
          const normalizedError = this.normalizeError(err);
          log('signIn error', normalizedError);
          reject(normalizedError);
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          log('signIn newPasswordRequired');
          reject({
            code: 'NewPasswordRequired',
            message: 'A new password is required',
            name: 'NewPasswordRequiredException',
          });
        },
      });
    });
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    log('signOut called');
    const user = userPool.getCurrentUser();
    if (user) {
      user.signOut();
    }
    this.currentUser = null;

    // Clear stored tokens
    await secureStorage.removeItem('cognito_id_token');
    await secureStorage.removeItem('cognito_access_token');
    await secureStorage.removeItem('cognito_refresh_token');
    await secureStorage.removeItem('cognito_username');
    log('signOut complete');
  }

  /**
   * Get current session (if valid)
   */
  async getSession(): Promise<CognitoUserSession | null> {
    log('getSession called');
    const user = userPool.getCurrentUser();
    if (!user) {
      log('No current user in pool, trying to restore from storage');
      // Try to restore from stored username
      const username = await secureStorage.getItem('cognito_username');
      if (!username) {
        log('No stored username found');
        return null;
      }
      log('Found stored username', { username });

      const storedUser = new CognitoUser({
        Username: username,
        Pool: userPool,
      });

      return new Promise((resolve) => {
        storedUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session) {
            log('getSession from storage failed', err);
            resolve(null);
            return;
          }
          if (session.isValid()) {
            log('Session restored from storage and is valid');
            this.currentUser = storedUser;
            resolve(session);
          } else {
            log('Session from storage is not valid');
            resolve(null);
          }
        });
      });
    }

    return new Promise((resolve) => {
      user.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          log('getSession failed', err);
          resolve(null);
          return;
        }
        if (session.isValid()) {
          log('Session is valid');
          this.currentUser = user;
          resolve(session);
        } else {
          log('Session is not valid');
          resolve(null);
        }
      });
    });
  }

  /**
   * Refresh the current session
   */
  async refreshSession(): Promise<CognitoUserSession> {
    const session = await this.getSession();
    if (!session) {
      throw new Error('No session to refresh');
    }

    const user = userPool.getCurrentUser();
    if (!user) {
      throw new Error('No current user');
    }

    return new Promise((resolve, reject) => {
      const refreshToken = session.getRefreshToken();
      user.refreshSession(refreshToken, async (err, newSession) => {
        if (err) {
          reject(this.normalizeError(err));
          return;
        }

        // Update stored tokens
        await secureStorage.setItem('cognito_id_token', newSession.getIdToken().getJwtToken());
        await secureStorage.setItem('cognito_access_token', newSession.getAccessToken().getJwtToken());
        await secureStorage.setItem('cognito_refresh_token', newSession.getRefreshToken().getToken());

        resolve(newSession);
      });
    });
  }

  /**
   * Get the current ID token (for API authentication)
   */
  async getIdToken(): Promise<string | null> {
    log('getIdToken called');
    try {
      const session = await this.getSession();
      if (!session) {
        log('getIdToken: No session available');
        return null;
      }

      // Check if token needs refresh (less than 5 minutes remaining)
      const idToken = session.getIdToken();
      const expiration = idToken.getExpiration() * 1000; // Convert to ms
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiration - now < fiveMinutes) {
        log('Token expiring soon, refreshing...');
        const newSession = await this.refreshSession();
        return newSession.getIdToken().getJwtToken();
      }

      log('Returning valid ID token');
      return idToken.getJwtToken();
    } catch (error) {
      log('Failed to get ID token', error);
      console.error('Failed to get ID token:', error);
      return null;
    }
  }

  /**
   * Get claims from the ID token
   */
  async getTokenClaims(): Promise<Record<string, unknown> | null> {
    const session = await this.getSession();
    if (!session) return null;

    return session.getIdToken().payload;
  }

  /**
   * Initiate forgot password flow
   * With email alias, user can reset using their email
   */
  async forgotPassword(emailOrUsername: string): Promise<void> {
    log('forgotPassword called', { emailOrUsername });
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: emailOrUsername,
        Pool: userPool,
      });

      user.forgotPassword({
        onSuccess: () => {
          log('forgotPassword success - code sent');
          resolve();
        },
        onFailure: (err) => {
          const normalizedError = this.normalizeError(err);
          log('forgotPassword error', normalizedError);
          reject(normalizedError);
        },
      });
    });
  }

  /**
   * Confirm forgot password with code and new password
   */
  async confirmForgotPassword(emailOrUsername: string, code: string, newPassword: string): Promise<void> {
    log('confirmForgotPassword called', { emailOrUsername });
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: emailOrUsername,
        Pool: userPool,
      });

      user.confirmPassword(code, newPassword, {
        onSuccess: () => {
          log('confirmForgotPassword success');
          resolve();
        },
        onFailure: (err) => {
          const normalizedError = this.normalizeError(err);
          log('confirmForgotPassword error', normalizedError);
          reject(normalizedError);
        },
      });
    });
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const user = userPool.getCurrentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }

    return new Promise((resolve, reject) => {
      // Need to get session first
      user.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          reject(new Error('No valid session'));
          return;
        }

        user.changePassword(oldPassword, newPassword, (err, result) => {
          if (err) {
            reject(this.normalizeError(err));
            return;
          }
          resolve();
        });
      });
    });
  }

  // ============================================================================
  // Future Social Login Methods (Coming Soon)
  // ============================================================================

  /**
   * Sign in with Apple - Coming Soon
   */
  async signInWithApple(): Promise<never> {
    throw {
      code: 'ComingSoon',
      message: 'Apple Sign-In is coming soon!',
      name: 'ComingSoonError',
    };
  }

  /**
   * Sign in with Google - Coming Soon
   */
  async signInWithGoogle(): Promise<never> {
    throw {
      code: 'ComingSoon',
      message: 'Google Sign-In is coming soon!',
      name: 'ComingSoonError',
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private normalizeError(error: unknown): CognitoError {
    const err = error as { code?: string; message?: string; name?: string };
    const normalized = {
      code: err.code || 'UnknownError',
      message: err.message || 'An unknown error occurred',
      name: err.name || 'Error',
    };
    log('Cognito error normalized', { original: err, normalized });
    return normalized;
  }
}

// Export singleton instance
export const cognitoAuth = new CognitoAuthService();

// Export error code helpers
export const CognitoErrorCodes = {
  UserNotConfirmed: 'UserNotConfirmedException',
  UserNotFound: 'UserNotFoundException',
  UsernameExists: 'UsernameExistsException',
  InvalidPassword: 'InvalidPasswordException',
  NotAuthorized: 'NotAuthorizedException',
  CodeMismatch: 'CodeMismatchException',
  ExpiredCode: 'ExpiredCodeException',
  LimitExceeded: 'LimitExceededException',
  TooManyRequests: 'TooManyRequestsException',
  InvalidParameter: 'InvalidParameterException',
  ComingSoon: 'ComingSoon',
} as const;

export function getErrorMessage(error: CognitoError): string {
  // Log the full error for debugging
  if (__DEV__) {
    console.log('[Cognito] getErrorMessage called with:', error);
  }

  switch (error.code) {
    case CognitoErrorCodes.UserNotConfirmed:
      return 'Please verify your email before signing in';
    case CognitoErrorCodes.UserNotFound:
      return 'No account found with this email';
    case CognitoErrorCodes.UsernameExists:
      return 'An account with this email already exists';
    case CognitoErrorCodes.InvalidParameter:
      // Provide more helpful message for common invalid parameter errors
      if (error.message.toLowerCase().includes('email')) {
        return 'Please enter a valid email address';
      }
      if (error.message.toLowerCase().includes('password')) {
        return 'Password does not meet requirements';
      }
      return error.message || 'Invalid input. Please check your entries.';
    case CognitoErrorCodes.InvalidPassword:
      return 'Password does not meet requirements';
    case CognitoErrorCodes.NotAuthorized:
      return 'Incorrect email or password';
    case CognitoErrorCodes.CodeMismatch:
      return 'Invalid verification code';
    case CognitoErrorCodes.ExpiredCode:
      return 'Verification code has expired. Please request a new one.';
    case CognitoErrorCodes.LimitExceeded:
    case CognitoErrorCodes.TooManyRequests:
      return 'Too many attempts. Please try again later.';
    case CognitoErrorCodes.ComingSoon:
      return error.message;
    default:
      return error.message || 'An error occurred. Please try again.';
  }
}
