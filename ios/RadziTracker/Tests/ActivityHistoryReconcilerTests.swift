import XCTest
@testable import Radzi

final class ActivityHistoryReconcilerTests: XCTestCase {
  func test_synthesisWalkingSubTrips() {
    let now = Date(timeIntervalSince1970: 1_000_000)
    let entries: [SyntheticActivityEntry] = [
      SyntheticActivityEntry(start: now.addingTimeInterval(-30*60), walking: true, cycling: false, automotive: false, stationary: false, running: false),
      SyntheticActivityEntry(start: now.addingTimeInterval(-27*60), walking: false, cycling: false, automotive: false, stationary: true,  running: false),
      SyntheticActivityEntry(start: now.addingTimeInterval(-25*60), walking: false, cycling: false, automotive: true,  stationary: false, running: false),
      SyntheticActivityEntry(start: now.addingTimeInterval(-5*60),  walking: false, cycling: false, automotive: false, stationary: true,  running: false),
      SyntheticActivityEntry(start: now.addingTimeInterval(-1*60),  walking: true,  cycling: false, automotive: false, stationary: false, running: false),
    ]
    let reconciler = ActivityHistoryReconciler(
      motion: MotionHistoryStub(history: entries),
      pedometer: PedometerStub(distanceM: 200)
    )
    let synthesized = reconciler.reconcileFromEntries(entries: entries, now: now, lookbackMinutes: 35, alreadyCovered: [])
    // Expect 2 walking sub-trips (3min walk and 1min walk)
    // Note: 1min walk = 60s < minSegmentSeconds (90s) → only the 3-min walk qualifies
    XCTAssertEqual(synthesized.count, 1)
    XCTAssertEqual(synthesized[0].activity, .walking)
    XCTAssertEqual(synthesized[0].distanceM, 200.0)
  }

  func test_alreadyCoveredWindowsAreSkipped() {
    let now = Date(timeIntervalSince1970: 1_000_000)
    let walkStart = now.addingTimeInterval(-30*60)
    let walkEnd = now.addingTimeInterval(-25*60) // 5-min walk = 300s > 90s
    let entries: [SyntheticActivityEntry] = [
      SyntheticActivityEntry(start: walkStart, walking: true, cycling: false, automotive: false, stationary: false, running: false),
      SyntheticActivityEntry(start: walkEnd, walking: false, cycling: false, automotive: false, stationary: true, running: false),
    ]
    let reconciler = ActivityHistoryReconciler(
      motion: MotionHistoryStub(history: entries),
      pedometer: PedometerStub(distanceM: 300)
    )
    // Mark the window as already covered
    let synthesized = reconciler.reconcileFromEntries(
      entries: entries, now: now, lookbackMinutes: 35,
      alreadyCovered: [(start: walkStart, end: walkEnd)]
    )
    XCTAssertEqual(synthesized.count, 0)
  }
}
