import Foundation
import CoreMotion

/// Samples accelerometer + gyroscope at 50 Hz using CMDeviceMotion.
/// Buffers data for 60 s, then flushes a JSON batch into sensor_batches via TrackingDatabase.
final class ImuSampler {

  private let manager = CMMotionManager()
  private var bufferAcc: [[String: Any]] = []
  private var bufferGyro: [[String: Any]] = []
  private var flushTimer: Timer?
  private var batchSeq = 0
  private var tripId: String?
  private(set) var isRunning = false

  static let sampleRateHz: Double = 50

  func attach(tripId: String) {
    self.tripId = tripId
    self.batchSeq = 0
  }

  func detach() {
    flush()
    self.tripId = nil
  }

  func start() {
    guard !isRunning, manager.isDeviceMotionAvailable else {
      TrackingLogger.shared.log(.warn, "ImuSampler: device motion unavailable")
      return
    }
    isRunning = true
    manager.deviceMotionUpdateInterval = 1.0 / Self.sampleRateHz
    manager.startDeviceMotionUpdates(to: OperationQueue()) { [weak self] motion, _ in
      guard let self = self, let m = motion else { return }
      let t = Int64(Date().timeIntervalSince1970 * 1000)
      self.bufferAcc.append([
        "t": t,
        "x": m.userAcceleration.x,
        "y": m.userAcceleration.y,
        "z": m.userAcceleration.z,
      ])
      self.bufferGyro.append([
        "t": t,
        "x": m.rotationRate.x,
        "y": m.rotationRate.y,
        "z": m.rotationRate.z,
      ])
    }
    flushTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
      self?.flush()
    }
    TrackingLogger.shared.log(.info, "ImuSampler: started @ \(Self.sampleRateHz) Hz")
  }

  func pause() {
    guard isRunning else { return }
    manager.stopDeviceMotionUpdates()
    flushTimer?.invalidate()
    flushTimer = nil
    isRunning = false
    TrackingLogger.shared.log(.info, "ImuSampler: paused")
  }

  func stop() {
    pause()
    flush()
  }

  private func flush() {
    guard let tripId = tripId else {
      bufferAcc.removeAll(); bufferGyro.removeAll(); return
    }
    if bufferAcc.isEmpty && bufferGyro.isEmpty { return }

    // Pair each accel sample with the closest gyro sample
    var interleaved: [[String: Any]] = []
    var gi = 0
    for a in bufferAcc {
      while gi + 1 < bufferGyro.count,
            let aT = a["t"] as? Int64,
            let gNext = bufferGyro[gi+1]["t"] as? Int64,
            let gCur = bufferGyro[gi]["t"] as? Int64,
            abs(gNext - aT) <= abs(gCur - aT) {
        gi += 1
      }
      let g = gi < bufferGyro.count ? bufferGyro[gi] : ["x": 0, "y": 0, "z": 0]
      interleaved.append([
        "t": a["t"] ?? 0,
        "ax": a["x"] ?? 0, "ay": a["y"] ?? 0, "az": a["z"] ?? 0,
        "gx": g["x"] ?? 0, "gy": g["y"] ?? 0, "gz": g["z"] ?? 0,
      ])
    }
    let payload: [String: Any] = ["data": interleaved]

    do {
      let json = try JSONSerialization.data(withJSONObject: payload, options: [])
      let str = String(data: json, encoding: .utf8) ?? "{}"
      try TrackingDatabase.shared.insertSensorBatch(tripId: tripId, seq: batchSeq, payloadJson: str)
      batchSeq += 1
      bufferAcc.removeAll()
      bufferGyro.removeAll()
    } catch {
      TrackingLogger.shared.log(.error, "ImuSampler: flush failed — \(error)")
    }
  }
}
