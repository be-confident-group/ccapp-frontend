/**
 * DORMANT — DATA COLLECTION ONLY. NOT IN LIVE CLASSIFICATION PATH.
 *
 * Entry point for the XGBoost on-device classifier stack.
 * Exports featurizer and tree evaluator for use by classifier.ts.
 *
 * Trip classification uses Apple's CMMotionActivityManager (CMMA) via
 * lib/services/MotionActivitySegmenter.ts — not this stack.
 * This stack collects IMU windows and predictions for future model training.
 */

export {
  extractFeatures,
  DEFAULT_FEATURIZER_CONFIG,
  type FeaturizerConfig,
} from './featurize';
export {
  loadXgbBooster,
  type XgbBooster,
  type XgbRawModel,
} from './xgbTree';
export {
  getClassifier,
  activityClassToTripType,
  type ActivityClass,
  type ActivityPrediction,
  type ClassifierHandle,
} from './classifier';
export { sensorBuffer } from './sensorBuffer';
export { streamingSegmenter, type LiveActivityState } from './streamingSegmenter';
