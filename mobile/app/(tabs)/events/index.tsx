import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { EVENTS, SPORTS } from '@/lib/mock-data';
import { EventCard } from '@/components/EventCard';
import { CalendarIcon, FootballIcon, TennisIcon, DartsIcon, CricketIcon, TargetIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

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
    default:
      return <CalendarIcon size={size} color={color} />;
  }
}

export default function EventsScreen(): React.ReactElement {
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const filteredEvents = selectedSport
    ? EVENTS.filter((e) => e.sport.slug === selectedSport)
    : EVENTS;

  // Group events by date
  const today = new Date().toDateString();
  const todayEvents = filteredEvents.filter(
    (e) => new Date(e.startTime).toDateString() === today
  );
  const futureEvents = filteredEvents.filter(
    (e) => new Date(e.startTime).toDateString() !== today
  );

  return (
    <View style={styles.container}>
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
          />
          {SPORTS.map((sport) => (
            <SportFilterChip
              key={sport.id}
              label={sport.name}
              sportSlug={sport.slug}
              selected={selectedSport === sport.slug}
              onPress={() => setSelectedSport(sport.slug)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Events List */}
      <ScrollView style={styles.eventsList} contentContainerStyle={styles.eventsContent}>
        {todayEvents.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}
          >
            <Text style={styles.sectionTitle}>Today</Text>
            {todayEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/(tabs)/events/${event.id}`)}
              />
            ))}
          </MotiView>
        )}

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
              />
            ))}
          </MotiView>
        )}

        {filteredEvents.length === 0 && (
          <View style={styles.emptyState}>
            <TargetIcon size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No events found</Text>
            <Text style={styles.emptySubtext}>
              Try selecting a different sport
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
}

function SportFilterChip({
  label,
  sportSlug,
  selected,
  onPress,
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  eventsList: {
    flex: 1,
  },
  eventsContent: {
    padding: layout.spacing.md,
    paddingBottom: layout.spacing.xxl,
  },
  sectionTitle: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: layout.spacing.md,
    marginTop: layout.spacing.md,
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
