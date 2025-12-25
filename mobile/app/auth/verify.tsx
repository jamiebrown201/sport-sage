import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput as RNTextInput } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { Button } from '@/components/ui';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';
import { useAuth } from '@/lib/store';

function MailIcon({ size = 48, color = colors.primary }: { size?: number; color?: string }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 6l-10 7L2 6"
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

const CODE_LENGTH = 6;

export default function VerifyScreen(): React.ReactElement {
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(RNTextInput | null)[]>([]);
  const { verifyEmail, resendVerificationCode, verificationEmail, pendingVerification } = useAuth();

  // Redirect if no pending verification
  useEffect(() => {
    if (!pendingVerification || !verificationEmail) {
      router.replace('/auth/login');
    }
  }, [pendingVerification, verificationEmail]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = (value: string, index: number): void => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-advance to next input
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (digit && index === CODE_LENGTH - 1) {
      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyPress = (key: string, index: number): void => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (verifyCode?: string): Promise<void> => {
    const codeToVerify = verifyCode || code.join('');

    if (codeToVerify.length !== CODE_LENGTH) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await verifyEmail(codeToVerify);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate to login - user must sign in after verification
      router.replace('/auth/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed. Please try again.';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Clear code on error
      setCode(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    setError('');

    try {
      await resendVerificationCode();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResendCooldown(60); // 60 second cooldown
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend code. Please try again.';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsResending(false);
    }
  };

  const maskedEmail = verificationEmail
    ? verificationEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')
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
            <MailIcon size={48} color={colors.primary} />
          </View>
        </MotiView>

        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 300 }}
        >
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to{'\n'}
            <Text style={styles.email}>{maskedEmail}</Text>
          </Text>
        </MotiView>

        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 400 }}
          style={styles.form}
        >
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

          <Button
            title="Verify Email"
            onPress={() => handleVerify()}
            loading={isLoading}
            disabled={isLoading || code.join('').length !== CODE_LENGTH}
            size="lg"
          />

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <Pressable onPress={handleResend} disabled={resendCooldown > 0 || isResending}>
              <Text style={[styles.resendLink, resendCooldown > 0 && styles.resendLinkDisabled]}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
              </Text>
            </Pressable>
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
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: layout.spacing.md,
  },
  resendText: {
    color: colors.textSecondary,
    fontSize: layout.fontSize.md,
  },
  resendLink: {
    color: colors.primary,
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.semibold,
  },
  resendLinkDisabled: {
    color: colors.textMuted,
  },
});
