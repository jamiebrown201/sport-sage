import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { Button } from '@/components/ui';
import { TrophyIcon, CoinIcon, StarIcon, FireIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

const { width, height } = Dimensions.get('window');

interface WinCelebrationProps {
  coinsWon: number;
  starsEarned: number;
  isNewBestStreak?: boolean;
  onComplete: () => void;
}

export function WinCelebration({
  coinsWon,
  starsEarned,
  isNewBestStreak = false,
  onComplete,
}: WinCelebrationProps): React.ReactElement {
  useEffect(() => {
    // Trigger haptic celebration
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const timer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'timing', duration: 300 }}
      style={styles.overlay}
    >
      {/* Confetti particles */}
      <ConfettiParticles />

      {/* Main content */}
      <View style={styles.content}>
        {/* Trophy animation */}
        <MotiView
          from={{ scale: 0, rotate: '-180deg' }}
          animate={{ scale: 1, rotate: '0deg' }}
          transition={{ type: 'spring', damping: 10, delay: 200 }}
          style={styles.trophyContainer}
        >
          <TrophyIcon size={80} color={colors.primary} />
        </MotiView>

        {/* Win text */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15, delay: 400 }}
        >
          <Text style={styles.title}>YOU WON!</Text>
        </MotiView>

        {/* Coins won */}
        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15, delay: 600 }}
        >
          <AnimatedNumber value={coinsWon} IconComponent={CoinIcon} color={colors.coins} />
        </MotiView>

        {/* Stars earned */}
        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15, delay: 800 }}
        >
          <AnimatedNumber value={starsEarned} IconComponent={StarIcon} color={colors.stars} />
        </MotiView>

        {/* New best streak badge */}
        {isNewBestStreak && (
          <MotiView
            from={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 10, delay: 1000 }}
          >
            <View style={styles.streakBadge}>
              <FireIcon size={24} />
              <Text style={styles.streakText}>New Best Streak!</Text>
            </View>
          </MotiView>
        )}

        {/* Continue button */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300, delay: 1200 }}
          style={styles.buttonContainer}
        >
          <Button title="Continue" onPress={onComplete} size="lg" />
        </MotiView>
      </View>
    </MotiView>
  );
}

interface AnimatedNumberProps {
  value: number;
  IconComponent: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
}

function AnimatedNumber({ value, IconComponent, color }: AnimatedNumberProps): React.ReactElement {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withDelay(100, withSpring(1.2, { damping: 10 })),
      withSpring(1, { damping: 15 })
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.numberContainer, animatedStyle]}>
      <Text style={[styles.numberValue, { color }]}>+{value.toLocaleString()}</Text>
      <IconComponent size={32} color={color} />
    </Animated.View>
  );
}

function ConfettiParticles(): React.ReactElement {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    color: [colors.primary, colors.coins, colors.stars, colors.success, colors.gems][i % 5],
    left: Math.random() * width,
    delay: Math.random() * 500,
    duration: 2000 + Math.random() * 1000,
    size: 8 + Math.random() * 8,
  }));

  return (
    <View style={styles.confettiContainer}>
      {particles.map((particle) => (
        <ConfettiParticle key={particle.id} {...particle} />
      ))}
    </View>
  );
}

interface ConfettiParticleProps {
  color: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
}

function ConfettiParticle({
  color,
  left,
  delay,
  duration,
  size,
}: ConfettiParticleProps): React.ReactElement {
  const translateY = useSharedValue(-50);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(height + 50, { duration, easing: Easing.linear })
    );
    rotate.value = withDelay(
      delay,
      withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1
      )
    );
    opacity.value = withDelay(
      delay + duration - 500,
      withTiming(0, { duration: 500 })
    );
  }, [translateY, rotate, opacity, delay, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        {
          backgroundColor: color,
          left,
          width: size,
          height: size,
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 27, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  confettiParticle: {
    position: 'absolute',
    borderRadius: 2,
  },
  content: {
    alignItems: 'center',
    padding: layout.spacing.xl,
  },
  trophyContainer: {
    marginBottom: layout.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: layout.fontWeight.bold,
    color: colors.primary,
    marginBottom: layout.spacing.xl,
    textShadowColor: colors.primaryMuted,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  numberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: layout.spacing.md,
    gap: layout.spacing.sm,
  },
  numberValue: {
    fontSize: 36,
    fontWeight: layout.fontWeight.bold,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    paddingVertical: layout.spacing.sm,
    paddingHorizontal: layout.spacing.lg,
    borderRadius: layout.borderRadius.full,
    marginTop: layout.spacing.md,
    gap: layout.spacing.sm,
  },
  streakText: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.warning,
  },
  buttonContainer: {
    marginTop: layout.spacing.xl,
    minWidth: 200,
  },
});
