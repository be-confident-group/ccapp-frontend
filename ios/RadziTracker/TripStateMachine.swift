import Foundation
import CoreLocation

protocol TripStateMachineDelegate: AnyObject {
  func stateMachine(_ sm: TripStateMachine, didTransitionTo state: TripStateMachine.State, from previous: TripStateMachine.State)
  func stateMachine(_ sm: TripStateMachine, didStartTrip tripId: String, startTime: Int64, backfillStart: Int64)
  func stateMachine(_ sm: TripStateMachine, didEndTrip tripId: String, endTime: Int64)
  func stateMachine(_ sm: TripStateMachine, didStoreLocation tripId: String, lat: Double, lng: Double, accuracy: Double, speed: Double, timestamp: Int64)
  func stateMachine(_ sm: TripStateMachine, requestAccuracyMode mode: LocationSession.AccuracyMode)
  func stateMachine(_ sm: TripStateMachine, requestImuRunning running: Bool, tripId: String?)
}

final class TripStateMachine {

  enum State: String { case idle, detecting, recording, cooldown, ending }

  struct Config {
    var detectionSustainSeconds: TimeInterval = 15    // 15s sustained walking before entering detecting
    var detectingMinDurationSeconds: TimeInterval = 30 // 30s minimum in detecting before promoting
    var detectingMinDisplacementMeters: Double = 20   // 20m GPS displacement to confirm real movement
    var falseStartGpsDisplacementMeters: Double = 8   // abort detecting if <8m after minDuration (not actually moving)
    var cooldownEnterSeconds: TimeInterval = 30
    var cooldownEndSeconds: TimeInterval = 180
  }

  weak var delegate: TripStateMachineDelegate?
  private(set) var state: State = .idle
  private(set) var currentTripId: String?
  private(set) var currentStagingId: String?
  var config = Config()

  private var detectingStartTime: Date?
  private var stationaryStartTime: Date?
  private var cooldownEnteredAt: Date?
  private var lastMotionActivity: MotionMonitor.Activity = .unknown
  private weak var motionMonitorRef: MotionMonitor?

  /// Fires every 10 s when in recording/cooldown so we can check elapsed-time
  /// thresholds even when CMMA stops delivering new events (which it does once
  /// the device is fully stationary).
  private var stationaryCheckTimer: Timer?
  private let stationaryCheckInterval: TimeInterval = 10

  func bind(motion: MotionMonitor) {
    self.motionMonitorRef = motion
  }

  // MARK: - Inputs

  func onMotionActivity(_ activity: MotionMonitor.Activity, confidence: MotionMonitor.Confidence) {
    self.lastMotionActivity = activity
    switch state {
    case .idle:
      if Self.isMoving(activity) { /* sustain handled by MotionMonitor.watchSustain */ }
    case .detecting:
      break  // Stationary/unknown blips are tolerated. checkDetectingPromotion() aborts
             // if 60s pass with <50m displacement — that's the right false-start gate.
    case .recording:
      if activity == .stationary {
        if stationaryStartTime == nil {
          stationaryStartTime = Date()
          scheduleStationaryCheckTimer()  // Start polling in case CMMA goes silent
        }
        checkRecordingStationaryThreshold()
      } else {
        stationaryStartTime = nil
        cancelStationaryCheckTimer()
      }
    case .cooldown:
      if Self.isMoving(activity) {
        transitionCooldownToRecording()
      } else if activity == .stationary {
        checkCooldownEndingThreshold()
      }
    case .ending:
      break
    }
  }

  func onSustainedMotion(_ activity: MotionMonitor.Activity) {
    if state == .idle && Self.isMoving(activity) {
      transitionIdleToDetecting()
    }
  }

