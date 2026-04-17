/**
 * TypeScript port of `radzi-ml-project/pipeline/featurizer_v1.py` (136 features).
 *
 * This file MUST stay bit-identical (within 1e-4 on float32) to the Python
 * implementation. The parity test in `__tests__/parity.test.ts` enforces this.
 *
 * Input:  a flat sample buffer ordered [accX, accY, accZ, gyroX, gyroY, gyroZ]
 *         per time step. Length must be `windowSize * 6`.
 * Output: Float32Array of length 136.
 */

const EPS = 1e-10;

export interface FeaturizerConfig {
  readonly sampleRateHz: number;
  readonly windowSize: number;
  readonly nFeatures: number;
}

export const DEFAULT_FEATURIZER_CONFIG: FeaturizerConfig = {
  sampleRateHz: 50,
  windowSize: 256,
  nFeatures: 136,
};

export function extractFeatures(
  sensorBuffer: Float32Array,
  config: FeaturizerConfig = DEFAULT_FEATURIZER_CONFIG,
): Float32Array {
  const { windowSize, sampleRateHz, nFeatures } = config;
  if (sensorBuffer.length !== windowSize * 6) {
    throw new Error(
      `featurize: expected ${windowSize * 6} samples, got ${sensorBuffer.length}`,
    );
  }

  const accX = sliceColumn(sensorBuffer, windowSize, 0);
  const accY = sliceColumn(sensorBuffer, windowSize, 1);
  const accZ = sliceColumn(sensorBuffer, windowSize, 2);
  const gyroX = sliceColumn(sensorBuffer, windowSize, 3);
  const gyroY = sliceColumn(sensorBuffer, windowSize, 4);
  const gyroZ = sliceColumn(sensorBuffer, windowSize, 5);
  const accMag = magnitude3(accX, accY, accZ);
  const gyroMag = magnitude3(gyroX, gyroY, gyroZ);

  const out = new Float32Array(nFeatures);
  let offset = 0;

  offset = writeTimeFeatures(out, offset, accX);
  offset = writeFreqFeatures(out, offset, accX, sampleRateHz);
  offset = writeTimeFeatures(out, offset, accY);
  offset = writeFreqFeatures(out, offset, accY, sampleRateHz);
  offset = writeTimeFeatures(out, offset, accZ);
  offset = writeFreqFeatures(out, offset, accZ, sampleRateHz);

  out[offset++] = correlation(accX, accY);
  out[offset++] = correlation(accX, accZ);
  out[offset++] = correlation(accY, accZ);
  out[offset++] = signalMagnitudeAreaXYZ(accX, accY, accZ);

  offset = writeTimeFeatures(out, offset, accMag);
  offset = writeFreqFeatures(out, offset, accMag, sampleRateHz);

  offset = writeTimeFeatures(out, offset, gyroX);
  offset = writeFreqFeatures(out, offset, gyroX, sampleRateHz);
  offset = writeTimeFeatures(out, offset, gyroY);
  offset = writeFreqFeatures(out, offset, gyroY, sampleRateHz);
  offset = writeTimeFeatures(out, offset, gyroZ);
  offset = writeFreqFeatures(out, offset, gyroZ, sampleRateHz);

  out[offset++] = correlation(gyroX, gyroY);
  out[offset++] = correlation(gyroX, gyroZ);
  out[offset++] = correlation(gyroY, gyroZ);
  out[offset++] = signalMagnitudeAreaXYZ(gyroX, gyroY, gyroZ);

  offset = writeTimeFeatures(out, offset, gyroMag);
  offset = writeFreqFeatures(out, offset, gyroMag, sampleRateHz);

  if (offset !== nFeatures) {
    throw new Error(`featurize: wrote ${offset} features, expected ${nFeatures}`);
  }

  // Replace NaN/Inf with 0, matching np.nan_to_num on the Python side.
  for (let i = 0; i < nFeatures; i++) {
    if (!Number.isFinite(out[i])) out[i] = 0;
  }

  return out;
}

function sliceColumn(buf: Float32Array, n: number, col: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf[i * 6 + col];
  return out;
}

function magnitude3(x: Float32Array, y: Float32Array, z: Float32Array): Float32Array {
  const n = x.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sqrt(x[i] * x[i] + y[i] * y[i] + z[i] * z[i]);
  }
  return out;
}

/**
 * 10 time-domain features: mean, std, min, max, q25, q50, q75, energy, skew, kurtosis.
 * `std` uses population formula (ddof=0) to match numpy.
 * `skew`/`kurtosis` match scipy.stats defaults (skew: Fisher-Pearson g1,
 * kurtosis: Fisher excess, bias=True).
 */
