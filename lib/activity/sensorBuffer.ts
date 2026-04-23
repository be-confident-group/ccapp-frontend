/**
 * IMU ring buffer + window driver.
 *
 * Subscribes to `expo-sensors` Accelerometer and Gyroscope, linearly resamples
 * each stream onto a shared 50 Hz grid, maintains a 256-sample ring buffer,
 * and emits a prediction every 128 new samples (≈2.56 s). Also keeps a raw
 * 60-second rolling chunk that gets flushed into the `sensor_batches` table
 * for later retraining.
 *
 * Background caveat: `expo-sensors` may be unreliable on some devices in the
 * background. However, since the location foreground service keeps the JS thread alive,
 * we attempt to keep sensors running so the ML model can classify background trips.
 * If no samples are received, the app falls back to the legacy speed-based classifier.
 */

import { AppState, type AppStateStatus } from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { getClassifier, type ActivityPrediction } from './classifier';
import { streamingSegmenter } from './streamingSegmenter';
import { database } from '../database';

type SensorSubscription = { remove: () => void };

const SAMPLE_RATE_HZ = 50;
const SAMPLE_PERIOD_MS = 1000 / SAMPLE_RATE_HZ; // 20 ms
const WINDOW_SIZE = 256;
const FRAME_SHIFT = 128;
const RAW_BATCH_FLUSH_INTERVAL_MS = 60_000;

type RawSensorTriple = { t: number; x: number; y: number; z: number };

export interface SensorBufferListener {
  onPrediction?: (prediction: ActivityPrediction & { windowStart: number; windowEnd: number }) => void;
}

class SensorBuffer {
  private accelSub: SensorSubscription | null = null;
  private gyroSub: SensorSubscription | null = null;
  private running = false;
  private tripId: string | null = null;

  // Staging buffers for each axis keyed by raw sensor timestamps (ms since epoch).
  private accQueue: RawSensorTriple[] = [];
  private gyroQueue: RawSensorTriple[] = [];

  // Next uniform grid timestamp we need to emit into the ring buffer (ms).
  private nextGridTime: number | null = null;

  // Ring buffer of resampled 6-axis samples, flat layout [ax,ay,az,gx,gy,gz] per step.
  private ring = new Float32Array(WINDOW_SIZE * 6);
  private ringCursor = 0; // write index (wraps at WINDOW_SIZE)
  private samplesSeen = 0; // total samples ever written
  private samplesSinceLastWindow = 0;

  // Rolling raw batch (uncompressed), flushed to `sensor_batches` every 60 s.
  private rawBatch: RawSensorTriple[] = [];
  private rawBatchGyro: RawSensorTriple[] = [];
  private rawBatchSeq = 0;
  private rawBatchTimer: ReturnType<typeof setInterval> | null = null;

  private appStateSub: { remove: () => void } | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private listener: SensorBufferListener = {};

  // Debug-only snapshots — updated on every sample / prediction.
  private _lastAccel: { x: number; y: number; z: number } | null = null;
  private _lastGyro: { x: number; y: number; z: number } | null = null;
  private _lastPrediction: (ActivityPrediction & { windowStart: number; windowEnd: number }) | null = null;

  setListener(listener: SensorBufferListener) {
    this.listener = listener;
  }

  /**
   * Begin subscribing to sensors. Safe to call multiple times.
   * Sensors only stream while the app is in the foreground.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      getClassifier();
    } catch (err) {
      console.error('[sensorBuffer] Failed to load classifier:', err);
      this.running = false;
      throw err;
    }

    this.appStateSub = AppState.addEventListener('change', this.handleAppStateChange);
    this.appState = AppState.currentState;

    await this.startSubscriptions();

    if (!this.rawBatchTimer) {
      this.rawBatchTimer = setInterval(() => {
        void this.flushRawBatch();
      }, RAW_BATCH_FLUSH_INTERVAL_MS);
    }

    console.log('[sensorBuffer] started');
  }

  /**
   * Stop subscriptions, flush any remaining raw data. Idempotent.
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
    if (this.rawBatchTimer) {
      clearInterval(this.rawBatchTimer);
      this.rawBatchTimer = null;
    }

    await this.stopSubscriptions();
    await this.flushRawBatch();

    this.resetStreams();
    this.tripId = null;
    console.log('[sensorBuffer] stopped');
  }

  /**
   * Tie subsequent window predictions and raw batches to a given tripId.
   * Resets sample/window counters so the first window for the trip has index 0.
   */
  attachTrip(tripId: string): void {
    this.tripId = tripId;
    streamingSegmenter.attachTrip(tripId);
    this.samplesSinceLastWindow = 0;
    this.rawBatchSeq = 0;
    this.rawBatch = [];
    this.rawBatchGyro = [];
    console.log(`[sensorBuffer] attached to trip ${tripId}`);
  }

  /**
   * Flush any remaining raw data for the current trip and detach.
   */
  async detachTrip(): Promise<void> {
    if (!this.tripId) return;
    await this.flushRawBatch();
    streamingSegmenter.detachTrip();
    console.log(`[sensorBuffer] detached from trip ${this.tripId}`);
    this.tripId = null;
  }

