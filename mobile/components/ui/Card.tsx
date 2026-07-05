import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Shadow, Spacing } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

export function Card({ children, style, variant = 'default', padding = 'md' }: CardProps) {
  return (
    <View style={[styles.base, styles[variant], styles[`pad_${padding}`], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
  },
  default: { ...Shadow.sm },
  elevated: { ...Shadow.md },
  outlined: {
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  pad_none: {},
  pad_sm: { padding: Spacing.sm },
  pad_md: { padding: Spacing.md },
  pad_lg: { padding: Spacing.lg },
});
