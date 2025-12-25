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
   */
  async signUp({ email, password, username }: SignUpParams): Promise<ISignUpResult> {
    return new Promise((resolve, reject) => {
      const attributeList: CognitoUserAttribute[] = [
        new CognitoUserAttribute({ Name: 'email', Value: email }),
        new CognitoUserAttribute({ Name: 'custom:username', Value: username }),
      ];

      userPool.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          reject(this.normalizeError(err));
          return;
        }
        if (!result) {
          reject(new Error('Sign up failed: no result returned'));
          return;
        }
        resolve(result);
      });
    });
  }

  /**
   * Confirm sign up with verification code
   */
  async confirmSignUp(email: string, code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      user.confirmRegistration(code, true, (err, result) => {
        if (err) {
          reject(this.normalizeError(err));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Resend confirmation code
   */
  async resendConfirmationCode(email: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      user.resendConfirmationCode((err, result) => {
        if (err) {
          reject(this.normalizeError(err));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<SignInResult> {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      user.authenticateUser(authDetails, {
        onSuccess: async (session) => {
          this.currentUser = user;

          // Store tokens securely
          const idToken = session.getIdToken().getJwtToken();
          const accessToken = session.getAccessToken().getJwtToken();
          const refreshToken = session.getRefreshToken().getToken();

          await secureStorage.setItem('cognito_id_token', idToken);
          await secureStorage.setItem('cognito_access_token', accessToken);
          await secureStorage.setItem('cognito_refresh_token', refreshToken);
          await secureStorage.setItem('cognito_user_email', email);

          resolve({
            session,
            idToken,
            accessToken,
            refreshToken,
          });
        },
        onFailure: (err) => {
          reject(this.normalizeError(err));
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
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
    const user = userPool.getCurrentUser();
    if (user) {
      user.signOut();
    }
    this.currentUser = null;

    // Clear stored tokens
    await secureStorage.removeItem('cognito_id_token');
    await secureStorage.removeItem('cognito_access_token');
    await secureStorage.removeItem('cognito_refresh_token');
    await secureStorage.removeItem('cognito_user_email');
  }

  /**
   * Get current session (if valid)
   */
  async getSession(): Promise<CognitoUserSession | null> {
    const user = userPool.getCurrentUser();
    if (!user) {
      // Try to restore from stored email
      const email = await secureStorage.getItem('cognito_user_email');
      if (!email) return null;

      const storedUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      return new Promise((resolve) => {
        storedUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session) {
            resolve(null);
            return;
          }
          if (session.isValid()) {
            this.currentUser = storedUser;
            resolve(session);
          } else {
            resolve(null);
          }
        });
      });
    }

    return new Promise((resolve) => {
      user.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          resolve(null);
          return;
        }
        if (session.isValid()) {
          this.currentUser = user;
          resolve(session);
        } else {
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
    try {
      const session = await this.getSession();
      if (!session) return null;

      // Check if token needs refresh (less than 5 minutes remaining)
      const idToken = session.getIdToken();
      const expiration = idToken.getExpiration() * 1000; // Convert to ms
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiration - now < fiveMinutes) {
        const newSession = await this.refreshSession();
        return newSession.getIdToken().getJwtToken();
      }

      return idToken.getJwtToken();
    } catch (error) {
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
   */
  async forgotPassword(email: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      user.forgotPassword({
        onSuccess: () => {
          resolve();
        },
        onFailure: (err) => {
          reject(this.normalizeError(err));
        },
      });
    });
  }

  /**
   * Confirm forgot password with code and new password
   */
  async confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      user.confirmPassword(code, newPassword, {
        onSuccess: () => {
          resolve();
        },
        onFailure: (err) => {
          reject(this.normalizeError(err));
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
    return {
      code: err.code || 'UnknownError',
      message: err.message || 'An unknown error occurred',
      name: err.name || 'Error',
    };
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
  switch (error.code) {
    case CognitoErrorCodes.UserNotConfirmed:
      return 'Please verify your email before signing in';
    case CognitoErrorCodes.UserNotFound:
      return 'No account found with this email';
    case CognitoErrorCodes.UsernameExists:
      return 'An account with this email already exists';
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
