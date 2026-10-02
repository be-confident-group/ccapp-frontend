/**
 * Manual Trip Entry Screen
 *
 * Full page form to manually add a trip with optional route drawing
 */

import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { TripManager } from '@/lib/services';
import { calculateRouteDistance } from '@/lib/utils/geoCalculations';
import { getTripTypeColor, type TripType } from '@/types/trip';
import type { Coordinate } from '@/types/location';
import Mapbox, { Camera, LineLayer, ShapeSource, CircleLayer } from '@rnmapbox/maps';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ArrowUturnLeftIcon, MapIcon, TrashIcon } from 'react-native-heroicons/outline';
import { Button } from '@/components/ui';
import { GlassButton } from '@/components/ui/GlassButton';
import { SettingsScreen } from '@/components/settings/SettingsScreen';
import { SettingsGroup } from '@/components/profile/SettingsGroup';
import { TripTypeTile } from '@/components/trips/TripTypeTile';
import { TripFormField } from '@/components/trips/TripFormField';
import { TRIP_TYPE_ICONS } from '@/components/trips/tripTypeIcons';
import { useLocation } from '@/lib/hooks/useLocation';
import { useTranslation } from 'react-i18next';

const TRIP_TYPES: { type: TripType; labelKey: string }[] = [
  { type: 'walk', labelKey: 'maps:tripTypes.walk' },
  { type: 'cycle', labelKey: 'maps:tripTypes.cycle' },
];

