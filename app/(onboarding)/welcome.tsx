import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/ui/Button';

export default function OnboardingWelcomeScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('onboarding');
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/(onboarding)/profile-setup');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logo}
        />
        <Text style={[styles.title, { color: colors.primary }]}>
          {t('welcome.title')}
        </Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          {t('welcome.tagline')}
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          title={t('welcome.cta')}
          onPress={handleGetStarted}
          variant="primary"
          size="large"
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 20,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  footer: {
    paddingBottom: 16,
  },
});
