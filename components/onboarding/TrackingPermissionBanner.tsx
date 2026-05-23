import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ExclamationCircleIcon, XMarkIcon } from 'react-native-heroicons/outline';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { TrackingCoordinator } from '@/lib/services/TrackingCoordinator';
import { getSkippedPermissions } from '@/lib/onboarding/state';
import { openAppSettings } from '@/lib/permissions/wizard';
import { Spacing, FontSizes, FontWeights } from '@/constants/theme';

const WHITE = '#FFFFFF'; // contrast against error background — does not vary with theme

export function TrackingPermissionBanner() {
  const { colors } = useTheme();
  const { t } = useTranslation('onboarding');
  const { currentUserId } = useAuth();

  const [hasPermissionWarning, setHasPermissionWarning] = useState(false);
  const [hasSkippedPermissions, setHasSkippedPermissions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Subscribe to native permission warnings
  useEffect(() => {
    const unsubscribe = TrackingCoordinator.subscribeToPermissionWarnings(() => {
      setHasPermissionWarning(true);
    });
    return unsubscribe;
  }, []);

  // Check for skipped permissions from onboarding
  useEffect(() => {
    if (currentUserId === null) return;

    getSkippedPermissions(currentUserId).then((skipped) => {
      if (skipped.length > 0) {
        setHasSkippedPermissions(true);
      }
    });
  }, [currentUserId]);

  const showBanner = !dismissed && (hasPermissionWarning || hasSkippedPermissions);

  if (!showBanner) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.error }]}
      onPress={openAppSettings}
      activeOpacity={0.85}
    >
      <ExclamationCircleIcon size={20} color={WHITE} />
      <Text style={styles.text}>{t('banner.permissionMissing')}</Text>
      <TouchableOpacity
        onPress={() => setDismissed(true)}
        hitSlop={{ top: Spacing.sm, bottom: Spacing.sm, left: Spacing.sm, right: Spacing.sm }}
      >
        <XMarkIcon size={20} color={WHITE} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  text: {
    flex: 1,
    color: WHITE,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
});
