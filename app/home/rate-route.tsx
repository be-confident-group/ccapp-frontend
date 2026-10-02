/**
 * Rate Route Screen
 *
 * Main screen for rating a route by painting segments with feelings.
 * Users select a feeling, then swipe along the route to paint.
 *
 * Layout: full-bleed map with floating glass controls (back, step pill,
 * undo/clear) and a glass bottom panel holding the feeling selector + save.
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, SlideInDown } from 'react-native-reanimated';
import { ArrowUturnLeftIcon, ChevronLeftIcon, TrashIcon } from 'react-native-heroicons/outline';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import {
  FeelingSelector,
  RatingMap,
  SegmentPainter,
  type RatingMapRef,
} from '@/components/rating';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui';
import { GlassButton } from '@/components/ui/GlassButton';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';
import { database } from '@/lib/database';
import type { Coordinate } from '@/types/location';
import {
  FeelingType,
  RouteSegment,
  mergeSegments,
  toSubmitRatingsRequest,
} from '@/types/rating';
import { ratingsAPI } from '@/lib/api/ratings';
import { useTrip } from '@/lib/hooks/useTrips';
import { ReportIssueModal } from '@/components/maps/ReportIssueModal';

const BUTTON_SIZE = 40;
// Same inset on both sides so the step pill stays centred on screen.
const PILL_INSET = 16 + BUTTON_SIZE + 8;
const PANEL_RADIUS = 28;
// Approximate height of the glass bottom panel (excluding the bottom inset);
// used to keep the route clear of it when the camera fits the route.
const PANEL_HEIGHT = 236;

/**
 * Densify a route by adding interpolated points between GPS coordinates
 * This makes painting smoother and more precise
 */
function densifyRoute(route: Coordinate[], targetPointsPerSegment: number = 5): Coordinate[] {
  if (route.length < 2) return route;

  const densified: Coordinate[] = [route[0]];

  for (let i = 0; i < route.length - 1; i++) {
    const start = route[i];
    const end = route[i + 1];

    // Add interpolated points between start and end
    for (let j = 1; j <= targetPointsPerSegment; j++) {
      const ratio = j / (targetPointsPerSegment + 1);
      densified.push({
        latitude: start.latitude + (end.latitude - start.latitude) * ratio,
        longitude: start.longitude + (end.longitude - start.longitude) * ratio,
      });
    }

    // Add the end point
    densified.push(end);
  }

  return densified;
}

