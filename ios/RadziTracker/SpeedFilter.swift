import Foundation

enum FilterableActivity {
  case walking, running, cycling

  var ceilingKmh: Double {
    switch self {
    case .walking: return 12
    case .running: return 30
    case .cycling: return 60
    }
  }
}

enum SpeedFilter {
  static let accuracyThresholdM: Double = 20

  /// Returns the highest legitimate speed after filtering:
  /// 1. Drop points with horizontal accuracy > 20 m
  /// 2. Drop points above the activity ceiling
  /// 3. Drop spikes > 1.5× the local 95th percentile (±5-point window)
  /// Returns nil if fewer than 5 valid points remain after filtering.
  static func maxSpeed(
    speedsKmh: [Double],
    horizontalAccuraciesM: [Double],
    activity: FilterableActivity
  ) -> Double? {
    precondition(speedsKmh.count == horizontalAccuraciesM.count)

    let accurate: [Double] = zip(speedsKmh, horizontalAccuraciesM)
      .filter { $0.1 <= accuracyThresholdM && $0.0 <= activity.ceilingKmh }
      .map { $0.0 }

    guard accurate.count >= 5 else { return nil }

    var kept: [Double] = []
    for i in 0..<accurate.count {
      let lo = max(0, i - 5)
      let hi = min(accurate.count - 1, i + 5)
      let window = accurate[lo...hi].sorted()
      let p95idx = Int(Double(window.count - 1) * 0.95)
      let p95 = window[p95idx]
      if accurate[i] <= 1.5 * p95 {
        kept.append(accurate[i])
      }
    }

    guard kept.count >= 5 else { return nil }
    return kept.max()
  }
}
