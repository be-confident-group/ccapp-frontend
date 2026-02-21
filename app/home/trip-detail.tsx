/**
 * Trip Detail Screen
 *
 * Shows detailed information about a trip including map with route
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { formatDistance, formatDuration, formatSpeed } from '@/lib/utils/geoCalculations';
import { getTripTypeColor, getTripTypeIcon, getTripTypeName } from '@/types/trip';
import { MapStyles } from '@/config/mapbox';
import { useMapLayer } from '@/lib/hooks/useMapLayer';
import Mapbox, { Camera, LineLayer, ShapeSource } from '@rnmapbox/maps';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChevronLeftIcon } from 'react-native-heroicons/outline';
import { useTrip, useDeleteTrip, useUpdateTrip } from '@/lib/hooks/useTrips';
import { database } from '@/lib/database';
import type { Trip } from '@/lib/database/db';
import type { TripType } from '@/types/trip';
import NetInfo from '@react-native-community/netinfo';
import { TripManager } from '@/lib/services';

// Build-time constant — true for dev and EAS preview builds, false for production
const isDebugBuild = __DEV__ || process.env.EXPO_PUBLIC_BUILD_PROFILE !== 'production';

/**
 * Translates internal tracking notes to user-friendly explanations.
 * Used for beta users to understand what happened to their trip.
 */
function getDisplayNote(rawNote: string | null): string | null {
  if (!rawNote) return null;

  if (rawNote.includes('[Auto-ended: background tracking timeout]')) {
    return 'Trip ended automatically — no GPS signal was detected for 45 minutes. This can happen if the app was backgrounded, battery saver mode was on, or you were indoors for a long time.';
  }
  if (rawNote.includes('[Auto-ended zombie]') && rawNote.includes('No locations recorded')) {
    return 'Trip was cancelled — GPS could not be obtained when the trip started.';
  }
  if (rawNote.includes('[Auto-ended zombie]') && rawNote.includes('below minimum')) {
    return 'Trip was cancelled — the distance was too short to record.';
  }
  if (rawNote.includes('[Auto-ended zombie]') && rawNote.includes('not supported')) {
    return 'Trip was cancelled — it was detected as a drive or run, which are not tracked.';
  }

  // Return raw note for anything we don't recognize
  return rawNote;
}

