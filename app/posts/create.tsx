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
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { useCreatePost } from '@/lib/hooks/usePosts';
import { pickAndProcessMultipleImages } from '@/lib/utils/imageHelpers';
import { PhotoIcon, XMarkIcon } from 'react-native-heroicons/outline';
import type { PostCreateRequest } from '@/types/feed';

export default function CreatePostScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ clubId: string }>();
  const clubId = params.clubId ? parseInt(params.clubId, 10) : 0;

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [photosBase64, setPhotosBase64] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ title?: string; text?: string }>({});

  const createPostMutation = useCreatePost();

  const handlePickPhotos = useCallback(async () => {
    try {
      const base64Array = await pickAndProcessMultipleImages({
        maxImages: 5 - photosBase64.length, // Limit total to 5 photos
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

  const validateForm = useCallback((): boolean => {
    const newErrors: { title?: string; text?: string } = {};

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
  }, [title, text, t]);

  const handleCreate = useCallback(async () => {
    if (!validateForm()) return;
    if (!clubId) {
      alert('Invalid group ID');
      return;
    }

    const postData: PostCreateRequest = {
      title: title.trim(),
      text: text.trim(),
      photos_data: photosBase64.length > 0 ? photosBase64 : undefined,
    };

    try {
      await createPostMutation.mutateAsync({ clubId, data: postData });

      // Navigate back to group detail
      router.back();
    } catch (error) {
      console.error('Error creating post:', error);
      alert(error instanceof Error ? error.message : 'Failed to create post');
    }
  }, [clubId, title, text, photosBase64, validateForm, createPostMutation]);

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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedView style={styles.content}>
              {/* Title Field */}
              <View style={styles.section}>
                <ThemedText style={styles.label}>
                  {t('posts.title', 'Title')} *
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.card, color: colors.text, borderColor: errors.title ? colors.error : colors.border },
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
                    { backgroundColor: colors.card, color: colors.text, borderColor: errors.text ? colors.error : colors.border },
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
                    style={[styles.addPhotosButton, { backgroundColor: colors.card, borderColor: colors.border }]}
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
                (!title.trim() || !text.trim() || createPostMutation.isPending) && styles.createButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={!title.trim() || !text.trim() || createPostMutation.isPending}
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
});
