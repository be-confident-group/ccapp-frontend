import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';

export default function UserProfileScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();

  const displayName = params.name ?? 'User';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Header title={displayName} showBack />
      <ThemedView style={styles.container}>
        <View style={styles.avatarSection}>
          {params.avatar ? (
            <Image source={{ uri: params.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
              <ThemedText style={[styles.avatarInitial, { color: colors.textSecondary }]}>
                {displayName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
          <ThemedText style={[styles.name, { color: colors.text }]}>{displayName}</ThemedText>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: Spacing.lg },
  avatarSection: { alignItems: 'center', paddingTop: Spacing.xl, gap: Spacing.md },
  avatar: { width: 96, height: 96, borderRadius: BorderRadius.full },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: FontSizes.xxl, fontWeight: '600' },
  name: { fontSize: FontSizes.xl, fontWeight: '700' },
});
