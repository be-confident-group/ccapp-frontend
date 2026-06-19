import {
  trimStationaryTail,
  calculateElevationGain,
  calculateElevationLoss,
} from '../geoCalculations';

/** Build a point offset north of (51, 0) by the given metres. 1 deg lat ≈ 111_320 m. */
function ptNorth(metersNorth: number, timestampMs: number) {
  return { lat: 51 + metersNorth / 111_320, lng: 0, timestamp: timestampMs };
}

describe('trimStationaryTail', () => {
  const MIN = 60_000;

  it('keeps a route that moves until the end', () => {
    const route = Array.from({ length: 10 }, (_, i) => ptNorth(i * 100, i * MIN));
    expect(trimStationaryTail(route)).toHaveLength(10);
  });

  it('trims a long stationary tail clustered at the end point', () => {
    // 5 min of walking (100 m apart), then 10 min of drift within ~20 m.
    const moving = Array.from({ length: 6 }, (_, i) => ptNorth(i * 100, i * MIN));
    const drift = Array.from({ length: 10 }, (_, i) =>
      ptNorth(500 + (i % 2 === 0 ? 10 : -10), (6 + i) * MIN)
    );
    const trimmed = trimStationaryTail([...moving, ...drift]);
    // Everything within 50 m of the final drift point spanning >= 3 min is removed.
    expect(trimmed.length).toBeLessThan(16);
    expect(trimmed.length).toBeGreaterThanOrEqual(6);
    const lastTs = trimmed[trimmed.length - 1].timestamp as number;
    expect(lastTs).toBeLessThanOrEqual(7 * MIN);
  });

  it('does not trim a brief arrival pause (< 3 min)', () => {
    const moving = Array.from({ length: 6 }, (_, i) => ptNorth(i * 100, i * MIN));
    // 2 minutes of stationary points at the destination (arrival at t=5min,
    // last point t=7min → tail span 2 min < 3 min minimum).
    const pause = [ptNorth(505, 6 * MIN), ptNorth(495, 7 * MIN)];
    const route = [...moving, ...pause];
    expect(trimStationaryTail(route)).toHaveLength(route.length);
  });

  it('handles ISO string timestamps', () => {
    const base = Date.parse('2026-06-10T08:00:00Z');
    const moving = Array.from({ length: 6 }, (_, i) => ({
      lat: 51 + (i * 100) / 111_320,
      lng: 0,
      timestamp: new Date(base + i * MIN).toISOString(),
    }));
    const drift = Array.from({ length: 6 }, (_, i) => ({
      lat: 51 + 500 / 111_320,
      lng: 0,
      timestamp: new Date(base + (6 + i) * MIN).toISOString(),
    }));
    const trimmed = trimStationaryTail([...moving, ...drift]);
    expect(trimmed.length).toBeLessThan(12);
  });

  it('returns short routes untouched', () => {
    const route = [ptNorth(0, 0), ptNorth(10, MIN)];
    expect(trimStationaryTail(route)).toHaveLength(2);
  });
});

describe('elevation dead-band', () => {
  it('ignores sub-3m jitter that previously summed to huge totals', () => {
    // 1000 samples of ±1.5 m oscillation — naive sum would report ~750 m gain.
    const altitudes = Array.from({ length: 1000 }, (_, i) => (i % 2 === 0 ? 0 : 1.5));
    expect(calculateElevationGain(altitudes)).toBe(0);
    expect(calculateElevationLoss(altitudes)).toBe(0);
  });

  it('still accumulates a real climb', () => {
    // Steady climb 0 → 100 m in 4 m steps.
    const altitudes = Array.from({ length: 26 }, (_, i) => i * 4);
    expect(calculateElevationGain(altitudes)).toBe(100);
    expect(calculateElevationLoss(altitudes)).toBe(0);
  });

  it('handles climb with noise and a descent', () => {
    const up = Array.from({ length: 11 }, (_, i) => i * 5); // 0 → 50
    const down = Array.from({ length: 11 }, (_, i) => 50 - i * 5); // 50 → 0
    expect(calculateElevationGain([...up, ...down])).toBe(50);
    expect(calculateElevationLoss([...up, ...down])).toBe(50);
  });
});
