import Foundation
import CoreLocation
import CoreMotion

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

  /// Seconds of sustained GPS+motion activity required before promoting to .detecting.
  /// Also used as the GPS stabilization window for the immediate-start path.
  static let gpsStabilizationTimeoutSeconds: TimeInterval = 8

  struct Config {
    var detectionSustainSeconds: TimeInterval = TripStateMachine.gpsStabilizationTimeoutSeconds
    var detectingMinDurationSeconds: TimeInterval = 60  // minimum detecting duration before promoting
    var detectingMinDisplacementMeters: Double = 30     // GPS displacement required to confirm real movement
    var falseStartGpsDisplacementMeters: Double = 15    // abort detecting if below this after minDuration
    var detectingAccuracyThresholdM: Double = 20        // strict — cold-start GPS at ±100–500 m corrupts displacement math
    var recordingAccuracyThresholdM: Double = 65        // relaxed — urban-canyon pedestrian fixes naturally sit 20–50 m
    var detectingMinPedometerSteps: Int = 40            // pedometer fallback for urban-canyon promotion
    var cooldownEnterSeconds: TimeInterval = 30
    var cooldownEndSeconds: TimeInterval = 180
    var multiWindowVoteSec: TimeInterval = 20           // vote window for multi-sample CMMA type selection
    var allowLowConfidenceWalking: Bool = true          // allow low-confidence walking through MotionMonitor
  }

  weak var delegate: TripStateMachineDelegate?
  private(set) var state: State = .idle
  private(set) var currentTripId: String?
  private(set) var currentTripType: String?
  private(set) var currentStagingId: String?
  var config = Config()

  private let reconciler: ActivityHistoryReconciler

  private var detectingStartTime: Date?
  private var stationaryStartTime: Date?
  private var cooldownEnteredAt: Date?
  private var lastMotionActivity: MotionMonitor.Activity = .unknown
  private weak var motionMonitorRef: MotionMonitor?

  // Multi-window CMMA vote state (B.2)
  private var voteBuffer: [(type: String, weight: Int)] = []
  private var voteTimer: Timer?

  // Pedometer corroboration state (B.4)
  private var detectingPedometerSteps: Int = 0
  private var detectingPedometerQueried = false
  private let pedometer = CMPedometer()

  /// Fires every 10 s when in recording/cooldown so we can check elapsed-time
  /// thresholds even when CMMA stops delivering new events (which it does once
  /// the device is fully stationary).
  private var stationaryCheckTimer: Timer?
  private let stationaryCheckInterval: TimeInterval = 10
  private let altimeter = AltimeterMonitor()

  init() {
    reconciler = ActivityHistoryReconciler(
      motion: ProductionMotionSource(),
      pedometer: ProductionPedometerSource()
    )
  }

  func bind(motion: MotionMonitor) {
    self.motionMonitorRef = motion
  }

  // MARK: - Inputs

  /// Called by MotionMonitor when CMMotionActivityManager reports a new activity.
  /// Implements a multi-window vote: buffers samples for `multiWindowVoteSec` before
  /// starting a trip, so a brief walking window before boarding a train can't lock the
  /// type as "walk". High-confidence samples short-circuit immediately.
  func handleMotionUpdate(activity: MotionMonitor.Activity, confidence: MotionMonitor.Confidence) {
    guard state == .idle else { return }

    // Allow low-confidence walking through if configured (B.6 — catches urban canyon walks).
    let isLowConfWalking = confidence == .low && activity == .walking && config.allowLowConfidenceWalking
    guard confidence != .low || isLowConfWalking else { return }

    let type: String
    switch activity {
    case .walking:    type = "walk"
    case .running:    type = "run"
    case .cycling:    type = "cycle"
    case .automotive: type = "drive"   // B.1 — now handled instead of silently dropped
    default: return
    }

    // High-confidence: short-circuit the vote window and start immediately.
    if confidence == .high {
      cancelVoteTimer()
      voteBuffer.removeAll()
      immediateStartTrip(type: type, classificationSource: "apple_motion")
      return
    }

    // Medium (or allowed low-confidence walking): accumulate into vote buffer.
    let weight = confidence == .medium ? 2 : 1
    voteBuffer.append((type: type, weight: weight))

    // Start the vote timer if not already running.
    if voteTimer == nil {
      scheduleVoteTimer()
    }
  }

  private func scheduleVoteTimer() {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { [weak self] in self?.scheduleVoteTimer() }
      return
    }
    let interval = config.multiWindowVoteSec
    voteTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
      self?.commitVote()
    }
  }

  private func cancelVoteTimer() {
    voteTimer?.invalidate()
    voteTimer = nil
    voteBuffer.removeAll()
  }

  private func commitVote() {
    defer { voteBuffer.removeAll(); voteTimer = nil }
    guard state == .idle, !voteBuffer.isEmpty else { return }
    var scores: [String: Int] = [:]
    for entry in voteBuffer { scores[entry.type, default: 0] += entry.weight }
    guard let winnerType = scores.max(by: { $0.value < $1.value })?.key else { return }
    immediateStartTrip(type: winnerType, classificationSource: "apple_motion")
  }

  func onMotionActivity(_ activity: MotionMonitor.Activity, confidence: MotionMonitor.Confidence) {
    // Immediate-start path for high/medium confidence classifications
    handleMotionUpdate(activity: activity, confidence: confidence)

    self.lastMotionActivity = activity
    switch state {
    case .idle:
      if Self.isMoving(activity) { /* sustain handled by MotionMonitor.watchSustain */ }
    case .detecting:
      break  // Stationary/unknown blips are tolerated. checkDetectingPromotion() aborts
             // if 60s pass with <50m displacement — that's the right false-start gate.
    case .recording:
      if Self.isMoving(activity) {
        stationaryStartTime = nil
        cancelStationaryCheckTimer()
      } else {
        if stationaryStartTime == nil {
          stationaryStartTime = Date()
          scheduleStationaryCheckTimer()  // Start polling in case CMMA goes silent
        }
        checkRecordingStationaryThreshold()
      }
    case .cooldown:
      if Self.isMoving(activity) {
        transitionCooldownToRecording()
      } else {
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
      // B.3: Drop low-accuracy fixes — cold-start GPS at ±100–500 m corrupts displacement maths.
      guard accuracy <= config.detectingAccuracyThresholdM else {
        TrackingLogger.shared.log(.info, "TripStateMachine: detecting — dropped low-accuracy fix (\(Int(accuracy))m)")
        return
      }
      guard let stagingId = currentStagingId else { return }
      try? TrackingDatabase.shared.insertStagingLocation(
        stagingId: stagingId, lat: lat, lng: lng,
        accuracy: accuracy, speed: speed, timestamp: timestamp
      )
      checkDetectingPromotion()
    case .recording:
      // Relaxed gate during recording — once we know we're moving, noisy 20–50 m fixes
      // still aggregate into useful displacement and shouldn't starve walking trips.
      guard accuracy <= config.recordingAccuracyThresholdM else {
        TrackingLogger.shared.log(.info, "TripStateMachine: recording — dropped low-accuracy fix (\(Int(accuracy))m)")
        return
      }
      guard let tripId = currentTripId else { return }
      try? TrackingDatabase.shared.insertLocation(
        tripId: tripId, lat: lat, lng: lng, accuracy: accuracy, speed: speed,
        heading: nil, altitude: nil, timestamp: timestamp, accuracyMode: "best"
      )
      try? TrackingDatabase.shared.updateTripUpdatedAt(tripId: tripId, updatedAt: timestamp)
      delegate?.stateMachine(self, didStoreLocation: tripId, lat: lat, lng: lng, accuracy: accuracy, speed: speed, timestamp: timestamp)
    case .cooldown:
      // B.10: Skip GPS insertion during cooldown entirely. The device is in .hundred mode
      // (100 m accuracy) and these fixes don't add value — they just corrupt distance stats.
      break
    }
  }

  // MARK: - Immediate-start (Apple Motion classification)

  /// Bypasses the detecting phase and transitions directly to .recording when
  /// CMMotionActivityManager reports a walk/run/cycle with medium+ confidence.
  private func immediateStartTrip(type: String, classificationSource: String) {
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    let tripId = "trip_\(now)_\(Int.random(in: 1000...9999))"
    do {
      try TrackingDatabase.shared.createTrip(id: tripId, startTime: now, backfillStart: now,
                                              type: type, classificationSource: classificationSource)
      currentTripId = tripId
      currentTripType = type
      transition(to: .recording)
      delegate?.stateMachine(self, didStartTrip: tripId, startTime: now, backfillStart: now)
      delegate?.stateMachine(self, requestAccuracyMode: .best)
      delegate?.stateMachine(self, requestImuRunning: true, tripId: tripId)
      altimeter.start()
    } catch {
      TrackingLogger.shared.log(.error, "TripStateMachine: immediateStartTrip failed — \(error)")
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
    altimeter.start()
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
    cancelVoteTimer()  // Cancel any in-progress vote window; detecting path takes over.
    let stagingId = "staging_\(Int64(Date().timeIntervalSince1970 * 1000))"
    currentStagingId = stagingId
    detectingStartTime = Date()
    detectingPedometerSteps = 0
    detectingPedometerQueried = false
    transition(to: .detecting)
    delegate?.stateMachine(self, requestAccuracyMode: .best)
  }

  private func transitionDetectingToIdle(reason: String) {
    if let stagingId = currentStagingId { try? TrackingDatabase.shared.discardStaging(stagingId: stagingId) }
    currentStagingId = nil
    detectingStartTime = nil
    detectingPedometerSteps = 0
    detectingPedometerQueried = false
    transition(to: .idle)
    delegate?.stateMachine(self, requestAccuracyMode: .off)
    TrackingLogger.shared.log(.info, "TripStateMachine: detecting→idle (\(reason))")
  }

  private func checkDetectingPromotion() {
    guard let start = detectingStartTime, let stagingId = currentStagingId else { return }
    let elapsed = Date().timeIntervalSince(start)
    let displacement = (try? TrackingDatabase.shared.stagingDisplacementMeters(stagingId: stagingId)) ?? 0

    guard elapsed >= config.detectingMinDurationSeconds else { return }

    // GPS displacement sufficient → promote.
    if displacement >= config.detectingMinDisplacementMeters {
      transitionDetectingToRecording()
      return
    }

    // B.4: Query pedometer once for step-count corroboration (catches urban-canyon / indoor walks).
    if !detectingPedometerQueried {
      detectingPedometerQueried = true
      if CMPedometer.isStepCountingAvailable() {
        let queryFrom = start
        pedometer.queryPedometerData(from: queryFrom, to: Date()) { [weak self] data, _ in
          DispatchQueue.main.async {
            guard let self, self.state == .detecting else { return }
            self.detectingPedometerSteps = data?.numberOfSteps.intValue ?? 0
            TrackingLogger.shared.log(.info, "TripStateMachine: pedometer steps in detecting window: \(self.detectingPedometerSteps)")
            self.checkDetectingPromotion()
          }
        }
      }
      return  // Wait for the async result before deciding.
    }

    // Pedometer shows real movement → promote even without GPS displacement.
    if detectingPedometerSteps >= config.detectingMinPedometerSteps {
      transitionDetectingToRecording()
      return
    }

    // B.4: Only abort if BOTH GPS displacement AND pedometer steps are below threshold.
    if displacement < config.falseStartGpsDisplacementMeters && detectingPedometerSteps < config.detectingMinPedometerSteps {
      transitionDetectingToIdle(reason: "GPS <\(Int(config.falseStartGpsDisplacementMeters))m, steps=\(detectingPedometerSteps) after \(Int(elapsed))s")
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
      altimeter.start()
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
    // Don't drain yet — trip may resume. Just stop the hardware.
    altimeter.stopAndDrain().forEach { s in
      guard let tripId = currentTripId else { return }
      try? TrackingDatabase.shared.insertAltitudeSample(tripId: tripId, timestamp: s.timestamp, altitudeM: s.relativeAltitudeM)
    }
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
    altimeter.start()
    delegate?.stateMachine(self, requestAccuracyMode: .best)
    delegate?.stateMachine(self, requestImuRunning: true, tripId: currentTripId)
  }

  private func transitionCooldownToEnding() {
    guard let tripId = currentTripId else { return }
    cancelStationaryCheckTimer()
    cooldownEnteredAt = nil
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    let endStats = try? TrackingDatabase.shared.endTrip(tripId: tripId, endTime: now)
    transition(to: .ending)
    delegate?.stateMachine(self, requestAccuracyMode: .off)
    delegate?.stateMachine(self, requestImuRunning: false, tripId: nil)
    let drained = altimeter.stopAndDrain()
    if let tripId = currentTripId {
      for s in drained {
        try? TrackingDatabase.shared.insertAltitudeSample(tripId: tripId, timestamp: s.timestamp, altitudeM: s.relativeAltitudeM)
      }
      let allSamples = (try? TrackingDatabase.shared.loadAltitudeSamples(tripId: tripId)) ?? []
      let agg = AltimeterMonitor.aggregate(samples: allSamples.map { (timestamp: $0.0, relativeAltitudeM: $0.1) })
      try? TrackingDatabase.shared.updateTripElevation(tripId: tripId, gainM: agg.gainMeters, lossM: agg.lossMeters)
    }

    // B.7: Reject trivially short/empty trips. If GPS distance and location count are
    // both below minimums, check pedometer. Only notify JS if the trip is worth keeping.
    let distanceM = endStats?.distanceMeters ?? 0
    let locationCount = endStats?.locationCount ?? 0
    let durationSec = endStats?.durationSec ?? 0
    let shouldCheckPedometer = distanceM < 50.0 && locationCount < 3

    if shouldCheckPedometer && CMPedometer.isStepCountingAvailable() {
      // Use recorded duration to compute trip start; fall back to 5 min window.
      let tripStartMs = durationSec > 0 ? (Double(now) - Double(durationSec) * 1000.0) : (Double(now) - 300_000)
      let tripStartDate = Date(timeIntervalSince1970: tripStartMs / 1000.0)
      let capturedTripId = tripId
      pedometer.queryPedometerData(from: tripStartDate, to: Date()) { [weak self] data, _ in
        let steps = data?.numberOfSteps.intValue ?? 0
        DispatchQueue.main.async {
          guard let self else { return }
          if steps >= self.config.detectingMinPedometerSteps || distanceM >= 50.0 {
            // Keep the trip — pedometer shows real movement.
            TrackingLogger.shared.log(.info, "TripStateMachine: kept short trip \(capturedTripId) via pedometer (steps=\(steps), dist=\(Int(distanceM))m)")
            self.finishEndingTrip(tripId: capturedTripId, endTime: now)
          } else {
            // Cancel — neither GPS nor pedometer shows real movement.
            TrackingLogger.shared.log(.info, "TripStateMachine: cancelled 0m trip \(capturedTripId) (steps=\(steps), dist=\(Int(distanceM))m, locs=\(locationCount))")
            TrackingDatabase.shared.cancelTrip(tripId: capturedTripId, reason: "0m rejection: steps=\(steps), dist=\(Int(distanceM))m")
            self.finishEndingNoNotify()
          }
        }
      }
    } else {
      finishEndingTrip(tripId: tripId, endTime: now)
    }
  }

  private func finishEndingTrip(tripId: String, endTime: Int64) {
    DispatchQueue.global(qos: .utility).async { [weak self] in
      guard let self else { return }
      let reconcileNow = Date()
      let covered = (try? TrackingDatabase.shared.recentTripWindows(within: 35 * 60, of: reconcileNow)) ?? []
      let synthesized = self.reconciler.reconcile(now: reconcileNow, lookbackMinutes: 35, alreadyCovered: covered)
      for syn in synthesized {
        guard let dist = syn.distanceM, dist > 0 else {
          TrackingLogger.shared.log(.info, "TripStateMachine: skipping 0-distance synthesized trip (pedometer nil)")
          continue
        }
        let id = "syn_\(Int(syn.start.timeIntervalSince1970))"
        try? TrackingDatabase.shared.insertSynthesizedTrip(
          id: id, start: syn.start, end: syn.end,
          type: syn.activity == .walking ? "walk" : "cycle",
          distanceM: dist,
          classificationSource: "apple_motion"
        )
      }
    }
    delegate?.stateMachine(self, didEndTrip: tripId, endTime: endTime)
  }

  private func finishEndingNoNotify() {
    // Trip was cancelled — don't notify JS. JS will not attempt to finalize it.
    // onFinalizationComplete() still needs to be called to reset state; fire it directly.
    cancelStationaryCheckTimer()
    currentTripId = nil
    stationaryStartTime = nil
    cooldownEnteredAt = nil
    transition(to: .idle)
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

// MARK: - Reconciler backfill

extension TripStateMachine {
  func reconcilerBackfill(now: Date, covered: [(start: Date, end: Date)]) -> [SynthesizedSubTrip] {
    reconciler.reconcile(now: now, lookbackMinutes: 35, alreadyCovered: covered)
  }
}

// MARK: - Rehydration (force-quit recovery)

extension TripStateMachine {
  func rehydrateIfNeeded() {
    guard let stale = try? TrackingDatabase.shared.findStaleRecordingTrip(staleAfterMs: 0) else { return }
    // There's an active native trip from a prior session — reattach to it.
    currentTripId = stale.id
    currentTripType = (try? TrackingDatabase.shared.loadTripType(tripId: stale.id)) ?? "walk"
    transition(to: .recording)
    altimeter.start()
    TrackingLogger.shared.log(.info, "TripStateMachine: rehydrated trip \(stale.id)")
    delegate?.stateMachine(self, didStartTrip: stale.id, startTime: stale.lastUpdate, backfillStart: stale.lastUpdate)
    delegate?.stateMachine(self, requestAccuracyMode: .best)
    delegate?.stateMachine(self, requestImuRunning: true, tripId: stale.id)
  }
}

// MARK: - Production motion/pedometer sources (private)

private final class ProductionMotionSource: MotionHistorySource {
  private let manager = CMMotionActivityManager()
  func queryActivities(from: Date, to: Date, completion: @escaping ([CMMotionActivity]) -> Void) {
    guard CMMotionActivityManager.isActivityAvailable() else { completion([]); return }
    manager.queryActivityStarting(from: from, to: to, to: OperationQueue.main) { activities, _ in
      completion(activities ?? [])
    }
  }
}

private final class ProductionPedometerSource: PedometerSource {
  private let pedometer = CMPedometer()
  func distanceMeters(from: Date, to: Date, completion: @escaping (Double?) -> Void) {
    guard CMPedometer.isDistanceAvailable() else { completion(nil); return }
    pedometer.queryPedometerData(from: from, to: to) { data, _ in
      completion(data?.distance?.doubleValue)
    }
  }
}

// MARK: - Test helpers (DEBUG only)

#if DEBUG
extension TripStateMachine {
  static func makeForTest() -> TripStateMachine {
    return TripStateMachine()
  }
}
#endif
