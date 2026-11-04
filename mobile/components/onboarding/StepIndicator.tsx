import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '../../constants/theme';

interface StepIndicatorProps {
  total: number;
  current: number;
}

export function StepIndicator({ total, current }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < current && styles.completed,
            i === current - 1 && styles.active,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
  active: {
    width: 24,
    backgroundColor: Colors.purple,
  },
  completed: {
    backgroundColor: Colors.purpleLight,
  },
});
