import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
  Pressable,
} from 'react-native';
import { colors } from '@/constants/colors';
import { layout } from '@/constants/layout';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  ...props
}: InputProps): React.ReactElement {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (): void => {
    setIsFocused(true);
  };

  const handleBlur = (): void => {
    setIsFocused(false);
  };

  const getBorderColor = (): string => {
    if (error) return colors.error;
    if (isFocused) return colors.primary;
    return colors.border;
  };

  const inputStyles: TextStyle[] = [styles.input];
  if (leftIcon) inputStyles.push(styles.inputWithLeftIcon);
  if (rightIcon) inputStyles.push(styles.inputWithRightIcon);

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputContainer, { borderColor: getBorderColor() }]}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          {...props}
          style={inputStyles}
          placeholderTextColor={colors.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {rightIcon && (
          <Pressable onPress={onRightIconPress} style={styles.iconRight}>
            {rightIcon}
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {helper && !error && <Text style={styles.helper}>{helper}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    fontSize: layout.fontSize.sm,
    fontWeight: layout.fontWeight.medium,
    marginBottom: layout.spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: layout.borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: layout.fontSize.md,
    paddingVertical: layout.spacing.md,
    paddingHorizontal: layout.spacing.md,
  },
  inputWithLeftIcon: {
    paddingLeft: layout.spacing.sm,
  },
  inputWithRightIcon: {
    paddingRight: layout.spacing.sm,
  },
  iconLeft: {
    paddingLeft: layout.spacing.md,
  },
  iconRight: {
    paddingRight: layout.spacing.md,
  },
  error: {
    color: colors.error,
    fontSize: layout.fontSize.sm,
    marginTop: layout.spacing.xs,
  },
  helper: {
    color: colors.textMuted,
    fontSize: layout.fontSize.sm,
    marginTop: layout.spacing.xs,
  },
});
