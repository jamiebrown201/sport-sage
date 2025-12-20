import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/store';
import { Card, Button, Badge } from '@/components/ui';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import {
  GemIcon,
  SparkleIcon,
  CrownIcon,
  StarIcon,
  CheckIcon,
  ChevronRightIcon,
} from '@/components/icons';
import { GEM_PACKS, SUBSCRIPTION_PLANS, CosmeticItem, CosmeticRarity } from '@/types';
import { colors, getRarityColor } from '@/constants/colors';
import { layout } from '@/constants/layout';

type ShopTab = 'gems' | 'cosmetics' | 'subscriptions';

const MOCK_COSMETICS: CosmeticItem[] = [
  {
    id: 'frame_gold',
    name: 'Golden Frame',
    description: 'A shimmering golden avatar frame',
    category: 'avatar_frame',
    rarity: 'rare',
    starPrice: 500,
    imageUrl: '',
    isExclusive: false,
    isLimitedTime: false,
  },
  {
    id: 'frame_fire',
    name: 'Flame Frame',
    description: 'An animated fire avatar frame',
    category: 'avatar_frame',
    rarity: 'epic',
    starPrice: 1500,
    imageUrl: '',
    isExclusive: false,
    isLimitedTime: false,
  },
  {
    id: 'frame_diamond',
    name: 'Diamond Frame',
    description: 'The ultimate avatar frame',
    category: 'avatar_frame',
    rarity: 'legendary',
    gemPrice: 200,
    imageUrl: '',
    isExclusive: true,
    isLimitedTime: false,
  },
  {
    id: 'victory_confetti',
    name: 'Confetti Burst',
    description: 'Colorful confetti on wins',
    category: 'victory_animation',
    rarity: 'common',
    starPrice: 200,
    imageUrl: '',
    isExclusive: false,
    isLimitedTime: false,
  },
  {
    id: 'victory_fireworks',
    name: 'Fireworks',
    description: 'Spectacular fireworks display',
    category: 'victory_animation',
    rarity: 'epic',
    starPrice: 2000,
    imageUrl: '',
    isExclusive: false,
    isLimitedTime: false,
  },
  {
    id: 'badge_winner',
    name: 'Champion Badge',
    description: 'Show off your winning ways',
    category: 'badge',
    rarity: 'rare',
    starPrice: 750,
    imageUrl: '',
    isExclusive: false,
    isLimitedTime: false,
  },
];

