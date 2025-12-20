import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { Accumulator } from '@/types';
import { Card, Badge } from '@/components/ui';
import {
  LayersIcon,
  CoinIcon,
  StarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  CloseIcon,
  PendingIcon,
} from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

interface AccumulatorCardProps {
  accumulator: Accumulator;
}

export function AccumulatorCard({ accumulator }: AccumulatorCardProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    placed: { color: colors.warning, label: 'Pending', Icon: PendingIcon },
    won: { color: colors.success, label: 'Won', Icon: CheckIcon },
    lost: { color: colors.error, label: 'Lost', Icon: CloseIcon },
    partial: { color: colors.warning, label: 'Partial', Icon: PendingIcon },
    void: { color: colors.textMuted, label: 'Void', Icon: CloseIcon },
    building: { color: colors.primary, label: 'Building', Icon: LayersIcon },
  };

  const status = statusConfig[accumulator.status];
  const selectionCount = accumulator.selections.length;

  const placedDate = accumulator.placedAt
    ? new Date(accumulator.placedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <Card style={styles.card}>
      {/* Header */}
      <Pressable onPress={() => setIsExpanded(!isExpanded)} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusIcon, { backgroundColor: `${status.color}20` }]}>
            <status.Icon size={16} color={status.color} />
          </View>
          <View>
            <View style={styles.titleRow}>
              <LayersIcon size={16} color={colors.textSecondary} />
              <Text style={styles.title}>{selectionCount}-Fold Accumulator</Text>
            </View>
            <Text style={styles.date}>{placedDate}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Badge text={status.label} variant={
            accumulator.status === 'won' ? 'success' :
            accumulator.status === 'lost' ? 'error' :
            accumulator.status === 'placed' ? 'warning' : 'default'
          } size="sm" />
          {isExpanded ? (
            <ChevronUpIcon size={20} color={colors.textMuted} />
          ) : (
            <ChevronDownIcon size={20} color={colors.textMuted} />
          )}
        </View>
      </Pressable>

      {/* Odds and stake summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Stake</Text>
          <View style={styles.summaryValue}>
            <CoinIcon size={14} color={colors.coins} />
            <Text style={styles.summaryAmount}>{accumulator.stake}</Text>
          </View>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Odds</Text>
          <Text style={styles.oddsValue}>{accumulator.totalOdds.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>
            {accumulator.status === 'won' ? 'Won' : 'Potential'}
          </Text>
          <View style={styles.summaryValue}>
            <CoinIcon size={14} color={accumulator.status === 'won' ? colors.success : colors.coins} />
            <Text style={[
              styles.summaryAmount,
              accumulator.status === 'won' && { color: colors.success }
            ]}>
              {accumulator.potentialCoins.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Expanded selections */}
      {isExpanded && (
        <MotiView
          from={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ type: 'timing', duration: 200 }}
        >
          <View style={styles.selectionsContainer}>
            {accumulator.selections.map((selection, index) => (
              <View key={selection.id} style={styles.selectionRow}>
                <View style={styles.selectionNumber}>
                  <Text style={styles.selectionNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.selectionInfo}>
                  <Text style={styles.selectionEvent} numberOfLines={1}>
                    {selection.event.homeTeam ?? selection.event.player1} vs{' '}
                    {selection.event.awayTeam ?? selection.event.player2}
                  </Text>
                  <View style={styles.selectionDetails}>
                    <Text style={styles.selectionOutcome}>{selection.outcome.name}</Text>
                    <Text style={styles.selectionOdds}>@ {selection.odds.toFixed(2)}</Text>
                  </View>
                </View>
                <View style={[
                  styles.selectionStatus,
                  { backgroundColor: getSelectionStatusColor(selection.status) + '20' }
                ]}>
                  {getSelectionStatusIcon(selection.status)}
                </View>
              </View>
            ))}
          </View>

          {/* Stars earned (if won) */}
          {accumulator.status === 'won' && (
            <View style={styles.starsEarned}>
              <StarIcon size={16} color={colors.stars} />
              <Text style={styles.starsText}>
                +{accumulator.potentialStars} stars earned
              </Text>
            </View>
          )}
        </MotiView>
      )}
    </Card>
  );
}

function getSelectionStatusColor(status: 'pending' | 'won' | 'lost' | 'void'): string {
  switch (status) {
    case 'won': return colors.success;
    case 'lost': return colors.error;
    case 'void': return colors.textMuted;
    default: return colors.warning;
  }
}

function getSelectionStatusIcon(status: 'pending' | 'won' | 'lost' | 'void'): React.ReactElement {
  const color = getSelectionStatusColor(status);
  switch (status) {
    case 'won': return <CheckIcon size={14} color={color} />;
    case 'lost': return <CloseIcon size={14} color={color} />;
    case 'void': return <CloseIcon size={14} color={color} />;
    default: return <PendingIcon size={14} color={color} />;
  }
}

const styles = StyleSheet.create({
  card: {
    marginBottom: layout.spacing.md,
    padding: layout.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
  },
  title: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  date: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: layout.borderRadius.md,
    padding: layout.spacing.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    marginBottom: 4,
  },
  summaryValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryAmount: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  oddsValue: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
    color: colors.primary,
  },
  selectionsContainer: {
    marginTop: layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: layout.spacing.md,
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: layout.spacing.sm,
  },
  selectionNumberText: {
    fontSize: layout.fontSize.xs,
    fontWeight: layout.fontWeight.bold,
    color: colors.textSecondary,
  },
  selectionInfo: {
    flex: 1,
  },
  selectionEvent: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  selectionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  selectionOutcome: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.medium,
    color: colors.textPrimary,
  },
  selectionOdds: {
    fontSize: layout.fontSize.sm,
    color: colors.primary,
  },
  selectionStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: layout.spacing.sm,
  },
  starsEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.spacing.xs,
    marginTop: layout.spacing.md,
    paddingTop: layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  starsText: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.semibold,
    color: colors.stars,
  },
});
