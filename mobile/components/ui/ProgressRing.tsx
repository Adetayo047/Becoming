import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Fonts } from '../../constants/theme';

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  labelSize?: number;
  sublabel?: string;
}

export function ProgressRing({
  percent,
  size = 80,
  strokeWidth = 8,
  color = Colors.purple,
  trackColor = Colors.grey[100],
  label,
  labelSize = 16,
  sublabel,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  const center = size / 2;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {label && <Text style={[styles.label, { color, fontSize: labelSize }]}>{label}</Text>}
        {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: Fonts.bold, fontSize: 16 },
  sublabel: { fontFamily: Fonts.regular, fontSize: 10, color: Colors.text.muted },
});
