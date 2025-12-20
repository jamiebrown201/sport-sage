import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MotiView } from 'moti';
import { LEADERBOARD } from '@/lib/mock-data';
import { LeaderboardEntry } from '@/types';
import { Card } from '@/components/ui';
import { StarIcon, TrophyIcon, CrownIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

export default function LeaderboardScreen(): React.ReactElement {
  // Find current user's entry
  const currentUserEntry = LEADERBOARD.find((e) => e.isCurrentUser);
  const currentUserRank = currentUserEntry?.rank ?? 0;

  // Get top 10 and nearby users
  const topEntries = LEADERBOARD.filter((e) => e.rank <= 10);
  const nearbyEntries = LEADERBOARD.filter(
    (e) => e.rank > 10 && Math.abs(e.rank - currentUserRank) <= 3
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Current User Position */}
      {currentUserEntry && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
        >
          <Card style={styles.currentUserCard}>
            <Text style={styles.currentUserLabel}>Your Position</Text>
            <View style={styles.currentUserInfo}>
              <Text style={styles.currentUserRank}>#{currentUserEntry.rank}</Text>
              <View style={styles.currentUserStats}>
                <View style={styles.starsRow}>
                  <Text style={styles.currentUserStars}>
                    {currentUserEntry.totalStarsEarned.toLocaleString()}
                  </Text>
                  <StarIcon size={16} color={colors.stars} />
                </View>
                <Text style={styles.currentUserWinRate}>
                  {currentUserEntry.winRate}% win rate
                </Text>
              </View>
            </View>
            {currentUserRank > 1 && (
              <View style={styles.toNextRankRow}>
                <Text style={styles.toNextRank}>
                  {getStarsToNextRank(currentUserEntry)}
                </Text>
                <StarIcon size={12} color={colors.primary} />
                <Text style={styles.toNextRank}> to rank up</Text>
              </View>
            )}
          </Card>
        </MotiView>
      )}

      {/* Top 3 Podium */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 100 }}
      >
        <Text style={styles.sectionTitle}>Top Players</Text>
        <View style={styles.podium}>
          {topEntries.slice(0, 3).map((entry, index) => (
            <PodiumEntry
              key={entry.userId}
              entry={entry}
              position={(index + 1) as 1 | 2 | 3}
            />
          ))}
        </View>
      </MotiView>

      {/* Rest of Top 10 */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 200 }}
      >
        {topEntries.slice(3).map((entry, index) => (
          <LeaderboardRow
            key={entry.userId}
            entry={entry}
            delay={index * 30}
          />
        ))}
      </MotiView>

      {/* Nearby Users */}
      {nearbyEntries.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300, delay: 300 }}
        >
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>•••</Text>
            <View style={styles.dividerLine} />
          </View>

          {nearbyEntries.map((entry, index) => (
            <LeaderboardRow
              key={entry.userId}
              entry={entry}
              delay={index * 30}
            />
          ))}
        </MotiView>
      )}
    </ScrollView>
  );
}

interface PodiumEntryProps {
  entry: LeaderboardEntry;
  position: 1 | 2 | 3;
}

function PodiumEntry({ entry, position }: PodiumEntryProps): React.ReactElement {
  const heights = [120, 90, 70];
  const medalColors = [colors.tierElite, '#C0C0C0', '#CD7F32'];

  return (
    <View style={styles.podiumItem}>
      <View style={[styles.medalContainer, { backgroundColor: `${medalColors[position - 1]}30` }]}>
        {position === 1 ? (
          <CrownIcon size={24} color={medalColors[0]} />
        ) : (
          <TrophyIcon size={24} color={medalColors[position - 1]} />
        )}
      </View>
      <Text style={styles.podiumUsername} numberOfLines={1}>
        {entry.username}
      </Text>
      <View style={styles.podiumStarsRow}>
        <Text style={styles.podiumStars}>
          {entry.totalStarsEarned.toLocaleString()}
        </Text>
        <StarIcon size={12} color={colors.stars} />
      </View>
      <View
        style={[
          styles.podiumBar,
          {
            height: heights[position - 1],
            backgroundColor:
              position === 1
                ? colors.tierElite
                : position === 2
                ? '#C0C0C0'
                : '#CD7F32',
          },
        ]}
      >
        <Text style={styles.podiumRank}>#{position}</Text>
      </View>
    </View>
  );
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  delay?: number;
}

function LeaderboardRow({ entry, delay = 0 }: LeaderboardRowProps): React.ReactElement {
  const isCurrentUser = entry.isCurrentUser;

  return (
    <MotiView
      from={{ opacity: 0, translateX: -10 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: 200, delay }}
    >
      <View
        style={[
          styles.row,
          isCurrentUser && styles.rowCurrentUser,
        ]}
      >
        <Text style={[styles.rank, isCurrentUser && styles.rankCurrentUser]}>
          #{entry.rank}
        </Text>
        <View style={styles.userInfo}>
          <Text
            style={[styles.username, isCurrentUser && styles.usernameCurrentUser]}
            numberOfLines={1}
          >
            {entry.username}
            {isCurrentUser && ' (You)'}
          </Text>
          <Text style={styles.winRate}>{entry.winRate}% win rate</Text>
        </View>
        <View style={styles.starsRow}>
          <Text style={[styles.stars, isCurrentUser && styles.starsCurrentUser]}>
            {entry.totalStarsEarned.toLocaleString()}
          </Text>
          <StarIcon size={14} color={isCurrentUser ? colors.primary : colors.stars} />
        </View>
      </View>
    </MotiView>
  );
}

function getStarsToNextRank(entry: LeaderboardEntry): string {
  const nextRankEntry = LEADERBOARD.find((e) => e.rank === entry.rank - 1);
  if (!nextRankEntry) return '0';
  const diff = nextRankEntry.totalStarsEarned - entry.totalStarsEarned;
  return diff.toLocaleString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.spacing.md,
    paddingBottom: layout.spacing.xxl,
  },
  currentUserCard: {
    marginBottom: layout.spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primaryDim,
  },
  currentUserLabel: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: layout.spacing.sm,
  },
  currentUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currentUserRank: {
    fontSize: layout.fontSize.xxxl,
    fontWeight: layout.fontWeight.bold,
    color: colors.primary,
  },
  currentUserStats: {
    alignItems: 'flex-end',
  },
  currentUserStars: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.stars,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toNextRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: layout.spacing.sm,
  },
  currentUserWinRate: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  toNextRank: {
    fontSize: layout.fontSize.sm,
    color: colors.primary,
    marginTop: layout.spacing.sm,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: layout.spacing.md,
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: layout.spacing.lg,
    gap: layout.spacing.md,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },
  medalContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: layout.spacing.xs,
  },
  podiumUsername: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
    textAlign: 'center',
  },
  podiumStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: layout.spacing.sm,
  },
  podiumStars: {
    fontSize: layout.fontSize.xs,
    color: colors.stars,
  },
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: layout.borderRadius.md,
    borderTopRightRadius: layout.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumRank: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.background,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: layout.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    marginHorizontal: layout.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    marginBottom: layout.spacing.sm,
  },
  rowCurrentUser: {
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  rank: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
    color: colors.textSecondary,
    width: 50,
  },
  rankCurrentUser: {
    color: colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  usernameCurrentUser: {
    color: colors.primary,
  },
  winRate: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
  },
  stars: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
    color: colors.stars,
  },
  starsCurrentUser: {
    color: colors.primary,
  },
});
