import XCTest
@testable import Radzi

final class SpeedFilterTests: XCTestCase {
  func test_maxSpeedDropsSpikesAndBadAccuracy_cyclingCeiling() {
    let speeds: [Double] = [12, 14, 15, 16, 14, 509.8, 18, 17, 16, 15, 14, 13]
    let accuracies: [Double] = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
    let result = SpeedFilter.maxSpeed(
      speedsKmh: speeds, horizontalAccuraciesM: accuracies, activity: .cycling
    )
    XCTAssertNotNil(result)
    XCTAssertLessThan(result!, 25.0)    // spike rejected
    XCTAssertGreaterThan(result!, 16.0) // real peak preserved
  }

  func test_maxSpeedReturnsNilWhenInsufficientPoints() {
    let result = SpeedFilter.maxSpeed(
      speedsKmh: [10, 12, 11], horizontalAccuraciesM: [5, 5, 5], activity: .walking
    )
    XCTAssertNil(result) // fewer than 5 valid points
  }

  func test_maxSpeedNilWhenAllExceedCeiling() {
    let speeds = Array(repeating: 80.0, count: 10)
    let accs = Array(repeating: 5.0, count: 10)
    let result = SpeedFilter.maxSpeed(speedsKmh: speeds, horizontalAccuraciesM: accs, activity: .cycling)
    XCTAssertNil(result) // 80 > 60 ceiling — all filtered → nil
  }

  func test_maxSpeedDropsBadAccuracyPoints() {
    let speeds: [Double]    = [12, 14, 15, 80, 14, 13, 12, 11, 10,  9]
    let accuracies: [Double] = [ 5,  5,  5, 50,  5,  5,  5,  5,  5,  5]
    let result = SpeedFilter.maxSpeed(speedsKmh: speeds, horizontalAccuraciesM: accuracies, activity: .cycling)
    XCTAssertNotNil(result)
    XCTAssertLessThan(result!, 20.0) // high-accuracy reading dropped
  }
}
