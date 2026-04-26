import { database } from '../database';
import { getClassifier } from '../activity/classifier';
import type { ClassifierDisagreement, MotionSegment } from '../database';

const WINDOW_SIZE = 256;
const FRAME_SHIFT = 128;

const CMMA_TO_XGB_LABEL: Record<MotionSegment['activity'], string | null> = {
  walking: 'walking',
  running: 'running',
  cycling: 'cycling',
  automotive: 'vehicle',
  stationary: null,
  unknown: null,
};

interface SensorFrame { t: number; ax: number; ay: number; az: number; gx: number; gy: number; gz: number; }

export class ShadowClassifierLogger {
  static async run(tripId: string): Promise<void> {
    try {
      const batches = await database.getSensorBatchesByTrip(tripId);
      if (batches.length === 0) return;
      const segments = await database.getMotionSegmentsByTrip(tripId);
      if (segments.length === 0) return;

      const allFrames: SensorFrame[] = [];
      for (const b of batches) {
        const parsed = JSON.parse(b.payload_json) as { data?: SensorFrame[] };
        if (parsed.data) allFrames.push(...parsed.data);
      }
      if (allFrames.length < WINDOW_SIZE) return;
      allFrames.sort((a, b) => a.t - b.t);

      const classifier = getClassifier();
      const disagreements: ClassifierDisagreement[] = [];

      for (let i = 0; i + WINDOW_SIZE <= allFrames.length; i += FRAME_SHIFT) {
        const window = new Float32Array(WINDOW_SIZE * 6);
        for (let j = 0; j < WINDOW_SIZE; j++) {
          const f = allFrames[i + j];
          const o = j * 6;
          window[o + 0] = f.ax; window[o + 1] = f.ay; window[o + 2] = f.az;
          window[o + 3] = f.gx; window[o + 4] = f.gy; window[o + 5] = f.gz;
        }
        const midT = allFrames[i + Math.floor(WINDOW_SIZE / 2)].t;
        const xgb = classifier.predict(window);
        const seg = segments.find(s => midT >= s.t_start && midT <= s.t_end);
        if (!seg) continue;
        const cmmaLabel = CMMA_TO_XGB_LABEL[seg.activity];
        if (!cmmaLabel) continue;
        if (xgb.label !== cmmaLabel) {
          disagreements.push({
            trip_id: tripId,
            t: midT,
            xgb_label: xgb.label,
            cmma_label: seg.activity,
            xgb_conf: xgb.confidence,
          });
        }
      }

      if (disagreements.length > 0) {
        await database.insertClassifierDisagreements(disagreements);
        console.log(`[ShadowClassifier] ${disagreements.length} disagreements for ${tripId}`);
      }
    } catch (err) {
      console.warn(`[ShadowClassifier] error: ${String(err)}`);
    }
  }
}
