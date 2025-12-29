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

// In-memory cache for sync access (Cognito SDK requires sync methods)
// IMPORTANT: Must be defined before cognitoStorage and initUserPool
const memoryStorage: Record<string, string> = {};

// Custom storage adapter for Cognito SDK (must be synchronous)
// This uses an in-memory cache that we sync with SecureStore
// IMPORTANT: Must be defined before initUserPool is called
const cognitoStorage = {
  setItem(key: string, value: string): void {
    log(`Storage setItem: ${key}`);
    memoryStorage[key] = value;
    // Async persist to SecureStore (fire and forget)
    SecureStore.setItemAsync(key, value).catch((error) => {
      console.warn('SecureStore setItem failed:', error);
    });
  },
  getItem(key: string): string | null {
    const value = memoryStorage[key];
    log(`Storage getItem: ${key} = ${value ? 'found' : 'null'}`);
    return value || null;
  },
  removeItem(key: string): void {
    log(`Storage removeItem: ${key}`);
    delete memoryStorage[key];
    // Async remove from SecureStore (fire and forget)
    SecureStore.deleteItemAsync(key).catch((error) => {
      console.warn('SecureStore removeItem failed:', error);
    });
  },
  clear(): void {
    log('Storage clear');
    Object.keys(memoryStorage).forEach((key) => {
      if (key.startsWith('CognitoIdentityServiceProvider')) {
        delete memoryStorage[key];
        SecureStore.deleteItemAsync(key).catch(() => {});
      }
    });
  },
};

// Initialize Cognito User Pool with custom storage
let userPool: CognitoUserPool;

function initUserPool(): void {
  userPool = new CognitoUserPool({
    UserPoolId: AUTH_CONFIG.userPoolId,
    ClientId: AUTH_CONFIG.clientId,
    Storage: cognitoStorage,
  });
}

// Initialize the pool (cognitoStorage is now defined above)
initUserPool();

// Function to load storage from SecureStore on app start
async function loadStorageFromSecureStore(): Promise<void> {
  log('Loading Cognito tokens from SecureStore...');
  try {
    // We need to load all the Cognito keys
    // The keys follow the pattern: CognitoIdentityServiceProvider.<clientId>.<username>.<tokenType>
    const prefix = `CognitoIdentityServiceProvider.${AUTH_CONFIG.clientId}`;
    const keysToLoad = [
      `${prefix}.LastAuthUser`,
    ];

    // First load LastAuthUser to know which user's tokens to load
    const lastAuthUser = await SecureStore.getItemAsync(`${prefix}.LastAuthUser`);
    if (lastAuthUser) {
      memoryStorage[`${prefix}.LastAuthUser`] = lastAuthUser;
      log('Found LastAuthUser:', lastAuthUser);

      // Load tokens for this user
      const userPrefix = `${prefix}.${lastAuthUser}`;
      const userKeys = ['idToken', 'accessToken', 'refreshToken', 'clockDrift'];

      for (const tokenKey of userKeys) {
        const fullKey = `${userPrefix}.${tokenKey}`;
        const value = await SecureStore.getItemAsync(fullKey);
        if (value) {
          memoryStorage[fullKey] = value;
          log(`Loaded ${tokenKey}`);
        }
      }
    } else {
      log('No LastAuthUser found in SecureStore');
    }
  } catch (error) {
    console.warn('Failed to load from SecureStore:', error);
  }
}

// Custom storage using SecureStore for React Native (for our own use, not Cognito SDK)
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
  private initialized = false;

  /**
   * Initialize the auth service by loading tokens from SecureStore
   * MUST be called before any other methods
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      log('Already initialized');
      return;
    }
    log('Initializing CognitoAuthService...');
    await loadStorageFromSecureStore();
    // Reinitialize user pool with loaded storage
    initUserPool();
    this.initialized = true;
    log('CognitoAuthService initialized');
  }

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
        Storage: cognitoStorage,
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
        Storage: cognitoStorage,
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
        Storage: cognitoStorage,
      });

      const authDetails = new AuthenticationDetails({
        Username: emailOrUsername,
        Password: password,
      });

      user.authenticateUser(authDetails, {
        onSuccess: async (session) => {
          log('signIn success');
          this.currentUser = user;

          // Tokens are automatically stored by the SDK via our cognitoStorage adapter
          const idToken = session.getIdToken().getJwtToken();
          const accessToken = session.getAccessToken().getJwtToken();
          const refreshToken = session.getRefreshToken().getToken();

          log('Authentication successful for user:', user.getUsername());

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

    // Clear Cognito storage (this also clears SecureStore via our adapter)
    cognitoStorage.clear();

    // Clear our legacy stored tokens (if any)
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

    // Make sure we're initialized
    if (!this.initialized) {
      log('Not initialized, initializing now...');
      await this.initialize();
    }

    const user = userPool.getCurrentUser();
    if (!user) {
      log('No current user in pool');
      return null;
    }

    log('Found current user:', user.getUsername());

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
          log('Session is not valid, trying to refresh...');
          // Try to refresh the session
          const refreshToken = session.getRefreshToken();
          user.refreshSession(refreshToken, (refreshErr, newSession) => {
            if (refreshErr || !newSession) {
              log('Session refresh failed', refreshErr);
              resolve(null);
              return;
            }
            log('Session refreshed successfully');
            this.currentUser = user;
            resolve(newSession);
          });
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
        Storage: cognitoStorage,
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
        Storage: cognitoStorage,
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
