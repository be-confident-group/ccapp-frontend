/**
 * ML-driven segment detector.
 *
 * Consumes the per-window ML predictions stored in `activity_windows` for a
 * trip and produces the same `SegmentAnalysis` shape, so the rest of the
 * pipeline (multi-modal split in TripManager, UI code) does not change.
 *
 * Fallback: if no activity_windows rows exist for the trip (typical for
 * background-only trips on iOS where expo-sensors can't stream), this
 * detector falls back to a simple speed-based segmenter inlined below.
 */

import { database, type ActivityWindow, type LocationPoint } from '../database';
import { activityClassToTripType, type ActivityClass } from '../activity/classifier';
import type { TripType } from '@/types/trip';

// ===== Shared segment types (previously in SegmentDetector.ts) =====

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

const MIN_SEGMENT_DURATION_SEC = 30;
const MIN_SEGMENT_DISTANCE_M = 100;
const MIN_WINDOW_CONFIDENCE = 0.45;

// Majority-vote smoothing window (in # of windows). 3 windows ≈ 7.5 s.
const SMOOTH_WINDOWS = 3;

export interface MLSegmentAnalysis extends SegmentAnalysis {
  classificationMethod: 'ml' | 'speed';
  mlWindowCount: number;
}

export class MLSegmentDetector {
  static async analyzeTrip(
    tripId: string,
    locations: LocationPoint[],
  ): Promise<MLSegmentAnalysis> {
    const windows = await database.getActivityWindowsByTrip(tripId);

    if (windows.length === 0) {
      console.log(
        `[MLSegmentDetector] No activity_windows for ${tripId}, falling back to speed-based`,
      );
      const legacy = speedBasedFallback(locations);
      return {
        ...legacy,
        classificationMethod: 'speed',
        mlWindowCount: 0,
      };
    }

    const smoothed = smoothLabels(windows, SMOOTH_WINDOWS);
    const runs = coalesceRuns(smoothed);
    const rawSegments = runs
      .map((run) => buildSegment(run, locations))
      .filter((seg): seg is TripSegment => seg !== null);
    const filtered = filterAndMergeSegments(rawSegments);

    const uniqueTypes = new Set(filtered.map((s) => s.type));
    const isMultiModal = uniqueTypes.size > 1;
    const dominantType = getDominantType(filtered);
    const confidence = calculateOverallConfidence(filtered);

    console.log(`[MLSegmentDetector] Trip ${tripId}:`, {
      windowCount: windows.length,
      rawSegments: rawSegments.length,
      finalSegments: filtered.length,
      types: filtered.map((s) => s.type),
      dominantType,
    });

    return {
      isMultiModal,
      segments: filtered,
      dominantType,
      confidence,
      classificationMethod: 'ml',
      mlWindowCount: windows.length,
    };
  }
}

interface SmoothedWindow {
  t_start: number;
  t_end: number;
  label: ActivityClass;
  confidence: number;
}

function smoothLabels(windows: ActivityWindow[], k: number): SmoothedWindow[] {
  const usable = windows
    .map((w) => ({
      t_start: w.t_start,
      t_end: w.t_end,
      label: w.label as ActivityClass,
      confidence: w.confidence,
    }))
    .filter((w) => w.confidence >= MIN_WINDOW_CONFIDENCE);
  if (usable.length === 0) return [];

  const half = Math.floor(k / 2);
  const out: SmoothedWindow[] = [];

  for (let i = 0; i < usable.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(usable.length, i + half + 1);

    const counts: Partial<Record<ActivityClass, number>> = {};
    let best: ActivityClass = usable[i].label;
    let bestCount = 0;
    for (let j = lo; j < hi; j++) {
      const label = usable[j].label;
      const c = (counts[label] = (counts[label] ?? 0) + 1);
      if (c > bestCount) {
        bestCount = c;
        best = label;
      }
    }
    out.push({
      t_start: usable[i].t_start,
      t_end: usable[i].t_end,
      label: best,
      confidence: usable[i].confidence,
    });
  }
  return out;
}

interface Run {
  label: ActivityClass;
  tStart: number;
  tEnd: number;
  windows: SmoothedWindow[];
}

