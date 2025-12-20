import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAccumulator, useAuth } from '@/lib/store';
import { Card, Button, Badge } from '@/components/ui';
import {
  CloseIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CoinIcon,
  StarIcon,
  TrashIcon,
  LayersIcon,
} from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';
import { ACCUMULATOR_LIMITS } from '@/types';

interface AccumulatorSlipProps {
  onPlaced?: () => void;
}

export function AccumulatorSlip({ onPlaced }: AccumulatorSlipProps): React.ReactElement | null {
  const {
    currentSelections,
    removeSelection,
    clearSelections,
    totalOdds,
    bonusMultiplier,
    canPlace,
    placeAccumulator,
  } = useAccumulator();
  const { user } = useAuth();

  const [isExpanded, setIsExpanded] = useState(false);
  const [stake, setStake] = useState('50');

  if (currentSelections.length === 0) {
    return null;
  }

  const stakeNum = parseInt(stake, 10) || 0;
  const potentialReturn = Math.floor(stakeNum * totalOdds * bonusMultiplier);
  const potentialProfit = potentialReturn - stakeNum;
  const canAfford = (user?.coins ?? 0) >= stakeNum;
  const isValidStake = stakeNum >= ACCUMULATOR_LIMITS.minStake && stakeNum <= ACCUMULATOR_LIMITS.maxStake;

  const handlePlaceBet = (): void => {
    if (!canPlace || !isValidStake || !canAfford) {
      if (!canAfford) {
        Alert.alert('Insufficient Coins', 'You don\'t have enough coins for this stake.');
      } else if (!isValidStake) {
        Alert.alert('Invalid Stake', `Stake must be between ${ACCUMULATOR_LIMITS.minStake} and ${ACCUMULATOR_LIMITS.maxStake} coins.`);
      }
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const result = placeAccumulator(stakeNum);
    if (result) {
      Alert.alert(
        'Accumulator Placed!',
        `Your ${currentSelections.length}-fold acca is in!\n\nStake: ${stakeNum} coins\nPotential return: ${potentialReturn} coins`,
        [{ text: 'Good luck!' }]
      );
      onPlaced?.();
    }
  };

  const handleRemoveSelection = (eventId: string): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeSelection(eventId);
  };

  const handleClearAll = (): void => {
    Alert.alert(
      'Clear Accumulator',
      'Remove all selections?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            clearSelections();
          },
        },
      ]
    );
  };

  const toggleExpanded = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  const bonusPercentage = Math.round((bonusMultiplier - 1) * 100);

  return (
    <MotiView
      from={{ translateY: 100, opacity: 0 }}
      animate={{ translateY: 0, opacity: 1 }}
      exit={{ translateY: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 20 }}
      style={styles.container}
    >
      <Card style={styles.card}>
        {/* Header - always visible */}
        <Pressable onPress={toggleExpanded} style={styles.header}>
          <View style={styles.headerLeft}>
            <LayersIcon size={20} color={colors.primary} />
            <Text style={styles.headerTitle}>
              {currentSelections.length}-Fold Acca
            </Text>
            {bonusPercentage > 0 && (
              <Badge text={`+${bonusPercentage}%`} variant="success" size="sm" />
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.oddsText}>{totalOdds.toFixed(2)}</Text>
            {isExpanded ? (
              <ChevronDownIcon size={20} color={colors.textSecondary} />
            ) : (
              <ChevronUpIcon size={20} color={colors.textSecondary} />
            )}
          </View>
        </Pressable>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <MotiView
              from={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'timing', duration: 200 }}
            >
              {/* Selections list */}
              <ScrollView style={styles.selectionsList} nestedScrollEnabled>
                {currentSelections.map((selection, index) => (
                  <View key={selection.id} style={styles.selectionItem}>
                    <View style={styles.selectionInfo}>
                      <Text style={styles.selectionEvent} numberOfLines={1}>
                        {selection.event.homeTeam ?? selection.event.player1} vs{' '}
                        {selection.event.awayTeam ?? selection.event.player2}
                      </Text>
                      <View style={styles.selectionDetails}>
                        <Text style={styles.selectionOutcome}>
                          {selection.outcome.name}
                        </Text>
                        <Text style={styles.selectionOdds}>
                          @ {selection.odds.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => handleRemoveSelection(selection.eventId)}
                      style={styles.removeButton}
                      hitSlop={8}
                    >
                      <CloseIcon size={16} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>

              {/* Clear all button */}
              <Pressable onPress={handleClearAll} style={styles.clearButton}>
                <TrashIcon size={14} color={colors.textMuted} />
                <Text style={styles.clearText}>Clear all</Text>
              </Pressable>

              {/* Stake input */}
              <View style={styles.stakeSection}>
                <Text style={styles.stakeLabel}>Stake</Text>
                <View style={styles.stakeInputContainer}>
                  <CoinIcon size={16} color={colors.coins} />
                  <TextInput
                    style={styles.stakeInput}
                    value={stake}
                    onChangeText={setStake}
                    keyboardType="number-pad"
                    placeholder="50"
                    placeholderTextColor={colors.textMuted}
                    maxLength={4}
                  />
                </View>
              </View>

              {/* Quick stake buttons */}
              <View style={styles.quickStakes}>
                {[25, 50, 100, 200].map((amount) => (
                  <Pressable
                    key={amount}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setStake(amount.toString());
                    }}
                    style={[
                      styles.quickStakeButton,
                      stake === amount.toString() && styles.quickStakeButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickStakeText,
                        stake === amount.toString() && styles.quickStakeTextActive,
                      ]}
                    >
                      {amount}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Returns */}
              <View style={styles.returnsSection}>
                <View style={styles.returnRow}>
                  <Text style={styles.returnLabel}>Potential Return</Text>
                  <View style={styles.returnValue}>
                    <CoinIcon size={14} color={colors.coins} />
                    <Text style={styles.returnAmount}>
                      {potentialReturn.toLocaleString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.returnRow}>
                  <Text style={styles.returnLabel}>Profit</Text>
                  <Text style={styles.profitAmount}>
                    +{potentialProfit.toLocaleString()}
                  </Text>
                </View>
              </View>
            </MotiView>
          )}
        </AnimatePresence>

        {/* Place bet button - always visible */}
        <Button
          title={isExpanded ? 'Place Accumulator' : `Place ${currentSelections.length}-Fold @ ${totalOdds.toFixed(2)}`}
          onPress={handlePlaceBet}
          disabled={!canPlace || !isValidStake || !canAfford}
          style={styles.placeButton}
        />
      </Card>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: layout.spacing.md,
    right: layout.spacing.md,
    zIndex: 100,
  },
  card: {
    padding: layout.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
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
  headerTitle: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
  },
  oddsText: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.primary,
  },
  selectionsList: {
    maxHeight: 150,
    marginBottom: layout.spacing.sm,
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  selectionOdds: {
    fontSize: layout.fontSize.sm,
    color: colors.primary,
    fontWeight: layout.fontWeight.medium,
  },
  removeButton: {
    padding: layout.spacing.xs,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.spacing.xs,
    paddingVertical: layout.spacing.xs,
    marginBottom: layout.spacing.sm,
  },
  clearText: {
    fontSize: layout.fontSize.sm,
    color: colors.textMuted,
  },
  stakeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: layout.spacing.sm,
  },
  stakeLabel: {
    fontSize: layout.fontSize.md,
    color: colors.textSecondary,
  },
  stakeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
    backgroundColor: colors.background,
    borderRadius: layout.borderRadius.md,
    paddingHorizontal: layout.spacing.sm,
    paddingVertical: layout.spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stakeInput: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    minWidth: 60,
    textAlign: 'right',
  },
  quickStakes: {
    flexDirection: 'row',
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.md,
  },
  quickStakeButton: {
    flex: 1,
    paddingVertical: layout.spacing.xs,
    borderRadius: layout.borderRadius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickStakeButtonActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  quickStakeText: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: layout.fontWeight.medium,
  },
  quickStakeTextActive: {
    color: colors.primary,
  },
  returnsSection: {
    backgroundColor: colors.background,
    borderRadius: layout.borderRadius.md,
    padding: layout.spacing.sm,
    marginBottom: layout.spacing.sm,
  },
  returnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  returnLabel: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  returnValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  returnAmount: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  profitAmount: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.success,
  },
  placeButton: {
    marginTop: layout.spacing.xs,
  },
});
