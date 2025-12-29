import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../presentation/navigation/main_shell.dart';
import '../presentation/screens/screens.dart';
import 'route_names.dart';

/// App router configuration with GoRouter
class AppRouter {
  final AuthProvider authProvider;

  AppRouter(this.authProvider);

  late final GoRouter router = GoRouter(
    initialLocation: RoutePaths.splash,
    debugLogDiagnostics: true,
    refreshListenable: authProvider,
    redirect: _redirect,
    routes: [
      // Splash screen
      GoRoute(
        path: RoutePaths.splash,
        name: RouteNames.splash,
        builder: (context, state) => const SplashScreen(),
      ),

      // Onboarding
      GoRoute(
        path: RoutePaths.onboarding,
        name: RouteNames.onboarding,
        builder: (context, state) => const OnboardingScreen(),
      ),

      // Auth routes
      GoRoute(
        path: RoutePaths.landing,
        name: RouteNames.landing,
        builder: (context, state) => const LandingScreen(),
      ),
      GoRoute(
        path: RoutePaths.login,
        name: RouteNames.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: RoutePaths.register,
        name: RouteNames.register,
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: RoutePaths.verify,
        name: RouteNames.verify,
        builder: (context, state) {
          final email = state.uri.queryParameters['email'] ?? '';
          return VerifyScreen(email: email);
        },
      ),
      GoRoute(
        path: RoutePaths.username,
        name: RouteNames.username,
        builder: (context, state) => const UsernameScreen(),
      ),
      GoRoute(
        path: RoutePaths.forgotPassword,
        name: RouteNames.forgotPassword,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),

      // Main shell with bottom navigation
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(
            path: RoutePaths.home,
            name: RouteNames.home,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: HomeScreen(),
            ),
          ),
          GoRoute(
            path: RoutePaths.events,
            name: RouteNames.events,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: EventsScreen(),
            ),
            routes: [
              GoRoute(
                path: ':id',
                name: RouteNames.eventDetail,
                builder: (context, state) {
                  final id = state.pathParameters['id']!;
                  return EventDetailScreen(eventId: id);
                },
              ),
            ],
          ),
          GoRoute(
            path: RoutePaths.predictions,
            name: RouteNames.predictions,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: PredictionsScreen(),
            ),
          ),
          GoRoute(
            path: RoutePaths.leaderboard,
            name: RouteNames.leaderboard,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: LeaderboardScreen(),
            ),
          ),
          GoRoute(
            path: RoutePaths.profile,
            name: RouteNames.profile,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ProfileScreen(),
            ),
          ),
        ],
      ),

      // Additional routes (outside shell)
      GoRoute(
        path: RoutePaths.settings,
        name: RouteNames.settings,
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: RoutePaths.shop,
        name: RouteNames.shop,
        builder: (context, state) => const ShopScreen(),
      ),
      GoRoute(
        path: RoutePaths.achievements,
        name: RouteNames.achievements,
        builder: (context, state) => const AchievementsScreen(),
      ),
      GoRoute(
        path: RoutePaths.friends,
        name: RouteNames.friends,
        builder: (context, state) => const FriendsScreen(),
      ),
      GoRoute(
        path: RoutePaths.transactions,
        name: RouteNames.transactions,
        builder: (context, state) => const TransactionsScreen(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Text('Page not found: ${state.uri.path}'),
      ),
    ),
  );

  /// Redirect logic based on auth state
  String? _redirect(BuildContext context, GoRouterState state) {
    final authState = authProvider.state;
    final isLoading = authProvider.isLoading;
    final currentPath = state.matchedLocation;

    // Public auth routes (no auth required)
    final publicAuthRoutes = [
      RoutePaths.onboarding,
      RoutePaths.landing,
      RoutePaths.login,
      RoutePaths.register,
      RoutePaths.verify,
      RoutePaths.forgotPassword,
    ];

    // Handle initial state - go to splash and wait
    if (authState == AuthState.initial) {
      if (currentPath != RoutePaths.splash) {
        return RoutePaths.splash;
      }
      return null;
    }

    // When loading, stay on current screen (overlay handles the loading UI)
    // This prevents screen flickering during sign-in/sign-out
    if (isLoading) {
      return null;
    }

    // Handle authenticated state
    if (authState == AuthState.authenticated) {
      // Redirect from splash or public routes to home
      if (currentPath == RoutePaths.splash || publicAuthRoutes.contains(currentPath)) {
        return RoutePaths.home;
      }
      return null;
    }

    // Handle needs registration state
    if (authState == AuthState.needsRegistration) {
      if (currentPath != RoutePaths.username) {
        return RoutePaths.username;
      }
      return null;
    }

    // Handle unauthenticated/error state
    if (authState == AuthState.unauthenticated || authState == AuthState.error) {
      // From splash, go to landing
      if (currentPath == RoutePaths.splash) {
        return RoutePaths.landing;
      }
      // Stay on public auth routes
      if (publicAuthRoutes.contains(currentPath)) {
        return null;
      }
      // From protected routes, go to landing
      return RoutePaths.landing;
    }

    return null;
  }
}

/// Extension for easy navigation
extension GoRouterExtension on BuildContext {
  void goToHome() => go(RoutePaths.home);
  void goToEvents() => go(RoutePaths.events);
  void goToEventDetail(String id) => go('/events/$id');
  void goToPredictions() => go(RoutePaths.predictions);
  void goToLeaderboard() => go(RoutePaths.leaderboard);
  void goToProfile() => go(RoutePaths.profile);
  void goToSettings() => push(RoutePaths.settings);
  void goToShop() => push(RoutePaths.shop);
  void goToAchievements() => push(RoutePaths.achievements);
  void goToFriends() => push(RoutePaths.friends);
  void goToTransactions() => push(RoutePaths.transactions);
  void goToLogin() => go(RoutePaths.login);
  void goToRegister() => go(RoutePaths.register);
  void goToVerify(String email) => go('${RoutePaths.verify}?email=$email');
  void goToUsername() => go(RoutePaths.username);
  void goToForgotPassword() => push(RoutePaths.forgotPassword);
  void goToLanding() => go(RoutePaths.landing);
}
