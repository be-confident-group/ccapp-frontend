import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

interface TripFormFieldProps extends TextInputProps {
  /** Trailing unit text shown inside the field (e.g. "hours"). */
  unit?: string;
}

/** Rounded form input (radius 12) using the input tokens, with optional trailing unit. */
export function TripFormField({ unit, style, editable = true, onFocus, onBlur, ...props }: TripFormFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: colors.inputBackground,
          borderColor: focused ? colors.glassTint : colors.inputBorder,
          opacity: editable ? 1 : 0.6,
        },
      ]}
    >
      <TextInput
        {...props}
        editable={editable}
        placeholderTextColor={colors.textSecondary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, { color: colors.text }, style]}
      />
      {unit ? <Text style={[styles.unit, { color: colors.textSecondary }]}>{unit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  unit: {
    fontSize: 14,
    marginLeft: 8,
  },
});
