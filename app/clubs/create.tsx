import React, { useState, useCallback } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { ClubFormFields } from '@/components/clubs/ClubFormFields';
import { ClubScreenHeader, useClubScroll } from '@/components/clubs/clubUi';
import { useTheme } from '@/contexts/ThemeContext';
import { useCreateClub } from '@/lib/hooks/useClubs';
import { pickAndProcessImage } from '@/lib/utils/imageHelpers';
import type { ClubCreateRequest } from '@/types/feed';

export default function CreateClubScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll, topInset } = useClubScroll();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
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
      alert(t('clubs.errors.photoPickFailed', { defaultValue: 'Failed to pick photo' }));
    }
  }, [t]);

  const handleRemovePhoto = useCallback(() => {
    setPhotoBase64(null);
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: { name?: string; description?: string } = {};

    if (!name.trim()) {
      newErrors.name = t('clubs.errors.nameRequired', 'Group name is required');
    } else if (name.trim().length < 3) {
      newErrors.name = t('clubs.errors.nameTooShort', 'Group name must be at least 3 characters');
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
      visibility: isPrivate ? 'private' : 'public',
    };

    try {
      const newClub = await createClubMutation.mutateAsync(clubData);

      // Navigate to the new group detail page
      router.replace(`/clubs/${newClub.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      // Parse field-specific errors from API (format: "field: message")
      if (message.includes('name:')) {
        setErrors(prev => ({ ...prev, name: t('clubs.errors.nameExists', 'A group with this name already exists. Please choose a different name.') }));
      } else {
        setErrors(prev => ({ ...prev, name: t('clubs.errors.createFailed', 'Failed to create group. Please try again.') }));
      }
    }
  }, [name, description, photoBase64, isPrivate, validateForm, createClubMutation, t]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.ScrollView
          style={styles.screen}
          contentContainerStyle={{ paddingTop: topInset, paddingBottom: 24 }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="never"
        >
          <ClubFormFields
            photoUri={photoBase64}
            onPickPhoto={handlePickPhoto}
            onRemovePhoto={handleRemovePhoto}
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            isPrivate={isPrivate}
            onPrivateChange={setIsPrivate}
            errors={errors}
            footnote={t(
              'clubs.createInfo',
              'You will be the owner of this group and can manage members and settings.'
            )}
          />
        </Animated.ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            title={t('clubs.create', 'Create Group')}
            onPress={handleCreate}
            size="large"
            fullWidth
            disabled={!name.trim()}
            loading={createClubMutation.isPending}
          />
        </View>
      </KeyboardAvoidingView>
      <ClubScreenHeader title={t('clubs.createClub', 'Create Group')} scrollY={scrollY} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  footer: { paddingHorizontal: 16, paddingTop: 12 },
});
