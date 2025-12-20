import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { getEventById, getEventTitle } from '@/lib/mock-data';
import { useAuth, useWallet, usePredictions, useAccumulator } from '@/lib/store';
import { Outcome, Prediction, Event, ACCUMULATOR_LIMITS } from '@/types';
import { Card, Badge, Button } from '@/components/ui';
import { PredictionSlip } from '@/components/PredictionSlip';
import { AccumulatorSlip } from '@/components/AccumulatorSlip';
import {
  FootballIcon,
  TennisIcon,
  DartsIcon,
  CricketIcon,
  BasketballIcon,
  GolfIcon,
  BoxingIcon,
  MMAIcon,
  CoinIcon,
  AlertIcon,
  StarIcon,
  CheckIcon,
  LayersIcon,
  PlusIcon,
} from '@/components/icons';
import { colors, getOddsColor } from '@/constants/colors';
import { layout } from '@/constants/layout';

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

export default function EventDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = id ? getEventById(id) : undefined;
  const { user, updateUser, updateStats, stats } = useAuth();
  const { addPrediction } = usePredictions();
  const {
    addSelection,
    removeSelection,
    hasSelection,
    getSelectedOutcome,
    currentSelections,
  } = useAccumulator();

  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);

  const handleSelectOutcome = (outcome: Outcome): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOutcome(outcome);
  };

  const handleAddToAcca = (outcome: Outcome): void => {
    if (!event) return;

    // Check if we already have a selection from this event
    if (hasSelection(event.id)) {
      // If same outcome, remove it
      const currentOutcome = getSelectedOutcome(event.id);
      if (currentOutcome?.id === outcome.id) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        removeSelection(event.id);
        return;
      }
      // Otherwise, swap the selection
      removeSelection(event.id);
    }

    // Check if we're at max selections
    if (currentSelections.length >= ACCUMULATOR_LIMITS.maxSelections) {
      Alert.alert(
        'Maximum Selections',
        `You can only add ${ACCUMULATOR_LIMITS.maxSelections} events to an accumulator.`
      );
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addSelection(event, outcome);
  };

  const handlePlacePrediction = useCallback(async (stake: number): Promise<void> => {
    if (!event || !selectedOutcome || !user || !stats) return;

    setIsPlacing(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    const potentialCoins = Math.floor(stake * selectedOutcome.odds);
    const potentialStars = Math.floor(potentialCoins - stake);

    // Create prediction
    const prediction: Prediction = {
      id: `pred_${Date.now()}`,
      eventId: event.id,
      event,
      outcomeId: selectedOutcome.id,
      outcome: selectedOutcome,
      stake,
      potentialCoins,
      potentialStars,
      starsMultiplier: stats.hasPredictionBoost ? 1.2 : 1.0,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // Deduct coins
    updateUser({ coins: user.coins - stake });
    updateStats({
      totalPredictions: stats.totalPredictions + 1,
      totalCoinsWagered: stats.totalCoinsWagered + stake,
      hasPredictionBoost: false, // Clear the boost after use
    });

    // Add prediction
    addPrediction(prediction);

    setIsPlacing(false);
    setSelectedOutcome(null);

    // Show success and navigate
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [event, selectedOutcome, user, stats, updateUser, updateStats, addPrediction]);

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorState}>
          <AlertIcon size={48} color={colors.textMuted} />
          <Text style={styles.errorText}>Event not found</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const title = getEventTitle(event);
  const startTime = new Date(event.startTime);
  const isToday = startTime.toDateString() === new Date().toDateString();
  const dateString = isToday
    ? `Today at ${startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : startTime.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });

  const market = event.markets[0];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Event Header */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
        >
          <View style={styles.header}>
            <View style={styles.sportBadge}>
              <View style={styles.sportIconContainer}>
                {getSportIcon(event.sport.slug, 24, colors.textSecondary)}
              </View>
              <Text style={styles.competition}>{event.competition}</Text>
            </View>
            <Text style={styles.date}>{dateString}</Text>
          </View>

          <Text style={styles.title}>{title}</Text>

          {event.sponsoredEvent && (
            <Badge
              text={`${event.sponsoredEvent.title}`}
              variant="info"
              style={styles.sponsorBadge}
            />
          )}
        </MotiView>

        {/* Market */}
        {market && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 100 }}
          >
            <Text style={styles.sectionTitle}>Make Your Prediction</Text>
            <View style={styles.outcomesGrid}>
              {market.outcomes.map((outcome) => {
                const accaOutcome = event ? getSelectedOutcome(event.id) : null;
                const isInAcca = accaOutcome?.id === outcome.id;

                return (
                  <OutcomeCard
                    key={outcome.id}
                    outcome={outcome}
                    selected={selectedOutcome?.id === outcome.id}
                    isInAcca={isInAcca}
                    onSelect={() => handleSelectOutcome(outcome)}
                    onAddToAcca={() => handleAddToAcca(outcome)}
                  />
                );
              })}
            </View>
          </MotiView>
        )}

        {/* Your Balance */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300, delay: 200 }}
        >
          <Card style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceValue}>{user?.coins ?? 0}</Text>
              <CoinIcon size={24} color={colors.coins} />
            </View>
          </Card>
        </MotiView>
      </ScrollView>

      {/* Prediction Slip */}
      {selectedOutcome && (
        <View style={styles.slipContainer}>
          <PredictionSlip
            outcome={selectedOutcome}
            userCoins={user?.coins ?? 0}
            onPlacePrediction={handlePlacePrediction}
            onCancel={() => setSelectedOutcome(null)}
            isLoading={isPlacing}
          />
        </View>
      )}

      {/* Accumulator Slip - only show when not placing single prediction */}
      {!selectedOutcome && <AccumulatorSlip />}
    </SafeAreaView>
  );
}

interface OutcomeCardProps {
  outcome: Outcome;
  selected: boolean;
  isInAcca: boolean;
  onSelect: () => void;
  onAddToAcca: () => void;
}

function OutcomeCard({ outcome, selected, isInAcca, onSelect, onAddToAcca }: OutcomeCardProps): React.ReactElement {
  const oddsColor = getOddsColor(outcome.odds);

  return (
    <View style={styles.outcomeWrapper}>
      <Pressable
        onPress={onSelect}
        style={[
          styles.outcomeCard,
          selected && styles.outcomeCardSelected,
          isInAcca && styles.outcomeCardInAcca,
        ]}
      >
        <View style={styles.outcomeContent}>
          <Text style={styles.outcomeName} numberOfLines={2}>
            {outcome.name}
          </Text>
          <Text style={[styles.outcomeOdds, { color: oddsColor }]}>
            {outcome.odds.toFixed(2)}
          </Text>
        </View>

        {selected && (
          <MotiView
            from={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            style={styles.selectedCheck}
          >
            <CheckIcon size={14} color={colors.background} />
          </MotiView>
        )}

        {isInAcca && !selected && (
          <MotiView
            from={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            style={styles.accaCheck}
          >
            <LayersIcon size={14} color={colors.background} />
          </MotiView>
        )}
      </Pressable>

      {/* Add to Acca button */}
      <Pressable
        onPress={onAddToAcca}
        style={[styles.accaButton, isInAcca && styles.accaButtonActive]}
      >
        {isInAcca ? (
          <CheckIcon size={16} color={colors.primary} />
        ) : (
          <PlusIcon size={16} color={colors.textSecondary} />
        )}
        <Text style={[styles.accaButtonText, isInAcca && styles.accaButtonTextActive]}>
          {isInAcca ? 'In Acca' : 'Acca'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: layout.spacing.md,
    paddingBottom: layout.spacing.xxl,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.spacing.md,
  },
  errorText: {
    fontSize: layout.fontSize.lg,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.md,
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
    fontSize: layout.fontSize.md,
    color: colors.textSecondary,
  },
  date: {
    fontSize: layout.fontSize.sm,
    color: colors.textMuted,
  },
  title: {
    fontSize: layout.fontSize.xxl,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: layout.spacing.md,
  },
  sponsorBadge: {
    marginBottom: layout.spacing.lg,
  },
  sectionTitle: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: layout.spacing.md,
  },
  outcomesGrid: {
    gap: layout.spacing.md,
    marginBottom: layout.spacing.lg,
  },
  outcomeWrapper: {
    flexDirection: 'row',
    gap: layout.spacing.sm,
  },
  outcomeCard: {
    flex: 1,
    backgroundColor: colors.card,
    padding: layout.spacing.lg,
    borderRadius: layout.borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  outcomeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  outcomeCardInAcca: {
    borderColor: colors.success,
    backgroundColor: `${colors.success}15`,
  },
  outcomeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outcomeName: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  outcomeOdds: {
    fontSize: layout.fontSize.xl,
    fontWeight: layout.fontWeight.bold,
    fontVariant: ['tabular-nums'],
    marginLeft: layout.spacing.md,
  },
  selectedCheck: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accaCheck: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accaButton: {
    width: 60,
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accaButtonActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  accaButtonText: {
    fontSize: layout.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: layout.fontWeight.medium,
  },
  accaButtonTextActive: {
    color: colors.primary,
  },
  balanceCard: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: layout.fontSize.sm,
    color: colors.textMuted,
    marginBottom: layout.spacing.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  balanceValue: {
    fontSize: layout.fontSize.xxl,
    fontWeight: layout.fontWeight.bold,
    color: colors.coins,
  },
  slipContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
