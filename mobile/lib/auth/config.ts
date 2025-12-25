// Cognito and API Configuration for Sport Sage

export const AUTH_CONFIG = {
  region: 'eu-west-1',
  userPoolId: 'eu-west-1_85f98jsbc',
  clientId: '2skfsajgv0fpo2tik8g37ii1h1',
  // Identity Pool for future social login (Apple, Google)
  identityPoolId: 'eu-west-1:0ce68b81-eef0-4e17-b37d-1f194ddf5620',

  // OAuth config (prepared for future social login)
  oauth: {
    domain: 'sport-sage-dev.auth.eu-west-1.amazoncognito.com',
    redirectSignIn: 'sportsage://auth/callback',
    redirectSignOut: 'sportsage://auth/logout',
    responseType: 'code' as const,
    scopes: ['email', 'openid', 'profile'],
  },

  // Password requirements (must match Cognito settings)
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: false,
  },
};

export const API_CONFIG = {
  baseUrl: 'https://ey6am7apnc.execute-api.eu-west-1.amazonaws.com',
  timeout: 30000,
  retryAttempts: 3,
};
