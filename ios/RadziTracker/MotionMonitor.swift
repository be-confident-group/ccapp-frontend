import Foundation
import CoreMotion

protocol MotionMonitorDelegate: AnyObject {
  func motionMonitor(_ monitor: MotionMonitor,
                     didChangeActivity activity: MotionMonitor.Activity,
                     confidence: MotionMonitor.Confidence,
                     timestamp: Date)
  func motionMonitor(_ monitor: MotionMonitor,
                     didSustainActivity activity: MotionMonitor.Activity,
                     forSeconds seconds: TimeInterval)
}

final class MotionMonitor {
  enum Activity: String {
    case stationary, walking, running, cycling, automotive, unknown
  }
  enum Confidence: String {
    case low, medium, high
  }

  weak var delegate: MotionMonitorDelegate?

  private let manager = CMMotionActivityManager()
  private let opQueue = OperationQueue()
  private(set) var currentActivity: Activity = .unknown
  private(set) var currentConfidence: Confidence = .low
  private var currentSince: Date?
  private var sustainTimer: Timer?
  private var sustainTargets: [(activity: Activity, seconds: TimeInterval)] = []

  init() {
    opQueue.maxConcurrentOperationCount = 1
  }

  static var isAvailable: Bool {
    CMMotionActivityManager.isActivityAvailable()
  }

  func start() {
    guard Self.isAvailable else {
      TrackingLogger.shared.log(.warn, "MotionMonitor: CMMotionActivityManager not available")
      return
    }
    manager.startActivityUpdates(to: opQueue) { [weak self] activity in
      guard let self = self, let activity = activity else { return }
      self.handle(activity: activity)
    }
    TrackingLogger.shared.log(.info, "MotionMonitor: started")
  }

  func stop() {
    manager.stopActivityUpdates()
    sustainTimer?.invalidate()
    sustainTimer = nil
    TrackingLogger.shared.log(.info, "MotionMonitor: stopped")
  }

  func watchSustain(activity: Activity, seconds: TimeInterval) {
    sustainTargets.append((activity, seconds))
    rescheduleSustainTimer()
  }

  func clearSustainTargets() {
    sustainTargets.removeAll()
    sustainTimer?.invalidate()
    sustainTimer = nil
  }

  func queryRecentActivities(lookbackSeconds: TimeInterval,
                             completion: @escaping ([CMMotionActivity]) -> Void) {
    guard Self.isAvailable else { completion([]); return }
    let end = Date()
    let start = end.addingTimeInterval(-lookbackSeconds)
    manager.queryActivityStarting(from: start, to: end, to: opQueue) { activities, _ in
      completion(activities ?? [])
    }
  }

  // MARK: - Private

  private func handle(activity: CMMotionActivity) {
    let new = Self.classify(activity)
    let conf = Self.mapConfidence(activity.confidence)
    guard conf != .low else {
      TrackingLogger.shared.log(.info, "MotionMonitor: low-confidence ignored (\(new.rawValue))")
      return
    }
    let prev = currentActivity
    if new != prev {
      currentActivity = new
      currentConfidence = conf
      currentSince = Date()
      DispatchQueue.main.async {
        self.delegate?.motionMonitor(self, didChangeActivity: new, confidence: conf, timestamp: Date())
      }
      rescheduleSustainTimer()
    } else {
      currentConfidence = conf
    }
  }

  private func rescheduleSustainTimer() {
    sustainTimer?.invalidate()
    let now = Date()
    let since = currentSince ?? now
    var nextFire: TimeInterval = .infinity
    for target in sustainTargets where target.activity == currentActivity {
      let elapsed = now.timeIntervalSince(since)
      let remaining = target.seconds - elapsed
      if remaining <= 0 {
        DispatchQueue.main.async {
          self.delegate?.motionMonitor(self, didSustainActivity: target.activity,
                                       forSeconds: target.seconds)
        }
      } else if remaining < nextFire {
        nextFire = remaining
      }
    }
    if nextFire != .infinity {
      sustainTimer = Timer.scheduledTimer(withTimeInterval: nextFire, repeats: false) { [weak self] _ in
        self?.rescheduleSustainTimer()
      }
    }
  }

  private static func classify(_ a: CMMotionActivity) -> Activity {
    if a.stationary { return .stationary }
    if a.walking    { return .walking }
    if a.running    { return .running }
    if a.cycling    { return .cycling }
    if a.automotive { return .automotive }
    return .unknown
  }

  private static func mapConfidence(_ c: CMMotionActivityConfidence) -> Confidence {
    switch c {
    case .low:    return .low
    case .medium: return .medium
    case .high:   return .high
    @unknown default: return .low
    }
  }
}

// MARK: - Test helpers (DEBUG only)

#if DEBUG
extension MotionMonitor {
  func _test_simulate(activity: Activity, confidence: Confidence) {
    guard confidence != .low else {
      TrackingLogger.shared.log(.info, "MotionMonitor: low-confidence ignored (\(activity.rawValue))")
      return
    }
    let prev = currentActivity
    if activity != prev {
      currentActivity = activity
      currentConfidence = confidence
      currentSince = Date()
      delegate?.motionMonitor(self, didChangeActivity: activity, confidence: confidence, timestamp: Date())
      rescheduleSustainTimer()
    } else {
      currentConfidence = confidence
    }
  }
}
#endif
