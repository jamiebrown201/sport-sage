import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAuth, usePredictions, useChallenges } from '@/lib/store';
import { EVENTS, canClaimTopup } from '@/lib/mock-data';
import { Card, Button, Badge } from '@/components/ui';
import { EventCard } from '@/components/EventCard';
import { PredictionCard } from '@/components/PredictionCard';
import { StreakIndicator } from '@/components/StreakIndicator';
import { DailyChallengeCard } from '@/components/DailyChallengeCard';
import { CoinBurst } from '@/components/animations';
import { GiftIcon, AlertIcon, FireIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

export default function HomeScreen(): React.ReactElement {
  const { user, stats, updateUser, updateStats } = useAuth();
  const { getPendingPredictions } = usePredictions();
  const { getActiveChallenges, claimChallenge } = useChallenges();
  const [showCoinBurst, setShowCoinBurst] = useState(false);

  const pendingPredictions = getPendingPredictions().slice(0, 2);
  const upcomingEvents = EVENTS.slice(0, 4);
  const activeChallenges = getActiveChallenges().slice(0, 3);
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
          <Text style={styles.statValue}>{stats?.winRate.toFixed(0) ?? 0}%</Text>
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

      {/* Active Predictions */}
      {pendingPredictions.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 400 }}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Predictions</Text>
            <Link href="/(tabs)/predictions" asChild>
              <Pressable>
                <Text style={styles.seeAll}>See All →</Text>
              </Pressable>
            </Link>
          </View>

          {pendingPredictions.map((prediction) => (
            <PredictionCard key={prediction.id} prediction={prediction} />
          ))}
        </MotiView>
      )}

      {/* Upcoming Events */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 500 }}
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
  expiresText: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
  },
  seeAll: {
    fontSize: layout.fontSize.sm,
    color: colors.primary,
    fontWeight: layout.fontWeight.medium,
  },
});
