import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui';
import { UserIcon, CheckIcon, AlertIcon, CoinIcon } from '@/components/icons';
import { useAuth } from '@/lib/store';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 16;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export default function UsernameScreen(): React.ReactElement {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setUsername: saveUsername, hasCompletedOnboarding } = useAuth();

  const usernameError = getValidationError(username);
  const isValid = username.length >= USERNAME_MIN_LENGTH && !usernameError;

  const handleContinue = async (): Promise<void> => {
    if (!isValid) return;

    setIsLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await saveUsername(username);

    // If user hasn't done onboarding yet, show them the slides
    if (!hasCompletedOnboarding) {
      router.replace('/onboarding');
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500 }}
            style={styles.header}
          >
            <View style={styles.iconContainer}>
              <UserIcon size={48} color={colors.primary} />
            </View>
            <Text style={styles.title}>Choose Your Name</Text>
            <Text style={styles.subtitle}>
              This is how other players will see you on the leaderboard
            </Text>
          </MotiView>

          {/* Username Input */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 200 }}
            style={styles.inputSection}
          >
            <View style={[
              styles.inputContainer,
              username.length > 0 && (isValid ? styles.inputValid : styles.inputError)
            ]}>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                maxLength={USERNAME_MAX_LENGTH}
              />
              {username.length > 0 && (
                <View style={styles.inputIcon}>
                  {isValid ? (
                    <CheckIcon size={20} color={colors.success} />
                  ) : (
                    <AlertIcon size={20} color={colors.error} />
                  )}
                </View>
              )}
            </View>

            {/* Validation message */}
            {username.length > 0 && usernameError && (
              <MotiView
                from={{ opacity: 0, translateY: -5 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 200 }}
              >
                <Text style={styles.errorText}>{usernameError}</Text>
              </MotiView>
            )}

            {/* Character count */}
            <Text style={styles.charCount}>
              {username.length}/{USERNAME_MAX_LENGTH}
            </Text>

            {/* Requirements */}
            <View style={styles.requirements}>
              <RequirementItem
                text="3-16 characters"
                met={username.length >= USERNAME_MIN_LENGTH && username.length <= USERNAME_MAX_LENGTH}
                active={username.length > 0}
              />
              <RequirementItem
                text="Letters, numbers, and underscores only"
                met={username.length > 0 && USERNAME_REGEX.test(username)}
                active={username.length > 0}
              />
            </View>
          </MotiView>

          {/* Welcome bonus info */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 400 }}
            style={styles.bonusSection}
          >
            <View style={styles.bonusCard}>
              <CoinIcon size={32} color={colors.coins} />
              <View style={styles.bonusText}>
                <Text style={styles.bonusTitle}>1,000 Free Coins</Text>
                <Text style={styles.bonusDescription}>Waiting for you to start playing!</Text>
              </View>
            </View>
          </MotiView>

          {/* Continue button */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 600 }}
            style={styles.buttonContainer}
          >
            <Button
              title="Continue"
              onPress={handleContinue}
              disabled={!isValid || isLoading}
              loading={isLoading}
              size="lg"
            />
          </MotiView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getValidationError(username: string): string | null {
  if (username.length === 0) return null;
  if (username.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MAX_LENGTH} characters or less`;
  }
  if (!USERNAME_REGEX.test(username)) {
    return 'Only letters, numbers, and underscores allowed';
  }
  // In production: check if username is taken
  return null;
}

interface RequirementItemProps {
  text: string;
  met: boolean;
  active: boolean;
}

function RequirementItem({ text, met, active }: RequirementItemProps): React.ReactElement {
  return (
    <View style={styles.requirementItem}>
      <View style={[
        styles.requirementDot,
        active && (met ? styles.requirementDotMet : styles.requirementDotUnmet)
      ]} />
      <Text style={[
        styles.requirementText,
        active && (met ? styles.requirementTextMet : styles.requirementTextUnmet)
      ]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.spacing.lg,
    paddingTop: layout.spacing.xxl,
    paddingBottom: layout.spacing.xl,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: layout.spacing.lg,
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
    textAlign: 'center',
    lineHeight: 22,
  },
  inputSection: {
    marginTop: layout.spacing.xl,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: layout.spacing.md,
  },
  inputValid: {
    borderColor: colors.success,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontSize: layout.fontSize.lg,
    fontWeight: layout.fontWeight.semibold,
    color: colors.textPrimary,
    paddingVertical: layout.spacing.md,
  },
  inputIcon: {
    marginLeft: layout.spacing.sm,
  },
  errorText: {
    fontSize: layout.fontSize.sm,
    color: colors.error,
    marginTop: layout.spacing.xs,
    marginLeft: layout.spacing.xs,
  },
  charCount: {
    fontSize: layout.fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: layout.spacing.xs,
  },
  requirements: {
    marginTop: layout.spacing.lg,
    gap: layout.spacing.sm,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.sm,
  },
  requirementDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  requirementDotMet: {
    backgroundColor: colors.success,
  },
  requirementDotUnmet: {
    backgroundColor: colors.error,
  },
  requirementText: {
    fontSize: layout.fontSize.sm,
    color: colors.textMuted,
  },
  requirementTextMet: {
    color: colors.success,
  },
  requirementTextUnmet: {
    color: colors.error,
  },
  bonusSection: {
    marginTop: layout.spacing.xl,
  },
  bonusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.spacing.md,
    backgroundColor: colors.card,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.coins,
    borderStyle: 'dashed',
  },
  bonusText: {
    flex: 1,
  },
  bonusTitle: {
    fontSize: layout.fontSize.md,
    fontWeight: layout.fontWeight.bold,
    color: colors.coins,
  },
  bonusDescription: {
    fontSize: layout.fontSize.sm,
    color: colors.textSecondary,
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingTop: layout.spacing.xl,
  },
});
