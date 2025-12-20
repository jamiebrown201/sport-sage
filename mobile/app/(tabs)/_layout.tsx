import React from 'react';
import { Tabs, router } from 'expo-router';
import { StyleSheet, View, Alert } from 'react-native';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import { HomeIcon, CalendarIcon, TargetIcon, TrophyIcon, UserIcon } from '@/components/icons';
import { useAuth } from '@/lib/store';

interface TabIconProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  focused: boolean;
}

function TabIcon({ icon: Icon, focused }: TabIconProps): React.ReactElement {
  return (
    <View style={styles.tabIconContainer}>
      <Icon
        size={24}
        color={focused ? colors.primary : colors.textMuted}
      />
    </View>
  );
}

function HeaderRight(): React.ReactElement {
  const { user } = useAuth();

  const handleCoinsPress = (): void => {
    Alert.alert(
      'Coins',
      'Coins are used to make predictions.\n\n• Stake coins on sports events\n• Win back more coins if you\'re right\n• Get 500 free coins daily\n• Run low? Watch ads for rescue coins!',
      [{ text: 'Got it!' }]
    );
  };

  const handleStarsPress = (): void => {
    Alert.alert(
      'Stars',
      'Stars show your prediction skill!\n\n• Earn stars from winning predictions\n• Stars = profit from your bets\n• Climb the leaderboard with more stars\n• Spend stars on cosmetics in the shop',
      [
        { text: 'View Leaderboard', onPress: () => router.push('/(tabs)/leaderboard') },
        { text: 'Shop', onPress: () => router.push('/shop') },
        { text: 'OK' },
      ]
    );
  };

  const handleGemsPress = (): void => {
    Alert.alert(
      'Gems',
      'Gems are the premium currency.\n\n• Purchase exclusive cosmetics\n• Unlock legendary items\n• Buy gem packs in the shop',
      [
        { text: 'Go to Shop', onPress: () => router.push('/shop') },
        { text: 'OK' },
      ]
    );
  };

  return (
    <View style={styles.headerRight}>
      <CurrencyDisplay
        coins={user?.coins ?? 0}
        stars={user?.stars ?? 0}
        gems={user?.gems ?? 0}
        onCoinsPress={handleCoinsPress}
        onStarsPress={handleStarsPress}
        onGemsPress={handleGemsPress}
        compact
      />
    </View>
  );
}

export default function TabsLayout(): React.ReactElement {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerTintColor: colors.textPrimary,
        headerRight: () => <HeaderRight />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon icon={HomeIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon icon={CalendarIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'Predictions',
          tabBarIcon: ({ focused }) => <TabIcon icon={TargetIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ focused }) => <TabIcon icon={TrophyIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon icon={UserIcon} focused={focused} />,
        }}
      />
      {/* Hide settings from tab bar - accessed via profile */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: layout.spacing.xs,
    height: 85,
  },
  tabLabel: {
    fontSize: layout.fontSize.xs,
    fontWeight: layout.fontWeight.medium,
    marginBottom: layout.spacing.sm,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
  },
  headerRight: {
    marginRight: layout.spacing.md,
  },
});
