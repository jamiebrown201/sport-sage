import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Outcome } from '@/types';
import { Button, Card } from '@/components/ui';
import { CoinIcon, StarIcon, CloseIcon } from '@/components/icons';
import { colors, getOddsColor } from '@/constants/colors';
import { layout } from '@/constants/layout';

const QUICK_STAKES = [50, 100, 200, 500];

interface PredictionSlipProps {
  outcome: Outcome;
  userCoins: number;
  onPlacePrediction: (stake: number) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PredictionSlip({
  outcome,
  userCoins,
  onPlacePrediction,
  onCancel,
  isLoading = false,
}: PredictionSlipProps): React.ReactElement {
  const [stake, setStake] = useState(100);
  const [customStake, setCustomStake] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const potentialCoins = useMemo(() => Math.floor(stake * outcome.odds), [stake, outcome.odds]);
  const potentialStars = useMemo(() => Math.floor(potentialCoins - stake), [potentialCoins, stake]);

  const canAfford = stake <= userCoins && stake > 0;
  const oddsColor = getOddsColor(outcome.odds);

  const handleQuickStake = (amount: number): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStake(amount);
    setShowCustom(false);
  };

  const handleCustomStakeChange = (value: string): void => {
    const numValue = parseInt(value, 10);
    setCustomStake(value);
    if (!isNaN(numValue) && numValue > 0) {
      setStake(numValue);
    }
  };

  const handleMaxStake = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStake(userCoins);
    setCustomStake(userCoins.toString());
    setShowCustom(true);
  };

  const handlePlacePrediction = (): void => {
    if (canAfford) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onPlacePrediction(stake);
    }
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: 20 }}
      transition={{ type: 'spring', damping: 20 }}
    >
      <Card style={styles.container} elevated>
        <View style={styles.header}>
          <Text style={styles.title}>Place Prediction</Text>
          <Pressable onPress={onCancel} style={styles.cancelButton}>
            <CloseIcon size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.selection}>
          <Text style={styles.label}>Your Pick</Text>
          <View style={styles.outcomeRow}>
            <Text style={styles.outcomeName}>{outcome.name}</Text>
            <Text style={[styles.odds, { color: oddsColor }]}>
              @ {outcome.odds.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.stakeSection}>
          <View style={styles.stakeHeader}>
            <Text style={styles.label}>Stake</Text>
            <Pressable onPress={handleMaxStake} style={styles.maxButtonContainer}>
              <Text style={styles.maxButton}>Max ({userCoins}</Text>
              <CoinIcon size={12} />
              <Text style={styles.maxButton}>)</Text>
            </Pressable>
          </View>

          <View style={styles.quickStakes}>
            {QUICK_STAKES.map((amount) => (
              <QuickStakeButton
                key={amount}
                amount={amount}
                selected={stake === amount && !showCustom}
                onPress={() => handleQuickStake(amount)}
                disabled={amount > userCoins}
              />
            ))}
            <Pressable
              onPress={() => setShowCustom(true)}
              style={[
                styles.quickStakeButton,
                showCustom && styles.quickStakeButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.quickStakeText,
                  showCustom && styles.quickStakeTextSelected,
                ]}
              >
                Custom
              </Text>
            </Pressable>
          </View>

          {showCustom && (
            <MotiView
              from={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ type: 'timing', duration: 200 }}
            >
              <View style={styles.customInput}>
                <View style={styles.currencyPrefix}>
                  <CoinIcon size={20} />
                </View>
                <TextInput
                  style={styles.input}
                  value={customStake}
                  onChangeText={handleCustomStakeChange}
                  keyboardType="numeric"
                  placeholder="Enter amount"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
              </View>
            </MotiView>
          )}
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewTitle}>If you win:</Text>
          <View style={styles.previewRow}>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>You Get Back</Text>
              <View style={styles.previewValue}>
                <Text style={styles.previewCoins}>{potentialCoins}</Text>
                <CoinIcon size={18} />
              </View>
              <Text style={styles.previewSubLabel}>
                ({stake} stake + {potentialCoins - stake} profit)
              </Text>
            </View>
            <View style={styles.previewDivider} />
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>Stars Earned</Text>
              <View style={styles.previewValue}>
                <Text style={styles.previewStars}>{potentialStars}</Text>
                <StarIcon size={18} />
              </View>
              <Text style={styles.previewSubLabel}>
                (profit = leaderboard rank)
              </Text>
            </View>
          </View>
        </View>

        {!canAfford && stake > 0 && (
          <View style={styles.errorContainer}>
            <Text style={styles.error}>Insufficient coins. You have {userCoins}</Text>
            <CoinIcon size={14} />
          </View>
        )}

        <Button
          title={`Place Prediction (${stake})`}
          onPress={handlePlacePrediction}
          disabled={!canAfford || isLoading}
          loading={isLoading}
          size="lg"
        />
      </Card>
    </MotiView>
  );
}

interface QuickStakeButtonProps {
  amount: number;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
}

function QuickStakeButton({
  amount,
  selected,
  onPress,
  disabled,
}: QuickStakeButtonProps): React.ReactElement {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (): void => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = (): void => {
    scale.value = withSpring(1, { damping: 15 });
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.quickStakeButton,
          selected && styles.quickStakeButtonSelected,
          disabled && styles.quickStakeButtonDisabled,
        ]}
      >
        <Text
          style={[
            styles.quickStakeText,
            selected && styles.quickStakeTextSelected,
            disabled && styles.quickStakeTextDisabled,
          ]}
        >
          {amount}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: layout.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.lg,
  },
  title: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  cancelButton: {
    padding: layout.spacing.xs,
  },
  selection: {
    backgroundColor: colors.card,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    marginBottom: layout.spacing.lg,
  },
  label: {
    fontSize: layout.fontSize.sm,
    color: colors.textMuted,
    marginBottom: layout.spacing.xs,
  },
  outcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outcomeName: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  odds: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  stakeSection: {
    marginBottom: layout.spacing.lg,
  },
  stakeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.sm,
  },
  maxButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  maxButton: {
    fontSize: layout.fontSize.sm,
    color: colors.primary,
    fontWeight: layout.fontWeight.medium,
  },
  quickStakes: {
    flexDirection: 'row',
    gap: layout.spacing.sm,
    flexWrap: 'wrap',
  },
  quickStakeButton: {
    backgroundColor: colors.card,
    paddingVertical: layout.spacing.sm,
    paddingHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickStakeButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickStakeButtonDisabled: {
    opacity: 0.4,
  },
  quickStakeText: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  quickStakeTextSelected: {
    color: colors.background,
  },
  quickStakeTextDisabled: {
    color: colors.textMuted,
  },
  customInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: layout.spacing.md,
    paddingHorizontal: layout.spacing.md,
  },
  currencyPrefix: {
    marginRight: layout.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    paddingVertical: layout.spacing.md,
  },
  preview: {
    backgroundColor: colors.primaryDim,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    marginBottom: layout.spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  previewTitle: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: layout.spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewItem: {
    flex: 1,
    alignItems: 'center',
  },
  previewValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: layout.spacing.md,
  },
  previewLabel: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  previewSubLabel: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  previewCoins: {
    fontSize: layout.fontSize.xl,
    fontWeight: layout.fontWeight.bold,
    color: colors.coins,
  },
  previewStars: {
    fontSize: layout.fontSize.xl,
    fontWeight: layout.fontWeight.bold,
    color: colors.stars,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: layout.spacing.md,
  },
  error: {
    fontSize: layout.fontSize.sm,
    color: colors.error,
    textAlign: 'center',
  },
});
