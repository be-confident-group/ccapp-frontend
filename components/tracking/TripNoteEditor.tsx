import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { database } from '@/lib/database';
import { syncService } from '@/lib/services/SyncService';
import { Spacing } from '@/constants/theme';

interface Props {
  tripId: string;
  initialValue: string | null | undefined;
  onSaved: () => void;
}

export function TripNoteEditor({ tripId, initialValue, onSaved }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation('maps');
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue ?? '');

  useEffect(() => {
    if (!isEditing) {
      setValue(initialValue ?? '');
    }
  }, [initialValue, isEditing]);

  async function handleSave() {
    await database.updateTrip(tripId, { user_note: value || null, user_note_dirty: 1 });
    void syncService.patchTripFields(tripId).catch(() => {/* ok, will retry */});
    setIsEditing(false);
    onSaved();
  }

  function handleCancel() {
    setValue(initialValue ?? '');
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <View style={styles.container}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={t('trip_detail.notes_placeholder')}
          placeholderTextColor={colors.textSecondary}
          multiline
          autoFocus
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
        />
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleCancel} style={[styles.btn, { borderColor: colors.border }]}>
            <ThemedText style={{ color: colors.textSecondary }}>{t('trip_detail.notes_cancel')}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={[styles.btn, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            <ThemedText style={{ color: '#fff', fontWeight: '600' }}>{t('trip_detail.notes_save')}</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.7} style={styles.container}>
      <ThemedText style={[styles.noteText, !value && { color: colors.textSecondary, fontStyle: 'italic' }]}>
        {value || t('trip_detail.notes_placeholder')}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.sm,
    minHeight: 80,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: Spacing.xs,
  },
  btn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  noteText: { fontSize: 14, lineHeight: 20 },
});
