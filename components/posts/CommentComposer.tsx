import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { PaperAirplaneIcon } from 'react-native-heroicons/solid';

import { GlassButton } from '@/components/ui/GlassButton';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';

const RADIUS = 26;

interface CommentComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  pending: boolean;
  placeholder: string;
  sendLabel: string;
}

/** Floating glass capsule: multiline comment field plus a circular glass send button. */
export function CommentComposer({ value, onChangeText, onSend, pending, placeholder, sendLabel }: CommentComposerProps) {
  const { colors } = useTheme();
  const canSend = value.trim().length > 0 && !pending;

  return (
    <View style={[styles.capsule, { shadowColor: colors.shadow }]}>
      <GlassSurface borderRadius={RADIUS} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        multiline
        maxLength={500}
        editable={!pending}
      />
      <GlassButton
        size={40}
        accessibilityLabel={sendLabel}
        onPress={() => {
          if (canSend) onSend();
        }}
      >
        {pending ? (
          <ActivityIndicator size="small" color={colors.glassTint} />
        ) : (
          <PaperAirplaneIcon size={18} color={canSend ? colors.glassTint : colors.glassInactive} />
        )}
      </GlassButton>
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: RADIUS,
    minHeight: 52,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingTop: 9,
    paddingBottom: 9,
  },
});
