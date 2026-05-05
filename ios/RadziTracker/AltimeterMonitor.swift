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
    var gain = 0.0
    var loss = 0.0
    for i in 1..<samples.count {
      let delta = samples[i].relativeAltitudeM - samples[i - 1].relativeAltitudeM
      if delta > 0 { gain += delta } else { loss += -delta }
    }
    return Aggregate(gainMeters: gain, lossMeters: loss)
  }
}
