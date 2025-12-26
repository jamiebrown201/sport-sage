import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

interface LiveIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function LiveIndicator({ size = 'md', showText = true }: LiveIndicatorProps): React.ReactElement {
  const dotSize = size === 'sm' ? 6 : size === 'md' ? 8 : 10;
  const containerPadding = size === 'sm' ? 6 : size === 'md' ? 8 : 10;
  const fontSize = size === 'sm' ? layout.fontSize.xs : size === 'md' ? layout.fontSize.xs : layout.fontSize.sm;

  // Only show background container when displaying text (badge mode)
  const containerStyle = showText
    ? [styles.container, styles.containerWithBackground, { paddingHorizontal: containerPadding, paddingVertical: containerPadding / 2 }]
    : [styles.container];

  return (
    <View style={containerStyle}>
      <View style={[styles.dotContainer, { width: dotSize * 2.5, height: dotSize * 2.5 }]}>
        {/* Outer pulsing ring */}
        <MotiView
          from={{ opacity: 0.6, scale: 1 }}
          animate={{ opacity: 0, scale: 2.2 }}
          transition={{
            type: 'timing',
            duration: 1500,
            loop: true,
          }}
          style={[
            styles.pulseRing,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
            },
          ]}
        />

        {/* Inner pulsing ring (slightly delayed) */}
        <MotiView
          from={{ opacity: 0.4, scale: 1 }}
          animate={{ opacity: 0, scale: 1.8 }}
          transition={{
            type: 'timing',
            duration: 1500,
            delay: 400,
            loop: true,
          }}
          style={[
            styles.pulseRing,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
            },
          ]}
        />

        {/* Solid center dot */}
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
            },
          ]}
        />
      </View>

      {showText && (
        <Text style={[styles.text, { fontSize }]}>LIVE</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  containerWithBackground: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: layout.borderRadius.sm,
  },
  dotContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: colors.error,
  },
  dot: {
    backgroundColor: colors.error,
  },
  text: {
    fontWeight: layout.fontWeight.bold,
    color: colors.error,
    letterSpacing: 0.5,
  },
});
