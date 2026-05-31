import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPinIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { openAppSettings } from '@/lib/permissions/wizard';
import Button from '@/components/ui/Button';
import { BorderRadius, FontSizes, FontWeights, Spacing } from '@/constants/theme';

interface LocationPermissionPromptProps {
  onRequestPermission: () => void;
  isLoading?: boolean;
}

export function LocationPermissionPrompt({
  onRequestPermission,
  isLoading = false,
}: LocationPermissionPromptProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('onboarding');

  const openSettings = openAppSettings;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Icon box */}
        <View
          style={[
            styles.iconBox,
            { backgroundColor: colors.primary + '1F' },
          ]}
        >
          <MapPinIcon size={48} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          {t('locationPrompt.title')}
        </Text>

        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {t('locationPrompt.description')}
        </Text>

        <View style={styles.buttons}>
          <Button
            title={t('locationPrompt.enableButton')}
            variant="primary"
            onPress={onRequestPermission}
            loading={isLoading}
            fullWidth
          />

          <Pressable onPress={openSettings} style={styles.settingsLink}>
            <Text style={[styles.settingsLinkText, { color: colors.primary }]}>
              {t('locationPrompt.openSettings')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    zIndex: 100,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: FontSizes.md,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  buttons: {
    width: '100%',
    gap: Spacing.md,
    alignItems: 'center',
  },
  settingsLink: {
    padding: Spacing.sm,
    alignItems: 'center',
  },
  settingsLinkText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
});
