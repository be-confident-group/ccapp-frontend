import React, { useState, useCallback } from 'react';
import { ActivityIndicator, Image, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CheckIcon, UserGroupIcon } from 'react-native-heroicons/outline';
import Button from '@/components/ui/Button';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { PostsScreen } from '@/components/posts/PostsScreen';
import { PostsEmptyState } from '@/components/posts/PostsEmptyState';
import { ComposerCard } from '@/components/posts/ComposerCard';
import { ComposerPhotos } from '@/components/posts/ComposerPhotos';
import { SelectorRow } from '@/components/posts/SelectorRow';
import { PressableScale } from '@/components/posts/PressableScale';
import { FadeInUp } from '@/components/posts/FadeInUp';
import { useTheme } from '@/contexts/ThemeContext';
import { useCreatePost } from '@/lib/hooks/usePosts';
import { useMyClubs } from '@/lib/hooks/useClubs';
import { pickAndProcessMultipleImages } from '@/lib/utils/imageHelpers';
import { containsObjectionableContent } from '@/lib/utils/contentFilter';
import type { PostCreateRequest, Club } from '@/types/feed';

function ClubAvatar({ club, size }: { club: Club; size: number }) {
  const { colors } = useTheme();
  if (club.photo) {
    return <Image source={{ uri: club.photo }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={[
        styles.clubPlaceholder,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.glassHighlight },
      ]}
    >
      <Text style={[styles.clubInitial, { color: colors.glassTint, fontSize: size * 0.42 }]}>
        {club.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

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
      alert(t('posts.errors.pickPhotos', { defaultValue: 'Failed to pick photos' }));
    }
  }, [photosBase64.length, t]);

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
      alert(error instanceof Error ? error.message : t('posts.errors.createFailed', { defaultValue: 'Failed to create post' }));
    }
  }, [selectedClub, title, text, photosBase64, validateForm, createPostMutation, t]);

  const renderClubRow = (club: Club) => {
    const isSelected = selectedClub?.id === club.id;
    return (
      <PressableScale
        key={club.id}
        scaleTo={0.98}
        onPress={() => handleSelectClub(club)}
        accessibilityState={{ selected: isSelected }}
        style={[styles.clubRow, isSelected && { backgroundColor: colors.glassHighlight }]}
      >
        <ClubAvatar club={club} size={40} />
        <View style={styles.clubInfo}>
          <Text style={[styles.clubName, { color: colors.glassTint }]} numberOfLines={1}>
            {club.name}
          </Text>
          {club.members_count !== undefined && (
            <Text style={[styles.clubMembers, { color: colors.textSecondary }]}>
              {t('posts.membersCount', {
                count: club.members_count,
                defaultValue: club.members_count === 1 ? '{{count}} member' : '{{count}} members',
              })}
            </Text>
          )}
        </View>
        {isSelected && <CheckIcon size={20} color={colors.glassTint} />}
      </PressableScale>
    );
  };

  if (loadingClubs) {
    return (
      <PostsScreen title={t('posts.createPost', 'Create Post')} scroll={false}>
        <ActivityIndicator size="large" color={colors.primary} />
      </PostsScreen>
    );
  }

  if (!myClubs || myClubs.length === 0) {
    return (
      <PostsScreen title={t('posts.createPost', 'Create Post')} scroll={false}>
        <PostsEmptyState
          icon={(color) => <UserGroupIcon size={28} color={color} />}
          title={t('posts.noGroupsTitle', { defaultValue: 'No groups yet' })}
          text={t('posts.noGroupsMessage', 'You need to join a group first to create a post.')}
          actionLabel={t('clubs.browseClubs', 'Browse Groups')}
          onAction={() => router.replace('/clubs/browse')}
        />
      </PostsScreen>
    );
  }

  return (
    <>
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
            disabled={!selectedClub || !title.trim() || !text.trim()}
          />
        }
      >
        <ComposerCard index={0} flush caption={`${t('posts.selectGroup', 'Select Group')} *`} error={errors.club}>
          <SelectorRow
            leading={selectedClub ? <ClubAvatar club={selectedClub} size={32} /> : undefined}
            value={selectedClub?.name}
            placeholder={t('posts.selectGroupPlaceholder', 'Choose a group to post in')}
            accessibilityLabel={t('posts.selectGroup', 'Select Group')}
            onPress={() => {
              Keyboard.dismiss();
              setShowGroupPicker(true);
            }}
          />
        </ComposerCard>

        <ComposerCard index={1} caption={`${t('posts.title', 'Title')} *`} error={errors.title}>
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

        <ComposerCard index={2} caption={`${t('posts.content', 'Content')} *`} error={errors.text}>
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

        <ComposerCard index={3} caption={`${t('posts.photos', 'Photos')} ${t('posts.optional', '(Optional)')}`}>
          <ComposerPhotos
            photos={photosBase64}
            max={5}
            onAdd={handlePickPhotos}
            onRemove={handleRemovePhoto}
            addLabel={photosBase64.length === 0 ? t('posts.addPhotos', 'Add Photos') : t('posts.addMorePhotos', 'Add More Photos')}
          />
        </ComposerCard>

        <FadeInUp index={4}>
          <Text style={[styles.footnote, { color: colors.textSecondary }]}>
            {t('posts.createInfo', 'Your post will be visible to all members of this group.')}
          </Text>
        </FadeInUp>
      </PostsScreen>

      <GlassSheet
        visible={showGroupPicker}
        onClose={() => setShowGroupPicker(false)}
        title={t('posts.selectGroup', 'Select Group')}
      >
        <View style={styles.clubList}>{myClubs.map(renderClubRow)}</View>
      </GlassSheet>
    </>
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 16, padding: 0 },
  textArea: { minHeight: 140 },
  characterCount: { fontSize: 12, textAlign: 'right' },
  footnote: { fontSize: 13, lineHeight: 18, paddingHorizontal: 32 },
  clubList: { gap: 4 },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 16,
  },
  clubPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  clubInitial: { fontWeight: '700' },
  clubInfo: { flex: 1, gap: 2 },
  clubName: { fontSize: 16, fontWeight: '600' },
  clubMembers: { fontSize: 13 },
});
