/**
 * Minimal XGBoost booster evaluator that reads the native JSON produced by
 * `xgboost.Booster.save_model(path.json)` and runs multi-class softmax inference.
 *
 * Target: the booster exported by `radzi-ml-project/pipeline/export.py` for
 * the shipped `best_model.pkl` (multi:softprob, 4 classes, gbtree).
 *
 * This is intentionally tiny — no native deps, no reflection on internals
 * beyond what is required for feature-vector → class-probability scoring.
 */

export type XgbRawModel = {
  learner: {
    learner_model_param: {
      base_score: string;
      num_class: string;
      num_feature: string;
      [k: string]: string;
    };
    objective: { name: string; softmax_multiclass_param?: { num_class: string } };
    gradient_booster: {
      name: string;
      model: {
        tree_info: number[];
        trees: XgbRawTree[];
      };
    };
  };
  version?: unknown;
};

type XgbRawTree = {
  left_children: number[];
  right_children: number[];
  split_conditions: number[];
  split_indices: number[];
  default_left: number[];
};

interface CompiledTree {
  readonly left: Int32Array;
  readonly right: Int32Array;
  readonly splitIndex: Int32Array;
  readonly splitValue: Float32Array;
  readonly defaultLeft: Uint8Array;
}

export interface XgbBooster {
  readonly numClass: number;
  readonly numFeature: number;
  predictProba(features: Float32Array): Float32Array;
  predict(features: Float32Array): number;
}

export function loadXgbBooster(raw: XgbRawModel): XgbBooster {
  const learner = raw.learner;
  if (!learner) throw new Error('XGB JSON missing "learner"');
  if (learner.gradient_booster.name !== 'gbtree') {
    throw new Error(
      `Unsupported gradient_booster: ${learner.gradient_booster.name} (only gbtree)`,
    );
  }
  if (
    learner.objective.name !== 'multi:softprob' &&
    learner.objective.name !== 'multi:softmax'
  ) {
    throw new Error(`Unsupported objective: ${learner.objective.name}`);
  }

  const numClass = parseInt(learner.learner_model_param.num_class, 10);
  const numFeature = parseInt(learner.learner_model_param.num_feature, 10);
  if (!(numClass > 1) || !(numFeature > 0)) {
    throw new Error(`Invalid XGB param: num_class=${numClass}, num_feature=${numFeature}`);
  }

  const baseScores = parseBaseScoreArray(
    learner.learner_model_param.base_score,
    numClass,
  );

  const rawTrees = learner.gradient_booster.model.trees;
  const treeInfo = learner.gradient_booster.model.tree_info;
  if (rawTrees.length !== treeInfo.length) {
    throw new Error(
      `tree_info length ${treeInfo.length} ≠ trees length ${rawTrees.length}`,
    );
  }

  const trees: CompiledTree[] = rawTrees.map(compileTree);
  const treeClass = Int32Array.from(treeInfo);

  function predictProba(features: Float32Array): Float32Array {
    if (features.length !== numFeature) {
      throw new Error(
        `predict: expected ${numFeature} features, got ${features.length}`,
      );
    }

    const margins = new Float32Array(numClass);
    for (let c = 0; c < numClass; c++) margins[c] = baseScores[c];

    for (let t = 0; t < trees.length; t++) {
      margins[treeClass[t]] += scoreTree(trees[t], features);
    }

    return softmax(margins);
  }

  function predict(features: Float32Array): number {
    const probs = predictProba(features);
    let best = 0;
    let bestP = probs[0];
    for (let c = 1; c < probs.length; c++) {
      if (probs[c] > bestP) {
        bestP = probs[c];
        best = c;
      }
    }
    return best;
  }

  return { numClass, numFeature, predictProba, predict };
}

function compileTree(tree: XgbRawTree): CompiledTree {
  const n = tree.left_children.length;
  if (
    tree.right_children.length !== n ||
    tree.split_conditions.length !== n ||
    tree.split_indices.length !== n ||
    tree.default_left.length !== n
  ) {
    throw new Error('Tree arrays have inconsistent lengths');
  }
  return {
    left: Int32Array.from(tree.left_children),
    right: Int32Array.from(tree.right_children),
    splitIndex: Int32Array.from(tree.split_indices),
    splitValue: Float32Array.from(tree.split_conditions),
    defaultLeft: Uint8Array.from(tree.default_left),
  };
}

function scoreTree(tree: CompiledTree, features: Float32Array): number {
  let node = 0;
  const { left, right, splitIndex, splitValue, defaultLeft } = tree;
  while (left[node] !== -1) {
    const featIdx = splitIndex[node];
    const value = features[featIdx];
    if (Number.isNaN(value)) {
      node = defaultLeft[node] ? left[node] : right[node];
    } else if (value < splitValue[node]) {
      node = left[node];
    } else {
      node = right[node];
    }
  }
  return splitValue[node];
}

function softmax(margins: Float32Array): Float32Array {
  const n = margins.length;
  let maxM = margins[0];
  for (let i = 1; i < n; i++) if (margins[i] > maxM) maxM = margins[i];
  let sum = 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = Math.exp(margins[i] - maxM);
    out[i] = v;
    sum += v;
  }
  if (sum > 0) {
    for (let i = 0; i < n; i++) out[i] /= sum;
  } else {
    const uniform = 1 / n;
    for (let i = 0; i < n; i++) out[i] = uniform;
  }
  return out;
}

/**
 * Parse base_score, which XGBoost ships as a stringified vector:
 *     "[5.428549E-1,2.3566139E-1,-1.3213711E0,5.428549E-1]"
 * Falls back to a single scalar repeated per class if that's how the
 * exporter stored it (older XGBoost).
 */
function parseBaseScoreArray(raw: string, numClass: number): Float32Array {
  const cleaned = raw.trim().replace(/^\[/, '').replace(/\]$/, '');
  const parts = cleaned.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === numClass) {
    return Float32Array.from(parts.map(Number));
  }
  if (parts.length === 1) {
    const v = Number(parts[0]);
    const out = new Float32Array(numClass);
    for (let i = 0; i < numClass; i++) out[i] = v;
    return out;
  }
  throw new Error(
    `Cannot parse base_score="${raw}" into ${numClass} values (got ${parts.length})`,
  );
}
