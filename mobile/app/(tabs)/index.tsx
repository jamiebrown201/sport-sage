import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from 'react-native';
import { Link, router } from 'expo-router';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAuth, usePredictions, useChallenges, useFriends } from '@/lib/store';
import { EVENTS, canClaimTopup } from '@/lib/mock-data';
import { Card, Button, Badge } from '@/components/ui';
import { EventCard } from '@/components/EventCard';
import { PredictionCard } from '@/components/PredictionCard';
import { StreakIndicator } from '@/components/StreakIndicator';
import { DailyChallengeCard } from '@/components/DailyChallengeCard';
import { CoinBurst } from '@/components/animations';
import { GiftIcon, AlertIcon, FireIcon, UsersIcon, StarIcon, TrophyIcon } from '@/components/icons';
import { LiveIndicator } from '@/components/LiveIndicator';
import { FriendActivity } from '@/types';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

// Helper to format time ago
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

// Get activity icon based on type
function getActivityIcon(type: FriendActivity['type']): React.ReactElement {
  switch (type) {
    case 'prediction_won':
    case 'accumulator_won':
      return <StarIcon size={12} color={colors.success} />;
    case 'streak_milestone':
      return <FireIcon size={12} color={colors.warning} />;
    case 'achievement_unlocked':
      return <TrophyIcon size={12} color={colors.gems} />;
    default:
      return <UsersIcon size={12} color={colors.primary} />;
  }
}

