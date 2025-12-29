import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/colors.dart';
import '../../../providers/achievements_provider.dart';
import '../../../data/models/mock_models.dart';

/// Achievements screen
class AchievementsScreen extends StatelessWidget {
  const AchievementsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final achievementsProvider = context.watch<AchievementsProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: const Text('Achievements'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: achievementsProvider.isLoading
          ? const Center(child: CircularProgressIndicator())
          : CustomScrollView(
              slivers: [
                // Progress header
                SliverToBoxAdapter(
                  child: Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.primary.withOpacity(0.2),
                          AppColors.primary.withOpacity(0.1),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        Text(
                          '${achievementsProvider.totalUnlocked}/${achievementsProvider.totalAchievements}',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.bold,
                            fontSize: 32,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Achievements Unlocked',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 16),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: LinearProgressIndicator(
                            value: achievementsProvider.completionPercent,
                            backgroundColor: AppColors.cardElevated,
                            valueColor: AlwaysStoppedAnimation(AppColors.primary),
                            minHeight: 8,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // In progress section
                if (achievementsProvider.inProgressAchievements.isNotEmpty) ...[
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        'In Progress',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.all(16),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final achievement =
                              achievementsProvider.inProgressAchievements[index];
                          return _AchievementCard(
                            achievement: achievement,
                            showProgress: true,
                          );
                        },
                        childCount:
                            achievementsProvider.inProgressAchievements.length,
                      ),
                    ),
                  ),
                ],

                // All achievements
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'All Achievements',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.all(16),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final achievement =
                            achievementsProvider.achievements[index];
                        return _AchievementCard(achievement: achievement);
                      },
                      childCount: achievementsProvider.achievements.length,
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _AchievementCard extends StatelessWidget {
  final Achievement achievement;
  final bool showProgress;

  const _AchievementCard({
    required this.achievement,
    this.showProgress = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: achievement.isUnlocked
            ? Border.all(color: _getRarityColor(), width: 2)
            : null,
      ),
      child: Opacity(
        opacity: achievement.isUnlocked || showProgress ? 1.0 : 0.5,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // Icon
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: _getRarityColor().withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: achievement.isUnlocked
                      ? Icon(
                          _getIcon(),
                          size: 28,
                          color: _getRarityColor(),
                        )
                      : Icon(
                          Icons.lock,
                          size: 24,
                          color: AppColors.textSecondary,
                        ),
                ),
              ),
              const SizedBox(width: 16),
              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          achievement.title,
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: _getRarityColor().withOpacity(0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            achievement.rarity.name.toUpperCase(),
                            style: TextStyle(
                              color: _getRarityColor(),
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      achievement.description,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                    if (showProgress) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: achievement.progressPercent,
                                backgroundColor: AppColors.cardElevated,
                                valueColor:
                                    AlwaysStoppedAnimation(_getRarityColor()),
                                minHeight: 6,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${achievement.currentProgress}/${achievement.targetCount}',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              // Rewards
              if (achievement.isUnlocked)
                Icon(
                  Icons.check_circle,
                  color: AppColors.success,
                )
              else
                Column(
                  children: [
                    if (achievement.rewardCoins > 0)
                      Row(
                        children: [
                          const Text('🪙', style: TextStyle(fontSize: 10)),
                          Text(
                            '${achievement.rewardCoins}',
                            style: TextStyle(
                              color: AppColors.coins,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    if (achievement.rewardStars > 0)
                      Row(
                        children: [
                          const Text('⭐', style: TextStyle(fontSize: 10)),
                          Text(
                            '${achievement.rewardStars}',
                            style: TextStyle(
                              color: AppColors.stars,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }

  Color _getRarityColor() {
    switch (achievement.rarity) {
      case AchievementRarity.common:
        return Colors.grey;
      case AchievementRarity.uncommon:
        return Colors.green;
      case AchievementRarity.rare:
        return Colors.blue;
      case AchievementRarity.epic:
        return Colors.purple;
      case AchievementRarity.legendary:
        return Colors.orange;
    }
  }

  IconData _getIcon() {
    switch (achievement.iconName) {
      case 'trophy':
        return Icons.emoji_events;
      case 'flame':
        return Icons.local_fire_department;
      case 'fire':
        return Icons.whatshot;
      case 'chart':
        return Icons.trending_up;
      case 'star':
        return Icons.star;
      case 'crown':
        return Icons.military_tech;
      default:
        return Icons.emoji_events;
    }
  }
}
