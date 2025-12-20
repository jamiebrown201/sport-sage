import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { usePredictions, useAccumulator } from '@/lib/store';
import { PredictionCard } from '@/components/PredictionCard';
import { AccumulatorCard } from '@/components/AccumulatorCard';
import { TargetIcon, PendingIcon, WonIcon, LostIcon, LayersIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

type ViewType = 'singles' | 'accumulators';
type FilterType = 'all' | 'pending' | 'won' | 'lost';

export default function PredictionsScreen(): React.ReactElement {
  const [viewType, setViewType] = useState<ViewType>('singles');
  const [filter, setFilter] = useState<FilterType>('all');
  const { predictions } = usePredictions();
  const { accumulators } = useAccumulator();

  const filteredPredictions = predictions.filter((p) => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const filteredAccumulators = accumulators.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return a.status === 'placed';
    return a.status === filter;
  });

  const pendingCount = viewType === 'singles'
    ? predictions.filter((p) => p.status === 'pending').length
    : accumulators.filter((a) => a.status === 'placed').length;

  const wonCount = viewType === 'singles'
    ? predictions.filter((p) => p.status === 'won').length
    : accumulators.filter((a) => a.status === 'won').length;

  const lostCount = viewType === 'singles'
    ? predictions.filter((p) => p.status === 'lost').length
    : accumulators.filter((a) => a.status === 'lost').length;

  const totalCount = viewType === 'singles' ? predictions.length : accumulators.length;

  return (
    <View style={styles.container}>
      {/* View Type Toggle */}
      <View style={styles.viewToggle}>
        <Pressable
          onPress={() => setViewType('singles')}
          style={[styles.toggleButton, viewType === 'singles' && styles.toggleButtonActive]}
        >
          <TargetIcon size={18} color={viewType === 'singles' ? colors.primary : colors.textMuted} />
          <Text style={[styles.toggleText, viewType === 'singles' && styles.toggleTextActive]}>
            Singles
          </Text>
          <View style={[styles.toggleBadge, viewType === 'singles' && styles.toggleBadgeActive]}>
            <Text style={[styles.toggleBadgeText, viewType === 'singles' && styles.toggleBadgeTextActive]}>
              {predictions.length}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => setViewType('accumulators')}
          style={[styles.toggleButton, viewType === 'accumulators' && styles.toggleButtonActive]}
        >
          <LayersIcon size={18} color={viewType === 'accumulators' ? colors.primary : colors.textMuted} />
          <Text style={[styles.toggleText, viewType === 'accumulators' && styles.toggleTextActive]}>
            Accas
          </Text>
          <View style={[styles.toggleBadge, viewType === 'accumulators' && styles.toggleBadgeActive]}>
            <Text style={[styles.toggleBadgeText, viewType === 'accumulators' && styles.toggleBadgeTextActive]}>
              {accumulators.length}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <FilterTab
          label="All"
          count={totalCount}
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <FilterTab
          label="Pending"
          count={pendingCount}
          selected={filter === 'pending'}
          onPress={() => setFilter('pending')}
          color={colors.warning}
        />
        <FilterTab
          label="Won"
          count={wonCount}
          selected={filter === 'won'}
          onPress={() => setFilter('won')}
          color={colors.success}
        />
        <FilterTab
          label="Lost"
          count={lostCount}
          selected={filter === 'lost'}
          onPress={() => setFilter('lost')}
          color={colors.error}
        />
      </View>

      {/* Content List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {viewType === 'singles' ? (
          // Singles view
          filteredPredictions.length > 0 ? (
            filteredPredictions.map((prediction, index) => (
              <MotiView
                key={prediction.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: index * 50 }}
              >
                <PredictionCard prediction={prediction} />
              </MotiView>
            ))
          ) : (
            <EmptyState filter={filter} type="singles" />
          )
        ) : (
          // Accumulators view
          filteredAccumulators.length > 0 ? (
            filteredAccumulators.map((accumulator, index) => (
              <MotiView
                key={accumulator.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: index * 50 }}
              >
                <AccumulatorCard accumulator={accumulator} />
              </MotiView>
            ))
          ) : (
            <EmptyState filter={filter} type="accumulators" />
          )
        )}
      </ScrollView>
    </View>
  );
}

interface EmptyStateProps {
  filter: FilterType;
  type: ViewType;
}

function EmptyState({ filter, type }: EmptyStateProps): React.ReactElement {
  const typeLabel = type === 'singles' ? 'predictions' : 'accumulators';

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        {type === 'accumulators' ? (
          <LayersIcon size={48} color={colors.textMuted} />
        ) : filter === 'pending' ? (
          <PendingIcon size={48} color={colors.warning} />
        ) : filter === 'won' ? (
          <WonIcon size={48} color={colors.success} />
        ) : filter === 'lost' ? (
          <LostIcon size={48} color={colors.error} />
        ) : (
          <TargetIcon size={48} color={colors.textMuted} />
        )}
      </View>
      <Text style={styles.emptyText}>
        {filter === 'all'
          ? `No ${typeLabel} yet`
          : `No ${filter} ${typeLabel}`}
      </Text>
      <Text style={styles.emptySubtext}>
        {type === 'accumulators'
          ? 'Build an accumulator by adding multiple selections'
          : filter === 'all'
          ? 'Place your first prediction to get started!'
          : `Your ${filter} ${typeLabel} will appear here`}
      </Text>
    </View>
  );
}

interface FilterTabProps {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
  color?: string;
}

function FilterTab({
  label,
  count,
  selected,
  onPress,
  color,
}: FilterTabProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterTab, selected && styles.filterTabSelected]}
    >
      <Text
        style={[
          styles.filterLabel,
          selected && styles.filterLabelSelected,
          color && selected && { color },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.countBadge,
          selected && styles.countBadgeSelected,
          color && selected && { backgroundColor: `${color}20` },
        ]}
      >
        <Text
          style={[
            styles.countText,
            selected && styles.countTextSelected,
            color && selected && { color },
          ]}
        >
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
  viewToggle: {
    flexDirection: 'row',
    paddingHorizontal: layout.spacing.md,
    paddingTop: layout.spacing.md,
    gap: layout.spacing.sm,
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.md,
    gap: layout.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.spacing.xs,
    paddingVertical: layout.spacing.sm,
    paddingHorizontal: layout.spacing.sm,
    borderRadius: layout.borderRadius.md,
    backgroundColor: colors.card,
  },
  filterTabSelected: {
    backgroundColor: colors.primaryDim,
  },
  filterLabel: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: layout.fontWeight.medium,
  },
  filterLabelSelected: {
    color: colors.primary,
  },
  countBadge: {
    backgroundColor: colors.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: layout.borderRadius.sm,
  },
  countBadgeSelected: {
    backgroundColor: colors.primaryDim,
  },
  countText: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    fontWeight: layout.fontWeight.semibold,
  },
  countTextSelected: {
    color: colors.primary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: layout.spacing.md,
    paddingBottom: layout.spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: layout.spacing.xxl,
    gap: layout.spacing.md,
  },
  emptyIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
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
