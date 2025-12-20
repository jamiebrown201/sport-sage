import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MotiView } from 'moti';
import { useInsights } from '@/lib/store';
import { SportInsight } from '@/types';
import { Card } from '@/components/ui';
import {
  ChartIcon,
  StarIcon,
  CoinIcon,
  TrophyIcon,
  FootballIcon,
  TennisIcon,
  DartsIcon,
  CricketIcon,
  BasketballIcon,
  GolfIcon,
  BoxingIcon,
  MMAIcon,
  FireIcon,
} from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

function getSportIcon(slug: string, size: number, color: string): React.ReactElement {
  switch (slug) {
    case 'football': return <FootballIcon size={size} color={color} />;
    case 'tennis': return <TennisIcon size={size} color={color} />;
    case 'darts': return <DartsIcon size={size} color={color} />;
    case 'cricket': return <CricketIcon size={size} color={color} />;
    case 'basketball': return <BasketballIcon size={size} color={color} />;
    case 'golf': return <GolfIcon size={size} color={color} />;
    case 'boxing': return <BoxingIcon size={size} color={color} />;
    case 'mma': return <MMAIcon size={size} color={color} />;
    default: return <FootballIcon size={size} color={color} />;
  }
}

function getWinRateColor(winRate: number): string {
  if (winRate >= 70) return colors.success;
  if (winRate >= 50) return colors.warning;
  return colors.error;
}

export function PredictionInsights(): React.ReactElement {
  const { insights } = useInsights();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Overview Card */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
      >
        <Card style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <ChartIcon size={24} color={colors.primary} />
            <Text style={styles.overviewTitle}>Your Performance</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{insights.overallWinRate.toFixed(1)}%</Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statValueRow}>
                <CoinIcon size={16} color={insights.totalProfit >= 0 ? colors.success : colors.error} />
                <Text style={[styles.statValue, { color: insights.totalProfit >= 0 ? colors.success : colors.error }]}>
                  {insights.totalProfit >= 0 ? '+' : ''}{insights.totalProfit}
                </Text>
              </View>
              <Text style={styles.statLabel}>Total Profit</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{insights.avgOdds.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Avg Odds</Text>
            </View>
          </View>

          <View style={styles.favoriteTimeRow}>
            <Text style={styles.favoriteTimeLabel}>Most Active:</Text>
            <Text style={styles.favoriteTimeValue}>{insights.favoriteTime}</Text>
          </View>
        </Card>
      </MotiView>

      {/* Sport Insights */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 100 }}
      >
        <Text style={styles.sectionTitle}>Performance by Sport</Text>
        {insights.sportInsights.map((sport, index) => (
          <SportInsightCard key={sport.sportSlug} insight={sport} delay={index * 50} />
        ))}
      </MotiView>

      {/* Weekly Performance */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 200 }}
      >
        <Text style={styles.sectionTitle}>Weekly Trend</Text>
        <Card style={styles.weeklyCard}>
          {insights.weeklyPerformance.map((week, index) => (
            <View key={week.week} style={styles.weekRow}>
              <Text style={styles.weekLabel}>{week.week}</Text>
              <View style={styles.weekStats}>
                <View style={styles.weekBarContainer}>
                  <View
                    style={[
                      styles.weekBar,
                      {
                        width: `${week.winRate}%`,
                        backgroundColor: getWinRateColor(week.winRate),
                      }
                    ]}
                  />
                </View>
                <Text style={[styles.weekWinRate, { color: getWinRateColor(week.winRate) }]}>
                  {week.winRate}%
                </Text>
              </View>
              <Text style={styles.weekPredictions}>{week.predictions} bets</Text>
            </View>
          ))}
        </Card>
      </MotiView>
    </ScrollView>
  );
}

interface SportInsightCardProps {
  insight: SportInsight;
  delay?: number;
}

