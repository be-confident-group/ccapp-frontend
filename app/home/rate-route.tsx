/**
 * Rate Route Screen
 *
 * Main screen for rating a route by painting segments with feelings.
 * Users select a feeling, then swipe along the route to paint.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
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
import { database, type Trip } from '@/lib/database';
import type { Coordinate } from '@/types/location';
import {
  FeelingType,
  RouteSegment,
  mergeSegments,
} from '@/types/rating';

export default function RateRouteScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapRef = useRef<RatingMapRef>(null);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [route, setRoute] = useState<Coordinate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState<FeelingType | null>(null);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [previewSegment, setPreviewSegment] = useState<RouteSegment | null>(null);
  const [routeScreenPoints, setRouteScreenPoints] = useState<
    { x: number; y: number }[]
  >([]);
  const [isPainting, setIsPainting] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  // Load trip data
  useEffect(() => {
    async function loadTrip() {
      if (!id) {
        Alert.alert('Error', 'No trip ID provided');
        router.back();
        return;
      }

      try {
        await database.init();
        const tripData = await database.getTrip(id);

        if (!tripData) {
          Alert.alert('Error', 'Trip not found');
          router.back();
          return;
        }

        if (!tripData.route_data) {
          Alert.alert('Error', 'This trip has no route data');
          router.back();
          return;
        }

        // Parse route data
        const routeData = JSON.parse(tripData.route_data) as Coordinate[];
        if (routeData.length < 2) {
          Alert.alert('Error', 'Route is too short to rate');
          router.back();
          return;
        }

        setTrip(tripData);
        setRoute(routeData);

        // Load existing rating if any
        const existingRating = await database.getRating(id);
        if (existingRating) {
          const existingSegments = JSON.parse(
            existingRating.segments
          ) as RouteSegment[];
          setSegments(existingSegments);
        }
      } catch (error) {
        console.error('[RateRoute] Error loading trip:', error);
        Alert.alert('Error', 'Failed to load trip data');
        router.back();
      } finally {
        setLoading(false);
      }
    }

    loadTrip();
  }, [id]);

  // Update route screen points when map is ready
  const updateScreenPoints = useCallback(async () => {
    if (mapRef.current && route.length > 0) {
      const points = await mapRef.current.getRouteScreenPoints();
      setRouteScreenPoints(points);
    }
  }, [route]);

  // Handle map ready
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    // Delay to ensure map is fully rendered
    setTimeout(() => {
      updateScreenPoints();
    }, 500);
  }, [updateScreenPoints]);

  // Handle segment painted
  const handleSegmentPainted = useCallback(
    (segment: RouteSegment) => {
      setSegments((prev) => mergeSegments(prev, segment));
      setPreviewSegment(null);
    },
    []
  );

  // Handle painting state change
  const handlePaintingStateChange = useCallback((painting: boolean) => {
    setIsPainting(painting);
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
    if (!trip || !id) return;

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

      // Check if rating already exists
      const existingRating = await database.getRating(id);

      if (existingRating) {
        // Update existing rating
        await database.updateRating(id, {
          segments: JSON.stringify(segments),
          synced: 0, // Mark as unsynced
        });
      } else {
        // Create new rating
        await database.createRating({
          trip_id: id,
          segments: JSON.stringify(segments),
          rated_at: now,
          synced: 0,
          backend_id: null,
          created_at: now,
          updated_at: now,
        });
      }

      Alert.alert('Success', 'Your route rating has been saved!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('[RateRoute] Error saving rating:', error);
      Alert.alert('Error', 'Failed to save rating. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [trip, id, segments]);

  if (loading) {
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
            <SegmentPainter
              route={route}
              routeScreenPoints={routeScreenPoints}
              selectedFeeling={selectedFeeling}
              onSegmentPainted={handleSegmentPainted}
              onPaintingStateChange={handlePaintingStateChange}
              enabled={isMapReady && selectedFeeling !== null}
              style={styles.painter}
            >
              <RatingMap
                ref={mapRef}
                route={route}
                segments={segments}
                previewSegment={previewSegment}
                onMapReady={handleMapReady}
                style={styles.map}
              />
            </SegmentPainter>

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
                  size={18}
                  color={colors.primary}
                />
                <ThemedText style={styles.paintingText}>
                  Swipe on route to paint
                </ThemedText>
              </View>
            )}
          </View>

          {/* Bottom panel */}
          <View style={[styles.bottomPanel, { backgroundColor: colors.card }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Feeling selector */}
              <FeelingSelector
                selectedFeeling={selectedFeeling}
                onSelect={setSelectedFeeling}
                disabled={saving}
                style={styles.selector}
              />

              {/* Instructions */}
              <View style={styles.instructions}>
                <ThemedText
                  style={[styles.instructionTitle, { color: colors.textSecondary }]}
                >
                  How to rate:
                </ThemedText>
                <View style={styles.instructionRow}>
                  <MaterialCommunityIcons
                    name="numeric-1-circle"
                    size={20}
                    color={colors.primary}
                  />
                  <ThemedText
                    style={[styles.instructionText, { color: colors.textSecondary }]}
                  >
                    Select a feeling above
                  </ThemedText>
                </View>
                <View style={styles.instructionRow}>
                  <MaterialCommunityIcons
                    name="numeric-2-circle"
                    size={20}
                    color={colors.primary}
                  />
                  <ThemedText
                    style={[styles.instructionText, { color: colors.textSecondary }]}
                  >
                    Swipe on the map to paint the route
                  </ThemedText>
                </View>
                <View style={styles.instructionRow}>
                  <MaterialCommunityIcons
                    name="numeric-3-circle"
                    size={20}
                    color={colors.primary}
                  />
                  <ThemedText
                    style={[styles.instructionText, { color: colors.textSecondary }]}
                  >
                    Tap "Save Rating" when done
                  </ThemedText>
                </View>
              </View>
            </ScrollView>

            {/* Save button */}
            <View
              style={[
                styles.footer,
                { borderTopColor: colors.border },
              ]}
            >
              <Button
                title="Save Rating"
                onPress={handleSave}
                variant="primary"
                size="large"
                fullWidth
                loading={saving}
                disabled={segments.length === 0}
              />
            </View>
          </View>
        </ThemedView>
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
  },
  painter: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  paintingIndicator: {
    position: 'absolute',
    top: Spacing.md,
    left: '50%',
    transform: [{ translateX: -80 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  paintingText: {
    fontSize: 13,
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
    maxHeight: '45%',
  },
  scrollContent: {
    paddingBottom: Spacing.sm,
  },
  selector: {
    paddingTop: Spacing.md,
  },
  instructions: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  instructionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  instructionText: {
    fontSize: 13,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
  },
});
