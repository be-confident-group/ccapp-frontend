/**
 * Trip Detail Screen
 *
 * Shows detailed information about a trip including map with route
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { database } from '@/lib/database';
import { TripManager } from '@/lib/services';
import { formatDistance, formatDuration, formatSpeed } from '@/lib/utils/geoCalculations';
import { getTripTypeColor, getTripTypeIcon, getTripTypeName } from '@/types/trip';
import Mapbox, { Camera, LineLayer, ShapeSource } from '@rnmapbox/maps';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChevronLeftIcon } from 'react-native-heroicons/outline';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [tripDetails, setTripDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTripDetails();
    }
  }, [id]);

  async function loadTripDetails() {
    try {
      await database.init();
      const details = await TripManager.getTripDetails(id as string);
      setTripDetails(details);
    } catch (error) {
      console.error('[TripDetail] Error loading trip:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await TripManager.deleteTrip(id as string);
              router.back();
            } catch (error) {
              console.error('[TripDetail] Error deleting trip:', error);
              Alert.alert('Error', 'Failed to delete trip');
            }
          },
        },
      ]
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

  if (!tripDetails) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <ThemedView style={styles.container}>
          <View style={styles.centered}>
            <ThemedText>Trip not found</ThemedText>
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const { trip, route, locationCount } = tripDetails;
  const tripColor = getTripTypeColor(trip.type);
  const tripName = getTripTypeName(trip.type);
  const date = new Date(trip.start_time);

  // Create GeoJSON for route
  const routeGeoJSON = route.length > 0 ? {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: route.map((coord: any) => [coord.longitude, coord.latitude]),
    },
  } : null;

  // Calculate center and bounds
  const center = route.length > 0 ? [
    route[Math.floor(route.length / 2)].longitude,
    route[Math.floor(route.length / 2)].latitude,
  ] : [-122.4194, 37.7749];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={[styles.pageHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeftIcon size={28} color={colors.text} />
          </TouchableOpacity>

          <ThemedText type="subtitle" style={styles.headerTitle}>
            {tripName}
          </ThemedText>

          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
            <MaterialCommunityIcons name="delete" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

      <ScrollView>
        {/* Map */}
        {route.length > 0 && (
          <View style={styles.mapContainer}>
            <Mapbox.MapView
              style={styles.map}
              styleURL="mapbox://styles/mapbox/outdoors-v12"
              zoomEnabled={true}
              scrollEnabled={true}
            >
              <Camera
                zoomLevel={13}
                centerCoordinate={center as [number, number]}
                animationDuration={0}
              />

              {routeGeoJSON && (
                <ShapeSource id="routeSource" shape={routeGeoJSON as any}>
                  <LineLayer
                    id="routeLine"
                    style={{
                      lineColor: tripColor,
                      lineWidth: 4,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />
                </ShapeSource>
              )}
            </Mapbox.MapView>
          </View>
        )}

        {/* Trip Info */}
        <View style={styles.content}>
          {/* Trip Info Header */}
          <View style={styles.tripHeader}>
            <View style={[styles.tripHeaderIcon, { backgroundColor: tripColor + '20' }]}>
              <MaterialCommunityIcons name={getTripTypeIcon(trip.type) as any} size={32} color={tripColor} />
            </View>
            <View style={styles.tripHeaderText}>
              <ThemedText style={styles.tripHeaderTitle}>{tripName}</ThemedText>
              <ThemedText style={[styles.tripHeaderDate, { color: colors.textSecondary }]}>
                {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </ThemedText>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={[styles.statsGrid, { backgroundColor: colors.card }]}>
            <View style={styles.statItem}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Distance</ThemedText>
              <ThemedText style={styles.statValue}>{formatDistance(trip.distance)}</ThemedText>
            </View>

            <View style={styles.statItem}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Duration</ThemedText>
              <ThemedText style={styles.statValue}>{formatDuration(trip.duration)}</ThemedText>
            </View>

            <View style={styles.statItem}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Speed</ThemedText>
              <ThemedText style={styles.statValue}>{formatSpeed(trip.avg_speed)}</ThemedText>
            </View>

            <View style={styles.statItem}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Max Speed</ThemedText>
              <ThemedText style={styles.statValue}>{formatSpeed(trip.max_speed)}</ThemedText>
            </View>

            <View style={styles.statItem}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Elevation</ThemedText>
              <ThemedText style={styles.statValue}>{trip.elevation_gain.toFixed(0)} m</ThemedText>
            </View>

            <View style={styles.statItem}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>CO₂ Saved</ThemedText>
              <ThemedText style={styles.statValue}>{trip.co2_saved.toFixed(2)} kg</ThemedText>
            </View>
          </View>

          {/* Additional Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Points Recorded</ThemedText>
              <ThemedText style={styles.infoValue}>{locationCount}</ThemedText>
            </View>

            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Entry Type</ThemedText>
              <ThemedText style={styles.infoValue}>{trip.is_manual ? 'Manual' : 'Automatic'}</ThemedText>
            </View>

            {trip.notes && (
              <View style={[styles.infoRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Notes</ThemedText>
                <ThemedText style={[styles.infoValue, { marginTop: 4 }]}>{trip.notes}</ThemedText>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
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
  pageHeader: {
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContainer: {
    height: 300,
    width: '100%',
  },
  map: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  tripHeaderIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tripHeaderText: {
    flex: 1,
  },
  tripHeaderTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  tripHeaderDate: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statItem: {
    width: '33.33%',
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});
