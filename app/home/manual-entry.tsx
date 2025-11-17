/**
 * Manual Trip Entry Screen
 *
 * Full page form to manually add a trip with optional route drawing
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { TripManager } from '@/lib/services';
import { calculateRouteDistance } from '@/lib/utils/geoCalculations';
import type { TripType } from '@/types/trip';
import type { Coordinate } from '@/types/location';
import Mapbox, { Camera, LineLayer, ShapeSource, CircleLayer } from '@rnmapbox/maps';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChevronLeftIcon } from 'react-native-heroicons/outline';
import { TextInput, Button } from '@/components/ui';

const TRIP_TYPES: { type: TripType; label: string; icon: string }[] = [
  { type: 'walk', label: 'Walking', icon: 'walk' },
  { type: 'cycle', label: 'Cycling', icon: 'bicycle' },
];

export default function ManualEntryScreen() {
  const { colors } = useTheme();
  const [selectedType, setSelectedType] = useState<TripType>('walk');
  const [distance, setDistance] = useState('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [routePoints, setRoutePoints] = useState<Coordinate[]>([]);

  async function handleSubmit() {
    // Validation
    let distanceNum = parseFloat(distance);
    const hoursNum = parseInt(hours) || 0;
    const minutesNum = parseInt(minutes) || 0;

    // If route drawn, use that distance
    if (routePoints.length > 1) {
      const routeDistance = calculateRouteDistance(routePoints);
      distanceNum = routeDistance / 1000; // Convert to km for display
    }

    if ((!distance && routePoints.length < 2) || (distance && (isNaN(distanceNum) || distanceNum <= 0))) {
      Alert.alert('Invalid Distance', 'Please enter a distance or draw a route on the map');
      return;
    }

    if (hoursNum === 0 && minutesNum === 0) {
      Alert.alert('Invalid Duration', 'Please enter a valid duration');
      return;
    }

    const distanceMeters = routePoints.length > 1
      ? calculateRouteDistance(routePoints)
      : distanceNum * 1000;
    const durationSeconds = hoursNum * 3600 + minutesNum * 60;

    setLoading(true);

    try {
      await TripManager.createManualTrip({
        userId: 'current_user',
        type: selectedType,
        distance: distanceMeters,
        duration: durationSeconds,
        startTime: Date.now() - durationSeconds * 1000,
        notes: notes.trim() || undefined,
        routeData: routePoints.length > 1 ? routePoints : undefined,
      });

      Alert.alert('Success', 'Trip added successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('[ManualEntry] Error saving trip:', error);
      Alert.alert('Error', 'Failed to save trip. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleMapPress(event: any) {
    if (!showMap) return;

    const { geometry } = event;
    const newPoint: Coordinate = {
      latitude: geometry.coordinates[1],
      longitude: geometry.coordinates[0],
    };

    setRoutePoints([...routePoints, newPoint]);

    // Auto-calculate distance if route has points
    if (routePoints.length >= 1) {
      const totalDistance = calculateRouteDistance([...routePoints, newPoint]);
      setDistance((totalDistance / 1000).toFixed(2));
    }
  }

  function clearRoute() {
    setRoutePoints([]);
    setDistance('');
  }

  function undoLastPoint() {
    if (routePoints.length > 0) {
      const newPoints = routePoints.slice(0, -1);
      setRoutePoints(newPoints);

      if (newPoints.length > 1) {
        const totalDistance = calculateRouteDistance(newPoints);
        setDistance((totalDistance / 1000).toFixed(2));
      } else {
        setDistance('');
      }
    }
  }

  // Create GeoJSON for route
  const routeGeoJSON = routePoints.length > 1 ? {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: routePoints.map(p => [p.longitude, p.latitude]),
    },
  } : null;

  const pointsGeoJSON = routePoints.length > 0 ? {
    type: 'FeatureCollection',
    features: routePoints.map((p, i) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.longitude, p.latitude],
      },
      properties: { index: i },
    })),
  } : null;

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
            Add Manual Trip
          </ThemedText>

          <View style={styles.placeholder} />
        </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Type Selection */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Activity Type</ThemedText>
          <View style={styles.typeGrid}>
            {TRIP_TYPES.map((type) => (
              <TouchableOpacity
                key={type.type}
                style={[
                  styles.typeButton,
                  { backgroundColor: colors.card },
                  selectedType === type.type && { borderColor: colors.primary, borderWidth: 2 },
                ]}
                onPress={() => setSelectedType(type.type)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={type.icon as any}
                  size={32}
                  color={selectedType === type.type ? colors.primary : colors.icon}
                />
                <ThemedText
                  style={[
                    styles.typeLabel,
                    selectedType === type.type && { color: colors.primary, fontWeight: '600' },
                  ]}
                >
                  {type.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Route Drawing Option */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Route (Optional)</ThemedText>
            <TouchableOpacity
              style={[styles.toggleButton, { backgroundColor: showMap ? colors.primary : colors.card }]}
              onPress={() => setShowMap(!showMap)}
            >
              <MaterialCommunityIcons
                name={showMap ? 'map-check' : 'map-outline'}
                size={20}
                color={showMap ? '#FFFFFF' : colors.icon}
              />
              <ThemedText style={[styles.toggleText, { color: showMap ? '#FFFFFF' : colors.text }]}>
                {showMap ? 'Hide Map' : 'Draw Route'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {showMap && (
            <>
              <View style={styles.mapContainer}>
                <Mapbox.MapView
                  style={styles.map}
                  styleURL="mapbox://styles/mapbox/outdoors-v12"
                  onPress={handleMapPress}
                >
                  <Camera
                    zoomLevel={13}
                    centerCoordinate={[-122.4194, 37.7749]}
                    animationDuration={0}
                  />

                  {routeGeoJSON && (
                    <ShapeSource id="routeSource" shape={routeGeoJSON as any}>
                      <LineLayer
                        id="routeLine"
                        style={{
                          lineColor: colors.primary,
                          lineWidth: 4,
                          lineCap: 'round',
                          lineJoin: 'round',
                        }}
                      />
                    </ShapeSource>
                  )}

                  {pointsGeoJSON && (
                    <ShapeSource id="pointsSource" shape={pointsGeoJSON as any}>
                      <CircleLayer
                        id="pointsCircle"
                        style={{
                          circleRadius: 8,
                          circleColor: colors.primary,
                          circleStrokeColor: '#FFFFFF',
                          circleStrokeWidth: 2,
                        }}
                      />
                    </ShapeSource>
                  )}
                </Mapbox.MapView>

                {routePoints.length > 0 && (
                  <View style={styles.mapControls}>
                    <TouchableOpacity
                      style={[styles.mapButton, { backgroundColor: colors.card }]}
                      onPress={undoLastPoint}
                    >
                      <MaterialCommunityIcons name="undo" size={20} color={colors.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.mapButton, { backgroundColor: colors.card }]}
                      onPress={clearRoute}
                    >
                      <MaterialCommunityIcons name="delete" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <ThemedText style={[styles.mapHint, { color: colors.textSecondary }]}>
                Tap on the map to draw your route. Distance will be calculated automatically.
              </ThemedText>
            </>
          )}
        </View>

        {/* Distance */}
        <View style={styles.section}>
          <TextInput
            label={`Distance (km)${routePoints.length > 1 ? ' (Auto-calculated)' : ''}`}
            value={distance}
            onChangeText={setDistance}
            placeholder="Enter distance or draw route"
            keyboardType="decimal-pad"
            editable={routePoints.length < 2}
            containerStyle={styles.inputContainer}
          />
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <ThemedText style={styles.label}>Duration</ThemedText>
          <View style={styles.durationRow}>
            <View style={styles.durationInput}>
              <TextInput
                value={hours}
                onChangeText={setHours}
                placeholder="0"
                keyboardType="number-pad"
                containerStyle={styles.durationInputContainer}
              />
              <ThemedText style={[styles.durationLabel, { color: colors.textSecondary }]}>hours</ThemedText>
            </View>

            <View style={styles.durationInput}>
              <TextInput
                value={minutes}
                onChangeText={setMinutes}
                placeholder="0"
                keyboardType="number-pad"
                containerStyle={styles.durationInputContainer}
              />
              <ThemedText style={[styles.durationLabel, { color: colors.textSecondary }]}>minutes</ThemedText>
            </View>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <TextInput
            label="Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any notes about your trip"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            containerStyle={styles.inputContainer}
            style={styles.textAreaInput}
          />
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Button
          title="Save Trip"
          onPress={handleSubmit}
          variant="primary"
          size="large"
          fullWidth
          loading={loading}
        />
      </View>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  typeLabel: {
    fontSize: 14,
  },
  mapContainer: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  mapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  mapHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 0,
  },
  textAreaInput: {
    minHeight: 120,
    paddingTop: 12,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  durationInput: {
    flex: 1,
  },
  durationInputContainer: {
    marginBottom: 0,
  },
  durationLabel: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
});