function SportInsightCard({ insight, delay = 0 }: SportInsightCardProps): React.ReactElement {
  const winRateColor = getWinRateColor(insight.winRate);

  return (
    <MotiView
      from={{ opacity: 0, translateX: -10 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: 200, delay }}
    >
      <Card style={styles.sportCard}>
        <View style={styles.sportHeader}>
          <View style={styles.sportInfo}>
            <View style={styles.sportIconContainer}>
              {getSportIcon(insight.sportSlug, 24, colors.textSecondary)}
            </View>
            <View>
              <Text style={styles.sportName}>{insight.sportName}</Text>
              <Text style={styles.sportPredictions}>
                {insight.totalPredictions} predictions
              </Text>
            </View>
          </View>
          <View style={[styles.winRateBadge, { backgroundColor: `${winRateColor}20` }]}>
            <Text style={[styles.winRateText, { color: winRateColor }]}>
              {insight.winRate.toFixed(0)}%
            </Text>
          </View>
        </View>

        <View style={styles.sportStats}>
          <View style={styles.sportStatItem}>
            <Text style={styles.sportStatLabel}>Wins</Text>
            <Text style={[styles.sportStatValue, { color: colors.success }]}>{insight.wins}</Text>
          </View>
          <View style={styles.sportStatItem}>
            <Text style={styles.sportStatLabel}>Losses</Text>
            <Text style={[styles.sportStatValue, { color: colors.error }]}>{insight.losses}</Text>
          </View>
          <View style={styles.sportStatItem}>
            <Text style={styles.sportStatLabel}>Profit</Text>
            <View style={styles.profitRow}>
              <CoinIcon size={12} color={insight.profit >= 0 ? colors.success : colors.error} />
              <Text style={[styles.sportStatValue, { color: insight.profit >= 0 ? colors.success : colors.error }]}>
                {insight.profit >= 0 ? '+' : ''}{insight.profit}
              </Text>
            </View>
          </View>
          <View style={styles.sportStatItem}>
            <Text style={styles.sportStatLabel}>Avg Odds</Text>
            <Text style={styles.sportStatValue}>{insight.avgOdds.toFixed(2)}</Text>
          </View>
        </View>

        {insight.bestWin && (
          <View style={styles.bestWinRow}>
            <TrophyIcon size={14} color={colors.stars} />
            <Text style={styles.bestWinText}>
              Best: {insight.bestWin.eventName} @ {insight.bestWin.odds} (+{insight.bestWin.coinsWon})
            </Text>
          </View>
        )}
      </Card>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.spacing.md,
    paddingBottom: layout.spacing.xxl,
  },
  overviewCard: {
    marginBottom: layout.spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primaryDim,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.md,
  },
  overviewTitle: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: layout.spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: layout.fontSize.xl,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  favoriteTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.spacing.xs,
    paddingTop: layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  favoriteTimeLabel: {
    fontSize: layout.fontSize.sm,
    color: colors.textMuted,
  },
  favoriteTimeValue: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.semibold,
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: layout.spacing.md,
  },
  sportCard: {
    marginBottom: layout.spacing.sm,
  },
  sportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.sm,
  },
  sportInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  sportIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportName: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  sportPredictions: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
  },
  winRateBadge: {
    paddingHorizontal: layout.spacing.sm,
    paddingVertical: layout.spacing.xs,
    borderRadius: layout.borderRadius.md,
  },
  winRateText: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
  },
  sportStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sportStatItem: {
    alignItems: 'center',
  },
  sportStatLabel: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  sportStatValue: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bestWinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
    marginTop: layout.spacing.sm,
    paddingTop: layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bestWinText: {
    fontSize: layout.fontSize.xs,
    color: colors.stars,
    flex: 1,
  },
  weeklyCard: {
    marginBottom: layout.spacing.lg,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekLabel: {
    width: 90,
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  weekStats: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  weekBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.cardElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  weekBar: {
    height: '100%',
    borderRadius: 4,
  },
  weekWinRate: {
    width: 40,
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.bold,
    textAlign: 'right',
  },
  weekPredictions: {
    width: 50,
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
  },
});
