import CoreMotion
import Foundation

final class AltimeterMonitor {
  struct Aggregate {
    let gainMeters: Double?
    let lossMeters: Double?
  }

  private let altimeter = CMAltimeter()
  private let queue = OperationQueue()
  private var samples: [(timestamp: Date, relativeAltitudeM: Double)] = []
  private let lock = NSLock()

  static var isAvailable: Bool { CMAltimeter.isRelativeAltitudeAvailable() }

  func start() {
    guard Self.isAvailable else { return }
    altimeter.startRelativeAltitudeUpdates(to: queue) { [weak self] data, _ in
      guard let self, let data else { return }
      self.lock.lock(); defer { self.lock.unlock() }
      self.samples.append((Date(), data.relativeAltitude.doubleValue))
    }
  }

  func stopAndDrain() -> [(timestamp: Date, relativeAltitudeM: Double)] {
    altimeter.stopRelativeAltitudeUpdates()
    lock.lock(); defer { lock.unlock() }
    let drained = samples
    samples = []
    return drained
  }

  static func aggregate(samples: [(timestamp: Date, relativeAltitudeM: Double)]) -> Aggregate {
    guard samples.count >= 3 else { return Aggregate(gainMeters: nil, lossMeters: nil) }
    // 3 m dead-band: only commit gain/loss once altitude moves >= 3 m from the last baseline.
    // Suppresses barometric sensor oscillations (door openings, pressure transients, etc.).
    let threshold = 3.0
    var gain = 0.0
    var loss = 0.0
    var baseline = samples[0].relativeAltitudeM
    for i in 1..<samples.count {
      let diff = samples[i].relativeAltitudeM - baseline
      if diff >= threshold {
        gain += diff
        baseline = samples[i].relativeAltitudeM
      } else if diff <= -threshold {
        loss += -diff
        baseline = samples[i].relativeAltitudeM
      }
    }
    return Aggregate(gainMeters: gain, lossMeters: loss)
  }
}
