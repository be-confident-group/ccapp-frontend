import Foundation
import React
import CoreLocation

@objc(RadziTracker)
final class RadziTracker: RCTEventEmitter, MotionMonitorDelegate, LocationSessionDelegate, TripStateMachineDelegate {

  override func supportedEvents() -> [String]! {
    return ["tripStarted", "tripEnded", "activityChanged", "stateChanged", "locationStored"]
  }

  override static func requiresMainQueueSetup() -> Bool { return false }

  private let motion = MotionMonitor()
  private let location = LocationSession()
  private let imu = ImuSampler()
  private let stateMachine = TripStateMachine()
  private var hasListeners = false

  override init() {
    super.init()
    motion.delegate = self
    location.delegate = self
    stateMachine.delegate = self
    stateMachine.bind(motion: motion)
    motion.watchSustain(activity: .walking, seconds: stateMachine.config.detectionSustainSeconds)
    motion.watchSustain(activity: .running, seconds: stateMachine.config.detectionSustainSeconds)
    motion.watchSustain(activity: .cycling, seconds: stateMachine.config.detectionSustainSeconds)
    motion.watchSustain(activity: .automotive, seconds: stateMachine.config.detectionSustainSeconds)
  }

  override func startObserving() { hasListeners = true }
  override func stopObserving()  { hasListeners = false }

  // MARK: - Public API

  @objc(start:rejecter:)
  func start(_ resolve: @escaping RCTPromiseResolveBlock,
             rejecter reject: @escaping RCTPromiseRejectBlock) {
    motion.start()
    resolve(nil)
  }

  @objc(stop:rejecter:)
  func stop(_ resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock) {
    motion.stop()
    location.setMode(.off)
    imu.stop()
    resolve(nil)
  }

