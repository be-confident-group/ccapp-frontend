import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import { UserCircleIcon, CameraIcon } from 'react-native-heroicons/outline';
import { saveLocalPreferences } from '@/lib/onboarding/state';
import { authApi } from '@/lib/api/auth';
import { showAlert } from '@/lib/utils/alert';
import { Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const AVATAR_SIZE = 100;
const WHITE = '#FFFFFF'; // contrast against primary brand red — does not vary with theme

export default function ProfileSetupScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('onboarding');
  const router = useRouter();
  const { currentUserId } = useAuth();

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [defaultMode, setDefaultMode] = useState<'walk' | 'cycle'>('walk');
  const [loading, setLoading] = useState(false);

  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('onboarding:profile.photoPermissionTitle', 'onboarding:profile.photoPermissionBody');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
      setAvatarBase64(result.assets[0].base64 ?? null);
    }
  }

  async function handleContinue() {
    setLoading(true);
    try {
      // 1. Save go-to activity + avatar to backend via the profile update endpoint (best-effort)
      try {
        const update: Parameters<typeof authApi.updateProfile>[0] = {
          preferred_activity: defaultMode,
        };
        if (avatarBase64) {
          update.profile_picture = `data:image/jpeg;base64,${avatarBase64}`;
        }
        await authApi.updateProfile(update);
      } catch (e) {
        console.warn('[ProfileSetup] updateProfile failed (non-blocking):', e);
      }

      // 2. Save local preference as cache fallback
      if (currentUserId !== null) {
        await saveLocalPreferences(currentUserId, { defaultMode });
      }

      // 3. Navigate to goals
      router.push('/(onboarding)/goals');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Screen title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {t('profile.title')}
          </Text>

          {/* Avatar section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={[styles.avatarWrapper, { borderColor: colors.border }]}
              onPress={handlePickAvatar}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('profile.avatarHint')}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
                  <UserCircleIcon size={100} color={colors.textSecondary} />
                </View>
              )}

              {/* Camera overlay badge */}
              <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
                <CameraIcon size={14} color={WHITE} />
              </View>
            </TouchableOpacity>

            <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>
              {t('profile.avatarHint')}
            </Text>
          </View>

          {/* Mode selector */}
          <Text style={[styles.modeLabel, { color: colors.text }]}>
            {t('profile.modeLabel')}
          </Text>

          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[
                styles.modePill,
                {
                  backgroundColor:
                    defaultMode === 'walk' ? colors.primary : colors.card,
                  borderColor:
                    defaultMode === 'walk' ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setDefaultMode('walk')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modePillText,
                  { color: defaultMode === 'walk' ? WHITE : colors.primary },
                ]}
              >
                {t('profile.walk')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modePill,
                {
                  backgroundColor:
                    defaultMode === 'cycle' ? colors.primary : colors.card,
                  borderColor:
                    defaultMode === 'cycle' ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setDefaultMode('cycle')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modePillText,
                  { color: defaultMode === 'cycle' ? WHITE : colors.primary },
                ]}
              >
                {t('profile.cycle')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Continue button */}
          <Button
            title={t('profile.continue')}
            onPress={handleContinue}
            variant="primary"
            size="large"
            fullWidth
            loading={loading}
            style={styles.continueButton}
          />
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.xl,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarWrapper: {
    position: 'relative',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    overflow: 'visible',
    marginBottom: 12,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontSize: 13,
  },
  modeLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.xl,
  },
  modePill: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
  },
  modePillText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  continueButton: {
    marginTop: 8,
  },
});
