/**
 * Runtime glue between per-window predictions and the rest of the app.
 *
 * Responsibilities:
 *  - Persist every window prediction to the `activity_windows` table so that
 *    post-hoc segmentation (`MLSegmentDetector`) has data to work with.
 *  - Maintain a small smoothing window that represents the "currently shown"
 *    activity for the active trip (used for live UI hints like a chip or
 *    badge). This is NOT the final trip type — that is decided when the
 *    trip is stopped by `MLSegmentDetector`.
 *  - Notify a single subscriber (TrackingContext) of live activity changes.
 *
 * The smoothing rule is simple and intentional: require `CONFIRM_WINDOWS`
 * consecutive windows of the same label above `MIN_CONFIDENCE` before we
 * update the live activity. This kills jitter at the cost of ~5 s latency.
 */

import { database } from '../database';
import type { ActivityClass, ActivityPrediction } from './classifier';

const CONFIRM_WINDOWS = 2; // need 2 consecutive windows (≈5 s) to switch
const MIN_CONFIDENCE = 0.55;

export interface LiveActivityState {
  tripId: string;
  label: ActivityClass;
  confidence: number;
  updatedAt: number;
}

type Listener = (state: LiveActivityState | null) => void;

interface WriteInput {
  tripId: string;
  tStart: number;
  tEnd: number;
  prediction: ActivityPrediction;
}

class StreamingSegmenter {
  private tripId: string | null = null;
  private current: LiveActivityState | null = null;
  private pendingLabel: ActivityClass | null = null;
  private pendingCount = 0;
  private listener: Listener | null = null;

  setListener(listener: Listener | null): void {
    this.listener = listener;
  }

  attachTrip(tripId: string): void {
    this.tripId = tripId;
    this.current = null;
    this.pendingLabel = null;
    this.pendingCount = 0;
    this.listener?.(null);
  }

  detachTrip(): void {
    this.tripId = null;
    this.current = null;
    this.pendingLabel = null;
    this.pendingCount = 0;
    this.listener?.(null);
  }

  getCurrent(): LiveActivityState | null {
    return this.current;
  }

  getDebugState() {
    return {
      tripId: this.tripId,
      current: this.current,
      pendingLabel: this.pendingLabel,
      pendingCount: this.pendingCount,
      confirmWindowsNeeded: 2,
    };
  }

  async writeWindow(input: WriteInput): Promise<void> {
    if (!this.tripId || input.tripId !== this.tripId) {
      // Window arrived for a stale trip (trip ended between predict and write).
      return;
    }

    try {
      await database.insertActivityWindow({
        trip_id: input.tripId,
        t_start: input.tStart,
        t_end: input.tEnd,
        label: input.prediction.label,
        confidence: input.prediction.confidence,
        probs_json: JSON.stringify(Array.from(input.prediction.probs)),
      });
    } catch (err) {
      console.error('[streamingSegmenter] Failed to persist activity_window:', err);
    }

    this.updateLive(input);
  }

  private updateLive(input: WriteInput): void {
    const { label, confidence } = input.prediction;
    if (confidence < MIN_CONFIDENCE) return;

    if (this.pendingLabel === label) {
      this.pendingCount++;
    } else {
      this.pendingLabel = label;
      this.pendingCount = 1;
    }

    const already = this.current?.label === label;
    if (already) {
      this.current = {
        tripId: input.tripId,
        label,
        confidence,
        updatedAt: input.tEnd,
      };
      this.listener?.(this.current);
      return;
    }

    if (this.pendingCount >= CONFIRM_WINDOWS) {
      this.current = {
        tripId: input.tripId,
        label,
        confidence,
        updatedAt: input.tEnd,
      };
      this.listener?.(this.current);
    }
  }
}

export const streamingSegmenter = new StreamingSegmenter();
