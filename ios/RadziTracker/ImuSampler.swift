import Foundation
import CoreMotion

/// Samples accelerometer + gyroscope at 50 Hz using CMDeviceMotion.
/// Buffers data for 60 s, then flushes a JSON batch into sensor_batches via TrackingDatabase.
final class ImuSampler {

  private let manager = CMMotionManager()
  private var bufferAcc: [[String: Any]] = []
  private var bufferGyro: [[String: Any]] = []
  private var flushTimer: Timer?
  private let bufferQueue = DispatchQueue(label: "com.radzi.imu.buffer")
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
      self.bufferQueue.async { [weak self] in
        guard let self = self else { return }
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
    }
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.flushTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
        self?.flush()
      }
    }
    TrackingLogger.shared.log(.info, "ImuSampler: started @ \(Self.sampleRateHz) Hz")
  }

  func pause() {
    guard isRunning else { return }
    manager.stopDeviceMotionUpdates()
    flushTimer?.invalidate()
    flushTimer = nil
    isRunning = false
    flush()
    TrackingLogger.shared.log(.info, "ImuSampler: paused")
  }

  func stop() {
    pause()
    flush()
  }

  private func flush() {
    var accSnapshot: [[String: Any]] = []
    var gyroSnapshot: [[String: Any]] = []
    bufferQueue.sync {
      accSnapshot = self.bufferAcc
      gyroSnapshot = self.bufferGyro
      self.bufferAcc.removeAll()
      self.bufferGyro.removeAll()
    }
    guard let tripId = self.tripId else { return }
    if accSnapshot.isEmpty && gyroSnapshot.isEmpty { return }

    // Pair each accel sample with the closest gyro sample
    var interleaved: [[String: Any]] = []
    var gi = 0
    for a in accSnapshot {
      while gi + 1 < gyroSnapshot.count,
            let aT = a["t"] as? Int64,
            let gNext = gyroSnapshot[gi+1]["t"] as? Int64,
            let gCur = gyroSnapshot[gi]["t"] as? Int64,
            abs(gNext - aT) <= abs(gCur - aT) {
        gi += 1
      }
      let g = gi < gyroSnapshot.count ? gyroSnapshot[gi] : ["x": 0, "y": 0, "z": 0]
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
    } catch {
      TrackingLogger.shared.log(.error, "ImuSampler: flush failed — \(error)")
    }
  }
}
