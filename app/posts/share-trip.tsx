import React, { useState, useCallback, useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { useTrips } from '@/lib/hooks/useTrips';
import { ShareTripModal } from '@/components/trips/ShareTripModal';
import { formatDistance, formatDuration } from '@/lib/utils/geoCalculations';
import { getTripTypeColor, getTripTypeIcon, getTripTypeName } from '@/types/trip';
import { useUnits } from '@/contexts/UnitsContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isVisibleTripType } from '@/lib/utils/tripTypeUi';
import type { ApiTrip } from '@/lib/api/trips';

export default function ShareTripScreen() {
  const { colors } = useTheme();
  const { unitSystem } = useUnits();

  const { data: trips, isLoading } = useTrips({ status: 'completed' });
  const [selectedTrip, setSelectedTrip] = useState<ApiTrip | null>(null);

  const visibleTrips = useMemo(() => {
    if (!trips) return [];
    return trips
      .filter((t) => t.is_valid !== false && isVisibleTripType(t.type))
      .slice(0, 20);
  }, [trips]);

  const handleTripPress = useCallback((trip: ApiTrip) => {
    setSelectedTrip(trip);
  }, []);

  function renderTrip({ item }: { item: ApiTrip }) {
    const tripColor = getTripTypeColor(item.type);
    const tripIcon = getTripTypeIcon(item.type);
    const tripName = getTripTypeName(item.type);
    const startTime = new Date(item.start_timestamp);

    return (
      <TouchableOpacity
        style={[styles.tripCard, { backgroundColor: colors.card }]}
        onPress={() => handleTripPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.tripIcon, { backgroundColor: tripColor + '20' }]}>
          <MaterialCommunityIcons name={tripIcon as any} size={24} color={tripColor} />
        </View>
        <View style={styles.tripDetails}>
          <ThemedText style={styles.tripType}>{tripName}</ThemedText>
          <ThemedText style={[styles.tripDate, { color: colors.textSecondary }]}>
            {startTime.toLocaleDateString()} at {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </ThemedText>
          <View style={styles.tripStats}>
            <ThemedText style={[styles.statText, { color: colors.textSecondary }]}>
              {formatDistance(item.distance * 1000, unitSystem)}
            </ThemedText>
            <ThemedText style={[styles.statText, { color: colors.textSecondary }]}>
              {formatDuration(item.duration)}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Header title="Share a Trip" showBack />
      <ThemedView style={styles.container}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : visibleTrips.length === 0 ? (
          <View style={styles.centered}>
            <ThemedText style={{ color: colors.textMuted, textAlign: 'center' }}>
              No trips yet. Complete a trip first to share it.
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={visibleTrips}
            renderItem={renderTrip}
            keyExtractor={(item) => item.client_id}
            contentContainerStyle={styles.list}
          />
        )}
      </ThemedView>

      <ShareTripModal
        visible={selectedTrip !== null}
        tripId={selectedTrip?.id ?? 0}
        tripDistance={selectedTrip?.distance}
        onClose={() => setSelectedTrip(null)}
        onSuccess={() => {
          setSelectedTrip(null);
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  list: { padding: Spacing.lg },
  tripCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tripIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tripDetails: { flex: 1, justifyContent: 'center' },
  tripType: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  tripDate: { fontSize: 13, marginBottom: 4 },
  tripStats: { flexDirection: 'row', gap: 12 },
  statText: { fontSize: 13 },
});
