import React, { useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon } from 'react-native-heroicons/mini';
import { MapIcon, MapPinIcon } from 'react-native-heroicons/outline';
import { PostsScreen } from '@/components/posts/PostsScreen';
import { PostsEmptyState } from '@/components/posts/PostsEmptyState';
import { PressableScale } from '@/components/posts/PressableScale';
import { FadeInUp } from '@/components/posts/FadeInUp';
import { useTheme } from '@/contexts/ThemeContext';
import { useTrips } from '@/lib/hooks/useTrips';
import { ShareTripModal } from '@/components/trips/ShareTripModal';
import { formatDistance, formatDuration } from '@/lib/utils/geoCalculations';
import { getTripTypeName } from '@/types/trip';
import { useUnits } from '@/contexts/UnitsContext';
import { isVisibleTripType } from '@/lib/utils/tripTypeUi';
import type { ApiTrip } from '@/lib/api/trips';

export default function ShareTripScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('groups');
  const { unitSystem } = useUnits();
  const params = useLocalSearchParams<{ clubId?: string }>();
  const preselectedClubId = params.clubId ? parseInt(params.clubId, 10) : undefined;

  const { data: trips, isLoading } = useTrips({ status: 'completed' });
  const [selectedTrip, setSelectedTrip] = useState<ApiTrip | null>(null);

  const visibleTrips = useMemo(() => {
    if (!trips) return [];
    return trips
      .filter((trip) => trip.is_valid !== false && isVisibleTripType(trip.type))
      .slice(0, 20);
  }, [trips]);

  const handleTripPress = useCallback((trip: ApiTrip) => {
    setSelectedTrip(trip);
  }, []);

  function renderTrip(item: ApiTrip, index: number) {
    const tripName = getTripTypeName(item.type);
    const startTime = new Date(item.start_timestamp);

    return (
      <FadeInUp key={item.client_id} index={index} style={styles.cardWrap}>
        <PressableScale
          style={[styles.tripCard, { backgroundColor: colors.card }]}
          onPress={() => handleTripPress(item)}
          accessibilityLabel={tripName}
        >
          <MapPinIcon size={24} color={colors.glassTint} />
          <View style={styles.tripDetails}>
            <Text style={[styles.tripType, { color: colors.text }]}>{tripName}</Text>
            <Text style={[styles.tripDate, { color: colors.textSecondary }]}>
              {t('posts.tripDateAt', {
                date: startTime.toLocaleDateString(),
                time: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                defaultValue: '{{date}} at {{time}}',
              })}
            </Text>
            <View style={styles.tripStats}>
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {formatDistance(item.distance * 1000, unitSystem)}
              </Text>
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {formatDuration(item.duration)}
              </Text>
            </View>
          </View>
          <ChevronRightIcon size={20} color={colors.textMuted} />
        </PressableScale>
      </FadeInUp>
    );
  }

  const title = t('posts.shareTrip', { defaultValue: 'Share a Trip' });

  return (
    <>
      {isLoading ? (
        <PostsScreen title={title} scroll={false}>
          <ActivityIndicator size="large" color={colors.primary} />
        </PostsScreen>
      ) : visibleTrips.length === 0 ? (
        <PostsScreen title={title} scroll={false}>
          <PostsEmptyState
            icon={(color) => <MapIcon size={28} color={color} />}
            text={t('posts.noTripsToShare', {
              defaultValue: 'No trips yet. Complete a trip first to share it.',
            })}
          />
        </PostsScreen>
      ) : (
        <PostsScreen title={title}>{visibleTrips.map(renderTrip)}</PostsScreen>
      )}

      <ShareTripModal
        visible={selectedTrip !== null}
        tripId={selectedTrip?.id ?? 0}
        tripDistance={selectedTrip?.distance}
        initialClubId={preselectedClubId}
        onClose={() => setSelectedTrip(null)}
        onSuccess={() => {
          setSelectedTrip(null);
          router.back();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  cardWrap: { paddingHorizontal: 16, marginBottom: 12 },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    gap: 12,
  },
  tripDetails: { flex: 1, gap: 2 },
  tripType: { fontSize: 16, fontWeight: '600' },
  tripDate: { fontSize: 13 },
  tripStats: { flexDirection: 'row', gap: 12, marginTop: 2 },
  statText: { fontSize: 13 },
});
