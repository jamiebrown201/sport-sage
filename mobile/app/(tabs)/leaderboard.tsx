import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, RefreshControl, Image } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { LEADERBOARD } from '@/lib/mock-data';
import { useFriends } from '@/lib/store';
import { LeaderboardEntry, Friend, FriendActivity } from '@/types';
import { Card, Badge, Button } from '@/components/ui';
import {
  StarIcon,
  TrophyIcon,
  CrownIcon,
  UsersIcon,
  GlobeIcon,
  FireIcon,
  CheckIcon,
  TargetIcon,
  LayersIcon,
  PlusIcon,
  SearchIcon,
} from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

type ViewType = 'global' | 'friends';

export default function LeaderboardScreen(): React.ReactElement {
  const [viewType, setViewType] = useState<ViewType>('global');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');

  const { friends, friendActivity, addFriend, getFriendLeaderboard, isFriend } = useFriends();

  // Find current user's entry
  const currentUserEntry = LEADERBOARD.find((e) => e.isCurrentUser);
  const currentUserRank = currentUserEntry?.rank ?? 0;

  // Get top 10 and nearby users
  const topEntries = LEADERBOARD.filter((e) => e.rank <= 10);
  const nearbyEntries = LEADERBOARD.filter(
    (e) => e.rank > 10 && Math.abs(e.rank - currentUserRank) <= 3
  );

  // Friends leaderboard
  const friendLeaderboard = getFriendLeaderboard();

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleAddFriend = (): void => {
    if (friendUsername.trim()) {
      const success = addFriend(friendUsername.trim());
      if (success) {
        Alert.alert('Friend Request Sent', `Request sent to ${friendUsername}`);
        setFriendUsername('');
        setShowAddFriend(false);
      } else {
        Alert.alert('Error', 'User not found or already added');
      }
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <Pressable
          onPress={() => setViewType('global')}
          style={[styles.toggleButton, viewType === 'global' && styles.toggleButtonActive]}
        >
          <GlobeIcon size={18} color={viewType === 'global' ? colors.primary : colors.textMuted} />
          <Text style={[styles.toggleText, viewType === 'global' && styles.toggleTextActive]}>
            Global
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewType('friends')}
          style={[styles.toggleButton, viewType === 'friends' && styles.toggleButtonActive]}
        >
          <UsersIcon size={18} color={viewType === 'friends' ? colors.primary : colors.textMuted} />
          <Text style={[styles.toggleText, viewType === 'friends' && styles.toggleTextActive]}>
            Friends
          </Text>
          {friends.filter(f => f.status === 'accepted').length > 0 && (
            <View style={[styles.toggleBadge, viewType === 'friends' && styles.toggleBadgeActive]}>
              <Text style={[styles.toggleBadgeText, viewType === 'friends' && styles.toggleBadgeTextActive]}>
                {friends.filter(f => f.status === 'accepted').length}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {viewType === 'global' ? (
        // Global Leaderboard
        <>
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
                  isFriend={isFriend(entry.userId)}
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
                isFriend={isFriend(entry.userId)}
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
                <Text style={styles.dividerText}>Your Rank</Text>
                <View style={styles.dividerLine} />
              </View>

              {nearbyEntries.map((entry, index) => (
                <LeaderboardRow
                  key={entry.userId}
                  entry={entry}
                  delay={index * 30}
                  isFriend={isFriend(entry.userId)}
                />
              ))}
            </MotiView>
          )}
        </>
      ) : (
        // Friends View
        <>
          {/* Add Friend Section */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}
          >
            <Card style={styles.addFriendCard}>
              {!showAddFriend ? (
                <Pressable onPress={() => setShowAddFriend(true)} style={styles.addFriendButton}>
                  <PlusIcon size={20} color={colors.primary} />
                  <Text style={styles.addFriendText}>Add Friend</Text>
                </Pressable>
              ) : (
                <View style={styles.addFriendForm}>
                  <View style={styles.searchInputContainer}>
                    <SearchIcon size={18} color={colors.textMuted} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Enter username"
                      placeholderTextColor={colors.textMuted}
                      value={friendUsername}
                      onChangeText={setFriendUsername}
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.addFriendActions}>
                    <Button
                      title="Cancel"
                      onPress={() => {
                        setShowAddFriend(false);
                        setFriendUsername('');
                      }}
                      variant="outline"
                      size="sm"
                    />
                    <Button title="Add" onPress={handleAddFriend} size="sm" />
                  </View>
                </View>
              )}
            </Card>
          </MotiView>

          {/* Friend Activity Feed */}
          {friendActivity.length > 0 && (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 100 }}
            >
              <Text style={styles.sectionTitle}>Friend Activity</Text>
              <View style={styles.activityFeed}>
                {friendActivity.slice(0, 5).map((activity, index) => (
                  <ActivityItem key={activity.id} activity={activity} delay={index * 50} />
                ))}
              </View>
            </MotiView>
          )}

          {/* Friends Leaderboard */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 200 }}
          >
            <Text style={styles.sectionTitle}>Friend Rankings</Text>
            {friendLeaderboard.length > 0 ? (
              friendLeaderboard.map((friend, index) => (
                <FriendRow key={friend.id} friend={friend} rank={index + 1} delay={index * 50} />
              ))
            ) : (
              <Card style={styles.emptyState}>
                <UsersIcon size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Friends Yet</Text>
                <Text style={styles.emptySubtext}>
                  Add friends to compare your predictions and compete!
                </Text>
              </Card>
            )}
          </MotiView>
        </>
      )}
    </ScrollView>
  );
}

