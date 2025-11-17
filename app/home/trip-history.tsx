/**
 * Trip History Screen
 *
 * Displays list of all trips with filters
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { database, type Trip as DBTrip } from '@/lib/database';
import { formatDistance, formatDuration } from '@/lib/utils/geoCalculations';
import { getTripTypeColor, getTripTypeIcon, getTripTypeName } from '@/types/trip';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChevronLeftIcon } from 'react-native-heroicons/outline';

export default function TripHistoryScreen() {
  const { colors } = useTheme();
  const [trips, setTrips] = useState<DBTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTrips();
  }, []);

  async function loadTrips() {
    try {
      await database.init();
      const allTrips = await database.getAllTrips({ status: 'completed' });
      setTrips(allTrips);
    } catch (error) {
      console.error('[TripHistory] Error loading trips:', error);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadTrips();
    setRefreshing(false);
  }

  function renderTrip({ item }: { item: DBTrip }) {
    const tripColor = getTripTypeColor(item.type);
    const tripIcon = getTripTypeIcon(item.type);
    const tripName = getTripTypeName(item.type);
    const date = new Date(item.start_time);

    return (
      <TouchableOpacity
        style={[styles.tripCard, { backgroundColor: colors.card }]}
        onPress={() => router.push(`/home/trip-detail?id=${item.id}`)}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View style={[styles.tripIcon, { backgroundColor: tripColor + '20' }]}>
          <MaterialCommunityIcons name={tripIcon as any} size={24} color={tripColor} />
        </View>

        {/* Details */}
        <View style={styles.tripDetails}>
          <View style={styles.tripHeader}>
            <ThemedText style={styles.tripType}>{tripName}</ThemedText>
            {item.is_manual === 1 && (
              <View style={[styles.manualBadge, { backgroundColor: colors.border }]}>
                <ThemedText style={styles.manualText}>Manual</ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={[styles.tripDate, { color: colors.textSecondary }]}>
            {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </ThemedText>

          <View style={styles.tripStats}>
            <View style={styles.stat}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Distance</ThemedText>
              <ThemedText style={styles.statValue}>{formatDistance(item.distance)}</ThemedText>
            </View>

            <View style={styles.stat}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Duration</ThemedText>
              <ThemedText style={styles.statValue}>{formatDuration(item.duration)}</ThemedText>
            </View>

            <View style={styles.stat}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>CO₂</ThemedText>
              <ThemedText style={styles.statValue}>{item.co2_saved.toFixed(2)} kg</ThemedText>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <ThemedView style={styles.container}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeftIcon size={28} color={colors.text} />
          </TouchableOpacity>

          <ThemedText type="subtitle" style={styles.headerTitle}>
            Trip History
          </ThemedText>

          <View style={styles.placeholder} />
        </View>

      {trips.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="map-marker-off" size={64} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
            No trips yet
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Enable background tracking or add a manual entry
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTrip}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
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
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tripDetails: {
    flex: 1,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tripType: {
    fontSize: 18,
    fontWeight: '600',
  },
  manualBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  manualText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tripDate: {
    fontSize: 13,
    marginBottom: 8,
  },
  tripStats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
