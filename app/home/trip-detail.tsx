/**
 * Trip Detail Screen
 *
 * Shows detailed information about a trip including map with route
 */

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { formatDistance, formatDuration, formatSpeed } from '@/lib/utils/geoCalculations';
import { getTripTypeColor, getTripTypeName } from '@/types/trip';
import { MapStyles } from '@/config/mapbox';
import { useMapLayer } from '@/lib/hooks/useMapLayer';
import Mapbox, { Camera, CircleLayer, LineLayer, ShapeSource } from '@rnmapbox/maps';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowsRightLeftIcon,
  BoltIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LifebuoyIcon,
  TrashIcon,
  TruckIcon,
  UserIcon,
} from 'react-native-heroicons/outline';
import { GlassButton } from '@/components/ui/GlassButton';
import { GlassSurface } from '@/components/ui/GlassSurface';
import Button from '@/components/ui/Button';
import { TripTypeTile } from '@/components/trips/TripTypeTile';
import { useTrip, useDeleteTrip, useUpdateTrip } from '@/lib/hooks/useTrips';
import { database } from '@/lib/database';
import type { Trip } from '@/lib/database/db';
import type { TripType } from '@/types/trip';
import NetInfo from '@react-native-community/netinfo';
import { syncService } from '@/lib/services/SyncService';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/i18n/formatters';
import { TripNoteEditor } from '@/components/tracking/TripNoteEditor';
import { isDebugEnabled } from '@/lib/utils/debugAccess';

const SHEET_OVERLAP = 28;
const BUTTON_SIZE = 44;
const TRIP_TYPES: TripType[] = ['walk', 'run', 'cycle', 'drive'];

const TRIP_TYPE_ICONS: Record<TripType, typeof UserIcon> = {
  walk: UserIcon,
  run: BoltIcon,
  cycle: LifebuoyIcon,
  drive: TruckIcon,
};

