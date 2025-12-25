import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { Button, Input } from '@/components/ui';
import { GiftIcon, CoinIcon, ChevronRightIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';
import { useAuth } from '@/lib/store';

function EyeIcon({ size = 20, color = colors.textMuted }: { size?: number; color?: string }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function EyeOffIcon({ size = 20, color = colors.textMuted }: { size?: number; color?: string }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M1 1l22 22"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BackIcon({ size = 20, color = colors.textSecondary }: { size?: number; color?: string }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function RegisterScreen(): React.ReactElement {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { register } = useAuth();

  const handleRegister = async (): Promise<void> => {
    if (!username || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Password must contain uppercase, lowercase, number, and special character
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      setError('Password must contain uppercase, lowercase, number, and special character');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await register(username, email, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate to verification screen
      router.replace('/auth/verify');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <BackIcon size={20} color={colors.textSecondary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join and get 1,000 coins to start predicting!
          </Text>
        </MotiView>

        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
          style={styles.form}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Input
            label="Username"
            placeholder="Choose a username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoComplete="username"
          />

          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Input
            label="Password"
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            rightIcon={showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
            onRightIconPress={() => setShowPassword(!showPassword)}
          />

          <View style={styles.welcome}>
            <View style={styles.welcomeIconContainer}>
              <GiftIcon size={28} color={colors.primary} />
            </View>
            <View style={styles.welcomeTextContainer}>
              <Text style={styles.welcomeTitle}>Welcome Bonus</Text>
              <View style={styles.welcomeCoins}>
                <Text style={styles.welcomeDescription}>You'll receive 1,000</Text>
                <CoinIcon size={14} color={colors.coins} />
                <Text style={styles.welcomeDescription}>to start!</Text>
              </View>
            </View>
          </View>

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={isLoading}
            disabled={isLoading}
            size="lg"
          />

          <View style={styles.loginLink}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Link href="/auth/login" asChild>
              <Pressable>
                <Text style={styles.loginLinkText}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </MotiView>
      </View>
    </SafeAreaView>
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
    paddingTop: layout.spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.xs,
    marginBottom: layout.spacing.lg,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: layout.fontSize.md,
  },
  title: {
    fontSize: layout.fontSize.xxl,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: layout.spacing.sm,
  },
  subtitle: {
    fontSize: layout.fontSize.md,
    color: colors.textSecondary,
    marginBottom: layout.spacing.xl,
  },
  form: {
    gap: layout.spacing.lg,
  },
  error: {
    color: colors.error,
    fontSize: layout.fontSize.sm,
    textAlign: 'center',
    padding: layout.spacing.md,
    backgroundColor: 'rgba(239, 83, 80, 0.1)',
    borderRadius: layout.borderRadius.md,
  },
  welcome: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryDim,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    gap: layout.spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  welcomeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: layout.borderRadius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
    color: colors.primary,
  },
  welcomeCoins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  welcomeDescription: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: layout.spacing.md,
  },
  loginText: {
    color: colors.textSecondary,
    fontSize: layout.fontSize.md,
  },
  loginLinkText: {
    color: colors.primary,
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
  },
});
