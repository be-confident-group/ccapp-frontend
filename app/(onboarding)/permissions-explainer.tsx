import { useRouter } from 'expo-router';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { MapPinIcon, BoltIcon } from 'react-native-heroicons/outline';
import * as Location from 'expo-location';
import { Spacing } from '@/constants/theme';

export default function PermissionsExplainerScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();

  async function handleGrant() {
    // Request foreground first (required before background on both iOS and Android)
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus === 'granted') {
      await Location.requestBackgroundPermissionsAsync();
    }
    // Navigate forward regardless of result — user can grant later in Settings
    router.replace('/(tabs)');
  }

  function handleSkip() {
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <ThemedText style={styles.title}>{t('common:permissions.title')}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('common:permissions.subtitle')}
          </ThemedText>

          {/* Location explanation */}
          <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
            <MapPinIcon size={28} color={colors.primary} />
            <View style={styles.cardText}>
              <ThemedText style={styles.cardTitle}>{t('common:permissions.location_title')}</ThemedText>
              <ThemedText style={[styles.cardBody, { color: colors.textSecondary }]}>
                {t('common:permissions.location_body')}
              </ThemedText>
            </View>
          </View>

          {/* Motion & Fitness explanation */}
          <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
            <BoltIcon size={28} color={colors.primary} />
            <View style={styles.cardText}>
              <ThemedText style={styles.cardTitle}>{t('common:permissions.motion_title')}</ThemedText>
              <ThemedText style={[styles.cardBody, { color: colors.textSecondary }]}>
                {t('common:permissions.motion_body')}
              </ThemedText>
            </View>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={handleGrant}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.primaryBtnText, { color: '#fff' }]}>{t('common:permissions.grant')}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
              {t('common:permissions.skip')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: Spacing.lg },
  scroll: { paddingVertical: Spacing.xl },
  title: { fontSize: 28, fontWeight: '700', marginBottom: Spacing.sm, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 },
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: 14,
    alignItems: 'flex-start',
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardBody: { fontSize: 14, lineHeight: 20 },
  actions: { paddingBottom: Spacing.lg, gap: 10 },
  primaryBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 10 },
  secondaryBtnText: { fontSize: 15 },
});
