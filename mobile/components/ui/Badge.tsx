import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'premium';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: string;
  style?: ViewStyle;
}

export function Badge({
  text,
  variant = 'default',
  size = 'sm',
  icon,
  style,
}: BadgeProps): React.ReactElement {
  return (
    <View style={[styles.badge, styles[variant], styles[`size_${size}`], style]}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[styles.text, styles[`text_${variant}`], styles[`text_${size}`]]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: layout.borderRadius.full,
    gap: 4,
  },
  size_sm: {
    paddingVertical: 2,
    paddingHorizontal: layout.spacing.sm,
  },
  size_md: {
    paddingVertical: 4,
    paddingHorizontal: layout.spacing.md,
  },
  default: {
    backgroundColor: colors.cardElevated,
  },
  success: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  warning: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
  },
  error: {
    backgroundColor: 'rgba(239, 83, 80, 0.2)',
  },
  info: {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
  },
  premium: {
    backgroundColor: colors.gemsDim,
  },
  icon: {
    fontSize: layout.fontSize.sm,
  },
  text: {
    fontWeight: layout.fontWeight.medium,
  },
  text_default: {
    color: colors.textSecondary,
  },
  text_success: {
    color: colors.success,
  },
  text_warning: {
    color: colors.warning,
  },
  text_error: {
    color: colors.error,
  },
  text_info: {
    color: '#2196F3',
  },
  text_premium: {
    color: colors.gems,
  },
  text_sm: {
    fontSize: layout.fontSize.xs,
  },
  text_md: {
    fontSize: layout.fontSize.sm,
  },
});
