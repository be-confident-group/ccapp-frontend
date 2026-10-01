import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon } from 'react-native-heroicons/mini';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { trophyAPI } from '@/lib/api/trophies';

const PRESS_SPRING = { damping: 15, stiffness: 400 };

interface ProfileCardProps {
  firstName?: string;
  lastName?: string;
  fullName: string;
  email?: string;
  imageUri?: string | null;
  onPress: () => void;
}

/**
 * Profile summary at the top of the You tab: avatar, name and email, plus
 * lifetime stats (distance, trips, trophies). Tapping opens Edit Profile.
 */
export function ProfileCard({ firstName, lastName, fullName, email, imageUri, onPress }: ProfileCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { formatDistance } = useUnits();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Same endpoints the Home tab uses; cached so revisiting the tab is instant.
  const { data: profile } = useQuery({
    queryKey: ['trophyProfile'],
    queryFn: () => trophyAPI.getUserProfile(),
    staleTime: 1000 * 60 * 5,
  });
  const { data: trophies } = useQuery({
    queryKey: ['trophies'],
    queryFn: () => trophyAPI.getTrophies(),
    staleTime: 1000 * 60 * 5,
  });

  const stats = profile?.stats;
  const totalDistance = (stats?.total_distance_ride ?? 0) + (stats?.total_distance_walk ?? 0);
  const totalTrips = (stats?.total_rides ?? 0) + (stats?.total_walks ?? 0);
  const earned = trophies?.filter((trophy) => trophy.is_earned).length ?? 0;

  const items = [
    { key: 'distance', value: stats ? formatDistance(totalDistance, 0) : '–', label: t('profile:card.distance', { defaultValue: 'Distance' }) },
    { key: 'trips', value: stats ? String(totalTrips) : '–', label: t('profile:card.trips', { defaultValue: 'Trips' }) },
    {
      key: 'trophies',
      value: trophies ? `${earned}/${trophies.length}` : '–',
      label: t('profile:card.trophies', { defaultValue: 'Trophies' }),
    },
  ];

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile:account.editProfile')}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.98, PRESS_SPRING);
          if (process.env.EXPO_OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS_SPRING);
        }}
        style={[styles.card, { backgroundColor: colors.card }]}
      >
        <View style={styles.identity}>
          <View style={[styles.avatarRing, { borderColor: colors.glassHighlight }]}>
            <ProfileAvatar imageUri={imageUri ?? undefined} firstName={firstName} lastName={lastName} size={64} editable={false} />
          </View>
          <View style={styles.identityText}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {fullName}
            </Text>
            {!!email && (
              <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
                {email}
              </Text>
            )}
          </View>
          <ChevronRightIcon size={20} color={colors.textMuted} />
        </View>

        <View style={[styles.statsRow, { backgroundColor: colors.backgroundSecondary }]}>
          {items.map((item, i) => (
            <React.Fragment key={item.key}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {item.value}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 16,
    gap: 16,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: {
    borderWidth: 3,
    borderRadius: 999,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
  },
  email: {
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
});
