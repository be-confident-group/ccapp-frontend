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
import { ChevronLeftIcon, ChevronDownIcon, ChevronUpIcon } from 'react-native-heroicons/outline';
import { useTrip, useDeleteTrip, useUpdateTrip } from '@/lib/hooks/useTrips';
import { database } from '@/lib/database';
import type { Trip } from '@/lib/database/db';
import type { TripType } from '@/types/trip';
import NetInfo from '@react-native-community/netinfo';
import { syncService } from '@/lib/services/SyncService';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/i18n/formatters';
import { TripNoteEditor } from '@/components/tracking/TripNoteEditor';

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
  const { t } = useTranslation('maps');
  const { selectedLayer } = useMapLayer(isDark);
  const [localTrip, setLocalTrip] = useState<Trip | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [confirmTypeOverride, setConfirmTypeOverride] = useState<TripType | null>(null);
  const [confirmedLocally, setConfirmedLocally] = useState(false);

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
            // Flush any pending dirty edits to backend (fire-and-forget; offline is fine)
            void syncService.patchTripFields(tripData.id).catch(() => {/* offline, retry later */});
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

      // Dirty-flag-aware merge: trust backend for computed/read-only fields,
      // but prefer local value for writable fields that the user has edited
      // since the last sync (indicated by the dirty flags in SQLite).
      const mergedType = localTrip?.type_dirty
        ? localTrip.type
        : (backendTrip.type ?? localTrip?.type);
      const mergedUserNote = localTrip?.user_note_dirty
        ? localTrip.user_note
        : (backendTrip.user_note ?? localTrip?.user_note ?? null);

      return {
        trip: {
          id: backendTrip.client_id,
          type: mergedType,
          is_manual: backendTrip.is_manual ? 1 : 0,
          start_time: new Date(backendTrip.start_timestamp).getTime(),
          end_time: new Date(backendTrip.end_timestamp).getTime(),
          // Always trust backend for computed/read-only fields:
          distance: backendTrip.distance * 1000, // Convert km to meters
          duration: backendTrip.duration,
          avg_speed: backendTrip.average_speed,
          max_speed: backendTrip.max_speed ?? null,
          elevation_gain: backendTrip.elevation_gain || 0,
          co2_saved: backendTrip.co2_saved,
          is_valid: backendTrip.is_valid,
          notes: mergedUserNote ?? backendTrip.notes ?? null,
          user_note: mergedUserNote,
          status: backendTrip.status,
          validation_log: backendTrip.validation_log ?? null,
          classification_source: (backendTrip as any).classification_source ?? localTrip?.classification_source ?? null,
        },
        route: transformedRoute,
      };
    }

    // Fallback to local trip if offline or backend fails
    if (localTrip) {
      // Parse route_data JSON string.
      // route_data is stored as {lat, lng, timestamp} — normalize to {latitude, longitude}
      // so the Mapbox coordinate mapping ([coord.longitude, coord.latitude]) works correctly.
      let parsedRoute: Array<{ latitude: number; longitude: number; timestamp?: string }> = [];
      if (localTrip.route_data) {
        try {
          const raw = JSON.parse(localTrip.route_data);
          parsedRoute = raw.map((p: any) => ({
            latitude: p.latitude ?? p.lat,
            longitude: p.longitude ?? p.lng,
            timestamp: p.timestamp,
          }));
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
          user_note: localTrip.user_note ?? null,
          status: localTrip.status,
          validation_log: localTrip.validation_log ?? null,
          classification_source: localTrip.classification_source ?? null,
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

  async function handleConfirmTrip() {
    if (!backendTrip) return;
    const selectedType = confirmTypeOverride ?? backendTrip.type;
    // Hide the card immediately — prevents re-render crash from cache update
    setConfirmedLocally(true);
    try {
      await updateTrip.mutateAsync({
        id: backendTrip.id,
        data: { user_confirmed: true, type: selectedType },
      });
    } catch (error) {
      setConfirmedLocally(false);
      console.error('[TripDetail] Error confirming trip:', error);
      Alert.alert('Error', 'Failed to confirm trip');
    }
  }

  async function handleNotMyTrip() {
    if (!backendTrip) return;
    // Hide the card immediately — prevents re-render crash from cache update
    setConfirmedLocally(true);
    try {
      await updateTrip.mutateAsync({
        id: backendTrip.id,
        data: { user_confirmed: false },
      });
    } catch (error) {
      setConfirmedLocally(false);
      console.error('[TripDetail] Error flagging trip:', error);
      Alert.alert('Error', 'Failed to flag trip');
    }
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
    type: 'Feature' as const,
    properties: null,
    geometry: {
      type: 'LineString' as const,
      coordinates: route.map((coord: { longitude: number; latitude: number }) => [coord.longitude, coord.latitude]),
    },
  } : null;

  // Calculate center and bounds
  const center = route.length > 0 ? [
    route[Math.floor(route.length / 2)].longitude,
    route[Math.floor(route.length / 2)].latitude,
  ] : [-122.4194, 37.7749];

  // Helper to reload local trip after a note save
  async function reloadLocalTrip() {
    try {
      let tripData: Trip | null = null;
      if (isLocalTrip) {
        tripData = await database.getTrip(id as string);
      } else {
        tripData = await database.getTripByBackendId(tripId);
      }
      if (tripData) setLocalTrip(tripData);
    } catch (error) {
      console.error('[TripDetail] Error reloading local trip:', error);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ThemedView style={styles.container}>
        {/* Header — above ScrollView */}
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

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 1. Map */}
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
                    <ShapeSource id="routeSource" shape={routeGeoJSON ?? undefined}>
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

          <View style={styles.content}>
            {/* 2. Date subtitle */}
            <ThemedText style={[styles.dateSubtitle, { color: colors.textSecondary }]}>
              {formatDate(date, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </ThemedText>

            {/* Confirmation card — shown when trip hasn't been reviewed yet */}
            {backendTrip && backendTrip.user_confirmed === null && !confirmedLocally && (
              <View style={[styles.confirmCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                {/* Type selector */}
                <View style={styles.typeSelector}>
                  {(['walk', 'cycle'] as TripType[]).map((type) => {
                    const selected = (confirmTypeOverride ?? backendTrip.type) === type;
                    const tColor = getTripTypeColor(type);
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeOption,
                          {
                            backgroundColor: selected ? tColor + '25' : colors.background,
                            borderColor: selected ? tColor : colors.border,
                          },
                        ]}
                        onPress={() => setConfirmTypeOverride(type)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name={getTripTypeIcon(type) as any}
                          size={18}
                          color={selected ? tColor : colors.textSecondary}
                        />
                        <ThemedText
                          style={[
                            styles.typeOptionText,
                            { color: selected ? tColor : colors.textSecondary },
                          ]}
                        >
                          {getTripTypeName(type)}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Confirm / Not my trip */}
                <View style={styles.confirmActions}>
                  {updateTrip.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.confirmBtn, { backgroundColor: '#4CAF50' + '20', borderColor: '#4CAF50' }]}
                        onPress={handleConfirmTrip}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons name="check" size={16} color="#4CAF50" />
                        <ThemedText style={[styles.confirmBtnText, { color: '#4CAF50' }]}>Confirm</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.confirmBtn, { backgroundColor: '#EF4444' + '20', borderColor: '#EF4444' }]}
                        onPress={handleNotMyTrip}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons name="close" size={16} color="#EF4444" />
                        <ThemedText style={[styles.confirmBtnText, { color: '#EF4444' }]}>Not my trip</ThemedText>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            )}

            {/* 3. Headline stats row */}
            <View style={[styles.headlineRow, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.headlineStat}>
                <ThemedText style={[styles.headlineLabel, { color: colors.textSecondary }]}>Distance</ThemedText>
                <ThemedText style={styles.headlineValue}>{formatDistance(trip.distance, unitSystem)}</ThemedText>
              </View>
              <View style={[styles.headlineDivider, { backgroundColor: colors.border }]} />
              <View style={styles.headlineStat}>
                <ThemedText style={[styles.headlineLabel, { color: colors.textSecondary }]}>Duration</ThemedText>
                <ThemedText style={styles.headlineValue}>{formatDuration(trip.duration)}</ThemedText>
              </View>
            </View>

            {/* 4. Speed grid: 2-column */}
            <View style={[styles.speedGrid, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.speedItem}>
                <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {t('trip_detail.avg_moving_speed')}
                </ThemedText>
                <ThemedText style={styles.statValue}>
                  {formatSpeed(localTrip?.moving_avg_speed_kmh != null
                    ? localTrip.moving_avg_speed_kmh / 3.6
                    : trip.avg_speed, unitSystem)}
                </ThemedText>
              </View>
              <View style={styles.speedItem}>
                <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {t('trip_detail.max_speed')}
                </ThemedText>
                <ThemedText style={styles.statValue}>
                  {trip.max_speed != null ? formatSpeed(trip.max_speed, unitSystem) : '—'}
                </ThemedText>
              </View>
            </View>

            {/* 5. Elevation row */}
            {((localTrip?.elevation_loss_m != null && localTrip.elevation_loss_m !== 0) ||
              (trip.elevation_gain != null && trip.elevation_gain !== 0)) && (
              <View style={[styles.elevationRow, { backgroundColor: colors.backgroundSecondary }]}>
                {trip.elevation_gain != null && trip.elevation_gain !== 0 && (
                  <ThemedText style={styles.elevationText}>
                    {'↗ '}{t('trip_detail.elevation_gain', { m: Math.round(trip.elevation_gain) })}
                  </ThemedText>
                )}
                {trip.elevation_gain != null && trip.elevation_gain !== 0 &&
                  localTrip?.elevation_loss_m != null && localTrip.elevation_loss_m !== 0 && (
                  <ThemedText style={[styles.elevationSep, { color: colors.textSecondary }]}> · </ThemedText>
                )}
                {localTrip?.elevation_loss_m != null && localTrip.elevation_loss_m !== 0 && (
                  <ThemedText style={styles.elevationText}>
                    {'↘ '}{t('trip_detail.elevation_loss', { m: Math.round(localTrip.elevation_loss_m) })}
                  </ThemedText>
                )}
              </View>
            )}

            {/* 6. CO₂ row */}
            {trip.co2_saved != null && trip.co2_saved > 0 && (
              <View style={[styles.co2Row, { backgroundColor: colors.backgroundSecondary }]}>
                <ThemedText style={styles.co2Text}>
                  {'🌱 '}{t('trip_detail.co2_saved', { kg: trip.co2_saved.toFixed(2) })}
                </ThemedText>
              </View>
            )}

            {/* 7. Notes section */}
            <View style={[styles.sectionCard, { backgroundColor: colors.backgroundSecondary }]}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('trip_detail.notes_title')}
              </ThemedText>
              <TripNoteEditor
                tripId={trip.id}
                initialValue={trip.user_note ?? trip.notes}
                onSaved={reloadLocalTrip}
              />
            </View>

            {/* 8. Beta Diagnostics drawer */}
            {isDebugBuild && (
              <View style={[styles.infoCard, { backgroundColor: colors.backgroundSecondary, marginTop: Spacing.sm }]}>
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={() => setShowDiagnostics(!showDiagnostics)}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>
                    {t('trip_detail.beta_diagnostics')}
                  </ThemedText>
                  {showDiagnostics
                    ? <ChevronUpIcon size={18} color={colors.textSecondary} />
                    : <ChevronDownIcon size={18} color={colors.textSecondary} />
                  }
                </TouchableOpacity>

                {showDiagnostics && (
                  <>
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>
                        {t('trip_detail.trip_id')}
                      </ThemedText>
                      <ThemedText style={[styles.infoValue, { fontSize: 11 }]} numberOfLines={1}>
                        {trip.id}
                      </ThemedText>
                    </View>
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>
                        {t('trip_detail.backend_id')}
                      </ThemedText>
                      <ThemedText style={styles.infoValue}>
                        {tripId > 0 ? String(tripId) : 'Not synced'}
                      </ThemedText>
                    </View>
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>
                        {t('trip_detail.gps_points')}
                      </ThemedText>
                      <ThemedText style={styles.infoValue}>{locationCount}</ThemedText>
                    </View>
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>
                        {t('trip_detail.imu_samples')}
                      </ThemedText>
                      <ThemedText style={styles.infoValue}>
                        {localTrip?.ml_confidence != null ? 'Available' : '—'}
                      </ThemedText>
                    </View>
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>
                        {t('trip_detail.classification_source')}
                      </ThemedText>
                      <ThemedText style={styles.infoValue}>
                        {trip.classification_source ?? localTrip?.classification_source ?? '—'}
                      </ThemedText>
                    </View>
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>
                        Entry Type
                      </ThemedText>
                      <ThemedText style={styles.infoValue}>
                        {trip.is_manual
                          ? t('trip_detail.entry_manual')
                          : t('trip_detail.entry_automatic')}
                      </ThemedText>
                    </View>
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>
                        {t('trip_detail.status')}
                      </ThemedText>
                      <ThemedText style={styles.infoValue}>{trip.status}</ThemedText>
                    </View>
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>
                        {t('trip_detail.avg_speed_backend')}
                      </ThemedText>
                      <ThemedText style={styles.infoValue}>
                        {localTrip?.backend_avg_speed_kmh != null
                          ? formatSpeed(localTrip.backend_avg_speed_kmh / 3.6, unitSystem)
                          : '—'}
                      </ThemedText>
                    </View>
                    {(trip.validation_log ?? localTrip?.validation_log) != null && (
                      <View style={[styles.infoRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                        <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>
                          {t('trip_detail.validation_log')}
                        </ThemedText>
                        <ThemedText style={[styles.infoValue, { marginTop: 4, fontSize: 11 }]}>
                          {trip.validation_log ?? localTrip?.validation_log}
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
  scrollContent: {
    paddingBottom: Spacing.xl,
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
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  dateSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  // Headline stats row
  headlineRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  headlineStat: {
    flex: 1,
    alignItems: 'center',
  },
  headlineLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  headlineValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  headlineDivider: {
    width: 1,
    height: 40,
    marginHorizontal: Spacing.sm,
  },
  // Speed grid
  speedGrid: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: Spacing.md,
  },
  speedItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Elevation row
  elevationRow: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elevationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  elevationSep: {
    fontSize: 14,
  },
  // CO₂ row
  co2Row: {
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  co2Text: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Notes / generic section card
  sectionCard: {
    borderRadius: 12,
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  // Info card (diagnostics)
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
    maxWidth: '60%',
    textAlign: 'right',
  },
  confirmCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 4,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
