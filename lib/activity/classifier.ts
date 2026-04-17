/**
 * On-device activity classifier.
 *
 * Bundles the XGBoost model + feature config that ship in
 * `ccapp-frontend/assets/model/` and exposes a single `predict()` that takes
 * a 256×6 sample window and returns a class label + probabilities.
 *
 * The class labels are the 4-class set the model was trained on:
 * `walking`, `cycling`, `running`, `vehicle`.
 */

import { DEFAULT_FEATURIZER_CONFIG, extractFeatures, type FeaturizerConfig } from './featurize';
import { loadXgbBooster, type XgbBooster, type XgbRawModel } from './xgbTree';

// Model assets bundled via Metro. These are loaded once at startup.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_JSON = require('../../assets/model/best_model.json') as XgbRawModel;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FEATURE_CONFIG = require('../../assets/model/feature_config.json') as {
  classes: readonly string[];
  feature_names: readonly string[];
  n_features: number;
  sample_rate_hz: number;
  window_size: number;
  frame_shift: number;
  sensors: readonly string[];
  featurizer_version?: string;
};

export type ActivityClass = 'walking' | 'cycling' | 'running' | 'vehicle';

export interface ActivityPrediction {
  label: ActivityClass;
  labelIndex: number;
  confidence: number;
  probs: Float32Array;
}

export interface ClassifierHandle {
  readonly classes: readonly ActivityClass[];
  readonly config: FeaturizerConfig;
  predict(window: Float32Array): ActivityPrediction;
}

let _handle: ClassifierHandle | null = null;

export function getClassifier(): ClassifierHandle {
  if (_handle) return _handle;

  const booster = loadXgbBooster(MODEL_JSON);
  const classes = FEATURE_CONFIG.classes as readonly ActivityClass[];
  if (classes.length !== booster.numClass) {
    throw new Error(
      `feature_config classes (${classes.length}) ≠ model num_class (${booster.numClass})`,
    );
  }
  if (FEATURE_CONFIG.n_features !== booster.numFeature) {
    throw new Error(
      `feature_config n_features (${FEATURE_CONFIG.n_features}) ≠ model num_feature (${booster.numFeature})`,
    );
  }

  const config: FeaturizerConfig = {
    sampleRateHz: FEATURE_CONFIG.sample_rate_hz,
    windowSize: FEATURE_CONFIG.window_size,
    nFeatures: FEATURE_CONFIG.n_features,
  };

  _handle = {
    classes,
    config,
    predict(window: Float32Array): ActivityPrediction {
      const features = extractFeatures(window, config);
      const probs = booster.predictProba(features);
      let best = 0;
      let bestP = probs[0];
      for (let c = 1; c < probs.length; c++) {
        if (probs[c] > bestP) {
          bestP = probs[c];
          best = c;
        }
      }
      return {
        label: classes[best],
        labelIndex: best,
        confidence: bestP,
        probs,
      };
    },
  };

  return _handle;
}

/**
 * Map an ML class to the Trip taxonomy used by the app/backend.
 */
export function activityClassToTripType(label: ActivityClass): 'walk' | 'cycle' | 'run' | 'drive' {
  switch (label) {
    case 'walking':
      return 'walk';
    case 'cycling':
      return 'cycle';
    case 'running':
      return 'run';
    case 'vehicle':
      return 'drive';
  }
}
