import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { usePredictions } from '@/lib/store';
import { PredictionCard } from '@/components/PredictionCard';
import { TargetIcon, PendingIcon, WonIcon, LostIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

type FilterType = 'all' | 'pending' | 'won' | 'lost';

export default function PredictionsScreen(): React.ReactElement {
  const [filter, setFilter] = useState<FilterType>('all');
  const { predictions } = usePredictions();

  const filteredPredictions = predictions.filter((p) => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const pendingCount = predictions.filter((p) => p.status === 'pending').length;
  const wonCount = predictions.filter((p) => p.status === 'won').length;
  const lostCount = predictions.filter((p) => p.status === 'lost').length;

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <FilterTab
          label="All"
          count={predictions.length}
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

      {/* Predictions List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filteredPredictions.length > 0 ? (
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
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              {filter === 'pending' ? (
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
                ? 'No predictions yet'
                : `No ${filter} predictions`}
            </Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all'
                ? 'Place your first prediction to get started!'
                : `Your ${filter} predictions will appear here`}
            </Text>
          </View>
        )}
      </ScrollView>
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
