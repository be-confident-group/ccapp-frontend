import XCTest
@testable import Radzi

final class MotionMonitorTests: XCTestCase {

  final class CapturingDelegate: MotionMonitorDelegate {
    var changes: [(MotionMonitor.Activity, MotionMonitor.Confidence)] = []
    var sustains: [(MotionMonitor.Activity, TimeInterval)] = []

    func motionMonitor(_ monitor: MotionMonitor,
                       didChangeActivity activity: MotionMonitor.Activity,
                       confidence: MotionMonitor.Confidence,
                       timestamp: Date) {
      changes.append((activity, confidence))
    }
    func motionMonitor(_ monitor: MotionMonitor,
                       didSustainActivity activity: MotionMonitor.Activity,
                       forSeconds seconds: TimeInterval) {
      sustains.append((activity, seconds))
    }
  }

  func test_lowConfidence_isIgnored() {
    let monitor = MotionMonitor()
    let delegate = CapturingDelegate()
    monitor.delegate = delegate
    monitor._test_simulate(activity: .walking, confidence: .low)
    XCTAssertEqual(delegate.changes.count, 0, "low-confidence events must not fire change")
  }

  func test_mediumConfidence_firesChangeOnce() {
    let monitor = MotionMonitor()
    let delegate = CapturingDelegate()
    monitor.delegate = delegate
    monitor._test_simulate(activity: .walking, confidence: .medium)
    monitor._test_simulate(activity: .walking, confidence: .medium)
    XCTAssertEqual(delegate.changes.count, 1, "same activity must not re-fire")
    XCTAssertEqual(delegate.changes[0].0, .walking)
  }

  func test_activityTransition_firesChange() {
    let monitor = MotionMonitor()
    let delegate = CapturingDelegate()
    monitor.delegate = delegate
    monitor._test_simulate(activity: .stationary, confidence: .high)
    monitor._test_simulate(activity: .walking, confidence: .high)
    XCTAssertEqual(delegate.changes.count, 2)
    XCTAssertEqual(delegate.changes[1].0, .walking)
  }
}
