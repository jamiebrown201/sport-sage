import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { FireIcon, StarIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

interface StreakIndicatorProps {
  currentStreak: number;
  bestStreak: number;
}

export function StreakIndicator({ currentStreak, bestStreak }: StreakIndicatorProps): React.ReactElement | null {
  if (currentStreak < 1) return null;

  const isOnFire = currentStreak >= 3;
  const isNewBest = currentStreak >= bestStreak && currentStreak > 1;

  return (
    <View style={styles.container}>
      <MotiView
        from={{ rotate: '-5deg' }}
        animate={{ rotate: '5deg' }}
        transition={{
          type: 'timing',
          duration: 200,
          loop: isOnFire,
          repeatReverse: true,
        }}
        style={styles.iconContainer}
      >
        {isOnFire ? (
          <FireIcon size={24} color={colors.warning} />
        ) : (
          <StarIcon size={24} color={colors.stars} />
        )}
      </MotiView>

      <View style={styles.info}>
        <Text style={styles.streakCount}>{currentStreak} Win Streak</Text>
        {isNewBest && (
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <Text style={styles.newBest}>New Best!</Text>
          </MotiView>
        )}
        {!isNewBest && bestStreak > 0 && (
          <Text style={styles.bestStreak}>Best: {bestStreak}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: layout.spacing.sm,
    paddingHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    gap: layout.spacing.sm,
  },
  iconContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  streakCount: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  newBest: {
    fontSize: layout.fontSize.xs,
    color: colors.primary,
    fontWeight: layout.fontWeight.medium,
  },
  bestStreak: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
  },
});
