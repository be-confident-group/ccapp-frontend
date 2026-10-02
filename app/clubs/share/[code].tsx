import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ClubScreenHeader, CLUB_HEADER_HEIGHT } from '@/components/clubs/clubUi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useClubByShareCode } from '@/lib/hooks/useClubs';

export default function ShareCodeResolverScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code: string }>();
  const shareCode = params.code || '';

  const { data: club, isLoading, isError } = useClubByShareCode(shareCode);

  useEffect(() => {
    if (club) {
      router.replace(`/clubs/${club.id}`);
    }
  }, [club]);

  useEffect(() => {
    if (isError) {
      Alert.alert(
        t('clubs.notFound', 'Group Not Found'),
        t('clubs.invalidShareCode', 'This share link is invalid or has expired.'),
        [{ text: t('common:buttons.ok', 'OK') }]
      );
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [isError, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <View style={[styles.content, { paddingTop: insets.top + CLUB_HEADER_HEIGHT }]}>
        {isLoading && <ActivityIndicator size="large" color={colors.primary} />}
      </View>
      <ClubScreenHeader />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
