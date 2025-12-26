import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

interface ComingSoonProps {
  title?: string;
  message?: string;
  children?: React.ReactNode;
  onPress?: () => void;
}

export function ComingSoon({
  title = 'Coming Soon',
  message = 'This feature is under development',
  children,
  onPress,
}: ComingSoonProps): React.ReactElement {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      {children}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 300 }}
        style={styles.overlay}
      >
        <View style={styles.content}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>COMING SOON</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
      </MotiView>
    </Pressable>
  );
}

interface ComingSoonBadgeProps {
  size?: 'sm' | 'md' | 'lg';
}

export function ComingSoonBadge({ size = 'md' }: ComingSoonBadgeProps): React.ReactElement {
  const fontSize = size === 'sm' ? 8 : size === 'md' ? 10 : 12;
  const padding = size === 'sm' ? 4 : size === 'md' ? 6 : 8;

  return (
    <View style={[styles.inlineBadge, { paddingHorizontal: padding, paddingVertical: padding / 2 }]}>
      <Text style={[styles.inlineBadgeText, { fontSize }]}>COMING SOON</Text>
    </View>
  );
}

interface ComingSoonScreenProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export function ComingSoonScreen({ title, description, icon }: ComingSoonScreenProps): React.ReactElement {
  return (
    <View style={styles.screenContainer}>
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        style={styles.screenContent}
      >
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <View style={styles.screenBadge}>
          <Text style={styles.screenBadgeText}>COMING SOON</Text>
        </View>
        <Text style={styles.screenTitle}>{title}</Text>
        {description && <Text style={styles.screenDescription}>{description}</Text>}
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: layout.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: layout.spacing.lg,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.xs,
    borderRadius: layout.borderRadius.full,
    marginBottom: layout.spacing.sm,
  },
  badgeText: {
    color: colors.background,
    fontSize: layout.fontSize.xs,
    fontWeight: layout.fontWeight.bold,
    letterSpacing: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    marginBottom: layout.spacing.xs,
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: layout.fontSize.sm,
    textAlign: 'center',
  },
  // Inline badge styles
  inlineBadge: {
    backgroundColor: colors.primaryMuted,
    borderRadius: layout.borderRadius.sm,
  },
  inlineBadgeText: {
    color: colors.primary,
    fontWeight: layout.fontWeight.bold,
    letterSpacing: 0.5,
  },
  // Full screen styles
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.spacing.xl,
  },
  screenContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  iconContainer: {
    marginBottom: layout.spacing.lg,
    opacity: 0.5,
  },
  screenBadge: {
    backgroundColor: colors.primaryDim,
    paddingHorizontal: layout.spacing.lg,
    paddingVertical: layout.spacing.sm,
    borderRadius: layout.borderRadius.full,
    marginBottom: layout.spacing.md,
  },
  screenBadgeText: {
    color: colors.primary,
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.bold,
    letterSpacing: 1.5,
  },
  screenTitle: {
    color: colors.textPrimary,
    fontSize: layout.fontSize.xxl,
    fontWeight: layout.fontWeight.bold,
    marginBottom: layout.spacing.sm,
    textAlign: 'center',
  },
  screenDescription: {
    color: colors.textSecondary,
    fontSize: layout.fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});
