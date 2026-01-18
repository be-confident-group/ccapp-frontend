/**
 * Rate Route Screen
 *
 * Main screen for rating a route by painting segments with feelings.
 * Users select a feeling, then swipe along the route to paint.
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ChevronLeftIcon } from 'react-native-heroicons/outline';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  FeelingSelector,
  RatingMap,
  SegmentPainter,
  type RatingMapRef,
} from '@/components/rating';
import { Button } from '@/components/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
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
  const [isPainting, setIsPainting] = useState(false);
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
        Alert.alert('Error', 'No trip ID provided');
        router.back();
        return;
      }

      if (isFetchingTrip) return;

      if (!backendTrip) {
        Alert.alert('Error', 'Trip not found');
        router.back();
        return;
      }

      if (!backendTrip.route || backendTrip.route.length === 0) {
        Alert.alert('Error', 'This trip has no route data');
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
          Alert.alert('Error', 'Route is too short to rate');
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
        Alert.alert('Error', 'Failed to load trip data');
        router.back();
      }
    }

    loadTrip();
  }, [id, backendTrip, isFetchingTrip]);

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

  // Handle painting state change
  const handlePaintingStateChange = useCallback((painting: boolean) => {
    setIsPainting(painting);
  }, []);

  // Handle long press to report issue - show confirmation first
  const handleLongPress = useCallback((coordinate: Coordinate) => {
    setPendingReportCoordinate(coordinate);

    Alert.alert(
      'Report Issue',
      'Do you want to report an issue at this location?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setPendingReportCoordinate(null),
        },
        {
          text: 'Report Here',
          onPress: () => {
            setIssueCoordinate(coordinate);
            setShowIssueModal(true);
            setPendingReportCoordinate(null);
          },
        },
      ]
    );
  }, []);

  // Handle close issue modal
  const handleCloseIssueModal = useCallback(() => {
    setShowIssueModal(false);
    setIssueCoordinate(null);
  }, []);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    Alert.alert('Clear All', 'Are you sure you want to clear all ratings?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => setSegments([]),
      },
    ]);
  }, []);

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
        'No Ratings',
        'Please paint at least one segment before saving.'
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

        console.log('[RateRoute] Submitting to backend:', JSON.stringify(apiRequest, null, 2));
        await ratingsAPI.submitRatings(apiRequest);

        // Mark as synced on success
        await database.updateRating(clientId, { synced: 1 });

        Alert.alert('Success', 'Your route rating has been saved!', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } catch (apiError) {
        console.error('[RateRoute] API submission failed:', apiError);
        // Rating is saved locally but not synced - will be retried later
        Alert.alert(
          'Saved Locally',
          'Your rating was saved but could not be uploaded. It will sync automatically when you have a connection.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('[RateRoute] Error saving rating:', error);
      Alert.alert('Error', 'Failed to save rating. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [trip, backendTrip, segments, originalRoute]);

  if (isFetchingTrip || !trip || route.length === 0) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <ThemedView style={styles.container}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading route...
            </ThemedText>
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const hasUnsavedChanges = segments.length > 0;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <ThemedView style={styles.container}>
          {/* Header */}
          <View
            style={[
              styles.header,
              { backgroundColor: colors.background, borderBottomColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (hasUnsavedChanges) {
                  Alert.alert(
                    'Unsaved Changes',
                    'You have unsaved changes. Are you sure you want to leave?',
                    [
                      { text: 'Stay', style: 'cancel' },
                      {
                        text: 'Leave',
                        style: 'destructive',
                        onPress: () => router.back(),
                      },
                    ]
                  );
                } else {
                  router.back();
                }
              }}
              activeOpacity={0.7}
            >
              <ChevronLeftIcon size={28} color={colors.text} />
            </TouchableOpacity>

            <ThemedText type="subtitle" style={styles.headerTitle}>
              Rate Your Route
            </ThemedText>

            <View style={styles.headerActions}>
              {segments.length > 0 && (
                <>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleUndoLast}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="undo"
                      size={22}
                      color={colors.icon}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleClearAll}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="delete-outline"
                      size={22}
                      color="#F44336"
                    />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Map with painting overlay */}
          <View style={styles.mapContainer}>
            <View style={[styles.mapWrapper, { backgroundColor: colors.card }]}>
              <SegmentPainter
                route={route}
                routeScreenPoints={routeScreenPoints}
                selectedFeeling={selectedFeeling}
                onSegmentPainted={handleSegmentPainted}
                onPaintingStateChange={handlePaintingStateChange}
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
                  disableInteraction={selectedFeeling !== null}
                  style={styles.map}
                />
              </SegmentPainter>
            </View>

            {/* Painting mode indicator */}
            {selectedFeeling && (
              <View
                style={[
                  styles.paintingIndicator,
                  { backgroundColor: colors.card },
                ]}
              >
                <MaterialCommunityIcons
                  name="gesture-swipe"
                  size={16}
                  color={colors.primary}
                />
                <ThemedText style={styles.paintingText}>
                  Swipe on route to paint
                </ThemedText>
              </View>
            )}
          </View>

          {/* Bottom panel - compact */}
          <View style={[styles.bottomPanel, { backgroundColor: colors.card }]}>
            {/* Instruction hint */}
            <ThemedText style={[styles.hintText, { color: colors.textSecondary }]}>
              {selectedFeeling ? 'Swipe on route to paint. Long press to report an issue.' : 'Select a feeling to start. Long press to report an issue.'}
            </ThemedText>

            {/* Feeling selector - compact single row */}
            <FeelingSelector
              selectedFeeling={selectedFeeling}
              onSelect={handleFeelingSelect}
              disabled={saving}
              compact
            />

            {/* Save button */}
            <View style={styles.footer}>
              <Button
                title="Save Rating"
                onPress={handleSave}
                variant="primary"
                size="medium"
                fullWidth
                loading={saving}
                disabled={segments.length === 0}
              />
            </View>
          </View>
        </ThemedView>

        {/* Report Issue Modal */}
        <ReportIssueModal
          visible={showIssueModal}
          coordinates={issueCoordinate}
          onClose={handleCloseIssueModal}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
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
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
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
  painter: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  paintingIndicator: {
    position: 'absolute',
    top: Spacing.lg + 4,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  paintingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  bottomPanel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    paddingTop: Spacing.sm,
  },
  hintText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
});
