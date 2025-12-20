import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { MotiView } from 'moti';
import { router } from 'expo-router';
import { useAuth, useSettings, useStreakShields, useReferrals } from '@/lib/store';
import { STREAK_SHIELDS } from '@/types';
import { Card, Button, Badge } from '@/components/ui';
import {
  SettingsIcon,
  BellIcon,
  ShieldIcon,
  UserIcon,
  EyeIcon,
  ShareIcon,
  GemIcon,
  StarIcon,
  CoinIcon,
  ChevronRightIcon,
  HelpIcon,
  FireIcon,
} from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

export default function SettingsScreen(): React.ReactElement {
  const { user, logout, stats } = useAuth();
  const { settings, updateNotifications, updatePrivacy } = useSettings();
  const { activeShields, purchaseShield, hasShield } = useStreakShields();
  const { stats: referralStats, shareReferralCode } = useReferrals();

  const [showShieldShop, setShowShieldShop] = useState(false);

  const handleLogout = (): void => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const handlePurchaseShield = (shieldId: string): void => {
    const shield = STREAK_SHIELDS.find(s => s.id === shieldId);
    if (!shield) return;

    if ((user?.gems ?? 0) < shield.gemPrice) {
      Alert.alert('Not Enough Gems', `You need ${shield.gemPrice} gems to purchase this shield.`);
      return;
    }

    Alert.alert(
      'Purchase Shield',
      `Buy ${shield.name} for ${shield.gemPrice} gems?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: () => {
            const success = purchaseShield(shieldId);
            if (success) {
              Alert.alert('Success', `You now have ${activeShields + shield.shieldsProvided} streak shields!`);
            }
          },
        },
      ]
    );
  };

  const handleShare = (): void => {
    shareReferralCode();
    Alert.alert(
      'Share Your Code',
      `Your referral code is: ${referralStats.referralCode}\n\nShare it with friends to earn 500 coins and 100 stars for each friend who joins!`
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
      >
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <UserIcon size={32} color={colors.textPrimary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.username}>{user?.username || 'Guest'}</Text>
              <Text style={styles.email}>{user?.email || ''}</Text>
            </View>
          </View>

          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <CoinIcon size={18} color={colors.coins} />
              <Text style={styles.balanceValue}>{user?.coins?.toLocaleString() ?? 0}</Text>
            </View>
            <View style={styles.balanceItem}>
              <StarIcon size={18} color={colors.stars} />
              <Text style={styles.balanceValue}>{user?.stars?.toLocaleString() ?? 0}</Text>
            </View>
            <View style={styles.balanceItem}>
              <GemIcon size={18} color={colors.gems} />
              <Text style={styles.balanceValue}>{user?.gems ?? 0}</Text>
            </View>
          </View>

          {stats && (
            <View style={styles.streakRow}>
              <FireIcon size={16} color={colors.warning} />
              <Text style={styles.streakText}>
                {stats.currentStreak} win streak (best: {stats.bestStreak})
              </Text>
              {hasShield && (
                <Badge text={`${activeShields} shields`} variant="success" size="sm" />
              )}
            </View>
          )}
        </Card>
      </MotiView>

      {/* Streak Shields */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 50 }}
      >
        <Pressable onPress={() => setShowShieldShop(!showShieldShop)}>
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <ShieldIcon size={24} color={colors.primary} />
              <View style={styles.sectionInfo}>
                <Text style={styles.sectionTitle}>Streak Shields</Text>
                <Text style={styles.sectionSubtitle}>
                  {activeShields > 0 ? `${activeShields} shields active` : 'Protect your streak'}
                </Text>
              </View>
              <ChevronRightIcon
                size={20}
                color={colors.textMuted}
              />
            </View>
          </Card>
        </Pressable>

        {showShieldShop && (
          <MotiView
            from={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ type: 'timing', duration: 200 }}
          >
            <View style={styles.shieldShop}>
              {STREAK_SHIELDS.map((shield) => (
                <Pressable
                  key={shield.id}
                  onPress={() => handlePurchaseShield(shield.id)}
                  style={styles.shieldItem}
                >
                  <ShieldIcon size={24} color={colors.primary} />
                  <View style={styles.shieldInfo}>
                    <Text style={styles.shieldName}>{shield.name}</Text>
                    <Text style={styles.shieldDesc}>{shield.description}</Text>
                  </View>
                  <View style={styles.shieldPrice}>
                    <GemIcon size={14} color={colors.gems} />
                    <Text style={styles.shieldPriceText}>{shield.gemPrice}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </MotiView>
        )}
      </MotiView>

      {/* Referrals */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 100 }}
      >
        <Pressable onPress={handleShare}>
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <ShareIcon size={24} color={colors.success} />
              <View style={styles.sectionInfo}>
                <Text style={styles.sectionTitle}>Invite Friends</Text>
                <Text style={styles.sectionSubtitle}>
                  {referralStats.completedReferrals} friends joined
                </Text>
              </View>
              <Badge text="500 coins" variant="success" size="sm" />
            </View>
          </Card>
        </Pressable>
      </MotiView>

      {/* Notifications */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 150 }}
      >
        <Text style={styles.sectionLabel}>Notifications</Text>
        <Card style={styles.settingsCard}>
          <SettingToggle
            icon={<BellIcon size={20} color={colors.textSecondary} />}
            title="Prediction Updates"
            subtitle="When your predictions settle"
            value={settings.notifications.predictions}
            onValueChange={(v) => updateNotifications({ predictions: v })}
          />
          <SettingToggle
            icon={<FireIcon size={20} color={colors.warning} />}
            title="Daily Challenges"
            subtitle="Reminders for challenges"
            value={settings.notifications.challenges}
            onValueChange={(v) => updateNotifications({ challenges: v })}
          />
          <SettingToggle
            icon={<UserIcon size={20} color={colors.textSecondary} />}
            title="Friend Activity"
            subtitle="When friends place predictions"
            value={settings.notifications.friends}
            onValueChange={(v) => updateNotifications({ friends: v })}
          />
          <SettingToggle
            icon={<GemIcon size={20} color={colors.gems} />}
            title="Promotions"
            subtitle="Special offers and rewards"
            value={settings.notifications.marketing}
            onValueChange={(v) => updateNotifications({ marketing: v })}
            isLast
          />
        </Card>
      </MotiView>

      {/* Privacy */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 200 }}
      >
        <Text style={styles.sectionLabel}>Privacy</Text>
        <Card style={styles.settingsCard}>
          <SettingToggle
            icon={<StarIcon size={20} color={colors.stars} />}
            title="Show on Leaderboard"
            subtitle="Let others see your ranking"
            value={settings.privacy.showOnLeaderboard}
            onValueChange={(v) => updatePrivacy({ showOnLeaderboard: v })}
          />
          <SettingToggle
            icon={<EyeIcon size={20} color={colors.textSecondary} />}
            title="Share Activity"
            subtitle="Friends can see your bets"
            value={settings.privacy.showActivityToFriends}
            onValueChange={(v) => updatePrivacy({ showActivityToFriends: v })}
          />
          <SettingToggle
            icon={<UserIcon size={20} color={colors.textSecondary} />}
            title="Friend Requests"
            subtitle="Allow others to add you"
            value={settings.privacy.allowFriendRequests}
            onValueChange={(v) => updatePrivacy({ allowFriendRequests: v })}
            isLast
          />
        </Card>
      </MotiView>

      {/* Help & Support */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 250 }}
      >
        <Text style={styles.sectionLabel}>Support</Text>
        <Card style={styles.settingsCard}>
          <Pressable style={styles.menuItem}>
            <HelpIcon size={20} color={colors.textSecondary} />
            <Text style={styles.menuText}>Help & FAQ</Text>
            <ChevronRightIcon size={18} color={colors.textMuted} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.menuItem}>
            <SettingsIcon size={20} color={colors.textSecondary} />
            <Text style={styles.menuText}>Terms & Conditions</Text>
            <ChevronRightIcon size={18} color={colors.textMuted} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={[styles.menuItem, styles.menuItemLast]}>
            <EyeIcon size={20} color={colors.textSecondary} />
            <Text style={styles.menuText}>Privacy Policy</Text>
            <ChevronRightIcon size={18} color={colors.textMuted} />
          </Pressable>
        </Card>
      </MotiView>

      {/* Logout */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 300 }}
      >
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutButton}
        />
        <Text style={styles.version}>Sport Sage v1.0.0</Text>
      </MotiView>
    </ScrollView>
  );
}

interface SettingToggleProps {
  icon: React.ReactElement;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  isLast?: boolean;
}

function SettingToggle({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  isLast,
}: SettingToggleProps): React.ReactElement {
  return (
    <>
      <View style={styles.settingRow}>
        {icon}
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.primaryMuted }}
          thumbColor={value ? colors.primary : colors.textMuted}
        />
      </View>
      {!isLast && <View style={styles.divider} />}
    </>
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
  profileCard: {
    marginBottom: layout.spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: layout.spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: layout.spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  username: {
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  email: {
    fontSize: layout.fontSize.sm,
    color: colors.textMuted,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
  },
  balanceValue: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
    marginTop: layout.spacing.sm,
    justifyContent: 'center',
  },
  streakText: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  sectionCard: {
    marginBottom: layout.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionInfo: {
    flex: 1,
    marginLeft: layout.spacing.md,
  },
  sectionTitle: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: layout.fontSize.sm,
    color: colors.textMuted,
  },
  shieldShop: {
    marginBottom: layout.spacing.md,
  },
  shieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    marginBottom: layout.spacing.xs,
  },
  shieldInfo: {
    flex: 1,
    marginLeft: layout.spacing.md,
  },
  shieldName: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  shieldDesc: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
  },
  shieldPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardElevated,
    paddingHorizontal: layout.spacing.sm,
    paddingVertical: layout.spacing.xs,
    borderRadius: layout.borderRadius.sm,
  },
  shieldPriceText: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.bold,
    color: colors.gems,
  },
  sectionLabel: {
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textMuted,
    marginTop: layout.spacing.md,
    marginBottom: layout.spacing.sm,
    marginLeft: layout.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsCard: {
    marginBottom: layout.spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginLeft: layout.spacing.md,
  },
  settingTitle: {
    fontSize: layout.fontSize.md,
    color: colors.textPrimary,
  },
  settingSubtitle: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.spacing.md,
  },
  menuItemLast: {
    paddingBottom: 0,
  },
  menuText: {
    flex: 1,
    fontSize: layout.fontSize.md,
    color: colors.textPrimary,
    marginLeft: layout.spacing.md,
  },
  logoutButton: {
    marginTop: layout.spacing.lg,
    borderColor: colors.error,
  },
  version: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: layout.spacing.md,
  },
});
