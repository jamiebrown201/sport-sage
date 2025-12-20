import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  noPadding?: boolean;
}

export function Card({
  children,
  style,
  elevated = false,
  onPress,
  disabled = false,
  noPadding = false,
}: CardProps): React.ReactElement {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (): void => {
    if (onPress && !disabled) {
      scale.value = withSpring(0.97, { damping: 15 });
    }
  };

  const handlePressOut = (): void => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const handlePress = (): void => {
    if (onPress && !disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const cardStyle = [
    styles.card,
    elevated && styles.elevated,
    !noPadding && styles.padding,
    disabled && styles.disabled,
    style,
  ];

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[cardStyle, animatedStyle]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: colors.cardElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  padding: {
    padding: layout.spacing.md,
  },
  disabled: {
    opacity: 0.6,
  },
});
