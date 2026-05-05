import { RouteFilter } from '../RouteFilter';

const pt = (lat: number, lng: number, ts: string, accuracy = 5) => ({ lat, lng, timestamp: ts, accuracy });
const sec = (s: number) => new Date(s * 1000).toISOString();

describe('RouteFilter', () => {
  it('drops points with accuracy > 20m', () => {
    const points = [pt(0, 0, sec(0)), pt(0, 1, sec(1), 50), pt(0, 2, sec(2))];
    expect(RouteFilter.filter(points, 'cycle')).toHaveLength(2);
  });

  it('drops sub-second duplicate positions', () => {
    const points = [pt(0, 0, sec(0)), pt(0, 0, '1970-01-01T00:00:00.500Z'), pt(0, 1, sec(1))];
    expect(RouteFilter.filter(points, 'cycle')).toHaveLength(2);
  });

  it('drops single-point speed spike exceeding cycling ceiling (60 km/h)', () => {
    // Build 12 normal points at ~14 km/h cycling pace, then one spike
    // Use ~0.00004° per second ≈ 14 km/h
    type RoutePointArr = ReturnType<typeof pt>[];
    const normal: RoutePointArr = [];
    for (let i = 0; i < 12; i++) {
      normal.push(pt(0, i * 0.00004, sec(i)));
    }
    // Spike: jump 0.2° in 1s ≈ 700+ km/h
    const spike = [...normal];
    spike.splice(6, 0, pt(0, 6 * 0.00004 + 0.2, sec(5.5)));
    const result = RouteFilter.filter(spike, 'cycle');
    expect(result.length).toBeLessThan(spike.length);
  });

  it('keeps all points when all speeds are within limits', () => {
    const points = [pt(0, 0, sec(0)), pt(0, 0.00004, sec(1)), pt(0, 0.00008, sec(2))];
    expect(RouteFilter.filter(points, 'cycle')).toHaveLength(3);
  });
});