interface PodiumEntryProps {
  entry: LeaderboardEntry;
  position: 1 | 2 | 3;
  isFriend: boolean;
}

function PodiumEntry({ entry, position, isFriend }: PodiumEntryProps): React.ReactElement {
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
      <View style={styles.podiumUsernameRow}>
        <Text style={styles.podiumUsername} numberOfLines={1}>
          {entry.username}
        </Text>
        {isFriend && <UsersIcon size={12} color={colors.primary} />}
      </View>
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
  isFriend: boolean;
}

function LeaderboardRow({ entry, delay = 0, isFriend }: LeaderboardRowProps): React.ReactElement {
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
          isFriend && !isCurrentUser && styles.rowFriend,
        ]}
      >
        <Text style={[styles.rank, isCurrentUser && styles.rankCurrentUser]}>
          #{entry.rank}
        </Text>
        <View style={styles.userInfo}>
          <View style={styles.usernameRow}>
            <Text
              style={[styles.username, isCurrentUser && styles.usernameCurrentUser]}
              numberOfLines={1}
            >
              {entry.username}
              {isCurrentUser && ' (You)'}
            </Text>
            {isFriend && !isCurrentUser && (
              <Badge text="Friend" variant="info" size="sm" />
            )}
          </View>
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

interface FriendRowProps {
  friend: Friend;
  rank: number;
  delay?: number;
}

