/**
 * Segment Detector
 *
 * Detects multi-modal trips by analyzing speed patterns and transitions.
 * Splits trips into segments where each segment represents a consistent activity type.
 */

import type { LocationPoint } from '@/lib/database/db';
import { ActivityClassifier } from './ActivityClassifier';
import type { TripType } from '@/types/trip';

export interface TripSegment {
  startIndex: number;
  endIndex: number;
  locations: LocationPoint[];
  type: TripType;
  distance: number; // meters
  duration: number; // seconds
  avgSpeed: number; // km/h
  maxSpeed: number; // km/h
  confidence: number; // 0-100
}

export interface SegmentAnalysis {
  isMultiModal: boolean;
  segments: TripSegment[];
  dominantType: TripType;
  confidence: number;
}

export class SegmentDetector {
  // Speed change threshold to detect transitions (km/h)
  private static SPEED_CHANGE_THRESHOLD = 5;

  // Minimum segment duration (seconds)
  private static MIN_SEGMENT_DURATION = 30;

  // Minimum segment distance (meters)
  private static MIN_SEGMENT_DISTANCE = 100;

  /**
   * Analyze trip locations and detect segments
   */
  static analyzeTrip(locations: LocationPoint[]): SegmentAnalysis {
    if (locations.length < 2) {
      return {
        isMultiModal: false,
        segments: [],
        dominantType: 'walk',
        confidence: 0,
      };
    }

    // Classify each location point
    const classifications = locations.map((loc) => {
      const speed = loc.speed || 0;
      const classification = ActivityClassifier.classifyBySpeed(speed);
      return {
        location: loc,
        type: this.mapActivityToTripType(classification.type),
        speedKmh: speed * 3.6,
        confidence: classification.confidence,
      };
    });

    // Detect segment boundaries (where activity type changes)
    const segments: TripSegment[] = [];
    let currentSegmentStart = 0;
    let currentType = classifications[0].type;

    for (let i = 1; i < classifications.length; i++) {
      const prevType = currentType;
      const currType = classifications[i].type;

      // Check if we should start a new segment
      const shouldSplit = this.shouldSplitSegment(
        classifications,
        currentSegmentStart,
        i,
        prevType,
        currType
      );

      if (shouldSplit) {
        // Create segment from currentSegmentStart to i-1
        const segment = this.createSegment(
          locations,
          classifications,
          currentSegmentStart,
          i - 1,
          prevType
        );

        if (segment) {
          segments.push(segment);
        }

        // Start new segment
        currentSegmentStart = i;
        currentType = currType;
      }
    }

    // Add final segment
    const finalSegment = this.createSegment(
      locations,
      classifications,
      currentSegmentStart,
      classifications.length - 1,
      currentType
    );
    if (finalSegment) {
      segments.push(finalSegment);
    }

    // Filter out tiny segments and merge adjacent similar segments
    const filteredSegments = this.filterAndMergeSegments(segments);

    // Determine if multi-modal
    const uniqueTypes = new Set(filteredSegments.map((s) => s.type));
    const isMultiModal = uniqueTypes.size > 1;

    // Find dominant type (by distance)
    const dominantType = this.getDominantType(filteredSegments);
    const overallConfidence = this.calculateOverallConfidence(filteredSegments);

    return {
      isMultiModal,
      segments: filteredSegments,
      dominantType,
      confidence: overallConfidence,
    };
  }

  /**
   * Determine if we should split at this point
   */
  private static shouldSplitSegment(
    classifications: any[],
    segmentStart: number,
    currentIndex: number,
    prevType: TripType,
    currType: TripType
  ): boolean {
    // Don't split if types are the same
    if (prevType === currType) {
      return false;
    }

    // Don't split if either type is stationary
    if (prevType === 'walk' && currType === 'walk') {
      return false;
    }

    // Check if this is a sustained change (not just a blip)
    // Look ahead 3 points to confirm the new activity
    const lookAhead = 3;
    const remainingPoints = classifications.length - currentIndex;
    const pointsToCheck = Math.min(lookAhead, remainingPoints);

    if (pointsToCheck < 2) {
      return false; // Not enough points to confirm
    }

    // Count how many of the next points match the new type
    let matchCount = 0;
    for (let i = 0; i < pointsToCheck; i++) {
      if (classifications[currentIndex + i].type === currType) {
        matchCount++;
      }
    }

    // Require at least 2/3 of next points to match new type
    return matchCount >= Math.ceil(pointsToCheck * 0.66);
  }