export default function RateRouteScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('maps');
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapRef = useRef<RatingMapRef>(null);

  // Parse trip ID as number for backend API
  const tripId = useMemo(() => {
    const numId = parseInt(id as string, 10);
    return !isNaN(numId) ? numId : 0;
  }, [id]);

  // Fetch trip from backend
  const { data: backendTrip, isLoading: isFetchingTrip } = useTrip(tripId);

  const [route, setRoute] = useState<Coordinate[]>([]); // Densified route for display/painting
  const [originalRoute, setOriginalRoute] = useState<Coordinate[]>([]); // Original GPS points
  const [saving, setSaving] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState<FeelingType | null>(null);
  const [segments, setSegments] = useState<RouteSegment[]>([]); // Segments reference originalRoute indices
  const [previewSegment, setPreviewSegment] = useState<RouteSegment | null>(null);
  const [routeScreenPoints, setRouteScreenPoints] = useState<
    { x: number; y: number }[]
  >([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isCameraSettled, setIsCameraSettled] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueCoordinate, setIssueCoordinate] = useState<Coordinate | null>(null);
  const [pendingReportCoordinate, setPendingReportCoordinate] = useState<Coordinate | null>(null);

  // Transform backend trip to local format
  const trip = useMemo(() => {
    if (!backendTrip) return null;

    return {
      id: backendTrip.client_id,
      user_id: backendTrip.user.toString(),
      type: backendTrip.type,
      status: backendTrip.status,
      is_manual: backendTrip.is_manual ? 1 : 0,
      start_time: new Date(backendTrip.start_timestamp).getTime(),
      end_time: new Date(backendTrip.end_timestamp).getTime(),
      distance: backendTrip.distance * 1000, // Convert km to meters
      duration: backendTrip.duration,
      avg_speed: backendTrip.average_speed,
      max_speed: 0,
      elevation_gain: backendTrip.elevation_gain || 0,
      calories: 0,
      co2_saved: backendTrip.co2_saved,
      notes: backendTrip.notes || null,
      route_data: backendTrip.route ? JSON.stringify(backendTrip.route) : null,
      created_at: new Date(backendTrip.created_at).getTime(),
      updated_at: new Date(backendTrip.updated_at).getTime(),
      synced: 1,
    };
  }, [backendTrip]);

  // Load trip data
  useEffect(() => {
    async function loadTrip() {
      if (!id) {
        Alert.alert(
          t('common:status.error', { defaultValue: 'Error' }),
          t('rating.errNoTripId', { defaultValue: 'No trip ID provided' })
        );
        router.back();
        return;
      }

      if (isFetchingTrip) return;

      if (!backendTrip) {
        Alert.alert(
          t('common:status.error', { defaultValue: 'Error' }),
          t('rating.errTripNotFound', { defaultValue: 'Trip not found' })
        );
        router.back();
        return;
      }

      if (!backendTrip.route || backendTrip.route.length === 0) {
        Alert.alert(
          t('common:status.error', { defaultValue: 'Error' }),
          t('rating.errNoRoute', { defaultValue: 'This trip has no route data' })
        );
        router.back();
        return;
      }

      try {
        // Transform backend route format {lat, lng} to {latitude, longitude}
        const routeData: Coordinate[] = backendTrip.route.map(coord => ({
          latitude: coord.lat,
          longitude: coord.lng,
          timestamp: coord.timestamp,
        }));

        if (routeData.length < 2) {
          Alert.alert(
            t('common:status.error', { defaultValue: 'Error' }),
            t('rating.errRouteTooShort', { defaultValue: 'Route is too short to rate' })
          );
          router.back();
          return;
        }

        // Store original route and densified version
        setOriginalRoute(routeData);
        // Increase densification for smoother painting (10 points between each GPS point)
        const densifiedRoute = densifyRoute(routeData, 10);
        setRoute(densifiedRoute);

        // Load existing rating if any (use client_id for local database)
        // Note: Existing segments will need to be scaled to match densified route
        await database.init();
        const existingRating = await database.getRating(backendTrip.client_id);
        if (existingRating) {
          const existingSegments = JSON.parse(
            existingRating.segments
          ) as RouteSegment[];

          // Map segments from original route indices to densified route indices
          // Each original index maps to densified via: index * (pointsPerSegment + 1)
          const pointsPerSegment = 10;
          const mappedSegments = existingSegments.map(seg => ({
            startIndex: seg.startIndex * (pointsPerSegment + 1),
            endIndex: Math.min(
              seg.endIndex * (pointsPerSegment + 1),
              densifiedRoute.length - 1
            ),
            feeling: seg.feeling,
          }));

          setSegments(mappedSegments);
        }
      } catch (error) {
        console.error('[RateRoute] Error loading trip:', error);
        Alert.alert(
          t('common:status.error', { defaultValue: 'Error' }),
          t('rating.errLoadTrip', { defaultValue: 'Failed to load trip data' })
        );
        router.back();
      }
    }

    loadTrip();
  }, [id, backendTrip, isFetchingTrip, t]);

  // Handle map ready
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    // Screen points will be updated when camera settles via handleCameraIdle
  }, []);

  // Handle camera idle - update screen points when camera stops moving
  const handleCameraIdle = useCallback(async () => {
    if (mapRef.current && route.length > 0) {
      const points = await mapRef.current.getRouteScreenPoints();
      // Only update if we got valid points
      if (points.length > 0) {
        setRouteScreenPoints(points);
        setIsCameraSettled(true);
      }
    }
  }, [route]);

  // Handle segment painted
  const handleSegmentPainted = useCallback(
    (segment: RouteSegment) => {
      setSegments((prev) => {
        const merged = mergeSegments(prev, segment);
        return merged;
      });
      setPreviewSegment(null);
    },
    [route.length]
  );

  // Handle feeling selection - refresh screen points when selecting a feeling
  // Tap same feeling to deselect it
  const handleFeelingSelect = useCallback(async (feeling: FeelingType) => {
    // Toggle: if same feeling is selected, deselect it
    const newFeeling = selectedFeeling === feeling ? null : feeling;
    setSelectedFeeling(newFeeling);

    // Refresh screen points when entering painting mode for accuracy
    if (newFeeling !== null && mapRef.current && isCameraSettled) {
      const points = await mapRef.current.getRouteScreenPoints();
      setRouteScreenPoints(points);
    }
  }, [selectedFeeling, isCameraSettled]);


  // Handle long press to report issue - show confirmation first
  const handleLongPress = useCallback((coordinate: Coordinate) => {
    setPendingReportCoordinate(coordinate);

    Alert.alert(
      t('rating.reportIssueTitle', { defaultValue: 'Report Issue' }),
      t('rating.reportIssueMessage', { defaultValue: 'Do you want to report an issue at this location?' }),
      [
        {
          text: t('common:buttons.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
          onPress: () => setPendingReportCoordinate(null),
        },
        {
          text: t('rating.reportHere', { defaultValue: 'Report Here' }),
          onPress: () => {
            setIssueCoordinate(coordinate);
            setShowIssueModal(true);
            setPendingReportCoordinate(null);
          },
        },
      ]
    );
  }, [t]);

  // Handle close issue modal
  const handleCloseIssueModal = useCallback(() => {
    setShowIssueModal(false);
    setIssueCoordinate(null);
  }, []);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    Alert.alert(
      t('rating.clearAllTitle', { defaultValue: 'Clear All' }),
      t('rating.clearAllMessage', { defaultValue: 'Are you sure you want to clear all ratings?' }),
      [
      { text: t('common:buttons.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
      {
        text: t('rating.clear', { defaultValue: 'Clear' }),
        style: 'destructive',
        onPress: () => setSegments([]),
      },
    ]);
  }, [t]);

  // Handle undo last
  const handleUndoLast = useCallback(() => {
    setSegments((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!trip || !backendTrip) return;

    if (segments.length === 0) {
      Alert.alert(
        t('rating.noRatingsTitle', { defaultValue: 'No Ratings' }),
        t('rating.noRatingsMessage', { defaultValue: 'Please paint at least one segment before saving.' })
      );
      return;
    }

    setSaving(true);

    try {
      const now = Date.now();
      const clientId = trip.id; // Use client_id for local database operations

      // Map segments back from densified indices to original route indices for storage
      // Each original segment has 10 interpolated points, so densified index maps to original via floor(index / 11)
      const pointsPerSegment = 10;
      const originalSegments = segments.map(seg => ({
        startIndex: Math.floor(seg.startIndex / (pointsPerSegment + 1)),
        endIndex: Math.min(
          Math.floor(seg.endIndex / (pointsPerSegment + 1)),
          originalRoute.length - 1
        ),
        feeling: seg.feeling,
      }));

      // Check if rating already exists locally
      const existingRating = await database.getRating(clientId);

      // Save locally first (offline-first approach)
      if (existingRating) {
        await database.updateRating(clientId, {
          segments: JSON.stringify(originalSegments),
          synced: 0,
        });
      } else {
        await database.createRating({
          trip_id: clientId,
          segments: JSON.stringify(originalSegments),
          rated_at: now,
          synced: 0,
          backend_id: null,
          created_at: now,
          updated_at: now,
        });
      }

      // Submit to backend API
      try {
        const apiRequest = toSubmitRatingsRequest(
          clientId,
          originalSegments,
          originalRoute,
          backendTrip.id,
          now
        );

        // Log full payload for debugging - easy to copy for backend engineer
        console.log('========================================');
        console.log('[RateRoute] POST /api/road-sections/submit/');
        console.log('========================================');
        console.log(JSON.stringify(apiRequest, null, 2));
        console.log('========================================');

        await ratingsAPI.submitRatings(apiRequest);

        // Mark as synced on success
        await database.updateRating(clientId, { synced: 1 });

        Alert.alert(
          t('common:status.success', { defaultValue: 'Success' }),
          t('rating.savedMessage', { defaultValue: 'Your route rating has been saved!' }),
          [
          {
            text: t('common:buttons.ok', { defaultValue: 'OK' }),
            onPress: () => router.back(),
          },
        ]);
      } catch (apiError) {
        console.error('[RateRoute] API submission failed:', apiError);
        // Rating is saved locally but not synced - will be retried later
        Alert.alert(
          t('rating.savedLocallyTitle', { defaultValue: 'Saved Locally' }),
          t('rating.savedLocallyMessage', {
            defaultValue:
              'Your rating was saved but could not be uploaded. It will sync automatically when you have a connection.',
          }),
          [
            {
              text: t('common:buttons.ok', { defaultValue: 'OK' }),
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('[RateRoute] Error saving rating:', error);
      Alert.alert(
        t('common:status.error', { defaultValue: 'Error' }),
        t('rating.errSave', { defaultValue: 'Failed to save rating. Please try again.' })
      );
    } finally {
      setSaving(false);
    }
  }, [trip, backendTrip, segments, originalRoute, t]);

  if (isFetchingTrip || !trip || route.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={{ paddingTop: insets.top }}>
          <Header showBack />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('rating.loadingRoute', { defaultValue: 'Loading route...' })}
          </ThemedText>
        </View>
      </View>
    );
  }

  const hasUnsavedChanges = segments.length > 0;

  const handleBackPress = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        t('rating.unsavedTitle', { defaultValue: 'Unsaved Changes' }),
        t('rating.unsavedMessage', {
          defaultValue: 'You have unsaved changes. Are you sure you want to leave?',
        }),
        [
          { text: t('rating.stay', { defaultValue: 'Stay' }), style: 'cancel' },
          {
            text: t('rating.leave', { defaultValue: 'Leave' }),
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const stepText = selectedFeeling
    ? t('rating.stepPaint', { defaultValue: 'Step 2 of 2 · Swipe on the route to paint' })
    : t('rating.stepChoose', { defaultValue: 'Step 1 of 2 · Choose a feeling' });
  const topOffset = insets.top + 8;
  const cameraPadding: [number, number, number, number] = [
    insets.top + 72,
    48,
    PANEL_HEIGHT + insets.bottom + 32,
    48,
  ];

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      {/* Full-bleed map with painting overlay */}
      <SegmentPainter
        route={route}
        routeScreenPoints={routeScreenPoints}
        selectedFeeling={selectedFeeling}
        onSegmentPainted={handleSegmentPainted}
        onLongPress={handleLongPress}
        enabled={isMapReady && isCameraSettled}
        style={styles.painter}
      >
        <RatingMap
          ref={mapRef}
          route={route}
          segments={segments}
          previewSegment={previewSegment}
          pendingReportLocation={pendingReportCoordinate}
          onMapReady={handleMapReady}
          onCameraIdle={handleCameraIdle}
          onLongPress={handleLongPress}
          disableInteraction={selectedFeeling !== null}
          cameraPadding={cameraPadding}
          style={styles.map}
        />
      </SegmentPainter>

      {/* Floating glass step pill (non-interactive, never blocks painting) */}
      <View
        pointerEvents="none"
        style={[styles.pillWrap, { top: topOffset, left: PILL_INSET, right: PILL_INSET }]}
      >
        <View style={styles.pill}>
          <GlassSurface borderRadius={22} />
          <ThemedText style={styles.pillTitle} numberOfLines={1}>
            {t('rating.rateYourRoute', { defaultValue: 'Rate Your Route' })}
          </ThemedText>
          <ThemedText style={[styles.pillStep, { color: colors.textSecondary }]} numberOfLines={2}>
            {stepText}
          </ThemedText>
        </View>
      </View>

      {/* Floating glass controls */}
      <GlassButton
        onPress={handleBackPress}
        accessibilityLabel={t('common:buttons.back', { defaultValue: 'Back' })}
        size={BUTTON_SIZE}
        style={[styles.floating, { top: topOffset, left: 16 }]}
      >
        <ChevronLeftIcon size={22} color={colors.glassInactive} />
      </GlassButton>
      {segments.length > 0 && (
        <>
          <GlassButton
            onPress={handleUndoLast}
            accessibilityLabel={t('rating.undo', { defaultValue: 'Undo last segment' })}
            size={BUTTON_SIZE}
            style={[styles.floating, { top: topOffset, right: 16 }]}
          >
            <ArrowUturnLeftIcon size={20} color={colors.glassInactive} />
          </GlassButton>
          <GlassButton
            onPress={handleClearAll}
            accessibilityLabel={t('rating.clearAllTitle', { defaultValue: 'Clear All' })}
            size={BUTTON_SIZE}
            style={[styles.floating, { top: topOffset + BUTTON_SIZE + 8, right: 16 }]}
          >
            <TrashIcon size={20} color={colors.error} />
          </GlassButton>
        </>
      )}

      {/* Glass bottom panel */}
      <Animated.View
        entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))}
        style={[styles.panelWrap, { bottom: insets.bottom + 12, shadowColor: colors.shadow }]}
      >
        <View style={styles.panel}>
          <GlassSurface borderRadius={PANEL_RADIUS} />
          <ThemedText style={[styles.hintText, { color: colors.textSecondary }]}>
            {selectedFeeling
              ? t('rating.hintPainting', {
                  defaultValue: 'Swipe on route to paint. Long press to report an issue.',
                })
              : t('rating.hintSelect', {
                  defaultValue: 'Select a feeling to start. Long press to report an issue.',
                })}
          </ThemedText>

          <FeelingSelector
            selectedFeeling={selectedFeeling}
            onSelect={handleFeelingSelect}
            disabled={saving}
            compact
          />

          <Button
            title={t('rating.saveRating', { defaultValue: 'Save Rating' })}
            onPress={handleSave}
            variant="primary"
            size="medium"
            fullWidth
            loading={saving}
            disabled={segments.length === 0}
          />
        </View>
      </Animated.View>

      {/* Report Issue Modal */}
      <ReportIssueModal
        visible={showIssueModal}
        coordinates={issueCoordinate}
        onClose={handleCloseIssueModal}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  painter: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    flex: 1,
  },
  floating: {
    position: 'absolute',
  },
  pillWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  pill: {
    maxWidth: '100%',
    minHeight: BUTTON_SIZE,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  pillStep: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
    textAlign: 'center',
  },
  panelWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: PANEL_RADIUS,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  panel: {
    padding: 16,
    gap: 12,
    borderRadius: PANEL_RADIUS,
  },
  hintText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
