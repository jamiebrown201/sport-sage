import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAuth, usePredictions } from '@/lib/store';
import { Prediction } from '@/types';
import { Button, Card, Badge } from '@/components/ui';
import { WinCelebration } from '@/components/animations';
import { CoinIcon, StarIcon, GemIcon, SettingsIcon, CheckIcon, CloseIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

interface DevToolsProps {
  visible: boolean;
  onClose: () => void;
}

export function DevTools({ visible, onClose }: DevToolsProps): React.ReactElement {
  const { user, stats, updateUser, updateStats } = useAuth();
  const { predictions, updatePrediction, getPendingPredictions } = usePredictions();

  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState({ coins: 0, stars: 0 });

  const pendingPredictions = getPendingPredictions();

  const handleAddCoins = (amount: number): void => {
    if (user) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateUser({ coins: user.coins + amount });
    }
  };

  const handleAddStars = (amount: number): void => {
    if (user) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateUser({ stars: user.stars + amount });
    }
  };

  const handleAddGems = (amount: number): void => {
    if (user) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateUser({ gems: user.gems + amount });
    }
  };

  const handleSettleWin = (prediction: Prediction): void => {
    if (!user || !stats) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Update prediction
    updatePrediction(prediction.id, {
      status: 'won',
      settledAt: new Date().toISOString(),
    });

    // Award coins and stars
    updateUser({
      coins: user.coins + prediction.potentialCoins,
      stars: user.stars + prediction.potentialStars,
    });

    // Update stats
    const newStreak = stats.currentStreak + 1;
    const newWins = stats.totalWins + 1;
    const totalGames = newWins + stats.totalLosses;
    const newWinRate = totalGames > 0 ? (newWins / totalGames) * 100 : 0;

    updateStats({
      totalWins: newWins,
      winRate: newWinRate,
      currentStreak: newStreak,
      bestStreak: Math.max(stats.bestStreak, newStreak),
      totalStarsEarned: stats.totalStarsEarned + prediction.potentialStars,
    });

    // Show celebration
    setCelebrationData({
      coins: prediction.potentialCoins,
      stars: prediction.potentialStars,
    });
    setShowCelebration(true);
  };

  const handleSettleLoss = (prediction: Prediction): void => {
    if (!stats) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Update prediction
    updatePrediction(prediction.id, {
      status: 'lost',
      settledAt: new Date().toISOString(),
    });

    // Update stats (reset streak)
    const newLosses = stats.totalLosses + 1;
    const totalGames = stats.totalWins + newLosses;
    const newWinRate = totalGames > 0 ? (stats.totalWins / totalGames) * 100 : 0;

    updateStats({
      totalLosses: newLosses,
      winRate: newWinRate,
      currentStreak: 0,
    });
  };

  const handleResetStreak = (): void => {
    if (stats) {
      updateStats({ currentStreak: 0 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleSetStreak = (streak: number): void => {
    if (stats) {
      updateStats({
        currentStreak: streak,
        bestStreak: Math.max(stats.bestStreak, streak),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <SettingsIcon size={24} color={colors.warning} />
            <Text style={styles.title}>Dev Tools</Text>
          </View>
          <Button title="Close" variant="ghost" onPress={onClose} size="sm" />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Currency Tools */}
          <Text style={styles.sectionTitle}>Currency</Text>
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={styles.currencyLabel}>
                <CoinIcon size={18} />
                <Text style={styles.label}>Coins: {user?.coins ?? 0}</Text>
              </View>
              <View style={styles.buttonRow}>
                <Button title="+100" onPress={() => handleAddCoins(100)} variant="secondary" size="sm" />
                <Button title="+1K" onPress={() => handleAddCoins(1000)} variant="secondary" size="sm" />
                <Button title="+10K" onPress={() => handleAddCoins(10000)} variant="secondary" size="sm" />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.currencyLabel}>
                <StarIcon size={18} />
                <Text style={styles.label}>Stars: {user?.stars ?? 0}</Text>
              </View>
              <View style={styles.buttonRow}>
                <Button title="+100" onPress={() => handleAddStars(100)} variant="secondary" size="sm" />
                <Button title="+1K" onPress={() => handleAddStars(1000)} variant="secondary" size="sm" />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.currencyLabel}>
                <GemIcon size={18} />
                <Text style={styles.label}>Gems: {user?.gems ?? 0}</Text>
              </View>
              <View style={styles.buttonRow}>
                <Button title="+50" onPress={() => handleAddGems(50)} variant="secondary" size="sm" />
                <Button title="+100" onPress={() => handleAddGems(100)} variant="secondary" size="sm" />
              </View>
            </View>
          </Card>

          {/* Streak Tools */}
          <Text style={styles.sectionTitle}>Streak</Text>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>
                Current: {stats?.currentStreak ?? 0} | Best: {stats?.bestStreak ?? 0}
              </Text>
            </View>
            <View style={styles.buttonRow}>
              <Button title="Reset" onPress={handleResetStreak} variant="outline" size="sm" />
              <Button title="Set 3" onPress={() => handleSetStreak(3)} variant="secondary" size="sm" />
              <Button title="Set 7" onPress={() => handleSetStreak(7)} variant="secondary" size="sm" />
            </View>
          </Card>

          {/* Settlement Tools */}
          <Text style={styles.sectionTitle}>Settle Predictions</Text>
          {pendingPredictions.length > 0 ? (
            pendingPredictions.map((prediction) => (
              <Card key={prediction.id} style={styles.predictionCard}>
                <View style={styles.predictionHeader}>
                  <Text style={styles.predictionTitle}>{prediction.outcome?.name ?? 'Unknown'}</Text>
                  <Badge text="Pending" variant="warning" />
                </View>
                <View style={styles.predictionStats}>
                  <View style={styles.statItem}>
                    <CoinIcon size={14} />
                    <Text style={styles.predictionDetails}>Stake: {prediction.stake}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <CoinIcon size={14} />
                    <Text style={styles.predictionDetails}>{prediction.potentialCoins}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <StarIcon size={14} />
                    <Text style={styles.predictionDetails}>{prediction.potentialStars}</Text>
                  </View>
                </View>
                <View style={styles.buttonRow}>
                  <Button
                    title="Settle as Win"
                    onPress={() => handleSettleWin(prediction)}
                    variant="secondary"
                    size="sm"
                  />
                  <Button
                    title="Settle as Loss"
                    onPress={() => handleSettleLoss(prediction)}
                    variant="outline"
                    size="sm"
                  />
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.card}>
              <Text style={styles.emptyText}>No pending predictions to settle</Text>
            </Card>
          )}

          {/* Test Celebration */}
          <Text style={styles.sectionTitle}>Animations</Text>
          <Card style={styles.card}>
            <Button
              title="Test Win Celebration"
              onPress={() => {
                setCelebrationData({ coins: 450, stars: 350 });
                setShowCelebration(true);
              }}
              variant="secondary"
            />
          </Card>
        </ScrollView>

        {/* Win Celebration Modal */}
        {showCelebration && (
          <WinCelebration
            coinsWon={celebrationData.coins}
            starsEarned={celebrationData.stars}
            isNewBestStreak={stats?.currentStreak === stats?.bestStreak && (stats?.currentStreak ?? 0) > 1}
            onComplete={() => setShowCelebration(false)}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  title: {
    fontSize: layout.fontSize.xl,
    fontWeight: layout.fontWeight.bold,
    color: colors.warning,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: layout.spacing.md,
    paddingBottom: layout.spacing.xxl,
  },
  sectionTitle: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: layout.spacing.lg,
    marginBottom: layout.spacing.md,
  },
  card: {
    marginBottom: layout.spacing.md,
  },
  row: {
    marginBottom: layout.spacing.md,
  },
  currencyLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
    marginBottom: layout.spacing.sm,
  },
  label: {
    fontSize: layout.fontSize.md,
    color: colors.textSecondary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: layout.spacing.sm,
    flexWrap: 'wrap',
  },
  predictionCard: {
    marginBottom: layout.spacing.md,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.sm,
  },
  predictionTitle: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  predictionStats: {
    flexDirection: 'row',
    gap: layout.spacing.md,
    marginBottom: layout.spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  predictionDetails: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: layout.fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    padding: layout.spacing.md,
  },
});
