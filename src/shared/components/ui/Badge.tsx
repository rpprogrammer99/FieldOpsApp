import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'small' | 'medium';
}

export function Badge({label, variant = 'default', size = 'medium'}: BadgeProps) {
  return (
    <View style={[styles.base, styles[variant], styles[size]]}>
      <Text style={[styles.text, styles[`${variant}Text` as keyof typeof styles], styles[`${size}Text` as keyof typeof styles]]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  default: {
    backgroundColor: '#E5E5EA',
  },
  success: {
    backgroundColor: '#34C759',
  },
  warning: {
    backgroundColor: '#FF9500',
  },
  error: {
    backgroundColor: '#FF3B30',
  },
  info: {
    backgroundColor: '#007AFF',
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  medium: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  defaultText: {
    color: '#3C3C43',
  },
  successText: {
    color: '#FFFFFF',
  },
  warningText: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#FFFFFF',
  },
  infoText: {
    color: '#FFFFFF',
  },
  smallText: {
    fontSize: 10,
  },
  mediumText: {
    fontSize: 12,
  },
});