  getActiveTripId(): string | null {
    return this.tripId;
  }

  private handleAppStateChange = (next: AppStateStatus): void => {
    this.appState = next;
    // We used to stop/start subscriptions here, but we now want them
    // to continue running in the background if possible.
  };

  private async startSubscriptions(): Promise<void> {
    if (this.accelSub || this.gyroSub) return;

    try {
      await Accelerometer.setUpdateInterval(SAMPLE_PERIOD_MS);
      await Gyroscope.setUpdateInterval(SAMPLE_PERIOD_MS);
      this.accelSub = Accelerometer.addListener((ev) => this.onAccel(ev));
      this.gyroSub = Gyroscope.addListener((ev) => this.onGyro(ev));
    } catch (err) {
      console.error('[sensorBuffer] Failed to subscribe to sensors:', err);
      await this.stopSubscriptions();
    }
  }

  private async stopSubscriptions(): Promise<void> {
    if (this.accelSub) {
      this.accelSub.remove();
      this.accelSub = null;
    }
    if (this.gyroSub) {
      this.gyroSub.remove();
      this.gyroSub = null;
    }
    try {
      Accelerometer.removeAllListeners();
      Gyroscope.removeAllListeners();
    } catch {
      // sensors not available on this device — swallow
    }
  }

  private onAccel(ev: { x: number; y: number; z: number; timestamp?: number }): void {
    const t = nowMs(ev.timestamp);
    this._lastAccel = { x: ev.x, y: ev.y, z: ev.z };
    this.accQueue.push({ t, x: ev.x, y: ev.y, z: ev.z });
    this.rawBatch.push({ t, x: ev.x, y: ev.y, z: ev.z });
    this.trimQueue(this.accQueue);
    this.drain();
  }

  private onGyro(ev: { x: number; y: number; z: number; timestamp?: number }): void {
    const t = nowMs(ev.timestamp);
    this._lastGyro = { x: ev.x, y: ev.y, z: ev.z };
    this.gyroQueue.push({ t, x: ev.x, y: ev.y, z: ev.z });
    this.rawBatchGyro.push({ t, x: ev.x, y: ev.y, z: ev.z });
    this.trimQueue(this.gyroQueue);
    this.drain();
  }

  /** Keep the raw queues bounded (at most 4 seconds of history). */
  private trimQueue(q: RawSensorTriple[]): void {
    if (q.length < 2) return;
    const cutoff = q[q.length - 1].t - 4000;
    while (q.length > 2 && q[1].t < cutoff) q.shift();
  }

  /**
   * Emit resampled 50 Hz samples into the ring buffer as long as we have
   * both an accelerometer and gyroscope sample on either side of the next
   * grid time. Linear interpolation both channels.
   */
  private drain(): void {
    if (this.accQueue.length < 2 || this.gyroQueue.length < 2) return;

    if (this.nextGridTime === null) {
      const start = Math.max(this.accQueue[0].t, this.gyroQueue[0].t);
      this.nextGridTime = start;
    }

    while (
      this.nextGridTime !== null &&
      this.nextGridTime <= this.accQueue[this.accQueue.length - 1].t &&
      this.nextGridTime <= this.gyroQueue[this.gyroQueue.length - 1].t
    ) {
      const t: number = this.nextGridTime!;
      const a = interpolate(this.accQueue, t);
      const g = interpolate(this.gyroQueue, t);
      if (a && g) {
        this.writeSample(a.x, a.y, a.z, g.x, g.y, g.z);
      }
      this.nextGridTime = t + SAMPLE_PERIOD_MS;
    }
  }

  private writeSample(ax: number, ay: number, az: number, gx: number, gy: number, gz: number): void {
    const i = this.ringCursor * 6;
    this.ring[i + 0] = ax;
    this.ring[i + 1] = ay;
    this.ring[i + 2] = az;
    this.ring[i + 3] = gx;
    this.ring[i + 4] = gy;
    this.ring[i + 5] = gz;
    this.ringCursor = (this.ringCursor + 1) % WINDOW_SIZE;
    this.samplesSeen++;
    this.samplesSinceLastWindow++;

    if (this.samplesSeen >= WINDOW_SIZE && this.samplesSinceLastWindow >= FRAME_SHIFT) {
      this.samplesSinceLastWindow = 0;
      this.runPrediction();
    }
  }

  private runPrediction(): void {
    if (!this.tripId) return;
    const window = this.snapshotWindow();
    let prediction: ActivityPrediction;
    try {
      prediction = getClassifier().predict(window);
    } catch (err) {
      console.error('[sensorBuffer] predict failed:', err);
      return;
    }

    const now = Date.now();
    const windowEnd = now;
    const windowStart = now - (WINDOW_SIZE * SAMPLE_PERIOD_MS);

    void streamingSegmenter.writeWindow({
      tripId: this.tripId,
      tStart: windowStart,
      tEnd: windowEnd,
      prediction,
    });

    const payload = { ...prediction, windowStart, windowEnd };
    this._lastPrediction = payload;
    if (this.listener.onPrediction) {
      this.listener.onPrediction(payload);
    }
  }

