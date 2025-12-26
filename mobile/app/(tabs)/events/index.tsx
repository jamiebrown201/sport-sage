import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { EVENTS, SPORTS } from '@/lib/mock-data';
import { useFriends } from '@/lib/store';
import { EventCard } from '@/components/EventCard';
import {
  CalendarIcon,
  FootballIcon,
  TennisIcon,
  DartsIcon,
  CricketIcon,
  BasketballIcon,
  GolfIcon,
  BoxingIcon,
  MMAIcon,
  TargetIcon,
  SearchIcon,
  CloseIcon,
  UsersIcon,
} from '@/components/icons';
import { LiveIndicator } from '@/components/LiveIndicator';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';
import { Badge } from '@/components/ui';

// Map sport slugs to icon components
function getSportIcon(slug: string | null, size: number, color: string): React.ReactElement {
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
      return <CalendarIcon size={size} color={color} />;
  }
}

export default function EventsScreen(): React.ReactElement {
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const { friendPredictions, getFriendPredictionsForEvent } = useFriends();

  // Count friends betting per event
  const friendCountByEvent = useMemo(() => {
    const counts: Record<string, number> = {};
    friendPredictions.forEach(fp => {
      counts[fp.eventId] = (counts[fp.eventId] || 0) + 1;
    });
    return counts;
  }, [friendPredictions]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let events = EVENTS;

    // Filter by sport
    if (selectedSport) {
      events = events.filter((e) => e.sport.slug === selectedSport);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      events = events.filter((e) => {
        const teams = [e.homeTeam, e.awayTeam, e.player1, e.player2]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const competition = e.competition.toLowerCase();
        return teams.includes(query) || competition.includes(query);
      });
    }

    return events;
  }, [selectedSport, searchQuery]);

  // Group events by date
  const today = new Date().toDateString();
  const todayEvents = filteredEvents.filter(
    (e) => new Date(e.startTime).toDateString() === today
  );
  const futureEvents = filteredEvents.filter(
    (e) => new Date(e.startTime).toDateString() !== today
  );

  // Live events
  const liveEvents = filteredEvents.filter((e) => e.status === 'live');

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      {showSearch ? (
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 200 }}
          style={styles.searchContainer}
        >
          <SearchIcon size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search teams, players, competitions..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <Pressable onPress={() => {
            setShowSearch(false);
            setSearchQuery('');
          }}>
            <CloseIcon size={20} color={colors.textMuted} />
          </Pressable>
        </MotiView>
      ) : (
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Events</Text>
          <Pressable onPress={() => setShowSearch(true)} style={styles.searchButton}>
            <SearchIcon size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Sport Filter */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          <SportFilterChip
            label="All"
            sportSlug={null}
            selected={selectedSport === null}
            onPress={() => setSelectedSport(null)}
            count={EVENTS.length}
          />
          {SPORTS.map((sport) => {
            const count = EVENTS.filter(e => e.sport.slug === sport.slug).length;
            return (
              <SportFilterChip
                key={sport.id}
                label={sport.name}
                sportSlug={sport.slug}
                selected={selectedSport === sport.slug}
                onPress={() => setSelectedSport(sport.slug)}
                count={count}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* Events List */}
      <ScrollView
        style={styles.eventsList}
        contentContainerStyle={styles.eventsContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Live Events */}
        {liveEvents.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}
          >
            <View style={styles.sectionHeader}>
              <LiveIndicator size="md" showText={false} />
              <Text style={[styles.sectionTitle, styles.liveTitle]}>Live Now</Text>
            </View>
            {liveEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/(tabs)/events/${event.id}`)}
                friendCount={friendCountByEvent[event.id]}
              />
            ))}
          </MotiView>
        )}

        {/* Today's Events */}
        {todayEvents.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: liveEvents.length > 0 ? 50 : 0 }}
          >
            <Text style={styles.sectionTitle}>Today</Text>
            {todayEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/(tabs)/events/${event.id}`)}
                friendCount={friendCountByEvent[event.id]}
              />
            ))}
          </MotiView>
        )}

        {/* Upcoming Events */}
        {futureEvents.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 100 }}
          >
            <Text style={styles.sectionTitle}>Upcoming</Text>
            {futureEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/(tabs)/events/${event.id}`)}
                friendCount={friendCountByEvent[event.id]}
              />
            ))}
          </MotiView>
        )}

        {/* Empty State */}
        {filteredEvents.length === 0 && (
          <View style={styles.emptyState}>
            <TargetIcon size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No events found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Try selecting a different sport'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

interface SportFilterChipProps {
  label: string;
  sportSlug: string | null;
  selected: boolean;
  onPress: () => void;
  count: number;
}

function SportFilterChip({
  label,
  sportSlug,
  selected,
  onPress,
  count,
}: SportFilterChipProps): React.ReactElement {
  const iconColor = selected ? colors.background : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, selected && styles.filterChipSelected]}
    >
      {getSportIcon(sportSlug, 16, iconColor)}
      <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>
        {label}
      </Text>
      <View style={[styles.filterCount, selected && styles.filterCountSelected]}>
        <Text style={[styles.filterCountText, selected && styles.filterCountTextSelected]}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: layout.fontSize.xl,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  searchButton: {
    padding: layout.spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: layout.fontSize.md,
    color: colors.textPrimary,
    paddingVertical: layout.spacing.xs,
  },
  filterWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterContainer: {
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
    backgroundColor: colors.card,
    paddingVertical: layout.spacing.sm,
    paddingHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadius.full,
    marginRight: layout.spacing.sm,
    height: 36,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
  },
  filterLabel: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: layout.fontWeight.medium,
  },
  filterLabelSelected: {
    color: colors.background,
  },
  filterCount: {
    backgroundColor: colors.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: layout.borderRadius.sm,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterCountText: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    fontWeight: layout.fontWeight.bold,
  },
  filterCountTextSelected: {
    color: colors.background,
  },
  eventsList: {
    flex: 1,
  },
  eventsContent: {
    padding: layout.spacing.md,
    paddingBottom: layout.spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
    marginBottom: layout.spacing.md,
    marginTop: layout.spacing.md,
  },
  sectionTitle: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: layout.spacing.md,
    marginTop: layout.spacing.md,
  },
  liveTitle: {
    color: colors.error,
    marginBottom: 0,
    marginTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: layout.spacing.xxl,
    gap: layout.spacing.md,
  },
  emptyText: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  emptySubtext: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
});
