export type ActivityForFilter = 'walk' | 'run' | 'cycle';

const CEILING_KMH: Record<ActivityForFilter, number> = { walk: 12, run: 30, cycle: 60 };
const ACCURACY_THRESHOLD_M = 20;

export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: string; // ISO 8601
  accuracy?: number; // metres
}

export const RouteFilter = {
  filter(points: RoutePoint[], activity: ActivityForFilter): RoutePoint[] {
    // 1. Drop bad accuracy
    let kept = points.filter(p => (p.accuracy ?? 0) <= ACCURACY_THRESHOLD_M);

    // 2. Drop sub-second duplicates (same position within <1s)
    kept = kept.filter((p, i, arr) => {
      if (i === 0) return true;
      const prev = arr[i - 1];
      if (p.lat === prev.lat && p.lng === prev.lng) {
        const dt = (new Date(p.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
        return dt >= 1;
      }
      return true;
    });

    // 3. Spike rejection: drop points where implied speed exceeds ceiling or 1.5× p95 of ±5 window
    if (kept.length < 2) return kept;
    const speeds = computeSpeeds(kept);
    const ceiling = CEILING_KMH[activity];
    return kept.filter((_, i) => {
      if (i === 0 || i === kept.length - 1) return true;
      const speedIn = speeds[i - 1];
      const speedOut = speeds[i];
      if (speedIn > ceiling || speedOut > ceiling) return false;
      const window = speeds.slice(Math.max(0, i - 5), Math.min(speeds.length, i + 6));
      const p95 = percentile(window, 0.95);
      return speedIn <= 1.5 * p95 && speedOut <= 1.5 * p95;
    });
  },
};

function computeSpeeds(pts: RoutePoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    out.push(impliedSpeedKmh(pts[i - 1], pts[i]));
  }
  return out;
}

function impliedSpeedKmh(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const distKm = 2 * R * Math.asin(Math.sqrt(h));
  const dtSec = (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) / 1000;
  return dtSec > 0 ? (distKm / dtSec) * 3600 : 0;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}
