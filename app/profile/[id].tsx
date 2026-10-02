import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PostsScreen } from '@/components/posts/PostsScreen';
import { FadeInUp } from '@/components/posts/FadeInUp';
import { UserAvatar } from '@/components/feed';
import { useTheme } from '@/contexts/ThemeContext';

export default function UserProfileScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  const params = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();

  const displayName = params.name ?? t('profile.unknownUser');

  return (
    <PostsScreen title={displayName}>
      <FadeInUp style={styles.wrap}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.avatarRing, { borderColor: colors.glassHighlight }]}>
            <UserAvatar name={displayName} imageUri={params.avatar || undefined} size={64} />
          </View>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
            {displayName}
          </Text>
        </View>
      </FadeInUp>
    </PostsScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16 },
  card: {
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: { borderWidth: 3, borderRadius: 999 },
  name: { flex: 1, fontSize: 20, fontWeight: '700' },
});
