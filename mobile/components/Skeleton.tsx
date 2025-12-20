import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = layout.borderRadius.sm,
  style,
}: SkeletonProps): React.ReactElement {
  return (
    <MotiView
      from={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{
        type: 'timing',
        duration: 1000,
        loop: true,
      }}
      style={[
        {
          width: width as number | `${number}%`,
          height,
          borderRadius,
          backgroundColor: colors.cardElevated,
        },
        style,
      ]}
    />
  );
}

// Event Card Skeleton
export function EventCardSkeleton(): React.ReactElement {
  return (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <View style={styles.eventHeaderLeft}>
          <Skeleton width={24} height={24} borderRadius={12} />
          <Skeleton width={100} height={14} />
        </View>
        <Skeleton width={60} height={14} />
      </View>
      <Skeleton width="80%" height={22} style={styles.eventTitle} />
      <View style={styles.oddsRow}>
        <Skeleton width="30%" height={50} borderRadius={layout.borderRadius.md} />
        <Skeleton width="30%" height={50} borderRadius={layout.borderRadius.md} />
        <Skeleton width="30%" height={50} borderRadius={layout.borderRadius.md} />
      </View>
    </View>
  );
}

// Leaderboard Row Skeleton
export function LeaderboardRowSkeleton(): React.ReactElement {
  return (
    <View style={styles.leaderboardRow}>
      <Skeleton width={30} height={20} />
      <Skeleton width={40} height={40} borderRadius={20} />
      <View style={styles.leaderboardInfo}>
        <Skeleton width={120} height={16} />
        <Skeleton width={80} height={12} style={styles.leaderboardSubtext} />
      </View>
      <Skeleton width={60} height={20} />
    </View>
  );
}

// Challenge Card Skeleton
export function ChallengeCardSkeleton(): React.ReactElement {
  return (
    <View style={styles.challengeCard}>
      <View style={styles.challengeHeader}>
        <Skeleton width={40} height={40} borderRadius={layout.borderRadius.md} />
        <View style={styles.challengeInfo}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="90%" height={12} style={styles.challengeSubtext} />
        </View>
      </View>
      <View style={styles.progressBar}>
        <Skeleton width="100%" height={8} borderRadius={4} />
      </View>
      <View style={styles.challengeFooter}>
        <Skeleton width={80} height={14} />
        <Skeleton width={60} height={28} borderRadius={layout.borderRadius.sm} />
      </View>
    </View>
  );
}

// Prediction Card Skeleton
export function PredictionCardSkeleton(): React.ReactElement {
  return (
    <View style={styles.predictionCard}>
      <View style={styles.predictionHeader}>
        <Skeleton width={24} height={24} borderRadius={12} />
        <Skeleton width={150} height={16} />
        <Skeleton width={60} height={20} borderRadius={layout.borderRadius.sm} />
      </View>
      <Skeleton width="90%" height={18} style={styles.predictionTitle} />
      <View style={styles.predictionFooter}>
        <Skeleton width={80} height={14} />
        <Skeleton width={100} height={14} />
      </View>
    </View>
  );
}

// Friend Activity Skeleton
export function FriendActivitySkeleton(): React.ReactElement {
  return (
    <View style={styles.activityItem}>
      <Skeleton width={36} height={36} borderRadius={18} />
      <View style={styles.activityInfo}>
        <Skeleton width="80%" height={14} />
        <Skeleton width="50%" height={12} style={styles.activitySubtext} />
      </View>
    </View>
  );
}

// Profile Card Skeleton
export function ProfileCardSkeleton(): React.ReactElement {
  return (
    <View style={styles.profileCard}>
      <View style={styles.profileHeader}>
        <Skeleton width={60} height={60} borderRadius={30} />
        <View style={styles.profileInfo}>
          <Skeleton width={120} height={20} />
          <Skeleton width={80} height={14} style={styles.profileSubtext} />
        </View>
      </View>
      <View style={styles.balanceRow}>
        <View style={styles.balanceItem}>
          <Skeleton width={24} height={24} borderRadius={12} />
          <Skeleton width={50} height={18} />
        </View>
        <View style={styles.balanceItem}>
          <Skeleton width={24} height={24} borderRadius={12} />
          <Skeleton width={50} height={18} />
        </View>
        <View style={styles.balanceItem}>
          <Skeleton width={24} height={24} borderRadius={12} />
          <Skeleton width={50} height={18} />
        </View>
      </View>
    </View>
  );
}

// Stats Grid Skeleton
export function StatsGridSkeleton(): React.ReactElement {
  return (
    <View style={styles.statsGrid}>
      <View style={styles.statItem}>
        <Skeleton width={40} height={24} />
        <Skeleton width={60} height={12} style={styles.statLabel} />
      </View>
      <View style={styles.statItem}>
        <Skeleton width={40} height={24} />
        <Skeleton width={60} height={12} style={styles.statLabel} />
      </View>
      <View style={styles.statItem}>
        <Skeleton width={40} height={24} />
        <Skeleton width={60} height={12} style={styles.statLabel} />
      </View>
      <View style={styles.statItem}>
        <Skeleton width={40} height={24} />
        <Skeleton width={60} height={12} style={styles.statLabel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Event Card
  eventCard: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    padding: layout.spacing.md,
    marginBottom: layout.spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.md,
  },
  eventHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  eventTitle: {
    marginBottom: layout.spacing.md,
  },
  oddsRow: {
    flexDirection: 'row',
    gap: layout.spacing.sm,
  },

  // Leaderboard Row
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.md,
    backgroundColor: colors.card,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    marginBottom: layout.spacing.sm,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardSubtext: {
    marginTop: 4,
  },

  // Challenge Card
  challengeCard: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    padding: layout.spacing.md,
    marginBottom: layout.spacing.md,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.md,
    marginBottom: layout.spacing.md,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeSubtext: {
    marginTop: 4,
  },
  progressBar: {
    marginBottom: layout.spacing.md,
  },
  challengeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Prediction Card
  predictionCard: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    padding: layout.spacing.md,
    marginBottom: layout.spacing.md,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.sm,
  },
  predictionTitle: {
    marginBottom: layout.spacing.md,
  },
  predictionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Friend Activity
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    paddingVertical: layout.spacing.sm,
  },
  activityInfo: {
    flex: 1,
  },
  activitySubtext: {
    marginTop: 4,
  },

  // Profile Card
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    padding: layout.spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.md,
    marginBottom: layout.spacing.lg,
  },
  profileInfo: {
    flex: 1,
  },
  profileSubtext: {
    marginTop: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  balanceItem: {
    alignItems: 'center',
    gap: layout.spacing.xs,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    padding: layout.spacing.md,
  },
  statItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: layout.spacing.md,
  },
  statLabel: {
    marginTop: layout.spacing.xs,
  },
});
