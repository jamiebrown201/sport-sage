import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { UserChallengeProgress, ChallengeDifficulty } from '@/types';
import { Card, Badge } from '@/components/ui';
import { CoinIcon, StarIcon, GemIcon, CheckIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

interface DailyChallengeCardProps {
  progress: UserChallengeProgress;
  onClaim?: () => void;
}

function getDifficultyColor(difficulty: ChallengeDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return colors.success;
    case 'medium':
      return colors.warning;
    case 'hard':
      return colors.error;
    default:
      return colors.textSecondary;
  }
}

function getIconName(iconName: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const iconMap: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
    'trophy': 'trophy',
    'target': 'bullseye',
    'bullseye-arrow': 'bullseye-arrow',
    'fire': 'fire',
    'soccer': 'soccer',
    'tennis': 'tennis',
    'cricket': 'cricket',
  };
  return iconMap[iconName] || 'star';
}

export function DailyChallengeCard({ progress, onClaim }: DailyChallengeCardProps): React.ReactElement {
  const { challenge, currentValue, isCompleted, isClaimed } = progress;
  const progressPercent = Math.min((currentValue / challenge.targetValue) * 100, 100);
  const difficultyColor = getDifficultyColor(challenge.difficulty);

  const canClaim = isCompleted && !isClaimed;

  return (
    <Card style={[styles.card, isClaimed && styles.claimedCard]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${difficultyColor}20` }]}>
          <MaterialCommunityIcons
            name={getIconName(challenge.iconName)}
            size={24}
            color={difficultyColor}
          />
        </View>
        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{challenge.title}</Text>
            <Badge
              text={challenge.difficulty.toUpperCase()}
              variant={challenge.difficulty === 'hard' ? 'error' : challenge.difficulty === 'medium' ? 'warning' : 'success'}
              size="sm"
            />
          </View>
          <Text style={styles.description}>{challenge.description}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <MotiView
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: 'timing', duration: 500 }}
            style={[styles.progressFill, { backgroundColor: isCompleted ? colors.success : colors.primary }]}
          />
        </View>
        <Text style={styles.progressText}>
          {currentValue}/{challenge.targetValue}
        </Text>
      </View>

      {/* Rewards */}
      <View style={styles.footer}>
        <View style={styles.rewards}>
          {challenge.rewardCoins > 0 && (
            <View style={styles.reward}>
              <CoinIcon size={16} />
              <Text style={styles.rewardText}>+{challenge.rewardCoins}</Text>
            </View>
          )}
          {challenge.rewardStars > 0 && (
            <View style={styles.reward}>
              <StarIcon size={16} />
              <Text style={styles.rewardText}>+{challenge.rewardStars}</Text>
            </View>
          )}
          {challenge.rewardGems > 0 && (
            <View style={styles.reward}>
              <GemIcon size={16} />
              <Text style={styles.rewardText}>+{challenge.rewardGems}</Text>
            </View>
          )}
        </View>

        {canClaim && (
          <Pressable onPress={onClaim} style={styles.claimButton}>
            <Text style={styles.claimButtonText}>Claim</Text>
          </Pressable>
        )}

        {isClaimed && (
          <View style={styles.claimedBadge}>
            <CheckIcon size={16} color={colors.success} />
            <Text style={styles.claimedText}>Claimed</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: layout.spacing.sm,
  },
  claimedCard: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: layout.spacing.md,
    marginBottom: layout.spacing.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    marginBottom: 2,
  },
  title: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  description: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: layout.fontSize.xs,
    fontWeight: layout.fontWeight.medium,
    color: colors.textSecondary,
    minWidth: 35,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewards: {
    flexDirection: 'row',
    gap: layout.spacing.md,
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardText: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.medium,
    color: colors.textSecondary,
  },
  claimButton: {
    backgroundColor: colors.success,
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.xs,
    borderRadius: 8,
  },
  claimButtonText: {
    color: '#fff',
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.semibold,
  },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  claimedText: {
    fontSize: layout.fontSize.sm,
    color: colors.success,
    fontWeight: layout.fontWeight.medium,
  },
});
