import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon } from 'react-native-heroicons/solid';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import { Spacing, FontSizes, FontWeights } from '@/constants/theme';

export default function AllSetScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('onboarding');
  const router = useRouter();
  const { markOnboardingComplete } = useAuth();

  const [loading, setLoading] = useState(false);

  async function handleStartWalk() {
    setLoading(true);
    try {
      await markOnboardingComplete();
      router.replace('/(tabs)/maps');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoHome() {
    setLoading(true);
    try {
      await markOnboardingComplete();
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <CheckCircleIcon size={80} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>
          {t('allSet.title')}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {t('allSet.body')}
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          title={t('allSet.startWalk')}
          onPress={handleStartWalk}
          variant="primary"
          size="large"
          fullWidth
          loading={loading}
          disabled={loading}
        />
        <Button
          title={t('allSet.goHome')}
          onPress={handleGoHome}
          variant="outline"
          size="large"
          fullWidth
          loading={loading}
          disabled={loading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    lineHeight: FontSizes.md * 1.5,
    paddingHorizontal: Spacing.md,
  },
  footer: {
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
});
