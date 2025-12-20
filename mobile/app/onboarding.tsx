import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/store';
import {
  TrophyIcon,
  CoinIcon,
  TargetIcon,
  StarIcon,
  GemIcon,
  SparkleIcon,
} from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  iconType: 'trophy' | 'coin' | 'target' | 'star' | 'gem' | 'sparkle';
  iconColor?: string;
  title: string;
  description: string;
  highlight?: {
    iconType: 'coin' | 'star' | 'gem';
    label: string;
    color: string;
  };
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    iconType: 'trophy',
    iconColor: colors.primary,
    title: 'Welcome to Sport Sage',
    description:
      'Make predictions on real sports events and compete with players around the world. No real money involved - just pure fun!',
  },
  {
    id: '2',
    iconType: 'coin',
    iconColor: colors.coins,
    title: 'Coins for Predictions',
    description:
      'Use coins to make predictions. You start with 1,000 free coins and get a daily top-up of 500 coins to keep playing.',
    highlight: {
      iconType: 'coin',
      label: '1,000 Starting Coins',
      color: colors.coins,
    },
  },
  {
    id: '3',
    iconType: 'target',
    iconColor: colors.primary,
    title: 'How Predictions Work',
    description:
      'Pick a team or player to win, choose how many coins to stake, and wait for the result. Higher odds = bigger potential returns!',
  },
  {
    id: '4',
    iconType: 'star',
    iconColor: colors.stars,
    title: 'Win Stars, Climb Ranks',
    description:
      'When you win, you earn Stars based on your profit. Stars measure your skill and determine your leaderboard ranking.',
    highlight: {
      iconType: 'star',
      label: 'Stars = Profit Earned',
      color: colors.stars,
    },
  },
  {
    id: '5',
    iconType: 'gem',
    iconColor: colors.gems,
    title: 'Gems for Cosmetics',
    description:
      'Purchase Gems to unlock exclusive cosmetics like avatar frames, card skins, and victory animations. Show off your style!',
    highlight: {
      iconType: 'gem',
      label: 'Unlock Exclusive Items',
      color: colors.gems,
    },
  },
  {
    id: '6',
    iconType: 'sparkle',
    iconColor: colors.success,
    title: 'Ready to Play?',
    description:
      "Create your account and start making predictions. Remember - it's all about having fun and testing your sports knowledge!",
  },
];

function getSlideIcon(iconType: string, color?: string, size = 80): React.ReactElement {
  const iconColor = color || colors.primary;
  switch (iconType) {
    case 'trophy':
      return <TrophyIcon size={size} color={iconColor} />;
    case 'coin':
      return <CoinIcon size={size} color={iconColor} />;
    case 'target':
      return <TargetIcon size={size} color={iconColor} />;
    case 'star':
      return <StarIcon size={size} color={iconColor} />;
    case 'gem':
      return <GemIcon size={size} color={iconColor} />;
    case 'sparkle':
      return <SparkleIcon size={size} color={iconColor} />;
    default:
      return <TrophyIcon size={size} color={iconColor} />;
  }
}

export default function OnboardingScreen(): React.ReactElement {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { completeOnboarding } = useAuth();

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleGetStarted();
  };

  const handleGetStarted = async (): Promise<void> => {
    await completeOnboarding();
    router.replace('/auth/register');
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }): React.ReactElement => (
    <View style={styles.slide}>
      <MotiView
        from={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 15, delay: 100 }}
        key={`icon-${index}-${currentIndex === index}`}
        style={styles.slideIconContainer}
      >
        {getSlideIcon(item.iconType, item.iconColor, 80)}
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 200 }}
        key={`content-${index}-${currentIndex === index}`}
      >
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideDescription}>{item.description}</Text>
      </MotiView>

      {item.highlight && (
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 400 }}
          style={[styles.highlightBox, { borderColor: item.highlight.color }]}
          key={`highlight-${index}-${currentIndex === index}`}
        >
          <View style={styles.highlightIconContainer}>
            {getSlideIcon(item.highlight.iconType, item.highlight.color, 28)}
          </View>
          <Text style={[styles.highlightLabel, { color: item.highlight.color }]}>
            {item.highlight.label}
          </Text>
        </MotiView>
      )}
    </View>
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {!isLastSlide && (
          <Button title="Skip" variant="ghost" size="sm" onPress={handleSkip} />
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      <View style={styles.footer}>
        {/* Pagination dots */}
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <MotiView
              key={index}
              animate={{
                width: index === currentIndex ? 24 : 8,
                backgroundColor:
                  index === currentIndex ? colors.primary : colors.border,
              }}
              transition={{ type: 'timing', duration: 200 }}
              style={styles.dot}
            />
          ))}
        </View>

        <Button
          title={isLastSlide ? 'Get Started' : 'Next'}
          onPress={handleNext}
          size="lg"
          style={styles.nextButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.sm,
    minHeight: 50,
  },
  slide: {
    width,
    paddingHorizontal: layout.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  slideIconContainer: {
    marginBottom: layout.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideTitle: {
    fontSize: layout.fontSize.xxl,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: layout.spacing.md,
  },
  slideDescription: {
    fontSize: layout.fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  highlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
    marginTop: layout.spacing.xl,
    paddingVertical: layout.spacing.md,
    paddingHorizontal: layout.spacing.lg,
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    borderWidth: 2,
  },
  highlightIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightLabel: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
  },
  footer: {
    paddingHorizontal: layout.spacing.lg,
    paddingBottom: layout.spacing.xl,
    gap: layout.spacing.lg,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: layout.spacing.xs,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    width: '100%',
  },
});
