/**
 * MotionActivitySegmenter
 *
 * Converts raw MotionSegment records from the motion_segments table into
 * structured TripSegment analysis using GPS location data for distance
 * calculation.
 */

import { database } from '@/lib/database';
import type { MotionSegment, LocationPoint } from '@/lib/database/db';
import type { TripSegment, SegmentAnalysis } from './SegmentDetector';
import type { TripType } from '@/types/trip';

// Minimum thresholds for valid segments
const MIN_SEGMENT_DURATION_S = 30; // seconds
const MIN_SEGMENT_DISTANCE_M = 100; // meters

/** Map CMMA activity strings to TripType */
function mapActivity(activity: MotionSegment['activity']): TripType | null {
  switch (activity) {
    case 'walking':
      return 'walk';
    case 'running':
      return 'run';
    case 'cycling':
      return 'cycle';
    case 'automotive':
      return 'drive';
    case 'stationary':
    case 'unknown':
    default:
      return null;
  }
}

/** Haversine distance in meters between two lat/lon points */
function haversine(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Calculate total distance (meters) for locations within [tStart, tEnd] range */
function distanceForTimeRange(
  locations: LocationPoint[],
  tStart: number,
  tEnd: number
): number {
  const pts = locations.filter(
    (loc) => loc.timestamp >= tStart && loc.timestamp <= tEnd
  );
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += haversine(
      pts[i - 1].latitude, pts[i - 1].longitude,
      pts[i].latitude, pts[i].longitude
    );
  }
  return total;
}

/** Get average speed km/h for locations in time range */
function avgSpeedForTimeRange(
  locations: LocationPoint[],
  tStart: number,
  tEnd: number
): number {
  const pts = locations.filter(
    (loc) => loc.timestamp >= tStart && loc.timestamp <= tEnd && loc.speed != null
  );
  if (pts.length === 0) return 0;
  const sum = pts.reduce((acc, p) => acc + (p.speed ?? 0), 0);
  return ((sum / pts.length) * 3.6); // m/s → km/h
}

/** Get max speed km/h for locations in time range */
function maxSpeedForTimeRange(
  locations: LocationPoint[],
  tStart: number,
  tEnd: number
): number {
  const pts = locations.filter(
    (loc) => loc.timestamp >= tStart && loc.timestamp <= tEnd && loc.speed != null
  );
  if (pts.length === 0) return 0;
  return Math.max(...pts.map((p) => (p.speed ?? 0))) * 3.6; // m/s → km/h
}

/** Map confidence string to numeric 0–100 */
function confidenceToNum(conf: MotionSegment['confidence']): number {
  switch (conf) {
    case 'high':
      return 90;
    case 'medium':
      return 60;
    case 'low':
      return 30;
    default:
      return 50;
  }
}

/**
 * Pick the dominant TripType by total accumulated distance.
 * Returns 'walk' as fallback if no segments.
 */
function dominantByDistance(segments: TripSegment[]): TripType {
  if (segments.length === 0) return 'walk';
  const totals = new Map<TripType, number>();
  for (const seg of segments) {
    totals.set(seg.type, (totals.get(seg.type) ?? 0) + seg.distance);
  }
  let best: TripType = 'walk';
  let bestDist = -1;
  for (const [type, dist] of totals.entries()) {
    if (dist > bestDist) {
      bestDist = dist;
      best = type;
    }
  }
  return best;
}

