import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/theme/app_theme.dart';
import 'data/services/storage/secure_storage.dart';
import 'data/services/storage/local_storage.dart';
import 'data/services/auth/cognito_service.dart';
import 'data/services/api/api_client.dart';
import 'data/repositories/auth_repository.dart';
import 'data/repositories/events_repository.dart';
import 'data/repositories/predictions_repository.dart';
import 'data/repositories/wallet_repository.dart';
import 'data/repositories/leaderboard_repository.dart';
import 'data/repositories/mock_repository.dart';
import 'providers/auth_provider.dart';
import 'providers/wallet_provider.dart';
import 'providers/events_provider.dart';
import 'providers/predictions_provider.dart';
import 'providers/accumulator_provider.dart';
import 'providers/leaderboard_provider.dart';
import 'providers/challenges_provider.dart';
import 'providers/achievements_provider.dart';
import 'providers/friends_provider.dart';
import 'providers/settings_provider.dart';
import 'providers/shop_provider.dart';
import 'router/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize services
  final secureStorage = SecureStorageService();
  final localStorage = LocalStorageService();
  await localStorage.init();

  final cognitoService = CognitoService(secureStorage);
  final apiClient = ApiClient(cognitoService);

  // Initialize repositories
  final authRepository = AuthRepository(apiClient, cognitoService);
  final eventsRepository = EventsRepository(apiClient);
  final predictionsRepository = PredictionsRepository(apiClient);
  final walletRepository = WalletRepository(apiClient);
  final leaderboardRepository = LeaderboardRepository(apiClient);
  final mockRepository = MockRepository();

  // Initialize providers
  final authProvider = AuthProvider(authRepository);
  final walletProvider = WalletProvider(walletRepository);
  final eventsProvider = EventsProvider(eventsRepository);
  final predictionsProvider = PredictionsProvider(predictionsRepository);
  final accumulatorProvider = AccumulatorProvider();
  final leaderboardProvider = LeaderboardProvider(leaderboardRepository);
  final challengesProvider = ChallengesProvider(mockRepository);
  final achievementsProvider = AchievementsProvider(mockRepository);
  final friendsProvider = FriendsProvider(mockRepository);
  final settingsProvider = SettingsProvider(localStorage);
  final shopProvider = ShopProvider(mockRepository);

  // Load settings
  await settingsProvider.loadSettings();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: authProvider),
        ChangeNotifierProvider.value(value: walletProvider),
        ChangeNotifierProvider.value(value: eventsProvider),
        ChangeNotifierProvider.value(value: predictionsProvider),
        ChangeNotifierProvider.value(value: accumulatorProvider),
        ChangeNotifierProvider.value(value: leaderboardProvider),
        ChangeNotifierProvider.value(value: challengesProvider),
        ChangeNotifierProvider.value(value: achievementsProvider),
        ChangeNotifierProvider.value(value: friendsProvider),
        ChangeNotifierProvider.value(value: settingsProvider),
        ChangeNotifierProvider.value(value: shopProvider),
      ],
      child: SportSageApp(authProvider: authProvider),
    ),
  );
}

class SportSageApp extends StatefulWidget {
  final AuthProvider authProvider;

  const SportSageApp({
    super.key,
    required this.authProvider,
  });

  @override
  State<SportSageApp> createState() => _SportSageAppState();
}

class _SportSageAppState extends State<SportSageApp> {
  late final AppRouter _appRouter;

  @override
  void initState() {
    super.initState();
    _appRouter = AppRouter(widget.authProvider);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Sport Sage',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      routerConfig: _appRouter.router,
      builder: (context, child) {
        return _AuthLoadingOverlay(child: child ?? const SizedBox.shrink());
      },
    );
  }
}

/// Full-screen loading overlay that shows during auth state transitions
class _AuthLoadingOverlay extends StatelessWidget {
  final Widget child;

  const _AuthLoadingOverlay({required this.child});

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();

    return Stack(
      children: [
        child,
        // Show loading overlay when auth is loading
        if (authProvider.isLoading)
          Container(
            color: const Color(0xFF0D1B2A), // AppColors.background
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // App logo
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFD600), // AppColors.primary
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.sports_soccer,
                      size: 40,
                      color: Color(0xFF0D1B2A),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      color: Color(0xFFFFD600),
                      strokeWidth: 2,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
