/// API endpoint constants for Sport Sage backend
class ApiEndpoints {
  // Auth endpoints
  static const String authRegister = '/api/auth/register';
  static const String authMe = '/api/auth/me';
  static String authCheckUsername(String username) =>
      '/api/auth/check-username/$username';

  // Events endpoints
  static const String events = '/api/events';
  static const String eventsById = '/api/events'; // Append /{id}
  static String eventById(String id) => '/api/events/$id';
  static const String eventsFeatured = '/api/events/featured';
  static const String eventsSports = '/api/events/sports';

  // Predictions endpoints
  static const String predictions = '/api/predictions';
  static String predictionById(String id) => '/api/predictions/$id';
  static const String predictionsStats = '/api/predictions/stats';

  // Wallet endpoints
  static const String wallet = '/api/wallet';
  static const String walletTransactions = '/api/wallet/transactions';
  static const String walletTopup = '/api/wallet/topup';
  static const String walletTopupStatus = '/api/wallet/topup/status';

  // Leaderboard endpoints
  static const String leaderboard = '/api/leaderboard';
  static const String leaderboardPosition = '/api/leaderboard/position';

  // Shop endpoints (placeholder)
  static const String shop = '/api/shop';

  // Challenges endpoints (placeholder)
  static const String challenges = '/api/challenges';

  // Achievements endpoints (placeholder)
  static const String achievements = '/api/achievements';

  // Social endpoints (placeholder)
  static const String social = '/api/social';
}