function coalesceRuns(windows: SmoothedWindow[]): Run[] {
  if (windows.length === 0) return [];
  const runs: Run[] = [];
  let cur: Run = {
    label: windows[0].label,
    tStart: windows[0].t_start,
    tEnd: windows[0].t_end,
    windows: [windows[0]],
  };
  for (let i = 1; i < windows.length; i++) {
    const w = windows[i];
    if (w.label === cur.label) {
      cur.tEnd = w.t_end;
      cur.windows.push(w);
    } else {
      runs.push(cur);
      cur = { label: w.label, tStart: w.t_start, tEnd: w.t_end, windows: [w] };
    }
  }
  runs.push(cur);
  return runs;
}

function buildSegment(run: Run, locations: LocationPoint[]): TripSegment | null {
  const sliceStart = firstIndexAtOrAfter(locations, run.tStart);
  const sliceEnd = lastIndexAtOrBefore(locations, run.tEnd);
  if (sliceStart < 0 || sliceEnd < sliceStart) return null;
  const segLocs = locations.slice(sliceStart, sliceEnd + 1);
  if (segLocs.length < 2) return null;

  const duration = (segLocs[segLocs.length - 1].timestamp - segLocs[0].timestamp) / 1000;

  let distance = 0;
  let maxSpeedKmh = 0;
  for (let i = 1; i < segLocs.length; i++) {
    const d = haversineMeters(segLocs[i - 1], segLocs[i]);
    distance += d;
    const deviceSpeedKmh = (segLocs[i].speed ?? 0) * 3.6;
    if (deviceSpeedKmh > maxSpeedKmh) maxSpeedKmh = deviceSpeedKmh;
  }

  const avgSpeedKmh = duration > 0 ? (distance / 1000) / (duration / 3600) : 0;

  const avgConfidence =
    (run.windows.reduce((s, w) => s + w.confidence, 0) / run.windows.length) * 100;

  return {
    startIndex: sliceStart,
    endIndex: sliceEnd,
    locations: segLocs,
    type: activityClassToTripType(run.label) as TripType,
    distance,
    duration,
    avgSpeed: avgSpeedKmh,
    maxSpeed: maxSpeedKmh,
    confidence: Math.round(avgConfidence),
  };
}

function firstIndexAtOrAfter(locs: LocationPoint[], t: number): number {
  for (let i = 0; i < locs.length; i++) {
    if (locs[i].timestamp >= t) return i;
  }
  return locs.length - 1;
}

function lastIndexAtOrBefore(locs: LocationPoint[], t: number): number {
  for (let i = locs.length - 1; i >= 0; i--) {
    if (locs[i].timestamp <= t) return i;
  }
  return -1;
}

function filterAndMergeSegments(segments: TripSegment[]): TripSegment[] {
  if (segments.length === 0) return [];
  const out: TripSegment[] = [];
  for (const seg of segments) {
    if (seg.duration < MIN_SEGMENT_DURATION_SEC || seg.distance < MIN_SEGMENT_DISTANCE_M) {
      continue;
    }
    if (out.length > 0 && out[out.length - 1].type === seg.type) {
      const prev = out[out.length - 1];
      prev.endIndex = seg.endIndex;
      prev.locations = [...prev.locations, ...seg.locations];
      prev.distance += seg.distance;
      prev.duration += seg.duration;
      prev.avgSpeed = prev.duration > 0 ? (prev.distance / 1000) / (prev.duration / 3600) : 0;
      prev.maxSpeed = Math.max(prev.maxSpeed, seg.maxSpeed);
      prev.confidence = Math.round((prev.confidence + seg.confidence) / 2);
      continue;
    }
    out.push(seg);
  }
  return out;
}

function getDominantType(segments: TripSegment[]): TripType {
  if (segments.length === 0) return 'walk';
  const byType: Record<string, number> = {};
  for (const s of segments) byType[s.type] = (byType[s.type] ?? 0) + s.distance;
  let bestType: TripType = 'walk';
  let bestDist = -1;
  for (const [t, d] of Object.entries(byType)) {
    if (d > bestDist) {
      bestDist = d;
      bestType = t as TripType;
    }
  }
  return bestType;
}

