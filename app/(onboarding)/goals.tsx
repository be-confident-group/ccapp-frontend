import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import { saveGoals } from '@/lib/onboarding/state';
import { Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const WHITE = '#FFFFFF'; // contrast against primary brand red — does not vary with theme

const WEEKLY_DISTANCE_OPTIONS = [10, 20, 25, 30, 50];
const ACTIVE_DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

const DEFAULT_WEEKLY_DISTANCE_KM = 25;
const DEFAULT_ACTIVE_DAYS_PER_WEEK = 4;

export default function GoalsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('onboarding');
  const router = useRouter();
  const { currentUserId } = useAuth();

  const [weeklyDistanceKm, setWeeklyDistanceKm] = useState(DEFAULT_WEEKLY_DISTANCE_KM);
  const [activeDaysPerWeek, setActiveDaysPerWeek] = useState(DEFAULT_ACTIVE_DAYS_PER_WEEK);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setLoading(true);
    try {
      if (currentUserId !== null) {
        await saveGoals(currentUserId, { weeklyDistanceKm, activeDaysPerWeek });
      }
      router.push('/(onboarding)/permissions-wizard');
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    if (currentUserId !== null) {
      await saveGoals(currentUserId, {
        weeklyDistanceKm: DEFAULT_WEEKLY_DISTANCE_KM,
        activeDaysPerWeek: DEFAULT_ACTIVE_DAYS_PER_WEEK,
      });
    }
    router.push('/(onboarding)/permissions-wizard');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Skip link in top-right */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: colors.primary }]}>
            {t('goals.skip')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen title */}
        <Text style={[styles.title, { color: colors.text }]}>
          {t('goals.title')}
        </Text>

        {/* Weekly distance section */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>
          {t('goals.weeklyDistance')}
        </Text>
        <View style={styles.chipsRow}>
          {WEEKLY_DISTANCE_OPTIONS.map((km) => {
            const selected = weeklyDistanceKm === km;
            return (
              <TouchableOpacity
                key={km}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setWeeklyDistanceKm(km)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? WHITE : colors.primary },
                  ]}
                >
                  {`${km} km`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active days section */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>
          {t('goals.activeDays')}
        </Text>
        <View style={styles.chipsRow}>
          {ACTIVE_DAYS_OPTIONS.map((days) => {
            const selected = activeDaysPerWeek === days;
            return (
              <TouchableOpacity
                key={days}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setActiveDaysPerWeek(days)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? WHITE : colors.primary },
                  ]}
                >
                  {String(days)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Continue button */}
        <Button
          title={t('goals.continue')}
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
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  skipText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.xl,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  continueButton: {
    marginTop: 8,
  },
});
