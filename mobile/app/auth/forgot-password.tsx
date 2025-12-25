import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput as RNTextInput } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { Button, Input } from '@/components/ui';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';
import { useAuth } from '@/lib/store';

function LockIcon({ size = 48, color = colors.primary }: { size?: number; color?: string }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4"
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

type Step = 'email' | 'code' | 'success';
const CODE_LENGTH = 6;

export default function ForgotPasswordScreen(): React.ReactElement {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const inputRefs = useRef<(RNTextInput | null)[]>([]);
  const {
    forgotPassword,
    confirmForgotPassword,
    pendingPasswordReset,
    passwordResetEmail,
  } = useAuth();

  // Sync with auth state
  useEffect(() => {
    if (pendingPasswordReset && passwordResetEmail && step === 'email') {
      setEmail(passwordResetEmail);
      setStep('code');
    }
  }, [pendingPasswordReset, passwordResetEmail, step]);

  const handleRequestCode = async (): Promise<void> => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await forgotPassword(email);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('code');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset code. Please try again.';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (value: string, index: number): void => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number): void => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResetPassword = async (): Promise<void> => {
    const codeValue = code.join('');

    if (codeValue.length !== CODE_LENGTH) {
      setError('Please enter the full 6-digit code');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      setError('Password must contain uppercase, lowercase, number, and special character');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await confirmForgotPassword(codeValue, newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password. Please try again.';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    : '';

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
        </MotiView>

        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: 200 }}
          style={styles.iconContainer}
        >
          <View style={styles.iconWrapper}>
            <LockIcon size={48} color={colors.primary} />
          </View>
        </MotiView>

        {step === 'email' && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 400, delay: 300 }}
          >
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a code to reset your password.
            </Text>

            <View style={styles.form}>
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

              <Button
                title="Send Reset Code"
                onPress={handleRequestCode}
                loading={isLoading}
                disabled={isLoading || !email}
                size="lg"
              />
            </View>
          </MotiView>
        )}

        {step === 'code' && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 400 }}
          >
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter the code sent to{'\n'}
              <Text style={styles.email}>{maskedEmail}</Text>
            </Text>

            <View style={styles.form}>
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.codeContainer}>
                {code.map((digit, index) => (
                  <RNTextInput
                    key={index}
                    ref={(ref) => { inputRefs.current[index] = ref; }}
                    style={[
                      styles.codeInput,
                      digit ? styles.codeInputFilled : null,
                      error ? styles.codeInputError : null,
                    ]}
                    value={digit}
                    onChangeText={(value) => handleCodeChange(value, index)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    selectTextOnFocus
                  />
                ))}
              </View>

              <Input
                label="New Password"
                placeholder="Create a new password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                rightIcon={showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                onRightIconPress={() => setShowPassword(!showPassword)}
              />

              <Text style={styles.passwordHint}>
                Password must be at least 8 characters with uppercase, lowercase, number, and special character.
              </Text>

              <Button
                title="Reset Password"
                onPress={handleResetPassword}
                loading={isLoading}
                disabled={isLoading || code.join('').length !== CODE_LENGTH || !newPassword}
                size="lg"
              />
            </View>
          </MotiView>
        )}

        {step === 'success' && (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 200 }}
          >
            <Text style={styles.title}>Password Reset!</Text>
            <Text style={styles.subtitle}>
              Your password has been successfully reset. You can now sign in with your new password.
            </Text>

            <View style={styles.form}>
              <Button
                title="Sign In"
                onPress={() => router.replace('/auth/login')}
                size="lg"
              />
            </View>
          </MotiView>
        )}
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
    marginBottom: layout.spacing.xl,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: layout.fontSize.md,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: layout.spacing.lg,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  title: {
    fontSize: layout.fontSize.xxl,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: layout.spacing.sm,
  },
  subtitle: {
    fontSize: layout.fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: layout.spacing.xl,
    lineHeight: 22,
  },
  email: {
    color: colors.primary,
    fontWeight: layout.fontWeight.semibold,
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
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.md,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: layout.borderRadius.md,
    fontSize: layout.fontSize.xl,
    fontWeight: layout.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    backgroundColor: colors.card,
  },
  codeInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  codeInputError: {
    borderColor: colors.error,
    backgroundColor: 'rgba(239, 83, 80, 0.1)',
  },
  passwordHint: {
    color: colors.textMuted,
    fontSize: layout.fontSize.xs,
    textAlign: 'center',
    marginTop: -layout.spacing.sm,
  },
});
