import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { CoinIcon } from '@/components/icons';

const { width } = Dimensions.get('window');

interface CoinBurstProps {
  amount?: number;
  onComplete?: () => void;
}

export function CoinBurst({ amount = 500, onComplete }: CoinBurstProps): React.ReactElement {
  const coinCount = Math.min(Math.max(amount / 25, 8), 20);
  const coins = Array.from({ length: coinCount }, (_, i) => ({
    id: i,
    angle: (i / 20) * Math.PI * 2,
    delay: i * 30,
  }));

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <View style={styles.container}>
      {coins.map((coin) => (
        <AnimatedCoin key={coin.id} angle={coin.angle} delay={coin.delay} />
      ))}
    </View>
  );
}

interface AnimatedCoinProps {
  angle: number;
  delay: number;
}

function AnimatedCoin({ angle, delay }: AnimatedCoinProps): React.ReactElement {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);

  const distance = 100 + Math.random() * 50;
  const targetX = Math.cos(angle) * distance;
  const targetY = Math.sin(angle) * distance;

  useEffect(() => {
    scale.value = withDelay(delay, withTiming(1, { duration: 200 }));
    translateX.value = withDelay(
      delay,
      withTiming(targetX, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      delay,
      withTiming(targetY, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
    rotate.value = withDelay(
      delay,
      withTiming(360 + Math.random() * 360, { duration: 600 })
    );
    opacity.value = withDelay(delay + 400, withTiming(0, { duration: 200 }));
  }, [translateX, translateY, scale, opacity, rotate, delay, targetX, targetY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.coin, animatedStyle]}>
      <CoinIcon size={24} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  coin: {
    position: 'absolute',
  },
});
