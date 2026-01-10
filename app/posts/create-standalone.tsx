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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { useCreatePost } from '@/lib/hooks/usePosts';
import { useMyClubs } from '@/lib/hooks/useClubs';
import { pickAndProcessMultipleImages } from '@/lib/utils/imageHelpers';
import { PhotoIcon, XMarkIcon, ChevronDownIcon, CheckIcon } from 'react-native-heroicons/outline';
import type { PostCreateRequest } from '@/types/feed';
import type { Club } from '@/types/feed';

export default function CreateStandalonePostScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();

  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [photosBase64, setPhotosBase64] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ club?: string; title?: string; text?: string }>({});

  const createPostMutation = useCreatePost();
  const { data: myClubs, isLoading: loadingClubs } = useMyClubs();

  const handlePickPhotos = useCallback(async () => {
    try {
      const base64Array = await pickAndProcessMultipleImages({
        maxImages: 5 - photosBase64.length,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.7,
      });

      if (base64Array.length > 0) {
        setPhotosBase64((prev) => [...prev, ...base64Array]);
      }
    } catch (error) {
      console.error('Error picking photos:', error);
      alert('Failed to pick photos');
    }
  }, [photosBase64.length]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotosBase64((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSelectClub = useCallback((club: Club) => {
    setSelectedClub(club);
    setShowGroupPicker(false);
    setErrors((prev) => ({ ...prev, club: undefined }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: { club?: string; title?: string; text?: string } = {};

    if (!selectedClub) {
      newErrors.club = t('posts.errors.clubRequired', 'Please select a group');
    }

    if (!title.trim()) {
      newErrors.title = t('posts.errors.titleRequired', 'Title is required');
    } else if (title.trim().length < 3) {
      newErrors.title = t('posts.errors.titleTooShort', 'Title must be at least 3 characters');
    }

    if (!text.trim()) {
      newErrors.text = t('posts.errors.textRequired', 'Post content is required');
    } else if (text.trim().length < 10) {
      newErrors.text = t('posts.errors.textTooShort', 'Post content must be at least 10 characters');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedClub, title, text, t]);

  const handleCreate = useCallback(async () => {
    if (!validateForm() || !selectedClub) return;

    const postData: PostCreateRequest = {
      title: title.trim(),
      text: text.trim(),
      photos_data: photosBase64.length > 0 ? photosBase64 : undefined,
    };

    try {
      await createPostMutation.mutateAsync({ clubId: selectedClub.id, data: postData });

      // Navigate to the group detail page
      router.replace(`/clubs/${selectedClub.id}`);
    } catch (error) {
      console.error('Error creating post:', error);
      alert(error instanceof Error ? error.message : 'Failed to create post');
    }
  }, [selectedClub, title, text, photosBase64, validateForm, createPostMutation]);

  const renderPhotoItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <View style={styles.photoItem}>
        <Image source={{ uri: item }} style={styles.photoThumbnail} />
        <TouchableOpacity
          style={[styles.removePhotoButton, { backgroundColor: colors.error }]}
          onPress={() => handleRemovePhoto(index)}
          activeOpacity={0.8}
        >
          <XMarkIcon size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    ),
    [colors, handleRemovePhoto]
  );

  const renderClubItem = useCallback(
    ({ item }: { item: Club }) => {
      const isSelected = selectedClub?.id === item.id;
      return (
        <TouchableOpacity
          style={[
            styles.clubItem,
            { backgroundColor: colors.card, borderColor: isSelected ? colors.primary : colors.border },
          ]}
          onPress={() => handleSelectClub(item)}
          activeOpacity={0.7}
        >
          {item.photo ? (
            <Image source={{ uri: item.photo }} style={styles.clubItemPhoto} />
          ) : (
            <View style={[styles.clubItemPhotoPlaceholder, { backgroundColor: colors.primary + '20' }]}>
              <ThemedText style={[styles.clubItemPhotoText, { color: colors.primary }]}>
                {item.name.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
          <View style={styles.clubItemInfo}>
            <ThemedText style={styles.clubItemName}>{item.name}</ThemedText>
            {item.member_count !== undefined && (
              <ThemedText style={[styles.clubItemMembers, { color: colors.textMuted }]}>
                {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
              </ThemedText>
            )}
          </View>
          {isSelected && (
            <View style={[styles.checkIcon, { backgroundColor: colors.primary }]}>
              <CheckIcon size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [colors, selectedClub, handleSelectClub]
  );

  if (loadingClubs) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <Header title={t('posts.createPost', 'Create Post')} showBack />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!myClubs || myClubs.length === 0) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <Header title={t('posts.createPost', 'Create Post')} showBack />
        <View style={styles.loading}>
          <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('posts.noGroupsMessage', 'You need to join a group first to create a post.')}
          </ThemedText>
          <TouchableOpacity
            style={[styles.browseButton, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/clubs/browse')}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.browseButtonText}>
              {t('clubs.browseClubs', 'Browse Groups')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <Header title={t('posts.createPost', 'Create Post')} showBack />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {!showGroupPicker ? (
          <>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <ThemedView style={styles.content}>
                {/* Group Selector */}
                <View style={styles.section}>
                  <ThemedText style={styles.label}>
                    {t('posts.selectGroup', 'Select Group')} *
                  </ThemedText>
                  <TouchableOpacity
                    style={[
                      styles.groupSelector,
                      {
                        backgroundColor: colors.card,
                        borderColor: errors.club ? colors.error : colors.border,
                      },
                    ]}
                    onPress={() => setShowGroupPicker(true)}
                    activeOpacity={0.7}
                  >
                    {selectedClub ? (
                      <>
                        {selectedClub.photo ? (
                          <Image source={{ uri: selectedClub.photo }} style={styles.selectedGroupPhoto} />
                        ) : (
                          <View style={[styles.selectedGroupPhotoPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                            <ThemedText style={[styles.selectedGroupPhotoText, { color: colors.primary }]}>
                              {selectedClub.name.charAt(0).toUpperCase()}
                            </ThemedText>
                          </View>
                        )}
                        <ThemedText style={styles.selectedGroupName}>{selectedClub.name}</ThemedText>
                      </>
                    ) : (
                      <ThemedText style={[styles.groupSelectorPlaceholder, { color: colors.textMuted }]}>
                        {t('posts.selectGroupPlaceholder', 'Choose a group to post in')}
                      </ThemedText>
                    )}
                    <ChevronDownIcon size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                  {errors.club && (
                    <ThemedText style={[styles.errorText, { color: colors.error }]}>
                      {errors.club}
                    </ThemedText>
                  )}
                </View>

                {/* Title Field */}
                <View style={styles.section}>
                  <ThemedText style={styles.label}>
                    {t('posts.title', 'Title')} *
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.card,
                        color: colors.text,
                        borderColor: errors.title ? colors.error : colors.border,
                      },
                    ]}
                    placeholder={t('posts.titlePlaceholder', 'Enter post title')}
                    placeholderTextColor={colors.textMuted}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={255}
                    autoCapitalize="sentences"
                    autoCorrect
                  />
                  {errors.title && (
                    <ThemedText style={[styles.errorText, { color: colors.error }]}>
                      {errors.title}
                    </ThemedText>
                  )}
                </View>

                {/* Text Field */}
                <View style={styles.section}>
                  <ThemedText style={styles.label}>
                    {t('posts.content', 'Content')} *
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      styles.textArea,
                      {
                        backgroundColor: colors.card,
                        color: colors.text,
                        borderColor: errors.text ? colors.error : colors.border,
                      },
                    ]}
                    placeholder={t('posts.contentPlaceholder', 'Share your thoughts...')}
                    placeholderTextColor={colors.textMuted}
                    value={text}
                    onChangeText={setText}
                    maxLength={2000}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    autoCapitalize="sentences"
                  />
                  {errors.text && (
                    <ThemedText style={[styles.errorText, { color: colors.error }]}>
                      {errors.text}
                    </ThemedText>
                  )}
                  <ThemedText style={[styles.characterCount, { color: colors.textMuted }]}>
                    {text.length}/2000
                  </ThemedText>
                </View>

                {/* Photos Section */}
                <View style={styles.section}>
                  <ThemedText style={styles.label}>
                    {t('posts.photos', 'Photos')} {t('posts.optional', '(Optional)')}
                  </ThemedText>

                  {photosBase64.length > 0 && (
                    <FlatList
                      data={photosBase64}
                      renderItem={renderPhotoItem}
                      keyExtractor={(_, index) => index.toString()}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.photosList}
                    />
                  )}

                  {photosBase64.length < 5 && (
                    <TouchableOpacity
                      style={[
                        styles.addPhotosButton,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                      onPress={handlePickPhotos}
                      activeOpacity={0.7}
                    >
                      <PhotoIcon size={24} color={colors.primary} />
                      <ThemedText style={[styles.addPhotosText, { color: colors.primary }]}>
                        {photosBase64.length === 0
                          ? t('posts.addPhotos', 'Add Photos')
                          : t('posts.addMorePhotos', 'Add More Photos')}
                      </ThemedText>
                      <ThemedText style={[styles.photosCount, { color: colors.textMuted }]}>
                        ({photosBase64.length}/5)
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Info Box */}
                <View style={[styles.infoBox, { backgroundColor: colors.primary + '15' }]}>
                  <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
                    {t('posts.createInfo', 'Your post will be visible to all members of this group.')}
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
                  (!selectedClub || !title.trim() || !text.trim() || createPostMutation.isPending) &&
                    styles.createButtonDisabled,
                ]}
                onPress={handleCreate}
                disabled={!selectedClub || !title.trim() || !text.trim() || createPostMutation.isPending}
                activeOpacity={0.8}
              >
                {createPostMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={[styles.createButtonText, { color: '#fff' }]}>
                    {t('posts.create', 'Create Post')}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.groupPickerContainer}>
            <View style={[styles.groupPickerHeader, { borderBottomColor: colors.border }]}>
              <ThemedText style={styles.groupPickerTitle}>
                {t('posts.selectGroup', 'Select Group')}
              </ThemedText>
              <TouchableOpacity onPress={() => setShowGroupPicker(false)} activeOpacity={0.7}>
                <ThemedText style={[styles.groupPickerCancel, { color: colors.primary }]}>
                  {t('common:buttons.cancel', 'Cancel')}
                </ThemedText>
              </TouchableOpacity>
            </View>
            <FlatList
              data={myClubs}
              renderItem={renderClubItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.groupPickerList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}
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
    padding: Spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  browseButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: 8,
    marginTop: Spacing.md,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  groupSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  groupSelectorPlaceholder: {
    flex: 1,
    fontSize: 16,
  },
  selectedGroupPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  selectedGroupPhotoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedGroupPhotoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedGroupName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    minHeight: 120,
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
  photosList: {
    gap: Spacing.sm,
  },
  photoItem: {
    position: 'relative',
  },
  photoThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: Spacing.sm,
  },
  addPhotosText: {
    fontSize: 14,
    fontWeight: '600',
  },
  photosCount: {
    fontSize: 12,
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
  groupPickerContainer: {
    flex: 1,
  },
  groupPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  groupPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  groupPickerCancel: {
    fontSize: 16,
    fontWeight: '600',
  },
  groupPickerList: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    gap: Spacing.md,
  },
  clubItemPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  clubItemPhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubItemPhotoText: {
    fontSize: 20,
    fontWeight: '600',
  },
  clubItemInfo: {
    flex: 1,
    gap: 2,
  },
  clubItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  clubItemMembers: {
    fontSize: 13,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