export default function HomeScreen(): React.ReactElement {
  const { user, stats, updateUser, updateStats } = useAuth();
  const { getPendingPredictions } = usePredictions();
  const { getActiveChallenges, claimChallenge } = useChallenges();
  const { friendActivity } = useFriends();
  const [showCoinBurst, setShowCoinBurst] = useState(false);

  const pendingPredictions = getPendingPredictions().slice(0, 2);
  const liveEvents = EVENTS.filter(e => e.status === 'live').slice(0, 3);
  const upcomingEvents = EVENTS.filter(e => e.status !== 'live').slice(0, 4);
  const activeChallenges = getActiveChallenges().slice(0, 3);
  const recentFriendActivity = friendActivity.slice(0, 4);
  const canTopup = user && stats ? canClaimTopup(user.coins, stats.lastTopupDate) : false;

  // Check if user is low on coins (for rescue prompt)
  const isLowOnCoins = (user?.coins ?? 0) < 100;

  const handleClaimChallenge = (challengeId: string): void => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const rewards = claimChallenge(challengeId);
    if (rewards) {
      setShowCoinBurst(true);
      const rewardParts: string[] = [];
      if (rewards.coins > 0) rewardParts.push(`${rewards.coins} coins`);
      if (rewards.stars > 0) rewardParts.push(`${rewards.stars} stars`);
      if (rewards.gems > 0) rewardParts.push(`${rewards.gems} gems`);
      Alert.alert('Challenge Complete!', `You earned ${rewardParts.join(', ')}!`, [{ text: 'Awesome!' }]);
    }
  };

  const handleClaimTopup = (): void => {
    if (!user || !stats) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Calculate top-up amount (up to 500 coins)
    const topupAmount = Math.max(0, 500 - user.coins);
    const newCoins = user.coins + topupAmount;

    updateUser({ coins: newCoins });
    updateStats({ lastTopupDate: new Date().toISOString() });

    // Show coin animation
    setShowCoinBurst(true);

    Alert.alert(
      'Top-up Claimed!',
      `You received ${topupAmount} coins!\n\nYour new balance: ${newCoins}`,
      [{ text: 'Awesome!' }]
    );
  };

  const handleWatchAdForCoins = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Rescue Coins',
      'Watch a short ad to receive 200 emergency coins!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Watch Ad',
          onPress: () => {
            // Simulate watching an ad
            setTimeout(() => {
              if (user) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                updateUser({ coins: user.coins + 200 });
                setShowCoinBurst(true);
                Alert.alert('Reward Claimed!', 'You received 200 rescue coins!');
              }
            }, 1500);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Welcome Section */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
      >
        <Text style={styles.greeting}>
          Welcome back, {user?.username ?? 'Player'}!
        </Text>
      </MotiView>

      {/* Streak Indicator */}
      {stats && stats.currentStreak > 0 && (
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 15, delay: 100 }}
          style={styles.streakContainer}
        >
          <StreakIndicator
            currentStreak={stats.currentStreak}
            bestStreak={stats.bestStreak}
          />
        </MotiView>
      )}

      {/* Top-up Banner */}
      {canTopup && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
        >
          <Card style={styles.topupCard}>
            <View style={styles.topupContent}>
              <View style={styles.topupIconContainer}>
                <GiftIcon size={28} color={colors.primary} />
              </View>
              <View style={styles.topupInfo}>
                <Text style={styles.topupTitle}>Daily Top-up Available!</Text>
                <Text style={styles.topupDescription}>
                  Claim your free coins to keep playing
                </Text>
              </View>
            </View>
            <Button
              title="Claim 500"
              onPress={handleClaimTopup}
              size="sm"
            />
          </Card>
        </MotiView>
      )}

      {/* Low Coins Rescue Banner */}
      {isLowOnCoins && !canTopup && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
        >
          <Card style={styles.rescueCard}>
            <View style={styles.topupContent}>
              <View style={styles.topupIconContainer}>
                <AlertIcon size={28} color={colors.error} />
              </View>
              <View style={styles.topupInfo}>
                <Text style={styles.rescueTitle}>Running Low on Coins!</Text>
                <Text style={styles.topupDescription}>
                  Watch a short ad to get 200 rescue coins
                </Text>
              </View>
            </View>
            <Button
              title="Watch Ad"
              onPress={handleWatchAdForCoins}
              variant="secondary"
              size="sm"
            />
          </Card>
        </MotiView>
      )}

      {/* Quick Stats */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 400, delay: 300 }}
        style={styles.statsRow}
      >
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.totalWins ?? 0}</Text>
          <Text style={styles.statLabel}>Wins</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{(stats?.winRate ?? 0).toFixed(0)}%</Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.totalPredictions ?? 0}</Text>
          <Text style={styles.statLabel}>Predictions</Text>
        </Card>
      </MotiView>

      {/* Daily Challenges */}
      {activeChallenges.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 350 }}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <FireIcon size={20} color={colors.warning} />
              <Text style={styles.sectionTitle}>Daily Challenges</Text>
            </View>
            <Text style={styles.expiresText}>Resets at midnight</Text>
          </View>

          {activeChallenges.map((progress) => (
            <DailyChallengeCard
              key={progress.challengeId}
              progress={progress}
              onClaim={() => handleClaimChallenge(progress.challengeId)}
            />
          ))}
        </MotiView>
      )}

      {/* Friend Activity */}
      {recentFriendActivity.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 400 }}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <UsersIcon size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Friend Activity</Text>
            </View>
            <Link href="/(tabs)/leaderboard" asChild>
              <Pressable>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            </Link>
          </View>

          <Card style={styles.activityCard}>
            {recentFriendActivity.map((activity, index) => (
              <View
                key={activity.id}
                style={[
                  styles.activityItem,
                  index < recentFriendActivity.length - 1 && styles.activityItemBorder,
                ]}
              >
                {activity.friendAvatarUrl ? (
                  <Image
                    source={{ uri: activity.friendAvatarUrl }}
                    style={styles.activityAvatar}
                  />
                ) : (
                  <View style={[styles.activityAvatar, styles.activityAvatarFallback]}>
                    <Text style={styles.activityAvatarText}>
                      {activity.friendUsername.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.activityContent}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityUsername}>{activity.friendUsername}</Text>
                    <View style={styles.activityBadge}>
                      {getActivityIcon(activity.type)}
                    </View>
                  </View>
                  <Text style={styles.activityText} numberOfLines={1}>
                    {activity.description}
                    {activity.eventName && ` on ${activity.eventName}`}
                  </Text>
                </View>
                <Text style={styles.activityTime}>{formatTimeAgo(activity.createdAt)}</Text>
              </View>
            ))}
          </Card>
        </MotiView>
      )}

      {/* Active Predictions */}
      {pendingPredictions.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 450 }}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Predictions</Text>
            <Link href="/(tabs)/predictions" asChild>
              <Pressable>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            </Link>
          </View>

          {pendingPredictions.map((prediction) => (
            <PredictionCard key={prediction.id} prediction={prediction} />
          ))}
        </MotiView>
      )}

      {/* Live Events */}
      {liveEvents.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 500 }}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <LiveIndicator size="md" showText={false} />
              <Text style={[styles.sectionTitle, styles.liveTitle]}>Live Now</Text>
            </View>
            <Link href="/(tabs)/events" asChild>
              <Pressable>
                <Text style={styles.seeAll}>See All →</Text>
              </Pressable>
            </Link>
          </View>

          {liveEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onPress={() => router.push(`/(tabs)/events/${event.id}`)}
            />
          ))}
        </MotiView>
      )}

      {/* Upcoming Events */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: liveEvents.length > 0 ? 550 : 500 }}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <Link href="/(tabs)/events" asChild>
            <Pressable>
              <Text style={styles.seeAll}>See All →</Text>
            </Pressable>
          </Link>
        </View>

        {upcomingEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onPress={() => router.push(`/(tabs)/events/${event.id}`)}
          />
        ))}
      </MotiView>

      {/* Coin Burst Animation */}
      {showCoinBurst && (
        <CoinBurst onComplete={() => setShowCoinBurst(false)} />
      )}
    </ScrollView>
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
  greeting: {
    fontSize: layout.fontSize.xl,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: layout.spacing.md,
  },
  streakContainer: {
    marginBottom: layout.spacing.md,
  },
  topupCard: {
    marginBottom: layout.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primaryDim,
  },
  topupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.md,
    flex: 1,
  },
  topupIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topupInfo: {
    flex: 1,
  },
  topupTitle: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.primary,
  },
  topupDescription: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  rescueCard: {
    marginBottom: layout.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: 'rgba(239, 83, 80, 0.1)',
  },
  rescueTitle: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.error,
  },
  statsRow: {
    flexDirection: 'row',
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: layout.spacing.md,
  },
  statValue: {
    fontSize: layout.fontSize.xxl,
    fontWeight: layout.fontWeight.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: layout.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
  },
  sectionTitle: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  liveTitle: {
    color: colors.error,
  },
  expiresText: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
  },
  seeAll: {
    fontSize: layout.fontSize.sm,
    color: colors.primary,
    fontWeight: layout.fontWeight.medium,
  },
  activityCard: {
    marginBottom: layout.spacing.lg,
    padding: 0,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.spacing.md,
    gap: layout.spacing.sm,
  },
  activityItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  activityAvatarFallback: {
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityAvatarText: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
    color: colors.primary,
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
  },
  activityUsername: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  activityBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    fontSize: layout.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  activityTime: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
  },
});