export default function TripDetailScreen() {
  const { id, local } = useLocalSearchParams<{ id: string; local?: string }>();
  const isLocalTrip = local === 'true';
  const isDebugBuild = isDebugEnabled();
  const { colors, isDark } = useTheme();
  const { unitSystem } = useUnits();
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
  const { data: backendTrip, isLoading, isError } = useTrip(tripId, { enabled: !isLocalTrip && tripId > 0 });
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
          auto_reclassified_from: backendTrip.auto_reclassified_from ?? null,
        },
        route: transformedRoute,
      };
    }

    // Fallback to local trip if offline or backend fails
    if (localTrip) {
      // Parse route_data JSON string.
      // route_data is stored as {lat, lng, timestamp} — normalize to {latitude, longitude}
      // so the Mapbox coordinate mapping ([coord.longitude, coord.latitude]) works correctly.
      let parsedRoute: { latitude: number; longitude: number; timestamp?: string }[] = [];
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
          auto_reclassified_from: null,
        },
        route: parsedRoute,
      };
    }

    return null;
  }, [backendTrip, localTrip, isLocalTrip]);

  // --- Presentation: hero / scroll / entrance animation (hooks must precede early returns) ---
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const hasRoute = (tripDetails?.route.length ?? 0) > 0;
  const heroHeight = hasRoute ? Math.round(windowHeight * 0.42) : insets.top + 72;
  const pillHideOffset = insets.top + BUTTON_SIZE + 24;
  const scrollY = useSharedValue(0);
  const sheetProgress = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  useEffect(() => {
    sheetProgress.value = withSpring(1, { damping: 18, stiffness: 140 });
  }, [sheetProgress]);

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-heroHeight, 0, heroHeight],
          [-heroHeight / 2, 0, heroHeight * 0.5],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(scrollY.value, [-heroHeight, 0], [2, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  const pillAnimatedStyle = useAnimatedStyle(() => {
    const start = heroHeight - insets.top - 120;
    const p = interpolate(scrollY.value, [start, start + 60], [0, 1], Extrapolation.CLAMP);
    return {
      transform: [
        { translateY: (1 - p) * -pillHideOffset },
        { scale: 0.9 + 0.1 * p },
      ],
    };
  });

  const statusBackdropStyle = useAnimatedStyle(() => {
    const start = heroHeight - insets.top - 100;
    return {
      opacity: interpolate(scrollY.value, [start, start + 60], [0, 1], Extrapolation.CLAMP),
    };
  });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sheetProgress.value,
    transform: [{ translateY: (1 - sheetProgress.value) * 24 }],
  }));

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
        data: { user_confirmed: true, type: selectedType, classification_source: 'manual' },
      });
      // Mirror the label into local SQLite so the type_dirty merge in SyncService
      // never clobbers the user's choice on the next background sync.
      if (backendTrip.client_id) {
        try {
          await database.updateTrip(backendTrip.client_id, {
            type: selectedType,
            classification_source: 'manual',
            type_dirty: 0,
            updated_at: Date.now(),
          });
        } catch {
          // Non-fatal — local DB update is best-effort.
        }
      }
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
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tripDetails) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centered}>
          <ThemedText>Trip not found</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const { trip, route } = tripDetails;
  const locationCount = route.length;
  const tripColor = getTripTypeColor(trip.type);
  const tripName = getTripTypeName(trip.type);
  const date = new Date(trip.start_time);
  const TripIcon = TRIP_TYPE_ICONS[trip.type as TripType] ?? UserIcon;

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

  // Start / end markers
  const endpointsGeoJSON = route.length > 0 ? {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: { kind: 'start' },
        geometry: { type: 'Point' as const, coordinates: [route[0].longitude, route[0].latitude] },
      },
      {
        type: 'Feature' as const,
        properties: { kind: 'end' },
        geometry: {
          type: 'Point' as const,
          coordinates: [route[route.length - 1].longitude, route[route.length - 1].latitude],
        },
      },
    ],
  } : null;

  // Route bounds for fitting the camera
  let routeBounds: { ne: [number, number]; sw: [number, number] } | null = null;
  if (route.length > 0) {
    let minLng = route[0].longitude;
    let maxLng = route[0].longitude;
    let minLat = route[0].latitude;
    let maxLat = route[0].latitude;
    for (const c of route) {
      if (c.longitude < minLng) minLng = c.longitude;
      if (c.longitude > maxLng) maxLng = c.longitude;
      if (c.latitude < minLat) minLat = c.latitude;
      if (c.latitude > maxLat) maxLat = c.latitude;
    }
    const eps = 0.0005; // keeps a single-point / tiny route from zooming to the max level
    routeBounds = { ne: [maxLng + eps, maxLat + eps], sw: [minLng - eps, minLat - eps] };
  }

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

  const cardStyle = { backgroundColor: colors.backgroundSecondary };
  const hasElevationGain = trip.elevation_gain != null && trip.elevation_gain !== 0;
  const hasElevationLoss = localTrip?.elevation_loss_m != null && localTrip.elevation_loss_m !== 0;

  const renderDiagRow = (label: string, value: string, small = false) => (
    <View style={styles.infoRow}>
      <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</ThemedText>
      <ThemedText style={[styles.infoValue, small && { fontSize: 11 }]} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        bounces
      >
        {/* Hero map — full bleed, stretchy + parallax */}
        <Animated.View
          style={[
            styles.hero,
            { height: heroHeight, backgroundColor: colors.card },
            heroAnimatedStyle,
          ]}
        >
          {routeBounds && (
            <Mapbox.MapView
              style={StyleSheet.absoluteFill}
              styleURL={mapStyle}
              zoomEnabled
              scrollEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              compassEnabled={false}
              logoEnabled={false}
              attributionEnabled
              attributionPosition={{ bottom: SHEET_OVERLAP + 8, left: 8 }}
            >
              <Camera
                bounds={{
                  ne: routeBounds.ne,
                  sw: routeBounds.sw,
                  paddingTop: insets.top + 60,
                  paddingBottom: 60,
                  paddingLeft: 40,
                  paddingRight: 40,
                }}
                animationDuration={0}
              />

              {routeGeoJSON && (
                <ShapeSource id="routeSource" shape={routeGeoJSON}>
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

              {endpointsGeoJSON && (
                <ShapeSource id="endpointsSource" shape={endpointsGeoJSON}>
                  <CircleLayer
                    id="endpointsCircle"
                    style={{
                      circleRadius: 7,
                      circleColor: ['match', ['get', 'kind'], 'start', '#34C759', tripColor],
                      circleStrokeColor: '#FFFFFF',
                      circleStrokeWidth: 2.5,
                    }}
                  />
                </ShapeSource>
              )}
            </Mapbox.MapView>
          )}
        </Animated.View>

        {/* Content sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              minHeight: windowHeight,
              paddingBottom: insets.bottom + 32,
            },
            sheetAnimatedStyle,
          ]}
        >
          {/* Title block */}
          <View style={styles.titleRow}>
            <View style={[styles.titleIcon, { backgroundColor: tripColor + '22' }]}>
              <TripIcon size={22} color={tripColor} />
            </View>
            <View style={styles.titleText}>
              <ThemedText style={styles.titleName} numberOfLines={1}>
                {tripName}
              </ThemedText>
              <ThemedText style={[styles.titleDate, { color: colors.textSecondary }]}>
                {formatDate(date, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </ThemedText>
            </View>
          </View>

          {/* Auto-reclassification notice — backend changed the trip type due to speed */}
          {trip.auto_reclassified_from != null && (
            <View style={[styles.card, styles.reclassifyBanner, { backgroundColor: '#FF9800' + '1F' }]}>
              <ArrowsRightLeftIcon size={20} color="#FF9800" />
              <View style={styles.flex1}>
                <ThemedText style={[styles.reclassifyTitle, { color: '#FF9800' }]}>
                  {t('trip_detail.reclassified_title', { defaultValue: 'Trip type updated automatically' })}
                </ThemedText>
                <ThemedText style={[styles.reclassifyBody, { color: colors.textSecondary }]}>
                  {t('trip_detail.reclassified_body', {
                    from: getTripTypeName(trip.auto_reclassified_from as TripType),
                    to: getTripTypeName(trip.type as TripType),
                    defaultValue:
                      'Changed from {{from}} to {{to}} based on speed — does that match what you remember?',
                  })}
                </ThemedText>
              </View>
            </View>
          )}

          {/* Confirmation card — shown when trip hasn't been reviewed yet */}
          {backendTrip && backendTrip.user_confirmed === null && !confirmedLocally && (
            <View style={[styles.card, cardStyle]}>
              <ThemedText style={styles.confirmPrompt}>
                {t('trip_detail.confirm_prompt', { defaultValue: 'Is this trip type right?' })}
              </ThemedText>

              <View style={styles.typeSelector}>
                {TRIP_TYPES.map((type) => (
                  <TripTypeTile
                    key={type}
                    label={getTripTypeName(type)}
                    color={getTripTypeColor(type)}
                    icon={TRIP_TYPE_ICONS[type]}
                    selected={(confirmTypeOverride ?? backendTrip.type) === type}
                    onPress={() => setConfirmTypeOverride(type)}
                  />
                ))}
              </View>

              <View style={styles.confirmActions}>
                {updateTrip.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Button
                      title={t('trip_detail.confirm', { defaultValue: 'Confirm' })}
                      variant="primary"
                      size="medium"
                      onPress={handleConfirmTrip}
                      icon={<CheckIcon size={18} color="#fff" />}
                      style={styles.flex1}
                    />
                    <Button
                      title={t('trip_detail.not_my_trip', { defaultValue: 'Not my trip' })}
                      variant="outline"
                      size="medium"
                      onPress={handleNotMyTrip}
                      style={styles.flex1}
                    />
                  </>
                )}
              </View>
            </View>
          )}

          {/* Stats — 2x2 grid */}
          <View style={[styles.card, styles.statsCard, cardStyle]}>
            <View style={styles.statsRow}>
              <View style={[styles.statCell, styles.statCellLeft, { borderColor: colors.border }]}>
                <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {t('trip_detail.distance', { defaultValue: 'Distance' })}
                </ThemedText>
                <ThemedText style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatDistance(trip.distance, unitSystem)}
                </ThemedText>
              </View>
              <View style={styles.statCell}>
                <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {t('trip_detail.duration', { defaultValue: 'Duration' })}
                </ThemedText>
                <ThemedText style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatDuration(trip.duration)}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.statsRow, styles.statsRowSecond, { borderColor: colors.border }]}>
              <View style={[styles.statCell, styles.statCellLeft, { borderColor: colors.border }]}>
                <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('trip_detail.avg_moving_speed')}
                </ThemedText>
                <ThemedText style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatSpeed(localTrip?.moving_avg_speed_kmh != null
                    ? localTrip.moving_avg_speed_kmh / 3.6
                    : trip.avg_speed, unitSystem)}
                </ThemedText>
              </View>
              <View style={styles.statCell}>
                <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('trip_detail.max_speed')}
                </ThemedText>
                <ThemedText style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {trip.max_speed != null ? formatSpeed(trip.max_speed, unitSystem) : '—'}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Elevation */}
          {(hasElevationGain || hasElevationLoss) && (
            <View style={[styles.slimCard, cardStyle]}>
              {hasElevationGain && (
                <ThemedText style={styles.slimText}>
                  {'↗ '}{t('trip_detail.elevation_gain', { m: Math.round(trip.elevation_gain as number) })}
                </ThemedText>
              )}
              {hasElevationGain && hasElevationLoss && (
                <ThemedText style={[styles.slimText, { color: colors.textSecondary }]}> · </ThemedText>
              )}
              {hasElevationLoss && (
                <ThemedText style={styles.slimText}>
                  {'↘ '}{t('trip_detail.elevation_loss', { m: Math.round(localTrip?.elevation_loss_m as number) })}
                </ThemedText>
              )}
            </View>
          )}

          {/* CO₂ */}
          {trip.co2_saved != null && trip.co2_saved > 0 && (
            <View style={[styles.slimCard, cardStyle]}>
              <ThemedText style={styles.slimText}>
                {'🌱 '}{t('trip_detail.co2_saved', { kg: trip.co2_saved.toFixed(2) })}
              </ThemedText>
            </View>
          )}

          {/* Notes */}
          <View style={[styles.card, cardStyle]}>
            <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('trip_detail.notes_title')}
            </ThemedText>
            <TripNoteEditor
              tripId={trip.id}
              initialValue={trip.user_note ?? trip.notes}
              onSaved={reloadLocalTrip}
            />
          </View>

          {/* Beta Diagnostics drawer */}
          {isDebugBuild && (
            <View style={[styles.card, cardStyle]}>
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => setShowDiagnostics(!showDiagnostics)}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.sectionLabel, styles.noMargin, { color: colors.textSecondary }]}>
                  {t('trip_detail.beta_diagnostics')}
                </ThemedText>
                {showDiagnostics
                  ? <ChevronUpIcon size={18} color={colors.textSecondary} />
                  : <ChevronDownIcon size={18} color={colors.textSecondary} />
                }
              </TouchableOpacity>

              {showDiagnostics && (
                <>
                  {renderDiagRow(t('trip_detail.trip_id'), String(trip.id), true)}
                  {renderDiagRow(
                    t('trip_detail.backend_id'),
                    tripId > 0 ? String(tripId) : t('trip_detail.not_synced', { defaultValue: 'Not synced' }),
                  )}
                  {renderDiagRow(t('trip_detail.gps_points'), String(locationCount))}
                  {renderDiagRow(
                    t('trip_detail.imu_samples'),
                    localTrip?.ml_confidence != null ? t('trip_detail.available', { defaultValue: 'Available' }) : '—',
                  )}
                  {renderDiagRow(
                    t('trip_detail.classification_source'),
                    String(trip.classification_source ?? localTrip?.classification_source ?? '—'),
                  )}
                  {renderDiagRow(
                    t('trip_detail.entry_type', { defaultValue: 'Entry Type' }),
                    trip.is_manual ? t('trip_detail.entry_manual') : t('trip_detail.entry_automatic'),
                  )}
                  {renderDiagRow(t('trip_detail.status'), String(trip.status))}
                  {renderDiagRow(
                    t('trip_detail.avg_speed_backend'),
                    localTrip?.backend_avg_speed_kmh != null
                      ? formatSpeed(localTrip.backend_avg_speed_kmh / 3.6, unitSystem)
                      : '—',
                  )}
                  {(trip.validation_log ?? localTrip?.validation_log) != null && (
                    <View style={[styles.infoRow, styles.infoRowColumn]}>
                      <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>
                        {t('trip_detail.validation_log')}
                      </ThemedText>
                      <ThemedText style={[styles.infoValue, styles.validationLog]}>
                        {trip.validation_log ?? localTrip?.validation_log}
                      </ThemedText>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </Animated.View>
      </Animated.ScrollView>

      {/* Status-bar backdrop (fades in once the hero scrolls away) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.statusBackdrop,
          { height: insets.top, backgroundColor: colors.background },
          statusBackdropStyle,
        ]}
      />

      {/* Compact glass title pill — slides down once the hero is gone */}
      <View
        pointerEvents="none"
        style={[
          styles.pillWrap,
          { top: insets.top + 8, left: 16 + BUTTON_SIZE + 8, right: 16 + BUTTON_SIZE + 8 },
        ]}
      >
        <Animated.View style={[styles.pill, pillAnimatedStyle]}>
          <GlassSurface borderRadius={BUTTON_SIZE / 2} />
          <ThemedText style={styles.pillText} numberOfLines={1}>
            {tripName}
          </ThemedText>
        </Animated.View>
      </View>

      {/* Floating glass controls */}
      <GlassButton
        onPress={() => router.back()}
        accessibilityLabel={t('common:buttons.back')}
        size={BUTTON_SIZE}
        style={[styles.floating, { top: insets.top + 8, left: 16 }]}
      >
        <ChevronLeftIcon size={22} color={colors.glassInactive} />
      </GlassButton>
      <GlassButton
        onPress={handleDelete}
        accessibilityLabel={t('common:buttons.delete')}
        size={BUTTON_SIZE}
        style={[styles.floating, { top: insets.top + 8, right: 16 }]}
      >
        <TrashIcon size={20} color={colors.error} />
      </GlassButton>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    width: '100%',
    zIndex: 0,
  },
  sheet: {
    marginTop: -SHEET_OVERLAP,
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    paddingHorizontal: Spacing.md,
    paddingTop: 20,
    gap: 12,
    zIndex: 1,
  },
  // Title block
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    flex: 1,
  },
  titleName: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
  },
  titleDate: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Cards
  card: {
    borderRadius: 20,
    padding: 16,
  },
  slimCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: 14,
  },
  slimText: {
    fontSize: 15,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  noMargin: {
    marginBottom: 0,
  },
  // Reclassify
  reclassifyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  reclassifyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  reclassifyBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Confirm
  confirmPrompt: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Stats
  statsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
  },
  statsRowSecond: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statCell: {
    flex: 1,
    padding: 16,
  },
  statCellLeft: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  // Diagnostics
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoRowColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
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
  validationLog: {
    marginTop: 4,
    fontSize: 11,
    maxWidth: '100%',
    textAlign: 'left',
  },
  // Floating chrome
  floating: {
    position: 'absolute',
    zIndex: 10,
  },
  statusBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  pillWrap: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 6,
  },
  pill: {
    height: BUTTON_SIZE,
    maxWidth: '100%',
    paddingHorizontal: 18,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
});
