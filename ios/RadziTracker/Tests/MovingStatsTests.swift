import XCTest
@testable import Radzi

final class MovingStatsTests: XCTestCase {
  func test_movingDurationExcludesStationaryGaps() {
    let intervals: [(distanceM: Double, seconds: Double)] = [
      (5, 1), (5, 1), (5, 1),
      (0.1, 1000),  // stationary gap
      (5, 1), (5, 1),
    ]
    let stats = MovingStats.compute(intervals: intervals)
    XCTAssertEqual(stats.movingDurationS, 5)
    XCTAssertEqual(stats.totalDistanceM, 25.1, accuracy: 0.001)
    XCTAssertEqual(stats.movingAvgSpeedKmh ?? 0, 18.07, accuracy: 0.1)
  }

  func test_movingAvgIsNilWhenNoMovement() {
    let intervals: [(distanceM: Double, seconds: Double)] = [(0.1, 100), (0.1, 100)]
    let stats = MovingStats.compute(intervals: intervals)
    XCTAssertNil(stats.movingAvgSpeedKmh)
    XCTAssertEqual(stats.movingDurationS, 0)
  }
}