  /**
   * Create a segment from location points
   */
  private static createSegment(
    locations: LocationPoint[],
    classifications: any[],
    startIndex: number,
    endIndex: number,
    type: TripType
  ): TripSegment | null {
    const segmentLocations = locations.slice(startIndex, endIndex + 1);

    if (segmentLocations.length < 2) {
      return null;
    }

    // Calculate segment stats
    const startTime = segmentLocations[0].timestamp;
    const endTime = segmentLocations[segmentLocations.length - 1].timestamp;
    const duration = (endTime - startTime) / 1000; // seconds

    // Calculate distance
    let distance = 0;
    for (let i = 1; i < segmentLocations.length; i++) {
      const d = this.calculateDistance(
        segmentLocations[i - 1],
        segmentLocations[i]
      );
      distance += d;
    }

    // Calculate max speed
    let maxSpeed = 0;
    const speeds = classifications.slice(startIndex, endIndex + 1);
    for (const s of speeds) {
      if (s.speedKmh > maxSpeed) {
        maxSpeed = s.speedKmh;
      }
    }

    // Calculate average speed
    const avgSpeed = duration > 0 ? (distance / 1000) / (duration / 3600) : 0;

    // Transit override: if calculated avg speed > 10 km/h but classified as walk, it's transit
    let effectiveType = type;
    if (effectiveType === 'walk' && avgSpeed > 10) {
      console.log(
        `[SegmentDetector] Transit override: segment avg speed ${avgSpeed.toFixed(1)} km/h but classified as walk`
      );
      effectiveType = 'drive';
    }

    // Calculate average confidence
    const avgConfidence =
      speeds.reduce((sum, s) => sum + s.confidence, 0) / speeds.length;

    return {
      startIndex,
      endIndex,
      locations: segmentLocations,
      type: effectiveType,
      distance,
      duration,
      avgSpeed,
      maxSpeed,
      confidence: Math.round(avgConfidence),
    };
  }

  /**
   * Filter out tiny segments and merge adjacent similar segments
   */
  private static filterAndMergeSegments(segments: TripSegment[]): TripSegment[] {
    if (segments.length === 0) return [];

    const filtered: TripSegment[] = [];

    for (const segment of segments) {
      // Skip segments that are too short
      if (
        segment.duration < this.MIN_SEGMENT_DURATION ||
        segment.distance < this.MIN_SEGMENT_DISTANCE
      ) {
        continue;
      }

      // Try to merge with previous segment if same type
      if (filtered.length > 0) {
        const prev = filtered[filtered.length - 1];
        if (prev.type === segment.type) {
          // Merge
          prev.endIndex = segment.endIndex;
          prev.locations = [...prev.locations, ...segment.locations];
          prev.distance += segment.distance;
          prev.duration += segment.duration;
          prev.avgSpeed = (prev.distance / 1000) / (prev.duration / 3600);
          prev.maxSpeed = Math.max(prev.maxSpeed, segment.maxSpeed);
          prev.confidence = Math.round((prev.confidence + segment.confidence) / 2);
          continue;
        }
      }

      filtered.push(segment);
    }

    return filtered;
  }

  /**
   * Get dominant activity type by distance
   */
  private static getDominantType(segments: TripSegment[]): TripType {
    if (segments.length === 0) return 'walk';

    const typeDistances: Record<string, number> = {};

    for (const segment of segments) {
      typeDistances[segment.type] = (typeDistances[segment.type] || 0) + segment.distance;
    }

    let maxDistance = 0;
    let dominantType: TripType = 'walk';

    for (const [type, distance] of Object.entries(typeDistances)) {
      if (distance > maxDistance) {
        maxDistance = distance;
        dominantType = type as TripType;
      }
    }

    return dominantType;
  }

  /**
   * Calculate overall confidence
   */
  private static calculateOverallConfidence(segments: TripSegment[]): number {
    if (segments.length === 0) return 0;

    // Weight by distance
    let totalWeightedConfidence = 0;
    let totalDistance = 0;

    for (const segment of segments) {
      totalWeightedConfidence += segment.confidence * segment.distance;
      totalDistance += segment.distance;
    }

    return totalDistance > 0
      ? Math.round(totalWeightedConfidence / totalDistance)
      : 0;
  }

  /**
   * Map ActivityType to TripType
   */
  private static mapActivityToTripType(activityType: string): TripType {
    switch (activityType) {
      case 'walking':
      case 'stationary':
        return 'walk';
      case 'running':
      case 'cycling':
        return 'cycle';
      case 'driving':
        return 'drive';
      default:
        return 'walk';
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private static calculateDistance(
    point1: LocationPoint,
    point2: LocationPoint
  ): number {
    const R = 6371000; // Earth radius in meters
    const lat1 = (point1.latitude * Math.PI) / 180;
    const lat2 = (point2.latitude * Math.PI) / 180;
    const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const deltaLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