function writeTimeFeatures(out: Float32Array, offset: number, signal: Float32Array): number {
  const n = signal.length;

  let sum = 0;
  let min = signal[0];
  let max = signal[0];
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = signal[i];
    sum += v;
    sumSq += v * v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mean = sum / n;

  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  for (let i = 0; i < n; i++) {
    const d = signal[i] - mean;
    const d2 = d * d;
    m2 += d2;
    m3 += d2 * d;
    m4 += d2 * d2;
  }
  m2 /= n;
  m3 /= n;
  m4 /= n;
  const std = Math.sqrt(m2);

  // Match np.percentile default (linear interpolation on sorted data).
  const sorted = Array.from(signal).sort((a, b) => a - b);
  const q25 = percentileLinear(sorted, 25);
  const q50 = percentileLinear(sorted, 50);
  const q75 = percentileLinear(sorted, 75);

  const energy = sumSq / n;

  // scipy.stats.skew(bias=True): g1 = m3 / m2^1.5
  const skew = m2 === 0 ? 0 : m3 / Math.pow(m2, 1.5);
  // scipy.stats.kurtosis(fisher=True, bias=True): g2 = m4 / m2^2 - 3
  const kurtosis = m2 === 0 ? 0 : m4 / (m2 * m2) - 3;

  out[offset + 0] = mean;
  out[offset + 1] = std;
  out[offset + 2] = min;
  out[offset + 3] = max;
  out[offset + 4] = q25;
  out[offset + 5] = q50;
  out[offset + 6] = q75;
  out[offset + 7] = energy;
  out[offset + 8] = skew;
  out[offset + 9] = kurtosis;
  return offset + 10;
}

/**
 * numpy.percentile default (linear) on a sorted array.
 * index = q * (n - 1), interpolated between adjacent sorted values.
 */
function percentileLinear(sortedAsc: number[], q: number): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  if (n === 1) return sortedAsc[0];
  const pos = (q / 100) * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  const frac = pos - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

/**
 * 6 freq-domain features on |rFFT(signal)| with DC bin dropped:
 * dom_freq, dom_freq_mag, spectral_centroid, total_power, freq_mean, freq_std.
 */
function writeFreqFeatures(
  out: Float32Array,
  offset: number,
  signal: Float32Array,
  sampleRateHz: number,
): number {
  const n = signal.length;
  const spectrum = rfftMagnitude(signal);

  const nBins = spectrum.length;
  const binHz = sampleRateHz / n;

  let sum = 0;
  let maxMag = -Infinity;
  let maxIdx = 1;
  let totalPower = 0;
  let weighted = 0;
  for (let k = 1; k < nBins; k++) {
    const mag = spectrum[k];
    const freq = k * binHz;
    sum += mag;
    totalPower += mag * mag;
    weighted += freq * mag;
    if (mag > maxMag) {
      maxMag = mag;
      maxIdx = k;
    }
  }

  const usefulBins = nBins - 1;
  if (usefulBins === 0 || sum === 0) {
    for (let i = 0; i < 6; i++) out[offset + i] = 0;
    return offset + 6;
  }

  const freqMean = sum / usefulBins;
  let varSum = 0;
  for (let k = 1; k < nBins; k++) {
    const d = spectrum[k] - freqMean;
    varSum += d * d;
  }
  const freqStd = Math.sqrt(varSum / usefulBins);

  const spectralCentroid = weighted / (sum + EPS);

  out[offset + 0] = maxIdx * binHz;
  out[offset + 1] = maxMag;
  out[offset + 2] = spectralCentroid;
  out[offset + 3] = totalPower;
  out[offset + 4] = freqMean;
  out[offset + 5] = freqStd;
  return offset + 6;
}

/**
 * Magnitude of the real FFT on a length-N signal, returning length-(N/2+1).
 * Uses an in-place radix-2 iterative Cooley-Tukey on a packed complex buffer.
 * Assumes N is a power of two (256 in practice).
 */
function rfftMagnitude(signal: Float32Array): Float32Array {
  const n = signal.length;
  if ((n & (n - 1)) !== 0) {
    throw new Error(`rfftMagnitude: length ${n} is not a power of 2`);
  }

  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = signal[i];

  fftInPlace(re, im);

  const outLen = (n >>> 1) + 1;
  const out = new Float32Array(outLen);
  for (let k = 0; k < outLen; k++) {
    out[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
  }
  return out;
}

/** Iterative radix-2 FFT (in place, unscaled). */
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // Bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >>> 1;
    for (; j & bit; bit >>>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const halfsize = size >>> 1;
    const tableStep = (-2 * Math.PI) / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < halfsize; j++) {
        const angle = tableStep * j;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const kEven = i + j;
        const kOdd = i + j + halfsize;
        const tre = re[kOdd] * cos - im[kOdd] * sin;
        const tim = re[kOdd] * sin + im[kOdd] * cos;
        re[kOdd] = re[kEven] - tre;
        im[kOdd] = im[kEven] - tim;
        re[kEven] += tre;
        im[kEven] += tim;
      }
    }
  }
}

/**
 * Pearson correlation matching numpy.corrcoef([a,b])[0,1].
 * Returns 0 when either series has zero variance.
 */
function correlation(a: Float32Array, b: Float32Array): number {
  const n = a.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let num = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return 0;
  return num / denom;
}

/** sum(|x|+|y|+|z|) / N — matches `np.sum(np.abs(acc)) / len(acc)`. */
function signalMagnitudeAreaXYZ(
  x: Float32Array,
  y: Float32Array,
  z: Float32Array,
): number {
  const n = x.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    s += Math.abs(x[i]) + Math.abs(y[i]) + Math.abs(z[i]);
  }
  return s / n;
}
