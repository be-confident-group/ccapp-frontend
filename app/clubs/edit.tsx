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
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useClub, useUpdateClub, useDeleteClub, useTransferOwnership } from '@/lib/hooks/useClubs';
import { pickAndProcessImage } from '@/lib/utils/imageHelpers';
import { PhotoIcon, XMarkIcon, LockClosedIcon, GlobeAltIcon } from 'react-native-heroicons/outline';
import type { ClubUpdateRequest } from '@/types/feed';

export default function EditClubScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const clubId = params.id ? parseInt(params.id, 10) : 0;

  const { data: club, isLoading } = useClub(clubId);
  const updateClubMutation = useUpdateClub();
  const deleteClubMutation = useDeleteClub();
  const transferOwnershipMutation = useTransferOwnership(clubId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

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
      alert(error instanceof Error ? error.message : 'Failed to update group');
    }
  }, [clubId, name, description, photoBase64, photoChanged, validateForm, updateClubMutation]);

  const handleTransferOwnership = useCallback(() => {
    if (!club?.members?.length) return;
    const eligible = club.members.filter((m) => m.id !== club.owner.id);
    if (!eligible.length) {
      Alert.alert('No Members', 'You need at least one other member to transfer ownership.');
      return;
    }
    Alert.alert(
      'Transfer Ownership',
      'Select a member to transfer ownership to:',
      [
        ...eligible.slice(0, 5).map((m) => ({
          text: `${m.name} ${m.last_name}`,
          onPress: async () => {
            try {
              await transferOwnershipMutation.mutateAsync(m.id);
              Alert.alert('Done', `Ownership transferred to ${m.name} ${m.last_name}.`);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to transfer ownership. Please try again.');
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [club, transferOwnershipMutation]);

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
              alert(error instanceof Error ? error.message : 'Failed to delete group');
            }
          },
        },
      ]
    );
  }, [clubId, club, deleteClubMutation, t]);

  // Get current photo to display (new photo or existing)
  const displayPhoto = photoChanged ? photoBase64 : club?.photo;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <Header title={t('clubs.editClub', 'Edit Group')} showBack />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!club) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <Header title={t('clubs.editClub', 'Edit Group')} showBack />
        <View style={styles.loading}>
          <ThemedText>{t('clubs.notFoundMessage', 'This group does not exist.')}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <Header title={t('clubs.editClub', 'Edit Group')} showBack />
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
                {t('clubs.photo', 'Group Photo')} {t('clubs.optional', '(Optional)')}
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
                {t('clubs.name', 'Group Name')} *
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.card, color: colors.text, borderColor: errors.name ? colors.error : colors.border },
                ]}
                placeholder={t('clubs.namePlaceholder', 'Enter group name')}
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
                placeholder={t('clubs.descriptionPlaceholder', 'Describe your group...')}
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

            {/* Visibility Toggle */}
            <View style={styles.section}>
              <ThemedText style={styles.label}>
                {t('clubs.visibility', 'Visibility')}
              </ThemedText>
              <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.toggleLabel}>
                  {isPrivate
                    ? <LockClosedIcon size={18} color={colors.textSecondary} />
                    : <GlobeAltIcon size={18} color={colors.textSecondary} />}
                  <View>
                    <ThemedText style={styles.toggleTitle}>
                      {isPrivate ? t('clubs.private', 'Private') : t('clubs.public', 'Public')}
                    </ThemedText>
                    <ThemedText style={[styles.toggleSubtitle, { color: colors.textMuted }]}>
                      {isPrivate
                        ? t('clubs.privateHint', 'Members must request to join')
                        : t('clubs.publicHint', 'Anyone can join directly')}
                    </ThemedText>
                  </View>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={setIsPrivate}
                  trackColor={{ false: colors.border, true: colors.primary + '80' }}
                  thumbColor={isPrivate ? colors.primary : colors.textMuted}
                />
              </View>
            </View>

            {/* Danger Zone */}
            <View style={[styles.dangerZone, { borderColor: colors.error + '40' }]}>
              <View style={[styles.dangerZoneHeader, { backgroundColor: colors.error + '08', borderBottomColor: colors.error + '25' }]}>
                <ThemedText style={[styles.dangerZoneTitle, { color: colors.error }]}>
                  {t('clubs.dangerZone', 'Danger Zone')}
                </ThemedText>
              </View>
              <View style={{ backgroundColor: colors.card }}>
                {/* Transfer Ownership */}
                <View style={[styles.dangerZoneRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <View style={styles.dangerZoneRowText}>
                    <ThemedText style={styles.dangerZoneLabel}>
                      {t('clubs.transferOwnership', 'Transfer Ownership')}
                    </ThemedText>
                    <ThemedText style={[styles.dangerZoneDescription, { color: colors.textMuted }]}>
                      {t('clubs.transferOwnershipDesc', 'Pass ownership of this group to another member.')}
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    style={[styles.dangerButton, { borderWidth: 1, borderColor: colors.error }]}
                    onPress={handleTransferOwnership}
                    disabled={transferOwnershipMutation.isPending}
                    activeOpacity={0.8}
                  >
                    {transferOwnershipMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <ThemedText style={[styles.dangerButtonText, { color: colors.error }]}>
                        {t('clubs.transfer', 'Transfer')}
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
                {/* Delete Group */}
                <View style={styles.dangerZoneRow}>
                  <View style={styles.dangerZoneRowText}>
                    <ThemedText style={styles.dangerZoneLabel}>
                      {t('clubs.deleteClub', 'Delete Group')}
                    </ThemedText>
                    <ThemedText style={[styles.dangerZoneDescription, { color: colors.textMuted }]}>
                      {t('clubs.deleteWarning', 'Once you delete a group, there is no going back. Please be certain.')}
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    style={[styles.dangerButton, { backgroundColor: colors.error }]}
                    onPress={handleDelete}
                    disabled={deleteClubMutation.isPending}
                    activeOpacity={0.8}
                  >
                    {deleteClubMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <ThemedText style={[styles.dangerButtonText, { color: '#fff' }]}>
                        {t('clubs.delete', 'Delete')}
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
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
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  photoContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.md,
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
    borderRadius: BorderRadius.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  changePhotoText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  photoPlaceholderText: {
    fontSize: FontSizes.sm,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSizes.md,
  },
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.md,
  },
  errorText: {
    fontSize: FontSizes.xs,
    marginTop: -Spacing.xs,
  },
  characterCount: {
    fontSize: FontSizes.xs,
    textAlign: 'right',
    marginTop: -Spacing.xs,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  saveButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  toggleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  toggleTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  toggleSubtitle: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  dangerZone: {
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dangerZoneHeader: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  dangerZoneTitle: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dangerZoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  dangerZoneRowText: {
    flex: 1,
    gap: 4,
  },
  dangerZoneLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  dangerZoneDescription: {
    fontSize: FontSizes.sm,
    lineHeight: 18,
  },
  dangerButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    minWidth: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});

