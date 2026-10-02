import React, { useState, useCallback, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowsRightLeftIcon, TrashIcon } from 'react-native-heroicons/outline';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import Button from '@/components/ui/Button';
import { SettingsGroup } from '@/components/profile/SettingsGroup';
import { SettingsItem } from '@/components/profile/SettingsItem';
import { ClubFormFields } from '@/components/clubs/ClubFormFields';
import { ClubScreenHeader, useClubScroll } from '@/components/clubs/clubUi';
import { useTheme } from '@/contexts/ThemeContext';
import { useClub, useUpdateClub, useDeleteClub } from '@/lib/hooks/useClubs';
import { pickAndProcessImage } from '@/lib/utils/imageHelpers';
import { TransferOwnershipModal } from '@/components/clubs/TransferOwnershipModal';
import type { ClubUpdateRequest } from '@/types/feed';

export default function EditClubScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll, topInset } = useClubScroll();
  const params = useLocalSearchParams<{ id: string }>();
  const clubId = params.id ? parseInt(params.id, 10) : 0;

  const { data: club, isLoading } = useClub(clubId);
  const updateClubMutation = useUpdateClub();
  const deleteClubMutation = useDeleteClub();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Pre-populate form when club data loads
  useEffect(() => {
    if (club) {
      setName(club.name);
      setDescription(club.description || '');
      setIsPrivate(club.visibility === 'private');
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
      alert(t('clubs.errors.photoPickFailed', { defaultValue: 'Failed to pick photo' }));
    }
  }, [t]);

  const handleRemovePhoto = useCallback(() => {
    setPhotoBase64(null);
    setPhotoChanged(true);
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

  const handleSave = useCallback(async () => {
    if (!validateForm() || !clubId) return;

    const clubData: ClubUpdateRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      visibility: isPrivate ? 'private' : 'public',
    };

    // Only include photo if it was changed
    if (photoChanged) {
      clubData.photo = photoBase64 || undefined;
    }

    try {
      await updateClubMutation.mutateAsync({ id: clubId, data: clubData });
      router.back();
    } catch (error) {
      console.error('Error updating group:', error);
      alert(error instanceof Error ? error.message : t('clubs.errors.updateFailed', { defaultValue: 'Failed to update group' }));
    }
  }, [clubId, name, description, photoBase64, photoChanged, validateForm, updateClubMutation, isPrivate, t]);

  const handleTransferOwnership = useCallback(() => {
    setShowTransferModal(true);
  }, []);

  const handleDelete = useCallback(() => {
    if (!clubId || !club) return;

    Alert.alert(
      t('clubs.deleteClub', 'Delete Group'),
      t('clubs.deleteConfirmMessage', `Are you sure you want to delete "${club.name}"? This action cannot be undone.`),
      [
        {
          text: t('common:buttons.cancel', 'Cancel'),
          style: 'cancel',
        },
        {
          text: t('clubs.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteClubMutation.mutateAsync(clubId);
              // Navigate to groups tab after successful deletion
              router.replace('/(tabs)/groups');
            } catch (error) {
              console.error('Error deleting group:', error);
              alert(error instanceof Error ? error.message : t('clubs.errors.deleteFailed', { defaultValue: 'Failed to delete group' }));
            }
          },
        },
      ]
    );
  }, [clubId, club, deleteClubMutation, t]);

  // Get current photo to display (new photo or existing)
  const displayPhoto = photoChanged ? photoBase64 : club?.photo;

  if (isLoading || !club) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={[styles.loading, { paddingTop: topInset }]}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <ThemedText>{t('clubs.notFoundMessage', 'This group does not exist.')}</ThemedText>
          )}
        </View>
        <ClubScreenHeader title={t('clubs.editClub', 'Edit Group')} />
      </View>
    );
  }

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
            photoUri={displayPhoto}
            allowChangePhoto
            onPickPhoto={handlePickPhoto}
            onRemovePhoto={handleRemovePhoto}
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            isPrivate={isPrivate}
            onPrivateChange={setIsPrivate}
            errors={errors}
          />

          <SettingsGroup title={t('clubs.dangerZone', 'Danger Zone')} index={3}>
            <SettingsItem
              grouped
              isFirst
              icon={<ArrowsRightLeftIcon size={22} color={colors.error} />}
              title={t('clubs.transferOwnership', 'Transfer Ownership')}
              subtitle={t('clubs.transferOwnershipDesc', 'Pass ownership of this group to another member.')}
              titleColor={colors.error}
              onPress={handleTransferOwnership}
            />
            <SettingsItem
              grouped
              isLast
              icon={<TrashIcon size={22} color={colors.error} />}
              title={t('clubs.deleteClub', 'Delete Group')}
              subtitle={t('clubs.deleteWarning', 'Once you delete a group, there is no going back. Please be certain.')}
              titleColor={colors.error}
              onPress={deleteClubMutation.isPending ? undefined : handleDelete}
              rightElement={
                deleteClubMutation.isPending ? <ActivityIndicator size="small" color={colors.error} /> : undefined
              }
            />
          </SettingsGroup>
        </Animated.ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            title={t('clubs.saveChanges', 'Save Changes')}
            onPress={handleSave}
            size="large"
            fullWidth
            disabled={!name.trim()}
            loading={updateClubMutation.isPending}
          />
        </View>
      </KeyboardAvoidingView>
      <ClubScreenHeader title={t('clubs.editClub', 'Edit Group')} scrollY={scrollY} />

      <TransferOwnershipModal
        visible={showTransferModal}
        club={club}
        onClose={() => setShowTransferModal(false)}
        onTransferred={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 12 },
});
