/**
 * DORMANT — DATA COLLECTION ONLY. NOT IN LIVE CLASSIFICATION PATH.
 *
 * Runtime glue between per-window XGBoost predictions and the `activity_windows`
 * table. Persists every prediction so that post-hoc analysis tools (e.g.
 * MLSegmentDetector, ShadowClassifierLogger) have data to work with.
 *
 * This module also maintains a live smoothing window for UI hints (e.g. an
 * activity chip during recording). These UI hints are cosmetic only — they
 * do NOT set the final trip type. Final trip type is decided at trip-end by
 * MotionActivitySegmenter (CMMA-based).
 *
 * The smoothing rule: require `CONFIRM_WINDOWS` consecutive windows of the
 * same label above `MIN_CONFIDENCE` before updating the displayed activity.
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
