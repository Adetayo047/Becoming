import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  hint,
  rightIcon,
  containerStyle,
  isPassword = false,
  style,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, focused && styles.focused, !!error && styles.errorBorder]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.grey[400]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.iconButton}>
            <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        )}
        {rightIcon && !isPassword && (
          <View style={styles.iconButton}>{rightIcon}</View>
        )}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.text.primary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  focused: { borderColor: Colors.purple },
  errorBorder: { borderColor: Colors.error },
  input: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text.primary,
    paddingVertical: Spacing.md,
  },
  iconButton: { paddingLeft: Spacing.sm },
  eyeText: { fontSize: 16 },
  error: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.error,
  },
  hint: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.text.muted,
  },
});