function calculateOverallConfidence(segments: TripSegment[]): number {
  if (segments.length === 0) return 0;
  let totalWeighted = 0;
  let totalDist = 0;
  for (const s of segments) {
    totalWeighted += s.confidence * s.distance;
    totalDist += s.distance;
  }
  return totalDist > 0 ? Math.round(totalWeighted / totalDist) : 0;
}

function haversineMeters(a: LocationPoint, b: LocationPoint): number {
  const R = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ===== Speed-based fallback segmenter =====
// Used when no activity_windows exist for a trip (background-only iOS trips).
// Intentionally minimal: classifies each point by speed thresholds, then
// coalesces runs of the same type into segments.

const SPEED_STATIONARY_KMH = 2;
const SPEED_WALKING_KMH = 7;
const SPEED_CYCLING_KMH = 30;

function classifySpeedKmh(speedMps: number): TripType {
  const kmh = speedMps * 3.6;
  if (kmh < SPEED_STATIONARY_KMH) return 'walk'; // stationary treated as walk for fallback
  if (kmh < SPEED_WALKING_KMH) return 'walk';
  if (kmh < SPEED_CYCLING_KMH) return 'cycle';
  return 'drive';
}

function speedBasedFallback(locations: LocationPoint[]): SegmentAnalysis {
  if (locations.length < 2) {
    return { isMultiModal: false, segments: [], dominantType: 'walk', confidence: 0 };
  }

  // Label each point
  const labels = locations.map((loc) => classifySpeedKmh(loc.speed ?? 0));

  // Coalesce runs of the same label
  interface FallbackRun { type: TripType; startIdx: number; endIdx: number }
  const runs: FallbackRun[] = [];
  let cur: FallbackRun = { type: labels[0], startIdx: 0, endIdx: 0 };
  for (let i = 1; i < labels.length; i++) {
    if (labels[i] === cur.type) {
      cur.endIdx = i;
    } else {
      runs.push(cur);
      cur = { type: labels[i], startIdx: i, endIdx: i };
    }
  }
  runs.push(cur);

  // Build TripSegments
  const rawSegments: TripSegment[] = runs.map((run) => {
    const segLocs = locations.slice(run.startIdx, run.endIdx + 1);
    let distance = 0;
    let maxSpeedKmh = 0;
    for (let i = 1; i < segLocs.length; i++) {
      distance += haversineMeters(segLocs[i - 1], segLocs[i]);
      const s = (segLocs[i].speed ?? 0) * 3.6;
      if (s > maxSpeedKmh) maxSpeedKmh = s;
    }
    const duration = segLocs.length > 1
      ? (segLocs[segLocs.length - 1].timestamp - segLocs[0].timestamp) / 1000
      : 0;
    const avgSpeed = duration > 0 ? (distance / 1000) / (duration / 3600) : 0;
    return {
      startIndex: run.startIdx,
      endIndex: run.endIdx,
      locations: segLocs,
      type: run.type,
      distance,
      duration,
      avgSpeed,
      maxSpeed: maxSpeedKmh,
      confidence: 60,
    };
  });

  // Filter short segments and merge adjacent same-type
  const filtered = rawSegments.filter(
    (s) => s.duration >= MIN_SEGMENT_DURATION_SEC && s.distance >= MIN_SEGMENT_DISTANCE_M,
  );

  const merged: TripSegment[] = [];
  for (const seg of filtered) {
    if (merged.length > 0 && merged[merged.length - 1].type === seg.type) {
      const prev = merged[merged.length - 1];
      prev.endIndex = seg.endIndex;
      prev.locations = [...prev.locations, ...seg.locations];
      prev.distance += seg.distance;
      prev.duration += seg.duration;
      prev.avgSpeed = prev.duration > 0 ? (prev.distance / 1000) / (prev.duration / 3600) : 0;
      prev.maxSpeed = Math.max(prev.maxSpeed, seg.maxSpeed);
    } else {
      merged.push({ ...seg, locations: [...seg.locations] });
    }
  }

  const uniqueTypes = new Set(merged.map((s) => s.type));
  const dominantType = getDominantType(merged);
  return {
    isMultiModal: uniqueTypes.size > 1,
    segments: merged,
    dominantType,
    confidence: merged.length > 0 ? 60 : 0,
  };
}