  func onLocation(lat: Double, lng: Double, accuracy: Double, speed: Double, timestamp: Int64) {
    switch state {
    case .idle, .ending:
      return
    case .detecting:
      guard let stagingId = currentStagingId else { return }
      try? TrackingDatabase.shared.insertStagingLocation(
        stagingId: stagingId, lat: lat, lng: lng,
        accuracy: accuracy, speed: speed, timestamp: timestamp
      )
      checkDetectingPromotion()
    case .recording:
      guard let tripId = currentTripId else { return }
      try? TrackingDatabase.shared.insertLocation(
        tripId: tripId, lat: lat, lng: lng, accuracy: accuracy, speed: speed,
        heading: nil, altitude: nil, timestamp: timestamp, accuracyMode: "best"
      )
      try? TrackingDatabase.shared.updateTripUpdatedAt(tripId: tripId, updatedAt: timestamp)
      delegate?.stateMachine(self, didStoreLocation: tripId, lat: lat, lng: lng, accuracy: accuracy, speed: speed, timestamp: timestamp)
    case .cooldown:
      guard let tripId = currentTripId else { return }
      try? TrackingDatabase.shared.insertLocation(
        tripId: tripId, lat: lat, lng: lng, accuracy: accuracy, speed: speed,
        heading: nil, altitude: nil, timestamp: timestamp, accuracyMode: "hundred"
      )
      try? TrackingDatabase.shared.updateTripUpdatedAt(tripId: tripId, updatedAt: timestamp)
    }
  }

  // MARK: - Force start/stop