  /** Copy the ring buffer into a contiguous window in the correct time order. */
  private snapshotWindow(): Float32Array {
    const out = new Float32Array(WINDOW_SIZE * 6);
    const start = this.ringCursor; // oldest sample lives here after wrap
    for (let i = 0; i < WINDOW_SIZE; i++) {
      const src = ((start + i) % WINDOW_SIZE) * 6;
      const dst = i * 6;
      out[dst + 0] = this.ring[src + 0];
      out[dst + 1] = this.ring[src + 1];
      out[dst + 2] = this.ring[src + 2];
      out[dst + 3] = this.ring[src + 3];
      out[dst + 4] = this.ring[src + 4];
      out[dst + 5] = this.ring[src + 5];
    }
    return out;
  }

  private resetStreams(): void {
    this.accQueue = [];
    this.gyroQueue = [];
    this.nextGridTime = null;
    this.ring = new Float32Array(WINDOW_SIZE * 6);
    this.ringCursor = 0;
    this.samplesSeen = 0;
    this.samplesSinceLastWindow = 0;
  }

  private async flushRawBatch(): Promise<void> {
    if (!this.tripId) {
      this.rawBatch = [];
      this.rawBatchGyro = [];
      return;
    }
    if (this.rawBatch.length === 0 && this.rawBatchGyro.length === 0) return;

    // Build an interleaved array matching the backend SensorDataBatch schema:
    // { data: [{ t, ax, ay, az, gx, gy, gz }, ...] }
    // We pair each accelerometer reading with the nearest gyroscope reading by time.
    const accArr = this.rawBatch;
    const gyroArr = this.rawBatchGyro;
    const interleaved: Array<{
      t: number; ax: number; ay: number; az: number;
      gx: number; gy: number; gz: number;
    }> = [];

    let gi = 0;
    for (const a of accArr) {
      // Advance gyro pointer to the closest sample by timestamp
      while (
        gi + 1 < gyroArr.length &&
        Math.abs(gyroArr[gi + 1].t - a.t) <= Math.abs(gyroArr[gi].t - a.t)
      ) {
        gi++;
      }
      const g = gyroArr[gi] ?? { x: 0, y: 0, z: 0 };
      interleaved.push({ t: a.t, ax: a.x, ay: a.y, az: a.z, gx: g.x, gy: g.y, gz: g.z });
    }

    // Backend endpoint expects: POST /api/trips/{id}/sensor-data/  body: { data: [...] }
    const payload = { data: interleaved };

    try {
      await database.insertSensorBatch({
        trip_id: this.tripId,
        seq: this.rawBatchSeq,
        payload_json: JSON.stringify(payload),
      });
      this.rawBatchSeq++;
      this.rawBatch = [];
      this.rawBatchGyro = [];
    } catch (err) {
      console.error('[sensorBuffer] Failed to persist raw batch:', err);
    }
  }

  getDebugState() {
    return {
      running: this.running,
      appState: this.appState as string,
      tripId: this.tripId,
      samplesSeen: this.samplesSeen,
      samplesSinceLastWindow: this.samplesSinceLastWindow,
      bufferFillPct: this.samplesSeen >= 256 ? 100 : Math.round((this.samplesSeen / 256) * 100),
      nextWindowInSamples: Math.max(0, 128 - this.samplesSinceLastWindow),
      lastAccel: this._lastAccel,
      lastGyro: this._lastGyro,
      lastPrediction: this._lastPrediction,
    };
  }
}

function interpolate(q: RawSensorTriple[], t: number): { x: number; y: number; z: number } | null {
  if (q.length < 2) return null;
  if (t <= q[0].t) return { x: q[0].x, y: q[0].y, z: q[0].z };
  if (t >= q[q.length - 1].t) {
    const last = q[q.length - 1];
    return { x: last.x, y: last.y, z: last.z };
  }
  // Binary search for the pair (q[i], q[i+1]) surrounding t.
  let lo = 0;
  let hi = q.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (q[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = q[lo];
  const b = q[hi];
  const span = b.t - a.t;
  if (span <= 0) return { x: a.x, y: a.y, z: a.z };
  const frac = (t - a.t) / span;
  return {
    x: a.x + (b.x - a.x) * frac,
    y: a.y + (b.y - a.y) * frac,
    z: a.z + (b.z - a.z) * frac,
  };
}

/**
 * expo-sensors emits `timestamp` in seconds (since device boot on iOS, since
 * UTC epoch on Android). Treat any value < 1e10 as a relative high-resolution
 * timestamp and fall back to `Date.now()` for ordering between events.
 */
function nowMs(tsSec?: number): number {
  if (typeof tsSec === 'number' && tsSec >= 1e10) return tsSec;
  return Date.now();
}

export const sensorBuffer = new SensorBuffer();
