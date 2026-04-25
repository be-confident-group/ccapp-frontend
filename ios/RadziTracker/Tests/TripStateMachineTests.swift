import XCTest
@testable import Radzi

final class TripStateMachineTests: XCTestCase {

  final class Capture: TripStateMachineDelegate {
    var transitions: [(TripStateMachine.State, TripStateMachine.State)] = []
    var startedTrips: [(String, Int64, Int64)] = []
    var endedTrips: [(String, Int64)] = []
    var locations: [(String, Double, Double)] = []
    var accuracyRequests: [LocationSession.AccuracyMode] = []
    var imuRequests: [(Bool, String?)] = []

    func stateMachine(_ sm: TripStateMachine, didTransitionTo state: TripStateMachine.State, from previous: TripStateMachine.State) {
      transitions.append((previous, state))
    }
    func stateMachine(_ sm: TripStateMachine, didStartTrip tripId: String, startTime: Int64, backfillStart: Int64) {
      startedTrips.append((tripId, startTime, backfillStart))
    }
    func stateMachine(_ sm: TripStateMachine, didEndTrip tripId: String, endTime: Int64) {
      endedTrips.append((tripId, endTime))
    }
    func stateMachine(_ sm: TripStateMachine, didStoreLocation tripId: String, lat: Double, lng: Double, accuracy: Double, speed: Double, timestamp: Int64) {
      locations.append((tripId, lat, lng))
    }
    func stateMachine(_ sm: TripStateMachine, requestAccuracyMode mode: LocationSession.AccuracyMode) {
      accuracyRequests.append(mode)
    }
    func stateMachine(_ sm: TripStateMachine, requestImuRunning running: Bool, tripId: String?) {
      imuRequests.append((running, tripId))
    }
  }

  func test_idleToDetecting_onSustainedMotion() {
    let sm = TripStateMachine()
    let cap = Capture()
    sm.delegate = cap
    XCTAssertEqual(sm.state, .idle)

    sm.onSustainedMotion(.walking)

    XCTAssertEqual(sm.state, .detecting)
    XCTAssertEqual(cap.accuracyRequests, [.hundred])
    XCTAssertNotNil(sm.currentStagingId)
  }

  func test_detecting_motionRegression_returnsToIdle() {
    let sm = TripStateMachine()
    let cap = Capture()
    sm.delegate = cap
    sm.onSustainedMotion(.walking)
    XCTAssertEqual(sm.state, .detecting)

    sm.onMotionActivity(.stationary, confidence: .medium)

    XCTAssertEqual(sm.state, .idle)
    XCTAssertEqual(cap.accuracyRequests.last, .off)
  }

  func test_recording_stationaryFor30s_transitionsToCooldown() {
    let sm = TripStateMachine()
    let cap = Capture()
    sm.delegate = cap
    sm.config.cooldownEnterSeconds = 0.05
    _ = try? sm.forceStart()
    XCTAssertEqual(sm.state, .recording)

    sm.onMotionActivity(.stationary, confidence: .medium)
    Thread.sleep(forTimeInterval: 0.06)
    sm.onMotionActivity(.stationary, confidence: .medium)

    XCTAssertEqual(sm.state, .cooldown)
    XCTAssertTrue(cap.accuracyRequests.contains(.hundred))
  }

  func test_cooldown_motionResumes_returnsToRecording() {
    let sm = TripStateMachine()
    let cap = Capture()
    sm.delegate = cap
    sm.config.cooldownEnterSeconds = 0.05
    _ = try? sm.forceStart()
    sm.onMotionActivity(.stationary, confidence: .medium)
    Thread.sleep(forTimeInterval: 0.06)
    sm.onMotionActivity(.stationary, confidence: .medium)
    XCTAssertEqual(sm.state, .cooldown)

    sm.onMotionActivity(.walking, confidence: .medium)
    XCTAssertEqual(sm.state, .recording)
  }

  func test_cooldown_stationaryFor3min_transitionsToEnding() {
    let sm = TripStateMachine()
    let cap = Capture()
    sm.delegate = cap
    sm.config.cooldownEnterSeconds = 0.05
    sm.config.cooldownEndSeconds = 0.1
    _ = try? sm.forceStart()
    sm.onMotionActivity(.stationary, confidence: .medium)
    Thread.sleep(forTimeInterval: 0.06)
    sm.onMotionActivity(.stationary, confidence: .medium)
    XCTAssertEqual(sm.state, .cooldown)

    Thread.sleep(forTimeInterval: 0.11)
    sm.onMotionActivity(.stationary, confidence: .medium)

    XCTAssertEqual(sm.state, .ending)
    XCTAssertEqual(cap.endedTrips.count, 1)
    XCTAssertEqual(cap.accuracyRequests.last, .off)
  }

  func test_ending_onFinalizationComplete_returnsToIdle() {
    let sm = TripStateMachine()
    let cap = Capture()
    sm.delegate = cap
    sm.config.cooldownEnterSeconds = 0.05
    sm.config.cooldownEndSeconds = 0.1
    _ = try? sm.forceStart()
    sm.onMotionActivity(.stationary, confidence: .medium)
    Thread.sleep(forTimeInterval: 0.06)
    sm.onMotionActivity(.stationary, confidence: .medium)
    Thread.sleep(forTimeInterval: 0.11)
    sm.onMotionActivity(.stationary, confidence: .medium)
    XCTAssertEqual(sm.state, .ending)

    sm.onFinalizationComplete()

    XCTAssertEqual(sm.state, .idle)
    XCTAssertNil(sm.currentTripId)
  }

  func test_forceStart_fromIdle_jumpsToRecording() {
    let sm = TripStateMachine()
    let cap = Capture()
    sm.delegate = cap
    let tripId = try? sm.forceStart()
    XCTAssertNotNil(tripId)
    XCTAssertEqual(sm.state, .recording)
    XCTAssertEqual(cap.accuracyRequests.last, .best)
    XCTAssertEqual(cap.imuRequests.last?.0, true)
  }

  func test_forceStart_fromNonIdle_throws() {
    let sm = TripStateMachine()
    _ = try? sm.forceStart()
    XCTAssertThrowsError(try sm.forceStart())
  }
}