export class MotionActivitySegmenter {
  /**
   * Analyze a trip and return a SegmentAnalysis built from motion_segments data.
   */
  static async analyze(tripId: string): Promise<SegmentAnalysis & { classificationMethod: string }> {
    const [motionSegments, rawLocations] = await Promise.all([
      database.getMotionSegmentsByTrip(tripId),
      database.getLocationsByTrip(tripId),
    ]);

    // WAL isolation fix: expo-sqlite may not see GRDB-written location rows.
    // Fall back to parsing the pre-computed route_data from the trips row.
    let locations = rawLocations;
    if (locations.length === 0) {
      console.log('[MotionActivitySegmenter] 0 locations from expo-sqlite, trying route_data fallback');
      try {
        const trip = await database.getTripById(tripId);
        if (trip?.route_data) {
          const parsed = JSON.parse(trip.route_data);
          if (Array.isArray(parsed) && parsed.length > 0) {
            locations = parsed.map((p: any, idx: number) => ({
              id: idx,
              trip_id: tripId,
              latitude: p.lat ?? p.latitude ?? 0,
              longitude: p.lng ?? p.longitude ?? 0,
              altitude: null,
              accuracy: null,
              speed: null,
              heading: null,
              timestamp: typeof p.timestamp === 'string' ? new Date(p.timestamp).getTime() : p.timestamp,
              activity_type: null,
              activity_confidence: null,
              synced: 0,
            }));
            console.log(`[MotionActivitySegmenter] recovered ${locations.length} points from route_data`);
          }
        }
      } catch (err) {
        console.warn('[MotionActivitySegmenter] route_data fallback failed:', err);
      }
    }

    // Sort locations by timestamp for accurate distance calc
    const sortedLocations = [...locations].sort((a, b) => a.timestamp - b.timestamp);

    // Step 1: Map each MotionSegment to a TripSegment (skip stationary/unknown)
    const rawSegments: TripSegment[] = [];
    for (const ms of motionSegments) {
      const type = mapActivity(ms.activity);
      if (type === null) continue;

      const durationS = (ms.t_end - ms.t_start) / 1000;
      const distance = distanceForTimeRange(sortedLocations, ms.t_start, ms.t_end);
      const avgSpeed = avgSpeedForTimeRange(sortedLocations, ms.t_start, ms.t_end);
      const maxSpeed = maxSpeedForTimeRange(sortedLocations, ms.t_start, ms.t_end);
      const confidence = confidenceToNum(ms.confidence);

      // Find start/end indices in the sorted location array
      const startIndex = sortedLocations.findIndex((l) => l.timestamp >= ms.t_start);
      const endIndexRaw = [...sortedLocations].reverse().findIndex((l) => l.timestamp <= ms.t_end);
      const endIndex = endIndexRaw >= 0 ? sortedLocations.length - 1 - endIndexRaw : startIndex;
      const segLocations = sortedLocations.filter(
        (l) => l.timestamp >= ms.t_start && l.timestamp <= ms.t_end
      );

      rawSegments.push({
        startIndex: Math.max(0, startIndex),
        endIndex: Math.max(0, endIndex),
        locations: segLocations,
        type,
        distance,
        duration: durationS,
        avgSpeed,
        maxSpeed,
        confidence,
      });
    }

    // Step 2: Merge adjacent segments of the same type
    const merged = mergeAdjacentSameType(rawSegments);

    // Step 3: Filter out segments that are too short
    const filtered = merged.filter(
      (seg) =>
        seg.duration >= MIN_SEGMENT_DURATION_S && seg.distance >= MIN_SEGMENT_DISTANCE_M
    );

    const uniqueTypes = new Set(filtered.map((s) => s.type));
    const isMultiModal = uniqueTypes.size > 1;
    const dominantType = dominantByDistance(filtered);
    const overallConfidence =
      filtered.length > 0
        ? Math.round(filtered.reduce((sum, s) => sum + s.confidence, 0) / filtered.length)
        : 0;

    return {
      segments: filtered,
      isMultiModal,
      dominantType,
      confidence: overallConfidence,
      classificationMethod: 'cmma',
    };
  }
}

/** Merge consecutive segments that share the same TripType */
function mergeAdjacentSameType(segments: TripSegment[]): TripSegment[] {
  if (segments.length === 0) return [];

  const result: TripSegment[] = [];
  let current = { ...segments[0], locations: [...segments[0].locations] };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    if (next.type === current.type) {
      // Merge: extend current
      current = {
        startIndex: current.startIndex,
        endIndex: next.endIndex,
        locations: [...current.locations, ...next.locations],
        type: current.type,
        distance: current.distance + next.distance,
        duration: current.duration + next.duration,
        avgSpeed: (current.avgSpeed + next.avgSpeed) / 2,
        maxSpeed: Math.max(current.maxSpeed, next.maxSpeed),
        confidence: Math.round((current.confidence + next.confidence) / 2),
      };
    } else {
      result.push(current);
      current = { ...next, locations: [...next.locations] };
    }
  }
  result.push(current);
  return result;
}
