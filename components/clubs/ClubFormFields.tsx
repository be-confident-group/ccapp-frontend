import React from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PhotoIcon, XMarkIcon } from 'react-native-heroicons/outline';

import { SettingsGroup } from '@/components/profile/SettingsGroup';
import { ThemedText } from '@/components/themed-text';
import Button from '@/components/ui/Button';
import { GlassButton } from '@/components/ui/GlassButton';
import { GlassTextSegments } from '@/components/ui/GlassTextSegments';
import { useTheme } from '@/contexts/ThemeContext';

interface ClubFormFieldsProps {
  /** Photo to display (data URI or remote URL), if any. */
  photoUri?: string | null;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  isPrivate: boolean;
  onPrivateChange: (value: boolean) => void;
  errors: { name?: string; description?: string };
  /** Show a "Change" button over an existing photo. */
  allowChangePhoto?: boolean;
  /** Optional note shown under the visibility card. */
  footnote?: string;
}

/** Grouped form cards (photo, details, visibility) shared by the create and edit club screens. */
export function ClubFormFields({
  photoUri,
  onPickPhoto,
  onRemovePhoto,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  isPrivate,
  onPrivateChange,
  errors,
  allowChangePhoto = false,
  footnote,
}: ClubFormFieldsProps) {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();

  const inputStyle = (hasError: boolean) => [
    styles.input,
    {
      backgroundColor: colors.inputBackground,
      color: colors.text,
      borderColor: hasError ? colors.error : colors.inputBorder,
    },
  ];

  return (
    <>
      <SettingsGroup title={`${t('clubs.photo', 'Group Photo')} ${t('clubs.optional', '(Optional)')}`} index={0}>
        <View style={styles.cardBody}>
          {photoUri ? (
            <View>
              <Image source={{ uri: photoUri }} style={styles.photo} />
              <View style={styles.photoActions}>
                {allowChangePhoto ? (
                  <Button
                    title={t('clubs.changePhoto', 'Change')}
                    variant="glass"
                    size="small"
                    onPress={onPickPhoto}
                  />
                ) : null}
                <GlassButton
                  onPress={onRemovePhoto}
                  accessibilityLabel={t('clubs.removePhoto', { defaultValue: 'Remove photo' })}
                  size={36}
                >
                  <XMarkIcon size={18} color={colors.glassInactive} />
                </GlassButton>
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('clubs.addPhoto', 'Add Photo')}
              onPress={onPickPhoto}
              style={({ pressed }) => [
                styles.photoPlaceholder,
                { borderColor: colors.inputBorder, backgroundColor: pressed ? colors.glassHighlight : colors.inputBackground },
              ]}
            >
              <View style={[styles.photoCircle, { backgroundColor: colors.glassHighlight }]}>
                <PhotoIcon size={28} color={colors.glassTint} />
              </View>
              <ThemedText style={[styles.photoText, { color: colors.textSecondary }]}>
                {t('clubs.addPhoto', 'Add Photo')}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </SettingsGroup>

      <SettingsGroup title={t('clubs.details', { defaultValue: 'Details' })} index={1}>
        <View style={styles.cardBody}>
          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('clubs.name', 'Group Name')} *</ThemedText>
            <TextInput
              style={inputStyle(!!errors.name)}
              placeholder={t('clubs.namePlaceholder', 'Enter group name')}
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={onNameChange}
              maxLength={100}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {errors.name ? (
              <ThemedText style={[styles.errorText, { color: colors.error }]}>{errors.name}</ThemedText>
            ) : null}
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>
              {t('clubs.description', 'Description')} {t('clubs.optional', '(Optional)')}
            </ThemedText>
            <TextInput
              style={[...inputStyle(!!errors.description), styles.textArea]}
              placeholder={t('clubs.descriptionPlaceholder', 'Describe your group...')}
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={onDescriptionChange}
              maxLength={500}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoCapitalize="sentences"
            />
            {errors.description ? (
              <ThemedText style={[styles.errorText, { color: colors.error }]}>{errors.description}</ThemedText>
            ) : null}
            <ThemedText style={[styles.characterCount, { color: colors.textMuted }]}>
              {description.length}/500
            </ThemedText>
          </View>
        </View>
      </SettingsGroup>

      <SettingsGroup title={t('clubs.visibility', 'Visibility')} index={2}>
        <View style={styles.cardBody}>
          <GlassTextSegments
            stretch
            value={isPrivate ? 'private' : 'public'}
            onChange={(key) => onPrivateChange(key === 'private')}
            items={[
              { key: 'public', label: t('clubs.public', 'Public') },
              { key: 'private', label: t('clubs.private', 'Private') },
            ]}
          />
          <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
            {isPrivate
              ? t('clubs.privateHint', 'Members must request to join')
              : t('clubs.publicHint', 'Anyone can join directly')}
          </ThemedText>
        </View>
      </SettingsGroup>

      {footnote ? (
        <ThemedText style={[styles.footnote, { color: colors.textSecondary }]}>{footnote}</ThemedText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  cardBody: { padding: 16, gap: 12 },
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: '600' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 110 },
  errorText: { fontSize: 13 },
  characterCount: { fontSize: 12, textAlign: 'right' },
  hint: { fontSize: 13, lineHeight: 18 },
  photo: { width: '100%', height: 180, borderRadius: 14 },
  photoActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoPlaceholder: {
    height: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  photoCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  photoText: { fontSize: 14, fontWeight: '500' },
  footnote: { fontSize: 13, lineHeight: 18, paddingHorizontal: 32, marginTop: -12, marginBottom: 24 },
});
