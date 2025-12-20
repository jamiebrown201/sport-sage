import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CoinIcon, StarIcon, GemIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

interface CurrencyBadgeProps {
  icon: React.ReactNode;
  value: number;
  color: string;
  onPress?: () => void;
}

function CurrencyBadge({ icon, value, color, onPress }: CurrencyBadgeProps): React.ReactElement {
  const scale = useSharedValue(1);
  const previousValueRef = useRef(value);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (value !== previousValueRef.current) {
      // Pop animation when value changes
      scale.value = withSequence(
        withSpring(1.15, { damping: 10 }),
        withSpring(1, { damping: 15 })
      );

      // Animate number change
      const startValue = previousValueRef.current;
      const endValue = value;
      const duration = 400;
      const startTime = Date.now();

      const animateNumber = (): void => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue = Math.floor(startValue + (endValue - startValue) * progress);
        setDisplayValue(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animateNumber);
        }
      };

      animateNumber();
      previousValueRef.current = value;
    }
  }, [value, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const content = (
    <>
      <View style={styles.iconContainer}>{icon}</View>
      <Text style={[styles.value, { color }]}>{displayValue.toLocaleString()}</Text>
    </>
  );

  return (
    <Animated.View style={[styles.badge, animatedStyle]}>
      {onPress ? (
        <Pressable onPress={onPress} style={styles.badgeInner}>
          {content}
        </Pressable>
      ) : (
        <View style={styles.badgeInner}>{content}</View>
      )}
    </Animated.View>
  );
}

interface CurrencyDisplayProps {
  coins: number;
  stars: number;
  gems?: number;
  onCoinsPress?: () => void;
  onStarsPress?: () => void;
  onGemsPress?: () => void;
  compact?: boolean;
}

export function CurrencyDisplay({
  coins,
  stars,
  gems = 0,
  onCoinsPress,
  onStarsPress,
  onGemsPress,
  compact = false,
}: CurrencyDisplayProps): React.ReactElement {
  const iconSize = compact ? 16 : 18;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <CurrencyBadge
        icon={<CoinIcon size={iconSize} />}
        value={coins}
        color={colors.coins}
        onPress={onCoinsPress}
      />
      <CurrencyBadge
        icon={<StarIcon size={iconSize} />}
        value={stars}
        color={colors.stars}
        onPress={onStarsPress}
      />
      {gems > 0 && (
        <CurrencyBadge
          icon={<GemIcon size={iconSize} />}
          value={gems}
          color={colors.gems}
          onPress={onGemsPress}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  containerCompact: {
    gap: layout.spacing.xs,
  },
  badge: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.full,
    overflow: 'hidden',
  },
  badgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.spacing.xs,
    paddingHorizontal: layout.spacing.sm,
    gap: 4,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
});
