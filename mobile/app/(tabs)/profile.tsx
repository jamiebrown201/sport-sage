import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAuth, usePredictions, useAchievements } from '@/lib/store';
import { Card, Button, Badge } from '@/components/ui';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import { StreakIndicator } from '@/components/StreakIndicator';
import { AchievementCard } from '@/components/AchievementCard';
import { DevTools } from '@/components/DevTools';
import { CrownIcon, StarIcon, FireIcon, ShopIcon, SettingsIcon, HelpIcon, ChevronRightIcon, TrophyIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

export default function ProfileScreen(): React.ReactElement {
  const { user, stats, logout, updateUser } = useAuth();
  const { predictions } = usePredictions();
  const { achievements, claimAchievement, getUnclaimedAchievements } = useAchievements();
  const [showDevTools, setShowDevTools] = useState(false);

  const unclaimedAchievements = getUnclaimedAchievements();
  const recentAchievements = achievements.slice(0, 4);

  const handleClaimAchievement = (achievementId: string): void => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const rewards = claimAchievement(achievementId);
    if (rewards) {
      const rewardParts: string[] = [];
      if (rewards.coins > 0) rewardParts.push(`${rewards.coins} coins`);
      if (rewards.stars > 0) rewardParts.push(`${rewards.stars} stars`);
      if (rewards.gems > 0) rewardParts.push(`${rewards.gems} gems`);
      Alert.alert('Achievement Claimed!', `You earned ${rewardParts.join(', ')}!`, [{ text: 'Awesome!' }]);
    }
  };

  const handleLogout = (): void => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/landing');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Header */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
      >
        <Card style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.username}>{user?.username ?? 'Player'}</Text>
          <Text style={styles.email}>{user?.email}</Text>

          {user?.subscriptionTier !== 'free' && (
            <View style={styles.tierBadgeContainer}>
              {user?.subscriptionTier === 'elite' ? (
                <CrownIcon size={16} color={colors.tierElite} />
              ) : (
                <StarIcon size={16} color={colors.primary} />
              )}
              <Text style={styles.tierBadgeText}>
                {user?.subscriptionTier === 'elite' ? 'Elite' : 'Pro'}
              </Text>
            </View>
          )}

          <View style={styles.currencyContainer}>
            <CurrencyDisplay
              coins={user?.coins ?? 0}
              stars={user?.stars ?? 0}
              gems={user?.gems ?? 0}
            />
          </View>
        </Card>
      </MotiView>

      {/* Streak */}
      {stats && stats.currentStreak > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300, delay: 100 }}
        >
          <StreakIndicator
            currentStreak={stats.currentStreak}
            bestStreak={stats.bestStreak}
          />
        </MotiView>
      )}

      {/* Stats */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 150 }}
      >
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          <StatCard label="Total Predictions" value={stats?.totalPredictions ?? 0} />
          <StatCard label="Wins" value={stats?.totalWins ?? 0} color={colors.success} />
          <StatCard label="Losses" value={stats?.totalLosses ?? 0} color={colors.error} />
          <StatCard label="Win Rate" value={`${stats?.winRate.toFixed(1) ?? 0}%`} />
          <StatCard label="Best Streak" value={stats?.bestStreak ?? 0} IconComponent={FireIcon} iconColor={colors.warning} />
          <StatCard
            label="Stars Earned"
            value={stats?.totalStarsEarned.toLocaleString() ?? '0'}
            IconComponent={StarIcon}
            iconColor={colors.stars}
          />
        </View>
      </MotiView>

      {/* Achievements */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 175 }}
      >
        <View style={styles.achievementHeader}>
          <View style={styles.achievementTitleRow}>
            <TrophyIcon size={20} color={colors.stars} />
            <Text style={styles.sectionTitle}>Achievements</Text>
          </View>
          {unclaimedAchievements.length > 0 && (
            <Badge text={`${unclaimedAchievements.length} to claim`} variant="success" size="sm" />
          )}
        </View>

        {recentAchievements.map((userAchievement) => (
          <AchievementCard
            key={userAchievement.achievementId}
            userAchievement={userAchievement}
            onClaim={() => handleClaimAchievement(userAchievement.achievementId)}
            compact
          />
        ))}
      </MotiView>

      {/* Actions */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 200 }}
      >
        <Text style={styles.sectionTitle}>Account</Text>

        <Card style={styles.menuCard}>
          <MenuItem
            IconComponent={ShopIcon}
            label="Shop"
            onPress={() => router.push('/shop')}
          />
          <MenuItem
            IconComponent={SettingsIcon}
            label="Settings"
            onPress={() => Alert.alert('Coming Soon', 'Settings will be available soon!')}
          />
          <MenuItem
            IconComponent={HelpIcon}
            label="Help & Support"
            onPress={() => Alert.alert('Help', 'Contact support@sportsage.app')}
          />
        </Card>

        <Button
          title="Logout"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutButton}
        />
      </MotiView>

      {/* Dev Tools Toggle */}
      <Pressable
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setShowDevTools(!showDevTools);
        }}
        delayLongPress={1000}
        style={styles.devToggle}
      >
        <Text style={styles.devToggleText}>v1.0.0-prototype</Text>
      </Pressable>

      {/* Dev Tools Modal */}
      <DevTools visible={showDevTools} onClose={() => setShowDevTools(false)} />
    </ScrollView>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  IconComponent?: React.ComponentType<{ size?: number; color?: string }>;
  iconColor?: string;
  color?: string;
}

function StatCard({ label, value, IconComponent, iconColor, color }: StatCardProps): React.ReactElement {
  return (
    <View style={styles.statCard}>
      <View style={styles.statValueRow}>
        {IconComponent && <IconComponent size={18} color={iconColor} />}
        <Text style={[styles.statValue, color && { color }]}>
          {value}
        </Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface MenuItemProps {
  IconComponent: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
}

function MenuItem({ IconComponent, label, onPress }: MenuItemProps): React.ReactElement {
  return (
    <Pressable onPress={onPress} style={styles.menuItem}>
      <View style={styles.menuIconContainer}>
        <IconComponent size={20} color={colors.textSecondary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <ChevronRightIcon size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.spacing.md,
    paddingBottom: layout.spacing.xxl,
  },
  headerCard: {
    alignItems: 'center',
    marginBottom: layout.spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: layout.spacing.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: layout.fontWeight.bold,
    color: colors.background,
  },
  username: {
    fontSize: layout.fontSize.xl,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  email: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: layout.spacing.sm,
  },
  tierBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
    backgroundColor: colors.primaryDim,
    paddingVertical: layout.spacing.xs,
    paddingHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadius.full,
    marginBottom: layout.spacing.md,
  },
  tierBadgeText: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.semibold,
    color: colors.primary,
  },
  currencyContainer: {
    marginTop: layout.spacing.sm,
  },
  sectionTitle: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: layout.spacing.md,
    marginTop: layout.spacing.lg,
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: layout.spacing.lg,
    marginBottom: layout.spacing.md,
  },
  achievementTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: layout.spacing.sm,
  },
  statCard: {
    backgroundColor: colors.card,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    width: '48%',
    alignItems: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: layout.fontSize.xl,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIconContainer: {
    marginRight: layout.spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: layout.fontSize.md,
    color: colors.textPrimary,
  },
  logoutButton: {
    marginTop: layout.spacing.lg,
  },
  devToggle: {
    alignItems: 'center',
    marginTop: layout.spacing.xl,
  },
  devToggleText: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
  },
});
