import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { useClubByShareCode } from '@/lib/hooks/useClubs';

export default function ShareCodeResolverScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code: string }>();
  const shareCode = params.code || '';

  const { data: club, isLoading, isError } = useClubByShareCode(shareCode);

  useEffect(() => {
    if (club) {
      router.replace(`/clubs/${club.id}`);
    }
  }, [club]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <Header title="" showBack onBackPress={() => router.back()} />
        <View style={styles.content}>
          {isLoading && (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
          {isError && (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorTitle}>
                {t('clubs.notFound', 'Group Not Found')}
              </ThemedText>
              <ThemedText style={styles.errorMessage}>
                {t('clubs.invalidShareCode', 'This share link is invalid or has expired.')}
              </ThemedText>
            </View>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorContainer: {
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  errorMessage: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
});
