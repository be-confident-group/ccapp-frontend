import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { PostsScreen } from '@/components/posts/PostsScreen';
import { ComposerCard } from '@/components/posts/ComposerCard';
import { ComposerPhotos } from '@/components/posts/ComposerPhotos';
import { FadeInUp } from '@/components/posts/FadeInUp';
import { useTheme } from '@/contexts/ThemeContext';
import { useCreatePost } from '@/lib/hooks/usePosts';
import { pickAndProcessMultipleImages } from '@/lib/utils/imageHelpers';
import { containsObjectionableContent } from '@/lib/utils/contentFilter';
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
      alert(t('posts.errors.pickPhotos', { defaultValue: 'Failed to pick photos' }));
    }
  }, [photosBase64.length, t]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotosBase64((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: { title?: string; text?: string } = {};

    if (!title.trim()) {
      newErrors.title = t('posts.errors.titleRequired', 'Title is required');
    } else if (title.trim().length < 3) {
      newErrors.title = t('posts.errors.titleTooShort', 'Title must be at least 3 characters');
    } else if (containsObjectionableContent(title)) {
      newErrors.title = t('posts.errors.titleObjectionable');
    }

    if (!text.trim()) {
      newErrors.text = t('posts.errors.textRequired', 'Post content is required');
    } else if (text.trim().length < 10) {
      newErrors.text = t('posts.errors.textTooShort', 'Post content must be at least 10 characters');
    } else if (containsObjectionableContent(text)) {
      newErrors.text = t('posts.errors.textObjectionable');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, text, t]);

  const handleCreate = useCallback(async () => {
    if (!validateForm()) return;
    if (!clubId) {
      alert(t('posts.errors.invalidGroup', { defaultValue: 'Invalid group ID' }));
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
      alert(error instanceof Error ? error.message : t('posts.errors.createFailed', { defaultValue: 'Failed to create post' }));
    }
  }, [clubId, title, text, photosBase64, validateForm, createPostMutation, t]);

  return (
    <PostsScreen
      title={t('posts.createPost', 'Create Post')}
      keyboardAvoiding
      footer={
        <Button
          title={t('posts.create', 'Create Post')}
          onPress={handleCreate}
          variant="primary"
          size="large"
          fullWidth
          loading={createPostMutation.isPending}
          disabled={!title.trim() || !text.trim()}
        />
      }
    >
      <ComposerCard index={0} caption={`${t('posts.title', 'Title')} *`} error={errors.title}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={t('posts.titlePlaceholder', 'Enter post title')}
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={255}
          autoCapitalize="sentences"
          autoCorrect
        />
      </ComposerCard>

      <ComposerCard index={1} caption={`${t('posts.content', 'Content')} *`} error={errors.text}>
        <TextInput
          style={[styles.input, styles.textArea, { color: colors.text }]}
          placeholder={t('posts.contentPlaceholder', 'Share your thoughts...')}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          maxLength={2000}
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
        />
        <Text style={[styles.characterCount, { color: colors.textMuted }]}>{text.length}/2000</Text>
      </ComposerCard>

      <ComposerCard index={2} caption={`${t('posts.photos', 'Photos')} ${t('posts.optional', '(Optional)')}`}>
        <ComposerPhotos
          photos={photosBase64}
          max={5}
          onAdd={handlePickPhotos}
          onRemove={handleRemovePhoto}
          addLabel={photosBase64.length === 0 ? t('posts.addPhotos', 'Add Photos') : t('posts.addMorePhotos', 'Add More Photos')}
        />
      </ComposerCard>

      <FadeInUp index={3}>
        <Text style={[styles.footnote, { color: colors.textSecondary }]}>
          {t('posts.createInfo', 'Your post will be visible to all members of this group.')}
        </Text>
      </FadeInUp>
    </PostsScreen>
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 16, padding: 0 },
  textArea: { minHeight: 140 },
  characterCount: { fontSize: 12, textAlign: 'right' },
  footnote: { fontSize: 13, lineHeight: 18, paddingHorizontal: 32 },
});
