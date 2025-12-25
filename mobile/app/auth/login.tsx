import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { Button, Input } from '@/components/ui';
import { EyeIcon, EyeOffIcon } from '@/components/icons';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';
import { useAuth } from '@/lib/store';

export default function LoginScreen(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();

  const handleLogin = async (): Promise<void> => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid email or password';
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
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to continue your predictions
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
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            rightIcon={showPassword ? <EyeOffIcon size={20} color={colors.textSecondary} /> : <EyeIcon size={20} color={colors.textSecondary} />}
            onRightIconPress={() => setShowPassword(!showPassword)}
          />

          <Link href="/auth/forgot-password" asChild>
            <Pressable style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </Pressable>
          </Link>

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading}
            size="lg"
            style={styles.submitButton}
          />

          <View style={styles.registerLink}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <Link href="/auth/register" asChild>
              <Pressable>
                <Text style={styles.registerLinkText}>Sign up</Text>
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
  showHide: {
    fontSize: layout.fontSize.lg,
  },
  submitButton: {
    marginTop: layout.spacing.md,
  },
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: layout.spacing.md,
  },
  registerText: {
    color: colors.textSecondary,
    fontSize: layout.fontSize.md,
  },
  registerLinkText: {
    color: colors.primary,
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -layout.spacing.sm,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.medium,
  },
});