  @objc(getStatus:rejecter:)
  func getStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve([
      "state": stateMachine.state.rawValue,
      "activity": motion.currentActivity.rawValue,
      "tripId": stateMachine.currentTripId as Any? ?? NSNull(),
      "stagingId": stateMachine.currentStagingId as Any? ?? NSNull(),
      "gpsAccuracyMode": location.currentMode.rawValue,
      "lastLocationTimestamp": NSNull(),
    ])
  }

  @objc(forceStartTrip:rejecter:)
  func forceStartTrip(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    do {
      let tripId = try stateMachine.forceStart()
      resolve(["tripId": tripId])
    } catch {
      reject("force_start_failed", error.localizedDescription, error)
    }
  }

  @objc(forceStopTrip:rejecter:)
  func forceStopTrip(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    do {
      try stateMachine.forceStop()
      resolve(nil)
    } catch {
      reject("force_stop_failed", error.localizedDescription, error)
    }
  }

  @objc(requestPermissions:rejecter:)
  func requestPermissions(_ resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    location.requestAlwaysPermission()
    motion.queryRecentActivities(lookbackSeconds: 60) { _ in }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
      self?.checkPermissions(resolve, rejecter: reject)
    }
  }

  @objc(checkPermissions:rejecter:)
  func checkPermissions(_ resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    let locStatus = location.currentAuthorization()
    let locStr: String
    switch locStatus {
    case .authorizedAlways: locStr = "granted"
    case .authorizedWhenInUse: locStr = "whenInUse"
    case .denied, .restricted: locStr = "denied"
    case .notDetermined: locStr = "denied"
    @unknown default: locStr = "denied"
    }
    let motionStr = MotionMonitor.isAvailable ? "granted" : "restricted"
    resolve(["location": locStr, "motion": motionStr])
  }

  @objc(setConfig:resolver:rejecter:)
  func setConfig(_ config: NSDictionary,
                 resolver resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    if let v = config["detectionSustainSeconds"] as? Double { stateMachine.config.detectionSustainSeconds = v }
    if let v = config["detectingMinDurationSeconds"] as? Double { stateMachine.config.detectingMinDurationSeconds = v }
    if let v = config["detectingMinDisplacementMeters"] as? Double { stateMachine.config.detectingMinDisplacementMeters = v }
    if let v = config["cooldownEnterSeconds"] as? Double { stateMachine.config.cooldownEnterSeconds = v }
    if let v = config["cooldownEndSeconds"] as? Double { stateMachine.config.cooldownEndSeconds = v }
    resolve(nil)
  }

  @objc(getConfig:rejecter:)
  func getConfig(_ resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve([
      "detectionSustainSeconds": stateMachine.config.detectionSustainSeconds,
      "detectingMinDurationSeconds": stateMachine.config.detectingMinDurationSeconds,
      "detectingMinDisplacementMeters": stateMachine.config.detectingMinDisplacementMeters,
      "cooldownEnterSeconds": stateMachine.config.cooldownEnterSeconds,
      "cooldownEndSeconds": stateMachine.config.cooldownEndSeconds,
      "imuSampleRateHz": ImuSampler.sampleRateHz,
    ])
  }

  // MARK: - MotionMonitorDelegate

  func motionMonitor(_ monitor: MotionMonitor, didChangeActivity activity: MotionMonitor.Activity,
                      confidence: MotionMonitor.Confidence, timestamp: Date) {
    let conf = MotionMonitor.Confidence(rawValue: confidence.rawValue) ?? .low
    stateMachine.onMotionActivity(activity, confidence: conf)

    if hasListeners {
      sendEvent(withName: "activityChanged", body: [
        "activity": activity.rawValue,
        "confidence": confidence.rawValue,
        "timestamp": Int64(timestamp.timeIntervalSince1970 * 1000),
      ])
    }

    if let tripId = stateMachine.currentTripId {
      try? TrackingDatabase.shared.insertMotionSegment(
        tripId: tripId,
        tStart: Int64(timestamp.timeIntervalSince1970 * 1000),
        tEnd: Int64(timestamp.timeIntervalSince1970 * 1000),
        activity: activity.rawValue,
        confidence: confidence.rawValue,
        source: "cmma"
      )
    }
  }

  func motionMonitor(_ monitor: MotionMonitor, didSustainActivity activity: MotionMonitor.Activity,
                      forSeconds seconds: TimeInterval) {
    stateMachine.onSustainedMotion(activity)
  }

  // MARK: - LocationSessionDelegate

  func locationSession(_ session: LocationSession, didReceive location: CLLocation, mode: LocationSession.AccuracyMode) {
    let ts = Int64(location.timestamp.timeIntervalSince1970 * 1000)
    stateMachine.onLocation(
      lat: location.coordinate.latitude,
      lng: location.coordinate.longitude,
      accuracy: location.horizontalAccuracy,
      speed: max(location.speed, 0),
      timestamp: ts
    )
  }

  func locationSession(_ session: LocationSession, didChangeAuthorization status: CLAuthorizationStatus) {
    TrackingLogger.shared.log(.info, "Location authorization changed: \(status.rawValue)")
  }

  func locationSession(_ session: LocationSession, didFailWithError error: Error) {
    TrackingLogger.shared.log(.error, "Location error: \(error.localizedDescription)")
  }

  // MARK: - TripStateMachineDelegate

  func stateMachine(_ sm: TripStateMachine, didTransitionTo state: TripStateMachine.State, from previous: TripStateMachine.State) {
    if hasListeners {
      sendEvent(withName: "stateChanged", body: [
        "state": state.rawValue,
        "previousState": previous.rawValue,
        "timestamp": Int64(Date().timeIntervalSince1970 * 1000),
      ])
    }
  }

  func stateMachine(_ sm: TripStateMachine, didStartTrip tripId: String, startTime: Int64, backfillStart: Int64) {
    if hasListeners {
      sendEvent(withName: "tripStarted", body: [
        "tripId": tripId, "startTime": startTime, "backfillStart": backfillStart,
      ])
    }
  }

  func stateMachine(_ sm: TripStateMachine, didEndTrip tripId: String, endTime: Int64) {
    if hasListeners {
      sendEvent(withName: "tripEnded", body: [
        "tripId": tripId, "endTime": endTime,
      ])
    }
  }

  func stateMachine(_ sm: TripStateMachine, didStoreLocation tripId: String, lat: Double, lng: Double, accuracy: Double, speed: Double, timestamp: Int64) {
    if hasListeners {
      sendEvent(withName: "locationStored", body: [
        "tripId": tripId, "lat": lat, "lng": lng,
        "accuracy": accuracy, "speed": speed, "timestamp": timestamp,
      ])
    }
  }

  func stateMachine(_ sm: TripStateMachine, requestAccuracyMode mode: LocationSession.AccuracyMode) {
    location.setMode(mode)
  }

  func stateMachine(_ sm: TripStateMachine, requestImuRunning running: Bool, tripId: String?) {
    if running {
      if let id = tripId { imu.attach(tripId: id) }
      imu.start()
    } else {
      imu.pause()
    }
  }
}