export default function ShopScreen(): React.ReactElement {
  const { user, updateUser } = useAuth();
  const [selectedTab, setSelectedTab] = useState<ShopTab>('gems');

  const handlePurchaseGems = (packId: string): void => {
    const pack = GEM_PACKS.find((p) => p.id === packId);
    if (!pack) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Purchase Gems',
      `Buy ${pack.gems} gems for £${pack.priceGBP.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: () => {
            // Mock purchase
            updateUser({ gems: (user?.gems ?? 0) + pack.gems });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success!', `You received ${pack.gems} gems!`);
          },
        },
      ]
    );
  };

  const handlePurchaseCosmetic = (cosmetic: CosmeticItem): void => {
    const currency = cosmetic.starPrice ? 'stars' : 'gems';
    const price = cosmetic.starPrice ?? cosmetic.gemPrice ?? 0;
    const userBalance = currency === 'stars' ? (user?.stars ?? 0) : (user?.gems ?? 0);

    if (userBalance < price) {
      Alert.alert('Insufficient Funds', `You need more ${currency} to purchase this item.`);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Purchase Item',
      `Buy ${cosmetic.name} for ${price} ${currency === 'stars' ? 'stars' : 'gems'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: () => {
            // Mock purchase
            if (currency === 'stars') {
              updateUser({ stars: (user?.stars ?? 0) - price });
            } else {
              updateUser({ gems: (user?.gems ?? 0) - price });
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success!', `You unlocked ${cosmetic.name}!`);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Shop</Text>
        <View style={styles.headerRight}>
          <CurrencyDisplay
            coins={user?.coins ?? 0}
            stars={user?.stars ?? 0}
            gems={user?.gems ?? 0}
            compact
          />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TabButton
          label="Gems"
          icon={<GemIcon size={18} color={selectedTab === 'gems' ? colors.background : colors.gems} />}
          selected={selectedTab === 'gems'}
          onPress={() => setSelectedTab('gems')}
        />
        <TabButton
          label="Cosmetics"
          icon={<SparkleIcon size={18} color={selectedTab === 'cosmetics' ? colors.background : colors.primary} />}
          selected={selectedTab === 'cosmetics'}
          onPress={() => setSelectedTab('cosmetics')}
        />
        <TabButton
          label="Premium"
          icon={<CrownIcon size={18} color={selectedTab === 'subscriptions' ? colors.background : colors.stars} />}
          selected={selectedTab === 'subscriptions'}
          onPress={() => setSelectedTab('subscriptions')}
        />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {selectedTab === 'gems' && (
          <GemsSection onPurchase={handlePurchaseGems} />
        )}
        {selectedTab === 'cosmetics' && (
          <CosmeticsSection
            cosmetics={MOCK_COSMETICS}
            userStars={user?.stars ?? 0}
            userGems={user?.gems ?? 0}
            onPurchase={handlePurchaseCosmetic}
          />
        )}
        {selectedTab === 'subscriptions' && (
          <SubscriptionsSection currentTier={user?.subscriptionTier ?? 'free'} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface TabButtonProps {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onPress: () => void;
}

function TabButton({ label, icon, selected, onPress }: TabButtonProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, selected && styles.tabSelected]}
    >
      <View style={styles.tabIconContainer}>{icon}</View>
      <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface GemsSectionProps {
  onPurchase: (packId: string) => void;
}

function GemsSection({ onPurchase }: GemsSectionProps): React.ReactElement {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
    >
      <Text style={styles.sectionDescription}>
        Gems are the premium currency used to unlock exclusive cosmetics and features.
      </Text>

      <View style={styles.gemPacks}>
        {GEM_PACKS.map((pack, index) => (
          <MotiView
            key={pack.id}
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: index * 50 }}
          >
            <Pressable
              onPress={() => onPurchase(pack.id)}
              style={[
                styles.gemPack,
                pack.isPopular && styles.gemPackPopular,
                pack.isBestValue && styles.gemPackBestValue,
              ]}
            >
              {pack.isPopular && (
                <Badge text="Most Popular" variant="warning" style={styles.packBadge} />
              )}
              {pack.isBestValue && (
                <Badge text="Best Value" variant="success" style={styles.packBadge} />
              )}

              <View style={styles.gemIconContainer}>
                <GemIcon size={40} />
              </View>
              <Text style={styles.gemAmount}>{pack.gems.toLocaleString()}</Text>
              <Text style={styles.gemName}>{pack.name}</Text>

              {pack.bonusPercent > 0 && (
                <Text style={styles.gemBonus}>+{pack.bonusPercent}% Bonus</Text>
              )}

              <Text style={styles.gemPrice}>£{pack.priceGBP.toFixed(2)}</Text>
            </Pressable>
          </MotiView>
        ))}
      </View>
    </MotiView>
  );
}

interface CosmeticsSectionProps {
  cosmetics: CosmeticItem[];
  userStars: number;
  userGems: number;
  onPurchase: (cosmetic: CosmeticItem) => void;
}

function CosmeticsSection({
  cosmetics,
  userStars,
  userGems,
  onPurchase,
}: CosmeticsSectionProps): React.ReactElement {
  const getRarityLabel = (rarity: CosmeticRarity): string => {
    return rarity.charAt(0).toUpperCase() + rarity.slice(1);
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
    >
      <Text style={styles.sectionDescription}>
        Spend your Stars or Gems on exclusive cosmetics to customize your profile.
      </Text>

      <View style={styles.cosmeticGrid}>
        {cosmetics.map((cosmetic, index) => {
          const price = cosmetic.starPrice ?? cosmetic.gemPrice ?? 0;
          const currency = cosmetic.starPrice ? 'stars' : 'gems';
          const canAfford = currency === 'stars' ? userStars >= price : userGems >= price;
          const rarityColor = getRarityColor(cosmetic.rarity);

          return (
            <MotiView
              key={cosmetic.id}
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 15, delay: index * 50 }}
            >
              <Pressable
                onPress={() => onPurchase(cosmetic)}
                style={[styles.cosmeticCard, { borderColor: rarityColor }]}
              >
                <View style={[styles.cosmeticIcon, { backgroundColor: rarityColor + '20' }]}>
                  <SparkleIcon size={28} color={rarityColor} />
                </View>

                <Text style={styles.cosmeticName}>{cosmetic.name}</Text>
                <Text style={[styles.cosmeticRarity, { color: rarityColor }]}>
                  {getRarityLabel(cosmetic.rarity)}
                </Text>

                <View style={[styles.cosmeticPrice, !canAfford && styles.cosmeticPriceDisabled]}>
                  <View style={styles.cosmeticPriceContent}>
                    {currency === 'stars' ? (
                      <StarIcon size={14} />
                    ) : (
                      <GemIcon size={14} />
                    )}
                    <Text style={styles.cosmeticPriceText}>{price}</Text>
                  </View>
                </View>

                {cosmetic.isExclusive && (
                  <View style={styles.exclusiveTag}>
                    <Text style={styles.exclusiveText}>Exclusive</Text>
                  </View>
                )}
              </Pressable>
            </MotiView>
          );
        })}
      </View>
    </MotiView>
  );
}

interface SubscriptionsSectionProps {
  currentTier: string;
}

function SubscriptionsSection({ currentTier }: SubscriptionsSectionProps): React.ReactElement {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
    >
      <Text style={styles.sectionDescription}>
        Upgrade your experience with premium features and rewards.
      </Text>

      {SUBSCRIPTION_PLANS.map((plan, index) => (
        <MotiView
          key={plan.tier}
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300, delay: index * 100 }}
        >
          <Card style={plan.tier === 'elite' ? [styles.subscriptionCard, styles.subscriptionCardElite] : styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionIconContainer}>
                {plan.tier === 'elite' ? (
                  <CrownIcon size={28} color={colors.stars} />
                ) : (
                  <StarIcon size={28} color={colors.tierPro} />
                )}
              </View>
              <Text style={styles.subscriptionName}>{plan.name}</Text>
              {currentTier === plan.tier && (
                <Badge text="Current" variant="success" />
              )}
            </View>

            <View style={styles.subscriptionBenefits}>
              {plan.benefits.map((benefit, i) => (
                <View key={i} style={styles.benefitRow}>
                  <CheckIcon size={16} color={colors.success} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            <View style={styles.subscriptionPricing}>
              <Text style={styles.subscriptionPrice}>
                £{plan.monthlyPriceGBP.toFixed(2)}/mo
              </Text>
              <Text style={styles.subscriptionYearly}>
                or £{plan.yearlyPriceGBP.toFixed(2)}/year (save 17%)
              </Text>
            </View>

            <Button
              title={currentTier === plan.tier ? 'Current Plan' : 'Subscribe'}
              variant={currentTier === plan.tier ? 'outline' : 'primary'}
              disabled={currentTier === plan.tier}
              onPress={() => Alert.alert('Coming Soon', 'Subscriptions coming soon!')}
            />
          </Card>
        </MotiView>
      ))}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: layout.spacing.sm,
  },
  backText: {
    color: colors.primary,
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.medium,
  },
  title: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.sm,
    gap: layout.spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.spacing.xs,
    paddingVertical: layout.spacing.sm,
    borderRadius: layout.borderRadius.lg,
    backgroundColor: colors.card,
  },
  tabSelected: {
    backgroundColor: colors.primary,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.medium,
    color: colors.textSecondary,
  },
  tabLabelSelected: {
    color: colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: layout.spacing.md,
    paddingBottom: layout.spacing.xxl,
  },
  sectionDescription: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: layout.spacing.lg,
    lineHeight: 20,
  },
  gemPacks: {
    gap: layout.spacing.md,
  },
  gemPack: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    padding: layout.spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gemPackPopular: {
    borderColor: colors.stars,
  },
  gemPackBestValue: {
    borderColor: colors.gems,
  },
  packBadge: {
    position: 'absolute',
    top: -10,
    right: 10,
  },
  gemIconContainer: {
    marginBottom: layout.spacing.sm,
  },
  gemAmount: {
    fontSize: layout.fontSize.xxl,
    fontWeight: layout.fontWeight.bold,
    color: colors.gems,
  },
  gemName: {
    fontSize: layout.fontSize.md,
    color: colors.textSecondary,
    marginBottom: layout.spacing.xs,
  },
  gemBonus: {
    fontSize: layout.fontSize.sm,
    color: colors.success,
    fontWeight: layout.fontWeight.medium,
    marginBottom: layout.spacing.sm,
  },
  gemPrice: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: layout.spacing.sm,
  },
  cosmeticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: layout.spacing.md,
  },
  cosmeticCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    padding: layout.spacing.md,
    alignItems: 'center',
    borderWidth: 2,
  },
  cosmeticIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: layout.spacing.sm,
  },
  cosmeticName: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  cosmeticRarity: {
    fontSize: layout.fontSize.xs,
    fontWeight: layout.fontWeight.medium,
    marginBottom: layout.spacing.sm,
  },
  cosmeticPrice: {
    paddingVertical: layout.spacing.xs,
    paddingHorizontal: layout.spacing.sm,
    backgroundColor: colors.primaryDim,
    borderRadius: layout.borderRadius.md,
  },
  cosmeticPriceDisabled: {
    opacity: 0.5,
  },
  cosmeticPriceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cosmeticPriceText: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  exclusiveTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.gems,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: layout.borderRadius.sm,
  },
  exclusiveText: {
    fontSize: 10,
    fontWeight: layout.fontWeight.bold,
    color: colors.background,
  },
  subscriptionCard: {
    marginBottom: layout.spacing.lg,
  },
  subscriptionCardElite: {
    borderWidth: 2,
    borderColor: colors.stars,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.md,
  },
  subscriptionIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionName: {
    flex: 1,
    fontSize: layout.fontSize.xl,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  subscriptionBenefits: {
    marginBottom: layout.spacing.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.sm,
  },
  benefitText: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  subscriptionPricing: {
    marginBottom: layout.spacing.md,
  },
  subscriptionPrice: {
    fontSize: layout.fontSize.xl,
    fontWeight: layout.fontWeight.bold,
    color: colors.primary,
  },
  subscriptionYearly: {
    fontSize: layout.fontSize.sm,
    color: colors.textMuted,
  },
});
