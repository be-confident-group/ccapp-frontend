/**
 * Location permission prompt overlay
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable, Linking } from 'react-native';
import { MapPinIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/ui/Button';

interface LocationPermissionPromptProps {
  onRequestPermission: () => void;
  isLoading?: boolean;
}

/**
 * Overlay shown when location permission is not granted
 */
export function LocationPermissionPrompt({
  onRequestPermission,
  isLoading = false,
}: LocationPermissionPromptProps) {
  const { colors } = useTheme();

  const openSettings = () => {
    Linking.openSettings();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
          <MapPinIcon size={48} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          Location Access Needed
        </Text>

        <Text style={[styles.description, { color: colors.textSecondary }]}>
          BeActive needs access to your location to show your position on the map and track your rides.
        </Text>

        <View style={styles.buttons}>
          <Button
            title="Enable Location"
            variant="primary"
            onPress={onRequestPermission}
            loading={isLoading}
            style={styles.button}
          />

          <Pressable onPress={openSettings} style={styles.settingsLink}>
            <Text style={[styles.settingsLinkText, { color: colors.primary }]}>
              Open Settings
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
    padding: 24,
    zIndex: 100,
  },
  content: {
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  buttons: {
    width: '100%',
    gap: 16,
  },
  button: {
    width: '100%',
  },
  settingsLink: {
    padding: 12,
    alignItems: 'center',
  },
  settingsLinkText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
