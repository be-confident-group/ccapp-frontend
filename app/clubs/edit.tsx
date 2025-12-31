import React, { useState, useCallback, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { useClub, useUpdateClub } from '@/lib/hooks/useClubs';
import { pickAndProcessImage } from '@/lib/utils/imageHelpers';
import { PhotoIcon, XMarkIcon } from 'react-native-heroicons/outline';
import type { ClubUpdateRequest } from '@/types/feed';

export default function EditClubScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const clubId = params.id ? parseInt(params.id, 10) : 0;

  const { data: club, isLoading } = useClub(clubId);
  const updateClubMutation = useUpdateClub();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  // Pre-populate form when club data loads
  useEffect(() => {
    if (club) {
      setName(club.name);
      setDescription(club.description || '');
      // Don't set photoBase64 from club.photo - it's a URL, not base64
      // We only set photoBase64 when user picks a new photo
    }
  }, [club]);

  const handlePickPhoto = useCallback(async () => {
    try {
      const base64 = await pickAndProcessImage({
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.7,
      });

      if (base64) {
        setPhotoBase64(base64);
        setPhotoChanged(true);
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      alert('Failed to pick photo');
    }
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setPhotoBase64(null);
    setPhotoChanged(true);
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: { name?: string; description?: string } = {};

    if (!name.trim()) {
      newErrors.name = t('clubs.errors.nameRequired', 'Club name is required');
    } else if (name.trim().length < 3) {
      newErrors.name = t('clubs.errors.nameTooShort', 'Club name must be at least 3 characters');
    }

    if (description.trim().length > 500) {
      newErrors.description = t('clubs.errors.descriptionTooLong', 'Description is too long (max 500 characters)');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, description, t]);

  const handleSave = useCallback(async () => {
    if (!validateForm() || !clubId) return;

    const clubData: ClubUpdateRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
    };

    // Only include photo if it was changed
    if (photoChanged) {
      clubData.photo = photoBase64 || undefined;
    }

    try {
      await updateClubMutation.mutateAsync({ id: clubId, data: clubData });
      router.back();
    } catch (error) {
      console.error('Error updating club:', error);
      alert(error instanceof Error ? error.message : 'Failed to update club');
    }
  }, [clubId, name, description, photoBase64, photoChanged, validateForm, updateClubMutation]);

  // Get current photo to display (new photo or existing)
  const displayPhoto = photoChanged ? photoBase64 : club?.photo;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <Header title={t('clubs.editClub', 'Edit Club')} showBack />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!club) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <Header title={t('clubs.editClub', 'Edit Club')} showBack />
        <View style={styles.loading}>
          <ThemedText>{t('clubs.notFoundMessage', 'This club does not exist.')}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <Header title={t('clubs.editClub', 'Edit Club')} showBack />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedView style={styles.content}>
            {/* Photo Section */}
            <View style={styles.section}>
              <ThemedText style={styles.label}>
                {t('clubs.photo', 'Club Photo')} {t('clubs.optional', '(Optional)')}
              </ThemedText>
              {displayPhoto ? (
                <View style={styles.photoContainer}>
                  <Image source={{ uri: displayPhoto }} style={styles.photo} />
                  <TouchableOpacity
                    style={[styles.removePhotoButton, { backgroundColor: colors.error }]}
                    onPress={handleRemovePhoto}
                    activeOpacity={0.8}
                  >
                    <XMarkIcon size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.changePhotoButton, { backgroundColor: colors.card }]}
                    onPress={handlePickPhoto}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={[styles.changePhotoText, { color: colors.primary }]}>
                      {t('clubs.changePhoto', 'Change')}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.photoPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={handlePickPhoto}
                  activeOpacity={0.7}
                >
                  <PhotoIcon size={48} color={colors.textMuted} />
                  <ThemedText style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>
                    {t('clubs.addPhoto', 'Add Photo')}
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {/* Name Field */}
            <View style={styles.section}>
              <ThemedText style={styles.label}>
                {t('clubs.name', 'Club Name')} *
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.card, color: colors.text, borderColor: errors.name ? colors.error : colors.border },
                ]}
                placeholder={t('clubs.namePlaceholder', 'Enter club name')}
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                maxLength={100}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {errors.name && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {errors.name}
                </ThemedText>
              )}
            </View>

            {/* Description Field */}
            <View style={styles.section}>
              <ThemedText style={styles.label}>
                {t('clubs.description', 'Description')} {t('clubs.optional', '(Optional)')}
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { backgroundColor: colors.card, color: colors.text, borderColor: errors.description ? colors.error : colors.border },
                ]}
                placeholder={t('clubs.descriptionPlaceholder', 'Describe your club...')}
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                maxLength={500}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoCapitalize="sentences"
              />
              {errors.description && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {errors.description}
                </ThemedText>
              )}
              <ThemedText style={[styles.characterCount, { color: colors.textMuted }]}>
                {description.length}/500
              </ThemedText>
            </View>
          </ThemedView>
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.primary },
              (!name.trim() || updateClubMutation.isPending) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!name.trim() || updateClubMutation.isPending}
            activeOpacity={0.8}
          >
            {updateClubMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={[styles.saveButtonText, { color: '#fff' }]}>
                {t('clubs.saveChanges', 'Save Changes')}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  photoContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 200,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  photoPlaceholderText: {
    fontSize: 14,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.md,
  },
  errorText: {
    fontSize: 12,
    marginTop: -Spacing.xs,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: -Spacing.xs,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  saveButton: {
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
