import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Prediction, PredictionEvent } from '@/types';
import { Card, Badge } from '@/components/ui';
import { CoinIcon, StarIcon, FootballIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

// Helper to get event title from PredictionEvent
function getPredictionEventTitle(event: PredictionEvent | null): string {
  if (!event) return 'Unknown Event';

  if (event.homeTeamName && event.awayTeamName) {
    return `${event.homeTeamName} vs ${event.awayTeamName}`;
  }
  if (event.player1Name && event.player2Name) {
    return `${event.player1Name} vs ${event.player2Name}`;
  }
  if (event.homeTeamName) return event.homeTeamName;
  if (event.player1Name) return event.player1Name;
  return 'Unknown Event';
}

interface PredictionCardProps {
  prediction: Prediction;
  onPress?: () => void;
}

export function PredictionCard({ prediction, onPress }: PredictionCardProps): React.ReactElement {
  const title = getPredictionEventTitle(prediction.event);
  const isPending = prediction.status === 'pending';
  const isWon = prediction.status === 'won';
  const isLost = prediction.status === 'lost';

  const statusVariant = isPending ? 'warning' : isWon ? 'success' : 'error';
  const statusText = isPending ? 'Pending' : isWon ? 'Won' : 'Lost';

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.eventInfo}>
          <View style={styles.sportIconContainer}>
            <FootballIcon size={24} color={colors.textSecondary} />
          </View>
          <View style={styles.eventTextContainer}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {prediction.event && (
              <Text style={styles.competition}>
                {new Date(prediction.event.startTime).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
        </View>
        <Badge text={statusText} variant={statusVariant} />
      </View>

      <View style={styles.predictionInfo}>
        <Text style={styles.pickLabel}>Your pick:</Text>
        <Text style={styles.pickValue}>{prediction.outcome?.name ?? 'Unknown'}</Text>
        <Text style={styles.odds}>@ {(prediction.outcome?.odds ?? prediction.odds).toFixed(2)}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.stakeInfo}>
          <Text style={styles.label}>Stake</Text>
          <View style={styles.currencyValue}>
            <CoinIcon size={16} />
            <Text style={styles.stakeValue}>{prediction.stake}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.returnInfo}>
          <Text style={styles.label}>{isPending ? 'Potential' : isWon ? 'Won' : 'Lost'}</Text>
          <View style={styles.returnValues}>
            {isWon ? (
              <>
                <MotiView
                  from={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  style={styles.currencyValue}
                >
                  <Text style={styles.coinsWon}>+{prediction.potentialCoins}</Text>
                  <CoinIcon size={14} />
                </MotiView>
                <MotiView
                  from={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15, delay: 100 }}
                  style={styles.currencyValue}
                >
                  <Text style={styles.starsWon}>+{prediction.potentialStars}</Text>
                  <StarIcon size={12} />
                </MotiView>
              </>
            ) : isLost ? (
              <View style={styles.currencyValue}>
                <Text style={styles.lost}>-{prediction.stake}</Text>
                <CoinIcon size={14} />
              </View>
            ) : (
              <>
                <View style={styles.currencyValue}>
                  <Text style={styles.potential}>{prediction.potentialCoins}</Text>
                  <CoinIcon size={14} />
                </View>
                <View style={styles.currencyValue}>
                  <Text style={styles.potentialStars}>{prediction.potentialStars}</Text>
                  <StarIcon size={12} />
                </View>
              </>
            )}
          </View>
        </View>
      </View>

    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: layout.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: layout.spacing.md,
  },
  eventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    flex: 1,
  },
  sportIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  competition: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
  },
  predictionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.md,
    backgroundColor: colors.cardElevated,
    padding: layout.spacing.sm,
    borderRadius: layout.borderRadius.md,
  },
  pickLabel: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  pickValue: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
    color: colors.primary,
    flex: 1,
  },
  odds: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stakeInfo: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: layout.spacing.md,
  },
  returnInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  label: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    marginBottom: 4,
  },
  currencyValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stakeValue: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  returnValues: {
    alignItems: 'flex-end',
  },
  potential: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  potentialStars: {
    fontSize: layout.fontSize.sm,
    color: colors.stars,
  },
  coinsWon: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.success,
  },
  starsWon: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.semibold,
    color: colors.stars,
  },
  lost: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.error,
  },
});