  func forceStart() throws -> String {
    guard state == .idle else {
      throw NSError(domain: "TripStateMachine", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Cannot force-start: not idle (state=\(state.rawValue))"])
    }
    let tripId = "trip_\(Int64(Date().timeIntervalSince1970 * 1000))_\(Int.random(in: 1000...9999))"
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    try TrackingDatabase.shared.createTrip(id: tripId, startTime: now, backfillStart: now)
    currentTripId = tripId
    transition(to: .recording)
    delegate?.stateMachine(self, didStartTrip: tripId, startTime: now, backfillStart: now)
    delegate?.stateMachine(self, requestAccuracyMode: .best)
    delegate?.stateMachine(self, requestImuRunning: true, tripId: tripId)
    return tripId
  }

  func forceStop() throws {
    guard state == .recording || state == .cooldown else { return }
    transitionCooldownToEnding()
  }

  // MARK: - Transitions

  private func transitionIdleToDetecting() {
    let stagingId = "staging_\(Int64(Date().timeIntervalSince1970 * 1000))"
    currentStagingId = stagingId
    detectingStartTime = Date()
    transition(to: .detecting)
    delegate?.stateMachine(self, requestAccuracyMode: .best)  // best accuracy for reliable displacement measurement
  }

  private func transitionDetectingToIdle(reason: String) {
    if let stagingId = currentStagingId { try? TrackingDatabase.shared.discardStaging(stagingId: stagingId) }
    currentStagingId = nil
    detectingStartTime = nil
    transition(to: .idle)
    delegate?.stateMachine(self, requestAccuracyMode: .off)
    TrackingLogger.shared.log(.info, "TripStateMachine: detecting→idle (\(reason))")
  }

  private func checkDetectingPromotion() {
    guard let start = detectingStartTime, let stagingId = currentStagingId else { return }
    let elapsed = Date().timeIntervalSince(start)
    let displacement = (try? TrackingDatabase.shared.stagingDisplacementMeters(stagingId: stagingId)) ?? 0

    if elapsed >= config.detectingMinDurationSeconds && displacement >= config.detectingMinDisplacementMeters {
      transitionDetectingToRecording()
      return
    }

    if elapsed >= config.detectingMinDurationSeconds && displacement < config.falseStartGpsDisplacementMeters {
      transitionDetectingToIdle(reason: "GPS displacement <\(Int(config.falseStartGpsDisplacementMeters))m after \(Int(elapsed))s")
    }
  }

  private func transitionDetectingToRecording() {
    guard let stagingId = currentStagingId else { return }

    let stagingFirstTs = (try? TrackingDatabase.shared.stagingFirstTimestamp(stagingId: stagingId)) ?? Int64(Date().timeIntervalSince1970 * 1000)
    let tripId = "trip_\(stagingFirstTs)_\(Int.random(in: 1000...9999))"
    var backfillStart = stagingFirstTs

    motionMonitorRef?.queryRecentActivities(lookbackSeconds: 15 * 60) { [weak self] activities in
      guard let self = self else { return }
      let movingActivities = activities.filter { a in a.walking || a.cycling || a.running || a.automotive }
      if let earliestMoving = movingActivities.first {
        let onset = Int64(earliestMoving.startDate.timeIntervalSince1970 * 1000)
        if onset < backfillStart { backfillStart = onset }
      }
      try? TrackingDatabase.shared.updateTripBackfillStart(tripId: tripId, backfillStart: backfillStart)
    }

    do {
      try TrackingDatabase.shared.createTrip(id: tripId, startTime: stagingFirstTs, backfillStart: backfillStart)
      try TrackingDatabase.shared.promoteStagingToTrip(stagingId: stagingId, tripId: tripId)
      currentTripId = tripId
      currentStagingId = nil
      detectingStartTime = nil
      transition(to: .recording)
      delegate?.stateMachine(self, didStartTrip: tripId, startTime: stagingFirstTs, backfillStart: backfillStart)
      delegate?.stateMachine(self, requestAccuracyMode: .best)
      delegate?.stateMachine(self, requestImuRunning: true, tripId: tripId)
    } catch {
      TrackingLogger.shared.log(.error, "TripStateMachine: failed to promote staging — \(error)")
      transitionDetectingToIdle(reason: "DB error")
    }
  }

  private func transitionRecordingToCooldown() {
    cancelStationaryCheckTimer()
    transition(to: .cooldown)
    cooldownEnteredAt = Date()
    delegate?.stateMachine(self, requestAccuracyMode: .hundred)
    delegate?.stateMachine(self, requestImuRunning: false, tripId: currentTripId)
    scheduleStationaryCheckTimer()  // Keep polling during cooldown too
  }

  private func transitionCooldownToRecording() {
    stationaryStartTime = nil
    cooldownEnteredAt = nil
    cancelStationaryCheckTimer()
    transition(to: .recording)
    delegate?.stateMachine(self, requestAccuracyMode: .best)
    delegate?.stateMachine(self, requestImuRunning: true, tripId: currentTripId)
  }

  private func transitionCooldownToEnding() {
    guard let tripId = currentTripId else { return }
    cancelStationaryCheckTimer()
    cooldownEnteredAt = nil
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    try? TrackingDatabase.shared.endTrip(tripId: tripId, endTime: now)
    transition(to: .ending)
    delegate?.stateMachine(self, requestAccuracyMode: .off)
    delegate?.stateMachine(self, requestImuRunning: false, tripId: nil)
    delegate?.stateMachine(self, didEndTrip: tripId, endTime: now)
  }

  func onFinalizationComplete() {
    cancelStationaryCheckTimer()
    currentTripId = nil
    stationaryStartTime = nil
    cooldownEnteredAt = nil
    transition(to: .idle)
  }

  // MARK: - Stationary check timer
  //
  // CMMA stops delivering activity updates once the device is fully still.
  // Without this timer the cooldown/ending thresholds would never fire after
  // the last stationary event.  The timer re-evaluates the same elapsed-time
  // conditions that onMotionActivity() would check on each incoming event.

  private func scheduleStationaryCheckTimer() {
    cancelStationaryCheckTimer()
    guard Thread.isMainThread else {
      DispatchQueue.main.async { [weak self] in self?.scheduleStationaryCheckTimer() }
      return
    }
    stationaryCheckTimer = Timer.scheduledTimer(
      withTimeInterval: stationaryCheckInterval,
      repeats: true
    ) { [weak self] _ in
      self?.onStationaryCheckTick()
    }
  }

  private func cancelStationaryCheckTimer() {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { [weak self] in self?.cancelStationaryCheckTimer() }
      return
    }
    stationaryCheckTimer?.invalidate()
    stationaryCheckTimer = nil
  }

  /// Called every `stationaryCheckInterval` seconds while in recording/cooldown.
  private func onStationaryCheckTick() {
    switch state {
    case .recording:
      checkRecordingStationaryThreshold()
    case .cooldown:
      checkCooldownEndingThreshold()
    default:
      cancelStationaryCheckTimer()
    }
  }

  private func checkRecordingStationaryThreshold() {
    guard let s = stationaryStartTime,
          Date().timeIntervalSince(s) >= config.cooldownEnterSeconds else { return }
    transitionRecordingToCooldown()
  }

  private func checkCooldownEndingThreshold() {
    guard let s = cooldownEnteredAt,
          Date().timeIntervalSince(s) >= config.cooldownEndSeconds else { return }
    transitionCooldownToEnding()
  }

  // MARK: - Helpers

  private func transition(to newState: State) {
    let previous = state
    state = newState
    delegate?.stateMachine(self, didTransitionTo: newState, from: previous)
    TrackingLogger.shared.log(.info, "TripStateMachine: \(previous.rawValue) → \(newState.rawValue)")
  }

  private static func isMoving(_ a: MotionMonitor.Activity) -> Bool {
    a == .walking || a == .running || a == .cycling || a == .automotive
  }
}
