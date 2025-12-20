import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { UserAchievement, AchievementTier } from '@/types';
import { Card } from '@/components/ui';
import { CoinIcon, StarIcon, GemIcon, CheckIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

interface AchievementCardProps {
  userAchievement: UserAchievement;
  onClaim?: () => void;
  compact?: boolean;
}

function getTierColor(tier: AchievementTier): string {
  switch (tier) {
    case 'bronze':
      return '#CD7F32';
    case 'silver':
      return '#C0C0C0';
    case 'gold':
      return '#FFD700';
    case 'platinum':
      return '#E5E4E2';
    case 'diamond':
      return '#B9F2FF';
    default:
      return colors.textSecondary;
  }
}

function getIconName(iconName: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const iconMap: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
    'trophy': 'trophy',
    'target': 'bullseye',
    'fire': 'fire',
    'soccer': 'soccer',
    'star': 'star',
  };
  return iconMap[iconName] || 'star';
}

export function AchievementCard({ userAchievement, onClaim, compact = false }: AchievementCardProps): React.ReactElement {
  const { achievement, currentProgress, isUnlocked, isClaimed } = userAchievement;
  const tierColor = getTierColor(achievement.tier);
  const progressPercent = Math.min((currentProgress / achievement.targetValue) * 100, 100);
  const canClaim = isUnlocked && !isClaimed;

  if (compact) {
    return (
      <Card style={[styles.compactCard, !isUnlocked && styles.lockedCard]}>
        <View style={[styles.compactIconContainer, { backgroundColor: `${tierColor}20` }]}>
          <MaterialCommunityIcons
            name={getIconName(achievement.iconName)}
            size={20}
            color={isUnlocked ? tierColor : colors.textMuted}
          />
        </View>
        <View style={styles.compactContent}>
          <Text style={[styles.compactName, !isUnlocked && styles.lockedText]} numberOfLines={1}>
            {achievement.name}
          </Text>
          <View style={styles.compactProgressBar}>
            <View
              style={[
                styles.compactProgressFill,
                { width: `${progressPercent}%`, backgroundColor: isUnlocked ? colors.success : tierColor },
              ]}
            />
          </View>
        </View>
        {canClaim && (
          <Pressable onPress={onClaim} style={styles.compactClaimButton}>
            <Text style={styles.compactClaimText}>Claim</Text>
          </Pressable>
        )}
        {isClaimed && <CheckIcon size={16} color={colors.success} />}
      </Card>
    );
  }

  return (
    <Card style={[styles.card, !isUnlocked && styles.lockedCard]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${tierColor}20`, borderColor: tierColor }]}>
          <MaterialCommunityIcons
            name={getIconName(achievement.iconName)}
            size={28}
            color={isUnlocked ? tierColor : colors.textMuted}
          />
        </View>
        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, !isUnlocked && styles.lockedText]}>{achievement.name}</Text>
            <View style={[styles.tierBadge, { backgroundColor: `${tierColor}30` }]}>
              <Text style={[styles.tierText, { color: tierColor }]}>
                {achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={[styles.description, !isUnlocked && styles.lockedText]}>
            {achievement.description}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <MotiView
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: 'timing', duration: 500 }}
            style={[
              styles.progressFill,
              { backgroundColor: isUnlocked ? colors.success : tierColor },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {currentProgress}/{achievement.targetValue}
        </Text>
      </View>

      {/* Rewards */}
      <View style={styles.footer}>
        <View style={styles.rewards}>
          {achievement.rewardCoins > 0 && (
            <View style={styles.reward}>
              <CoinIcon size={16} />
              <Text style={styles.rewardText}>+{achievement.rewardCoins}</Text>
            </View>
          )}
          {achievement.rewardStars > 0 && (
            <View style={styles.reward}>
              <StarIcon size={16} />
              <Text style={styles.rewardText}>+{achievement.rewardStars}</Text>
            </View>
          )}
          {achievement.rewardGems > 0 && (
            <View style={styles.reward}>
              <GemIcon size={16} />
              <Text style={styles.rewardText}>+{achievement.rewardGems}</Text>
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
  lockedCard: {
    opacity: 0.7,
  },
  lockedText: {
    color: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: layout.spacing.md,
    marginBottom: layout.spacing.sm,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
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
  name: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  tierBadge: {
    paddingHorizontal: layout.spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierText: {
    fontSize: layout.fontSize.xs,
    fontWeight: layout.fontWeight.semibold,
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
    minWidth: 45,
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
  // Compact styles
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    padding: layout.spacing.sm,
    marginBottom: layout.spacing.xs,
  },
  compactIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContent: {
    flex: 1,
  },
  compactName: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  compactProgressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  compactClaimButton: {
    backgroundColor: colors.success,
    paddingHorizontal: layout.spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compactClaimText: {
    color: '#fff',
    fontSize: layout.fontSize.xs,
    fontWeight: layout.fontWeight.semibold,
  },
});
