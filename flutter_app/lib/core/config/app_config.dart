/// Application configuration for Sport Sage
class AppConfig {
  // API Configuration
  static const String apiBaseUrl =
      'https://ey6am7apnc.execute-api.eu-west-1.amazonaws.com';

  // AWS Cognito Configuration
  static const String cognitoUserPoolId = 'eu-west-1_85f98jsbc';
  static const String cognitoClientId = '2skfsajgv0fpo2tik8g37ii1h1';
  static const String cognitoRegion = 'eu-west-1';

  // API Timeouts
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // Retry Configuration
  static const int maxRetryAttempts = 3;

  // Cache Configuration
  static const Duration eventsCacheDuration = Duration(seconds: 30);

  // Prediction Limits
  static const int minStake = 10;
  static const int maxStake = 1000;
  static const int minAccumulatorSelections = 2;
  static const int maxAccumulatorSelections = 10;

  // Currency Constants
  static const int welcomeBonusCoins = 1000;
  static const int dailyTopupAmount = 500;

  // Accumulator Bonus Multipliers
  static const Map<int, double> accumulatorBonuses = {
    2: 1.0,
    3: 1.05,
    4: 1.1,
    5: 1.15,
    6: 1.2,
    7: 1.3,
    8: 1.4,
    9: 1.5,
    10: 1.75,
  };

  // Password Requirements
  static const int minPasswordLength = 8;
  static const bool requireUppercase = true;
  static const bool requireLowercase = true;
  static const bool requireDigits = true;
  static const bool requireSymbols = false;

  // Username Requirements
  static const int minUsernameLength = 3;
  static const int maxUsernameLength = 20;

  // Default stake for predictions
  static const int defaultStake = 100;

  /// Get accumulator bonus multiplier for a given number of selections
  static double getAccumulatorBonus(int selections) {
    return accumulatorBonuses[selections] ?? 1.0;
  }
}
