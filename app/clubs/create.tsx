import React, { useState, useCallback } from 'react';
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
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { useCreateClub } from '@/lib/hooks/useClubs';
import { pickAndProcessImage } from '@/lib/utils/imageHelpers';
import { PhotoIcon, XMarkIcon } from 'react-native-heroicons/outline';
import type { ClubCreateRequest } from '@/types/feed';

export default function CreateClubScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  const createClubMutation = useCreateClub();

  const handlePickPhoto = useCallback(async () => {
    try {
      const base64 = await pickAndProcessImage({
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.7,
      });

      if (base64) {
        setPhotoBase64(base64);
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      alert('Failed to pick photo');
    }
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setPhotoBase64(null);
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

  const handleCreate = useCallback(async () => {
    if (!validateForm()) return;

    const clubData: ClubCreateRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      photo: photoBase64 || undefined,
    };

    try {
      const newClub = await createClubMutation.mutateAsync(clubData);

      // Navigate to the new club detail page
      router.replace(`/clubs/${newClub.id}`);
    } catch (error) {
      console.error('Error creating club:', error);
      alert(error instanceof Error ? error.message : 'Failed to create club');
    }
  }, [name, description, photoBase64, validateForm, createClubMutation]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('clubs.createClub', 'Create Club'),
        }}
      />
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
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
                {photoBase64 ? (
                  <View style={styles.photoContainer}>
                    <Image source={{ uri: photoBase64 }} style={styles.photo} />
                    <TouchableOpacity
                      style={[styles.removePhotoButton, { backgroundColor: colors.error }]}
                      onPress={handleRemovePhoto}
                      activeOpacity={0.8}
                    >
                      <XMarkIcon size={20} color="#fff" />
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

              {/* Info Box */}
              <View style={[styles.infoBox, { backgroundColor: colors.primary + '15' }]}>
                <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
                  {t('clubs.createInfo', 'You will be the owner of this club and can manage members and settings.')}
                </ThemedText>
              </View>
            </ThemedView>
          </ScrollView>

          {/* Create Button */}
          <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.createButton,
                { backgroundColor: colors.primary },
                (!name.trim() || createClubMutation.isPending) && styles.createButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={!name.trim() || createClubMutation.isPending}
              activeOpacity={0.8}
            >
              {createClubMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={[styles.createButtonText, { color: '#fff' }]}>
                  {t('clubs.create', 'Create Club')}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
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
    alignSelf: 'center',
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    alignSelf: 'center',
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
  infoBox: {
    padding: Spacing.md,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  createButton: {
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