export default function TripDetailScreen() {
  const { id, local } = useLocalSearchParams<{ id: string; local?: string }>();
  const isLocalTrip = local === 'true';
  const { colors, isDark } = useTheme();
  const { unitSystem, formatElevation, formatWeight } = useUnits();
  const { selectedLayer } = useMapLayer(isDark);
  const [localTrip, setLocalTrip] = useState<Trip | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showTypeCorrection, setShowTypeCorrection] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Try to parse as number (backend trip ID) or use as string (local client_id)
  const tripId = useMemo(() => {
    const numId = parseInt(id as string, 10);
    return !isNaN(numId) ? numId : 0;
  }, [id]);

  // Fetch trip from backend if we have a numeric ID
  const { data: backendTrip, isLoading, isError } = useTrip(isLocalTrip ? 0 : tripId);
  const deleteTrip = useDeleteTrip();
  const updateTrip = useUpdateTrip();

  // Check network status and load from local DB if offline or backend fails
  useEffect(() => {
    let mounted = true;

    const checkNetworkAndLoadLocal = async () => {
      const netState = await NetInfo.fetch();
      const online = netState.isConnected ?? false;

      if (mounted) {
        setIsOnline(online);
      }

      // Load from local DB if offline, backend fails, or explicitly a local trip
      if (!online || isError || isLocalTrip) {
        try {
          let tripData: Trip | null = null;
          if (isLocalTrip) {
            // Load by local client ID (the `id` param is the local UUID)
            tripData = await database.getTrip(id as string);
          } else {
            tripData = await database.getTripByBackendId(tripId);
          }
          if (mounted && tripData) {
            setLocalTrip(tripData);
          }
        } catch (error) {
          console.error('[TripDetail] Error loading local trip:', error);
        }
      }
    };

    checkNetworkAndLoadLocal();

    return () => {
      mounted = false;
    };
  }, [tripId, isError, isLocalTrip, id]);

  // Transform backend trip OR local trip to display format
  const tripDetails = useMemo(() => {
    // Use backend trip if available, but skip it for explicitly local trips
    if (!isLocalTrip && backendTrip) {
      // Transform route from backend format {lat, lng} to {latitude, longitude}
      const transformedRoute = backendTrip.route
        ? backendTrip.route.map(coord => ({
            latitude: coord.lat,
            longitude: coord.lng,
            timestamp: coord.timestamp
          }))
        : [];

      return {
        trip: {
          id: backendTrip.client_id,
          type: backendTrip.type,
          is_manual: backendTrip.is_manual ? 1 : 0,
          start_time: new Date(backendTrip.start_timestamp).getTime(),
          end_time: new Date(backendTrip.end_timestamp).getTime(),
          distance: backendTrip.distance * 1000, // Convert km to meters
          duration: backendTrip.duration,
          avg_speed: backendTrip.average_speed,
          max_speed: null, // Backend doesn't return max_speed — hide the stat
          elevation_gain: backendTrip.elevation_gain || 0,
          co2_saved: backendTrip.co2_saved,
          notes: backendTrip.notes || null,
          status: backendTrip.status,
        },
        route: transformedRoute,
      };
    }

    // Fallback to local trip if offline or backend fails
    if (localTrip) {
      // Parse route_data JSON string
      let parsedRoute: any[] = [];
      if (localTrip.route_data) {
        try {
          parsedRoute = JSON.parse(localTrip.route_data);
        } catch (error) {
          console.error('[TripDetail] Error parsing route_data:', error);
        }
      }

      return {
        trip: {
          id: localTrip.id,
          type: localTrip.type,
          is_manual: localTrip.is_manual,
          start_time: localTrip.start_time,
          end_time: localTrip.end_time,
          distance: localTrip.distance,
          duration: localTrip.duration,
          avg_speed: localTrip.avg_speed,
          max_speed: localTrip.max_speed,
          elevation_gain: localTrip.elevation_gain,
          co2_saved: localTrip.co2_saved,
          notes: localTrip.notes,
          status: localTrip.status,
        },
        route: parsedRoute,
      };
    }

    return null;
  }, [backendTrip, localTrip, isLocalTrip]);

  function handleDelete() {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (tripId > 0) {
              deleteTrip.mutate(tripId, {
                onSuccess: () => {
                  router.back();
                },
                onError: (error) => {
                  console.error('[TripDetail] Error deleting trip:', error);
                  Alert.alert('Error', 'Failed to delete trip');
                },
              });
            } else {
              Alert.alert('Error', 'Invalid trip ID');
            }
          },
        },
      ]
    );
  }

  async function handleCorrectType(newType: TripType) {
    if (!tripDetails) return;

    setCorrecting(true);
    setShowTypeCorrection(false);

    try {
      // Update local database
      if (localTrip) {
        await TripManager.updateTrip(localTrip.id, { type: newType });
      }

      // Update backend if trip is synced
      if (tripId > 0) {
        updateTrip.mutate(
          { id: tripId, data: { type: newType } },
          {
            onSuccess: () => {
              Alert.alert('Success', `Trip type updated to ${newType}`);
            },
            onError: (error) => {
              console.error('[TripDetail] Error updating trip type:', error);
              Alert.alert('Error', 'Failed to update trip type on server');
            },
          }
        );
      } else {
        Alert.alert('Success', `Trip type updated to ${newType}`);
      }
    } catch (error) {
      console.error('[TripDetail] Error correcting trip type:', error);
      Alert.alert('Error', 'Failed to update trip type');
    } finally {
      setCorrecting(false);
    }
  }

  function showTypeCorrectionModal() {
    if (!tripDetails) return;

    const currentType = tripDetails.trip.type;
    const options = [
      { type: 'walk' as TripType, label: 'Walking', icon: 'walk' },
      { type: 'cycle' as TripType, label: 'Cycling', icon: 'bicycle' },
    ].filter(opt => opt.type !== currentType);

    Alert.alert(
      'Correct Trip Type',
      `Current type: ${currentType}. What should this trip be?`,
      [
        ...options.map(opt => ({
          text: opt.label,
          onPress: () => handleCorrectType(opt.type),
        })),
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }

  if (isLoading) {
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

  const { trip, route } = tripDetails;
  const locationCount = route.length;
  const tripColor = getTripTypeColor(trip.type);
  const tripName = getTripTypeName(trip.type);
  const date = new Date(trip.start_time);

  // Convert selected layer to Mapbox style URL
  const getStyleURL = (): string => {
    switch (selectedLayer) {
      case 'light':
        return MapStyles.LIGHT;
      case 'dark':
        return MapStyles.DARK;
      case 'streets':
        return MapStyles.STREETS;
      case 'outdoors':
        return MapStyles.OUTDOORS;
      case 'satellite':
        return MapStyles.SATELLITE;
      default:
        return isDark ? MapStyles.DARK : MapStyles.LIGHT;
    }
  };

  const mapStyle = getStyleURL();

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
            <View style={[styles.mapWrapper, { backgroundColor: colors.card }]}>
              <Mapbox.MapView
                style={styles.map}
                styleURL={mapStyle}
                zoomEnabled={true}
                scrollEnabled={true}
                compassEnabled={false}
                logoEnabled={false}
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
                        lineWidth: 6,
                        lineCap: 'round',
                        lineJoin: 'round',
                        lineOpacity: 0.9,
                      }}
                    />
                  </ShapeSource>
                )}
              </Mapbox.MapView>
            </View>
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
          <View style={[styles.statsGrid, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.statItem}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Distance</ThemedText>
              <ThemedText style={styles.statValue}>{formatDistance(trip.distance, unitSystem)}</ThemedText>
            </View>

            <View style={styles.statItem}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Duration</ThemedText>
              <ThemedText style={styles.statValue}>{formatDuration(trip.duration)}</ThemedText>
            </View>

            <View style={styles.statItem}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Speed</ThemedText>
              <ThemedText style={styles.statValue}>{formatSpeed(trip.avg_speed, unitSystem)}</ThemedText>
            </View>

            {trip.max_speed != null && (
              <View style={styles.statItem}>
                <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Max Speed</ThemedText>
                <ThemedText style={styles.statValue}>{formatSpeed(trip.max_speed, unitSystem)}</ThemedText>
              </View>
            )}

            <View style={styles.statItem}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Elevation</ThemedText>
              <ThemedText style={styles.statValue}>{formatElevation(trip.elevation_gain)}</ThemedText>
            </View>

            <View style={styles.statItem}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>CO₂ Saved</ThemedText>
              <ThemedText style={styles.statValue}>{formatWeight(trip.co2_saved)}</ThemedText>
            </View>
          </View>

          {/* Additional Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Points Recorded</ThemedText>
              <ThemedText style={styles.infoValue}>{locationCount}</ThemedText>
            </View>

            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Entry Type</ThemedText>
              <ThemedText style={styles.infoValue}>{trip.is_manual ? 'Manual' : 'Automatic'}</ThemedText>
            </View>

            {(() => {
              const displayNote = getDisplayNote(trip.notes);
              return displayNote ? (
                <View style={[styles.infoRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Notes</ThemedText>
                  <ThemedText style={[styles.infoValue, { marginTop: 4 }]}>{displayNote}</ThemedText>
                </View>
              ) : null;
            })()}
          </View>

          {/* Trip Type Correction */}
          <View style={[styles.correctionCard, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.correctionHeader}>
              <MaterialCommunityIcons name="help-circle-outline" size={20} color={colors.textSecondary} />
              <ThemedText style={[styles.correctionQuestion, { color: colors.textSecondary }]}>
                Was this trip categorized correctly?
              </ThemedText>
            </View>
            <TouchableOpacity
              style={[styles.correctionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={showTypeCorrectionModal}
              disabled={correcting}
            >
              <MaterialCommunityIcons name="pencil" size={18} color={colors.primary} />
              <ThemedText style={[styles.correctionButtonText, { color: colors.primary }]}>
                {correcting ? 'Updating...' : 'Report Issue'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Beta Diagnostics */}
          {isDebugBuild && tripDetails && (
            <View style={[styles.infoCard, { backgroundColor: colors.backgroundSecondary, marginTop: Spacing.sm }]}>
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => setShowDiagnostics(!showDiagnostics)}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Beta Diagnostics
                </ThemedText>
                <MaterialCommunityIcons
                  name={showDiagnostics ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {showDiagnostics && (
                <>
                  <View style={styles.infoRow}>
                    <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Trip ID</ThemedText>
                    <ThemedText style={[styles.infoValue, { fontSize: 11 }]} numberOfLines={1}>
                      {tripDetails.trip.id}
                    </ThemedText>
                  </View>
                  <View style={styles.infoRow}>
                    <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Backend ID</ThemedText>
                    <ThemedText style={styles.infoValue}>{tripId > 0 ? String(tripId) : 'Not synced'}</ThemedText>
                  </View>
                  <View style={styles.infoRow}>
                    <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>GPS Points</ThemedText>
                    <ThemedText style={styles.infoValue}>{locationCount}</ThemedText>
                  </View>
                  <View style={styles.infoRow}>
                    <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Status</ThemedText>
                    <ThemedText style={styles.infoValue}>{tripDetails.trip.status}</ThemedText>
                  </View>
                  {tripDetails.trip.notes && (
                    <View style={[styles.infoRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                      <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Raw Note</ThemedText>
                      <ThemedText style={[styles.infoValue, { marginTop: 4, fontSize: 11 }]}>
                        {tripDetails.trip.notes}
                      </ThemedText>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
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
    padding: Spacing.md,
  },
  mapWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    alignItems: 'center',
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
  correctionCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  correctionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  correctionQuestion: {
    fontSize: 14,
    flex: 1,
  },
  correctionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  correctionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