export default function ManualEntryScreen() {
  const { t } = useTranslation('maps');
  const { colors } = useTheme();
  const { location, getCurrentLocation } = useLocation();
  const { unitSystem, distanceUnit, kmToDistance } = useUnits();
  const [selectedType, setSelectedType] = useState<TripType>('walk');
  const [distance, setDistance] = useState('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [routePoints, setRoutePoints] = useState<Coordinate[]>([]);

  // Get user location when map is shown
  useEffect(() => {
    if (showMap && !location) {
      getCurrentLocation();
    }
  }, [showMap]);

  // Helper to convert display distance to meters for storage
  const displayDistanceToMeters = (displayDist: number): number => {
    // displayDist is in user's preferred unit (km or mi)
    // Convert to km first, then to meters
    if (unitSystem === 'imperial') {
      // Convert miles to kilometers, then to meters
      return displayDist * 1.60934 * 1000;
    }
    // Already in km, just convert to meters
    return displayDist * 1000;
  };

  // Helper to convert meters to display distance
  const metersToDisplayDistance = (meters: number): number => {
    const km = meters / 1000;
    return kmToDistance(km);
  };

  async function handleSubmit() {
    // Validation
    const distanceParsed = parseFloat(distance);
    const distanceNum = Number.isFinite(distanceParsed) ? distanceParsed : NaN;
    const hoursNum = parseInt(hours) || 0;
    const minutesNum = parseInt(minutes) || 0;

    // If route drawn, use that distance (already in meters)
    let distanceMeters: number;
    if (routePoints.length > 1) {
      distanceMeters = calculateRouteDistance(routePoints);
    } else {
      // User entered distance - need to convert from display units to meters
      if (!distance || !Number.isFinite(distanceNum) || distanceNum <= 0) {
        Alert.alert(
          t('manualEntry.invalidDistance'),
          t('manualEntry.invalidDistanceMessage')
        );
        return;
      }
      distanceMeters = displayDistanceToMeters(distanceNum);
    }

    if (hoursNum === 0 && minutesNum === 0) {
      Alert.alert(t('manualEntry.invalidDuration'), t('manualEntry.invalidDurationMessage'));
      return;
    }

    const durationSeconds = hoursNum * 3600 + minutesNum * 60;

    setLoading(true);

    try {
      await TripManager.createManualTrip({
        userId: 'current_user',
        type: selectedType,
        distance: distanceMeters, // Always stored in meters
        duration: durationSeconds,
        startTime: Date.now() - durationSeconds * 1000,
        notes: notes.trim() || undefined,
        routeData: routePoints.length > 1 ? routePoints : undefined,
      });

      Alert.alert(t('manualEntry.success'), t('manualEntry.successMessage'), [
        {
          text: t('manualEntry.ok'),
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('[ManualEntry] Error saving trip:', error);
      Alert.alert(t('manualEntry.error'), t('manualEntry.errorMessage'));
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
      const totalDistanceMeters = calculateRouteDistance([...routePoints, newPoint]);
      const displayDist = metersToDisplayDistance(totalDistanceMeters);
      setDistance(displayDist.toFixed(2));
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
        const totalDistanceMeters = calculateRouteDistance(newPoints);
        const displayDist = metersToDisplayDistance(totalDistanceMeters);
        setDistance(displayDist.toFixed(2));
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
    <SettingsScreen title={t('manualEntry.title')} keyboardAvoiding>
      {/* Type Selection */}
      <SettingsGroup title={t('manualEntry.activityType')} index={0}>
        <View style={styles.cardBody}>
          <View style={styles.typeGrid}>
            {TRIP_TYPES.map((type) => (
              <TripTypeTile
                key={type.type}
                label={t(type.labelKey)}
                color={getTripTypeColor(type.type)}
                icon={TRIP_TYPE_ICONS[type.type]}
                selected={selectedType === type.type}
                onPress={() => setSelectedType(type.type)}
              />
            ))}
          </View>
        </View>
      </SettingsGroup>

      {/* Route Drawing Option */}
      <SettingsGroup title={t('manualEntry.route')} index={1}>
        <View style={styles.cardBody}>
          <View style={styles.routeToggle}>
            <Button
              title={showMap ? t('manualEntry.hideMap') : t('manualEntry.drawRoute')}
              onPress={() => setShowMap(!showMap)}
              variant="glass"
              size="small"
              icon={<MapIcon size={18} color={colors.glassTint} />}
            />
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
                    centerCoordinate={
                      location
                        ? [location.longitude, location.latitude]
                        : [-0.1276, 51.5074] // Default to London
                    }
                    animationDuration={300}
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
                    <GlassButton
                      onPress={undoLastPoint}
                      accessibilityLabel={t('manualEntry.undoPoint', { defaultValue: 'Undo last point' })}
                      size={40}
                    >
                      <ArrowUturnLeftIcon size={20} color={colors.glassTint} />
                    </GlassButton>
                    <GlassButton
                      onPress={clearRoute}
                      accessibilityLabel={t('manualEntry.clearRoute', { defaultValue: 'Clear route' })}
                      size={40}
                    >
                      <TrashIcon size={20} color="#EF4444" />
                    </GlassButton>
                  </View>
                )}
              </View>

              <Text style={[styles.mapHint, { color: colors.textSecondary }]}>
                {t('manualEntry.mapHint')}
              </Text>
            </>
          )}
        </View>
      </SettingsGroup>

      {/* Distance */}
      <SettingsGroup
        title={
          routePoints.length > 1
            ? t('manualEntry.distanceLabelAuto', { unit: distanceUnit })
            : t('manualEntry.distanceLabel', { unit: distanceUnit })
        }
        index={2}
      >
        <View style={styles.cardBody}>
          <TripFormField
            value={distance}
            onChangeText={setDistance}
            placeholder={t('manualEntry.distancePlaceholder', { unit: distanceUnit })}
            keyboardType="decimal-pad"
            editable={routePoints.length < 2}
          />
        </View>
      </SettingsGroup>

      {/* Duration */}
      <SettingsGroup title={t('manualEntry.durationLabel')} index={3}>
        <View style={[styles.cardBody, styles.durationRow]}>
          <View style={styles.durationInput}>
            <TripFormField
              value={hours}
              onChangeText={setHours}
              placeholder="0"
              keyboardType="number-pad"
              unit={t('manualEntry.hours')}
            />
          </View>
          <View style={styles.durationInput}>
            <TripFormField
              value={minutes}
              onChangeText={setMinutes}
              placeholder="0"
              keyboardType="number-pad"
              unit={t('manualEntry.minutes')}
            />
          </View>
        </View>
      </SettingsGroup>

      {/* Notes */}
      <SettingsGroup title={t('manualEntry.notesLabel')} index={4}>
        <View style={styles.cardBody}>
          <TripFormField
            value={notes}
            onChangeText={setNotes}
            placeholder={t('manualEntry.notesPlaceholder')}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={styles.textAreaInput}
          />
        </View>
      </SettingsGroup>

      {/* Submit Button */}
      <View style={styles.submit}>
        <Button
          title={t('manualEntry.saveTrip')}
          onPress={handleSubmit}
          variant="primary"
          size="large"
          fullWidth
          loading={loading}
        />
      </View>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  cardBody: {
    padding: 16,
    gap: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  routeToggle: {
    alignItems: 'flex-start',
  },
  mapContainer: {
    height: 300,
    borderRadius: 14,
    overflow: 'hidden',
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
  mapHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  textAreaInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  durationRow: {
    flexDirection: 'row',
  },
  durationInput: {
    flex: 1,
  },
  submit: {
    paddingHorizontal: 16,
    marginTop: 4,
  },
});
