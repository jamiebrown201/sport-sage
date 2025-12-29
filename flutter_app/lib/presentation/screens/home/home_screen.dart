import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/colors.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/wallet_provider.dart';
import '../../../providers/events_provider.dart';
import '../../../providers/challenges_provider.dart';
import '../../../router/route_names.dart';

/// Home screen with dashboard
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    // Defer data loading to after the first frame to avoid setState during build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    final walletProvider = context.read<WalletProvider>();
    final eventsProvider = context.read<EventsProvider>();
    final challengesProvider = context.read<ChallengesProvider>();

    await Future.wait([
      walletProvider.loadWallet(),
      walletProvider.loadTopupStatus(),
      eventsProvider.initialize(),
      challengesProvider.loadChallenges(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final walletProvider = context.watch<WalletProvider>();
    final eventsProvider = context.watch<EventsProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: AppColors.primary,
        child: CustomScrollView(
          slivers: [
            // App bar
            SliverAppBar(
              floating: true,
              backgroundColor: AppColors.background,
              title: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.sports_soccer,
                      size: 18,
                      color: AppColors.background,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text('Sport Sage'),
                ],
              ),
              actions: [
                // Coins display
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      const Text(
                        '🪙',
                        style: TextStyle(fontSize: 16),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${walletProvider.coins}',
                        style: TextStyle(
                          color: AppColors.coins,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                // Settings
                IconButton(
                  icon: const Icon(Icons.settings_outlined),
                  onPressed: () => context.push(RoutePaths.settings),
                ),
              ],
            ),

            // Welcome section
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome back, ${authProvider.user?.username ?? 'Player'}!',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Ready to make some predictions?',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ),

            // Daily topup card
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _DailyTopupCard(
                  canClaim: walletProvider.canClaimTopup,
                  nextClaimAt: walletProvider.topupStatus?.nextClaimAt ??
                      walletProvider.wallet?.nextTopupAt,
                  onClaim: () async {
                    await walletProvider.claimTopup();
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Claimed 500 coins!'),
                          backgroundColor: AppColors.success,
                        ),
                      );
                    }
                  },
                ),
              ),
            ),

            // Featured events section
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Featured Events',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    TextButton(
                      onPressed: () => context.go(RoutePaths.events),
                      child: Text(
                        'See All',
                        style: TextStyle(color: AppColors.primary),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Featured events list
            SliverToBoxAdapter(
              child: SizedBox(
                height: 160,
                child: eventsProvider.featuredEvents.isEmpty
                    ? Center(
                        child: Text(
                          'No featured events',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      )
                    : ListView.builder(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: eventsProvider.featuredEvents.length,
                        itemBuilder: (context, index) {
                          final event = eventsProvider.featuredEvents[index];
                          return Container(
                            width: 280,
                            margin: const EdgeInsets.only(right: 12),
                            decoration: BoxDecoration(
                              color: AppColors.card,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: InkWell(
                              onTap: () => context.go('/events/${event.id}'),
                              borderRadius: BorderRadius.circular(16),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Icon(
                                          Icons.sports_soccer,
                                          size: 16,
                                          color: AppColors.textSecondary,
                                        ),
                                        const SizedBox(width: 4),
                                        Expanded(
                                          child: Text(
                                            event.competition.name,
                                            style: TextStyle(
                                              color: AppColors.textSecondary,
                                              fontSize: 12,
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        if (event.isLive)
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: AppColors.error.withOpacity(0.2),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              'LIVE',
                                              style: TextStyle(
                                                color: AppColors.error,
                                                fontSize: 10,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                    const Spacer(),
                                    Text(
                                      event.homeName,
                                      style: TextStyle(
                                        color: AppColors.textPrimary,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'vs',
                                      style: TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 12,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      event.awayName,
                                      style: TextStyle(
                                        color: AppColors.textPrimary,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ),

            // Stats section
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your Stats',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        _StatCard(
                          icon: Icons.star,
                          iconColor: AppColors.stars,
                          title: 'Stars',
                          value: '${authProvider.stats?.totalStars ?? 0}',
                        ),
                        const SizedBox(width: 12),
                        _StatCard(
                          icon: Icons.local_fire_department,
                          iconColor: AppColors.error,
                          title: 'Streak',
                          value: '${authProvider.stats?.currentStreak ?? 0}',
                        ),
                        const SizedBox(width: 12),
                        _StatCard(
                          icon: Icons.percent,
                          iconColor: AppColors.success,
                          title: 'Win Rate',
                          value: '${authProvider.stats?.winRate ?? 0}%',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Bottom padding for navigation
            const SliverPadding(padding: EdgeInsets.only(bottom: 100)),
          ],
        ),
      ),
    );
  }
}

class _DailyTopupCard extends StatefulWidget {
  final bool canClaim;
  final DateTime? nextClaimAt;
  final VoidCallback onClaim;

  const _DailyTopupCard({
    required this.canClaim,
    required this.nextClaimAt,
    required this.onClaim,
  });

  @override
  State<_DailyTopupCard> createState() => _DailyTopupCardState();
}

class _DailyTopupCardState extends State<_DailyTopupCard> {
  late Duration _timeRemaining;
  late bool _isReady;

  @override
  void initState() {
    super.initState();
    _updateTimeRemaining();
    // Start timer to update countdown every second
    _startTimer();
  }

  void _startTimer() {
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) {
        setState(() {
          _updateTimeRemaining();
        });
        _startTimer();
      }
    });
  }

  void _updateTimeRemaining() {
    if (widget.canClaim || widget.nextClaimAt == null) {
      _isReady = true;
      _timeRemaining = Duration.zero;
    } else {
      final now = DateTime.now();
      if (widget.nextClaimAt!.isAfter(now)) {
        _timeRemaining = widget.nextClaimAt!.difference(now);
        _isReady = false;
      } else {
        _timeRemaining = Duration.zero;
        _isReady = true;
      }
    }
  }

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (hours > 0) {
      return '${hours}h ${minutes}m ${seconds}s';
    } else if (minutes > 0) {
      return '${minutes}m ${seconds}s';
    } else {
      return '${seconds}s';
    }
  }

  @override
  void didUpdateWidget(_DailyTopupCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.canClaim != widget.canClaim ||
        oldWidget.nextClaimAt != widget.nextClaimAt) {
      _updateTimeRemaining();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isReady = _isReady || widget.canClaim;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isReady
              ? [
                  AppColors.primary.withOpacity(0.2),
                  AppColors.primary.withOpacity(0.1),
                ]
              : [
                  AppColors.card,
                  AppColors.card,
                ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isReady
              ? AppColors.primary.withOpacity(0.3)
              : AppColors.textMuted.withOpacity(0.2),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: isReady
                  ? AppColors.primary.withOpacity(0.2)
                  : AppColors.textMuted.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                isReady ? '🪙' : '⏰',
                style: const TextStyle(fontSize: 24),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isReady ? 'Daily Top-up Ready!' : 'Daily Top-up',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  isReady
                      ? 'Claim 500 free coins'
                      : 'Next claim in ${_formatDuration(_timeRemaining)}',
                  style: TextStyle(
                    color: isReady ? AppColors.textSecondary : AppColors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 80,
            child: ElevatedButton(
              onPressed: isReady ? widget.onClaim : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: isReady ? AppColors.primary : AppColors.cardElevated,
                foregroundColor: isReady ? AppColors.background : AppColors.textMuted,
                padding: const EdgeInsets.symmetric(horizontal: 16),
              ),
              child: Text(isReady ? 'Claim' : 'Wait'),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String value;

  const _StatCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: iconColor, size: 24),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
