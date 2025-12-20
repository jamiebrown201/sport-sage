import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle } from 'react-native-svg';
import { Button } from '@/components/ui';
import { TrophyIcon, CoinIcon, StarIcon, TargetIcon } from '@/components/icons';
import { useAuth } from '@/lib/store';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

// Apple logo icon
function AppleIcon({ size = 20, color = '#fff' }: { size?: number; color?: string }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

// Google logo icon
function GoogleIcon({ size = 20 }: { size?: number }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

// Email icon
function EmailIcon({ size = 20, color = colors.textPrimary }: { size?: number; color?: string }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6l8 5 8-5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 6h16v12H4V6z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function LandingScreen(): React.ReactElement {
  const { loginWithApple, loginWithGoogle } = useAuth();

  const handleAppleSignIn = async (): Promise<void> => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await loginWithApple();
    router.replace('/auth/username');
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await loginWithGoogle();
    router.replace('/auth/username');
  };

  const handleEmailSignIn = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/auth/register');
  };

  const handleLogin = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/auth/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo Section */}
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600 }}
          style={styles.logoContainer}
        >
          <View style={styles.logoIcon}>
            <TrophyIcon size={64} color={colors.primary} />
          </View>
          <Text style={styles.title}>Sport Sage</Text>
          <Text style={styles.subtitle}>Predict. Win. Compete.</Text>
        </MotiView>

        {/* Feature highlights */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 600, delay: 300 }}
          style={styles.features}
        >
          <FeatureItem
            Icon={CoinIcon}
            iconColor={colors.coins}
            title="1,000 Free Coins"
            description="Start with coins to make predictions"
          />
          <FeatureItem
            Icon={StarIcon}
            iconColor={colors.stars}
            title="Earn Stars"
            description="Win predictions to climb the leaderboard"
          />
          <FeatureItem
            Icon={TargetIcon}
            iconColor={colors.primary}
            title="No Real Money"
            description="All the fun, zero financial risk"
          />
        </MotiView>

        {/* Auth buttons */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600, delay: 600 }}
          style={styles.authSection}
        >
          {/* Social sign-in buttons */}
          <Pressable
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          >
            <AppleIcon size={20} color="#fff" />
            <Text style={styles.appleButtonText}>Continue with Apple</Text>
          </Pressable>

          <Pressable
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
          >
            <GoogleIcon size={20} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </Pressable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email option */}
          <Pressable
            style={styles.emailButton}
            onPress={handleEmailSignIn}
          >
            <EmailIcon size={20} color={colors.textPrimary} />
            <Text style={styles.emailButtonText}>Continue with Email</Text>
          </Pressable>

          {/* Existing account link */}
          <Pressable onPress={handleLogin} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>Already have an account? <Text style={styles.loginLinkHighlight}>Sign in</Text></Text>
          </Pressable>
        </MotiView>
      </View>
    </SafeAreaView>
  );
}

interface FeatureItemProps {
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  iconColor: string;
  title: string;
  description: string;
}

function FeatureItem({ Icon, iconColor, title, description }: FeatureItemProps): React.ReactElement {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        <Icon size={28} color={iconColor} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.spacing.lg,
    justifyContent: 'space-between',
    paddingBottom: layout.spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: layout.spacing.xxl,
  },
  logoIcon: {
    marginBottom: layout.spacing.md,
  },
  title: {
    fontSize: layout.fontSize.xxxl,
    fontWeight: layout.fontWeight.bold,
    color: colors.primary,
    marginBottom: layout.spacing.xs,
  },
  subtitle: {
    fontSize: layout.fontSize.lg,
    color: colors.textSecondary,
  },
  features: {
    gap: layout.spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    gap: layout.spacing.md,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: layout.borderRadius.md,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  authSection: {
    gap: layout.spacing.md,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.spacing.sm,
    backgroundColor: '#000',
    paddingVertical: layout.spacing.md,
    paddingHorizontal: layout.spacing.lg,
    borderRadius: layout.borderRadius.lg,
  },
  appleButtonText: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: '#fff',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.spacing.sm,
    backgroundColor: '#fff',
    paddingVertical: layout.spacing.md,
    paddingHorizontal: layout.spacing.lg,
    borderRadius: layout.borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleButtonText: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: '#1f1f1f',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.md,
    marginVertical: layout.spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: layout.fontSize.sm,
    color: colors.textMuted,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.spacing.sm,
    backgroundColor: colors.card,
    paddingVertical: layout.spacing.md,
    paddingHorizontal: layout.spacing.lg,
    borderRadius: layout.borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emailButtonText: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: layout.spacing.sm,
  },
  loginLinkText: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  loginLinkHighlight: {
    color: colors.primary,
    fontWeight: layout.fontWeight.semibold,
  },
});
