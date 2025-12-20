import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MotiPressable } from 'moti/interactions';
import * as Haptics from 'expo-haptics';
import { Event, Outcome } from '@/types';
import { Card, Badge } from '@/components/ui';
import { FootballIcon, TennisIcon, DartsIcon, CricketIcon, UsersIcon, LiveIcon, BasketballIcon, GolfIcon, BoxingIcon, MMAIcon } from '@/components/icons';
import { colors, getOddsColor } from '@/constants/colors';
import { layout } from '@/constants/layout';
import { getEventTitle } from '@/lib/mock-data';

function getSportIcon(slug: string, size: number, color: string): React.ReactElement {
  switch (slug) {
    case 'football':
      return <FootballIcon size={size} color={color} />;
    case 'tennis':
      return <TennisIcon size={size} color={color} />;
    case 'darts':
      return <DartsIcon size={size} color={color} />;
    case 'cricket':
      return <CricketIcon size={size} color={color} />;
    case 'basketball':
      return <BasketballIcon size={size} color={color} />;
    case 'golf':
      return <GolfIcon size={size} color={color} />;
    case 'boxing':
      return <BoxingIcon size={size} color={color} />;
    case 'mma':
      return <MMAIcon size={size} color={color} />;
    default:
      return <FootballIcon size={size} color={color} />;
  }
}

interface EventCardProps {
  event: Event;
  onPress: () => void;
  compact?: boolean;
  friendCount?: number;
}

export function EventCard({ event, onPress, compact = false, friendCount }: EventCardProps): React.ReactElement {
  const title = getEventTitle(event);
  const startTime = new Date(event.startTime);
  const isToday = startTime.toDateString() === new Date().toDateString();
  const isLive = event.status === 'live';
  const timeString = startTime.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateString = isToday ? 'Today' : startTime.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const handlePress = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  if (compact) {
    return (
      <Card onPress={handlePress} style={styles.compactCard}>
        <View style={styles.compactHeader}>
          <View style={styles.sportIconContainer}>
            {getSportIcon(event.sport.slug, 18, colors.textSecondary)}
          </View>
          <Text style={styles.compactTitle} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.compactFooter}>
          <Text style={styles.compactTime}>{timeString}</Text>
          <View style={styles.oddsPreview}>
            {event.markets[0]?.outcomes.slice(0, 2).map((outcome) => (
              <OddsBadge key={outcome.id} outcome={outcome} small />
            ))}
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card onPress={handlePress} style={[styles.card, isLive && styles.cardLive]}>
      <View style={styles.header}>
        <View style={styles.sportBadge}>
          <View style={styles.sportIconContainer}>
            {getSportIcon(event.sport.slug, 20, colors.textSecondary)}
          </View>
          <Text style={styles.competition}>{event.competition}</Text>
        </View>
        <View style={styles.timeContainer}>
          {isLive ? (
            <View style={styles.liveIndicator}>
              <LiveIcon size={12} color={colors.error} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : (
            <>
              <Text style={styles.date}>{dateString}</Text>
              <Text style={styles.time}>{timeString}</Text>
            </>
          )}
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>

      {/* Live Score */}
      {isLive && event.liveScore && (
        <View style={styles.liveScoreContainer}>
          <Text style={styles.liveScore}>{event.liveScore.home}</Text>
          <Text style={styles.liveScoreSeparator}>-</Text>
          <Text style={styles.liveScore}>{event.liveScore.away}</Text>
          {event.liveScore.time && (
            <Text style={styles.liveTime}>{event.liveScore.time}</Text>
          )}
        </View>
      )}

      {event.sponsoredEvent && (
        <Badge
          text={`Sponsored by ${event.sponsoredEvent.sponsorName}`}
          variant="info"
          style={styles.sponsorBadge}
        />
      )}

      <View style={styles.oddsContainer}>
        {event.markets[0]?.outcomes.map((outcome) => (
          <OddsBadge key={outcome.id} outcome={outcome} />
        ))}
      </View>

      {/* Friend Count Indicator */}
      {friendCount && friendCount > 0 && (
        <View style={styles.friendIndicator}>
          <UsersIcon size={14} color={colors.primary} />
          <Text style={styles.friendCount}>
            {friendCount} friend{friendCount > 1 ? 's' : ''} betting
          </Text>
        </View>
      )}
    </Card>
  );
}

interface OddsBadgeProps {
  outcome: Outcome;
  small?: boolean;
}

function OddsBadge({ outcome, small = false }: OddsBadgeProps): React.ReactElement {
  const oddsColor = getOddsColor(outcome.odds);

  return (
    <View style={[styles.oddsBadge, small && styles.oddsBadgeSmall]}>
      <Text style={[styles.outcomeName, small && styles.outcomeNameSmall]} numberOfLines={1}>
        {outcome.name}
      </Text>
      <Text style={[styles.oddsValue, small && styles.oddsValueSmall, { color: oddsColor }]}>
        {outcome.odds.toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: layout.spacing.md,
  },
  cardLive: {
    borderWidth: 1,
    borderColor: colors.error,
  },
  compactCard: {
    width: 200,
    marginRight: layout.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: layout.spacing.md,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: layout.spacing.sm,
    paddingVertical: 4,
    borderRadius: layout.borderRadius.sm,
  },
  liveText: {
    fontSize: layout.fontSize.xs,
    fontWeight: layout.fontWeight.bold,
    color: colors.error,
    letterSpacing: 0.5,
  },
  liveScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.spacing.sm,
    backgroundColor: colors.cardElevated,
    paddingVertical: layout.spacing.sm,
    paddingHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadius.md,
    marginBottom: layout.spacing.md,
  },
  liveScore: {
    fontSize: layout.fontSize.xxl,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  liveScoreSeparator: {
    fontSize: layout.fontSize.xl,
    color: colors.textMuted,
  },
  liveTime: {
    fontSize: layout.fontSize.sm,
    color: colors.error,
    fontWeight: layout.fontWeight.medium,
    marginLeft: layout.spacing.sm,
  },
  friendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
    marginTop: layout.spacing.md,
    paddingTop: layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  friendCount: {
    fontSize: layout.fontSize.sm,
    color: colors.primary,
    fontWeight: layout.fontWeight.medium,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  sportIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  competition: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  date: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
  },
  time: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  title: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: layout.spacing.md,
  },
  sponsorBadge: {
    marginBottom: layout.spacing.md,
  },
  oddsContainer: {
    flexDirection: 'row',
    gap: layout.spacing.sm,
  },
  oddsBadge: {
    flex: 1,
    backgroundColor: colors.cardElevated,
    padding: layout.spacing.sm,
    borderRadius: layout.borderRadius.md,
    alignItems: 'center',
  },
  oddsBadgeSmall: {
    flex: 0,
    paddingHorizontal: layout.spacing.sm,
    paddingVertical: layout.spacing.xs,
  },
  outcomeName: {
    fontSize: layout.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 2,
    textAlign: 'center',
  },
  outcomeNameSmall: {
    display: 'none',
  },
  oddsValue: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  oddsValueSmall: {
    fontSize: layout.fontSize.sm,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.sm,
  },
  compactTitle: {
    flex: 1,
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  compactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactTime: {
    fontSize: layout.fontSize.xs,
    color: colors.textSecondary,
  },
  oddsPreview: {
    flexDirection: 'row',
    gap: layout.spacing.xs,
  },
});