function FriendRow({ friend, rank, delay = 0 }: FriendRowProps): React.ReactElement {
  return (
    <MotiView
      from={{ opacity: 0, translateX: -10 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: 200, delay }}
    >
      <View style={styles.row}>
        <Text style={styles.rank}>#{rank}</Text>
        <View style={styles.avatarContainer}>
          {friend.avatarUrl ? (
            <Image source={{ uri: friend.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{friend.username.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {friend.isOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.username} numberOfLines={1}>
            {friend.username}
          </Text>
          <View style={styles.friendStats}>
            <Text style={styles.winRate}>{friend.winRate}% win rate</Text>
            {friend.currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <FireIcon size={12} color={colors.warning} />
                <Text style={styles.streakText}>{friend.currentStreak}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.starsRow}>
          <Text style={styles.stars}>
            {friend.totalStarsEarned.toLocaleString()}
          </Text>
          <StarIcon size={14} color={colors.stars} />
        </View>
      </View>
    </MotiView>
  );
}

interface ActivityItemProps {
  activity: FriendActivity;
  delay?: number;
}

function ActivityItem({ activity, delay = 0 }: ActivityItemProps): React.ReactElement {
  const getActivityIcon = (): React.ReactElement => {
    switch (activity.type) {
      case 'prediction_won':
        return <CheckIcon size={16} color={colors.success} />;
      case 'prediction_lost':
        return <TargetIcon size={16} color={colors.error} />;
      case 'prediction_placed':
        return <TargetIcon size={16} color={colors.primary} />;
      case 'accumulator_placed':
      case 'accumulator_won':
        return <LayersIcon size={16} color={colors.primary} />;
      case 'streak_milestone':
        return <FireIcon size={16} color={colors.warning} />;
      case 'achievement_unlocked':
        return <TrophyIcon size={16} color={colors.tierElite} />;
      default:
        return <StarIcon size={16} color={colors.stars} />;
    }
  };

  const timeAgo = getTimeAgo(activity.createdAt);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 5 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 200, delay }}
    >
      <View style={styles.activityItem}>
        <View style={styles.activityAvatarContainer}>
          {activity.friendAvatarUrl ? (
            <Image source={{ uri: activity.friendAvatarUrl }} style={styles.activityAvatar} />
          ) : (
            <View style={[styles.activityAvatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{activity.friendUsername.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.activityIconBadge}>{getActivityIcon()}</View>
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityText}>
            <Text style={styles.activityUsername}>{activity.friendUsername}</Text>
            {' '}{activity.description}
          </Text>
          {activity.eventName && (
            <Text style={styles.activityEvent}>{activity.eventName}</Text>
          )}
          {activity.coinsWon && (
            <Text style={styles.activityWin}>
              Won {activity.coinsWon} coins (+{activity.starsEarned} stars)
            </Text>
          )}
        </View>
        <Text style={styles.activityTime}>{timeAgo}</Text>
      </View>
    </MotiView>
  );
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
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
  viewToggle: {
    flexDirection: 'row',
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.md,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.spacing.xs,
    paddingVertical: layout.spacing.sm,
    paddingHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  toggleButtonActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  toggleText: {
    fontSize: layout.fontSize.md,
    color: colors.textMuted,
    fontWeight: layout.fontWeight.semibold,
  },
  toggleTextActive: {
    color: colors.primary,
  },
  toggleBadge: {
    backgroundColor: colors.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: layout.borderRadius.full,
  },
  toggleBadgeActive: {
    backgroundColor: `${colors.primary}30`,
  },
  toggleBadgeText: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    fontWeight: layout.fontWeight.bold,
  },
  toggleBadgeTextActive: {
    color: colors.primary,
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
  podiumUsernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  podiumUsername: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
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
    fontSize: layout.fontSize.sm,
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
  rowFriend: {
    borderWidth: 1,
    borderColor: colors.tierPro,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: layout.spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
    color: colors.primary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.card,
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
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
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
  // Friends specific styles
  addFriendCard: {
    marginBottom: layout.spacing.lg,
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.spacing.sm,
    paddingVertical: layout.spacing.sm,
  },
  addFriendText: {
    fontSize: layout.fontSize.md,
    color: colors.primary,
    fontWeight: layout.fontWeight.semibold,
  },
  addFriendForm: {
    gap: layout.spacing.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    backgroundColor: colors.background,
    borderRadius: layout.borderRadius.md,
    paddingHorizontal: layout.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: layout.fontSize.md,
    color: colors.textPrimary,
    paddingVertical: layout.spacing.sm,
  },
  addFriendActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: layout.spacing.sm,
  },
  friendStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: `${colors.warning}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: layout.borderRadius.sm,
  },
  streakText: {
    fontSize: layout.fontSize.xs,
    color: colors.warning,
    fontWeight: layout.fontWeight.bold,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  activityFeed: {
    marginBottom: layout.spacing.lg,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    marginBottom: layout.spacing.sm,
  },
  activityAvatarContainer: {
    position: 'relative',
    marginRight: layout.spacing.sm,
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  activityIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: layout.spacing.sm,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  activityUsername: {
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  activityEvent: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  activityWin: {
    fontSize: layout.fontSize.xs,
    color: colors.success,
    marginTop: 2,
    fontWeight: layout.fontWeight.medium,
  },
  activityTime: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: layout.spacing.xl,
    gap: layout.spacing.sm,
  },
  emptyTitle: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  emptySubtext: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
