import XCTest
@testable import Radzi

final class AltimeterMonitorTests: XCTestCase {
  func test_aggregateSamples_computesGainAndLoss() {
    let samples: [(timestamp: Date, relativeAltitudeM: Double)] = [
      (Date(timeIntervalSince1970: 0), 0.0),
      (Date(timeIntervalSince1970: 10), 5.0),   // +5
      (Date(timeIntervalSince1970: 20), 12.0),  // +7
      (Date(timeIntervalSince1970: 30), 9.0),   // -3
      (Date(timeIntervalSince1970: 40), 14.0),  // +5
      (Date(timeIntervalSince1970: 50), 4.0),   // -10
    ]
    let result = AltimeterMonitor.aggregate(samples: samples)
    XCTAssertEqual(result.gainMeters!, 17.0, accuracy: 0.001)
    XCTAssertEqual(result.lossMeters!, 13.0, accuracy: 0.001)
  }

  func test_aggregateSamples_returnsNilWhenInsufficient() {
    let samples: [(timestamp: Date, relativeAltitudeM: Double)] = [
      (Date(timeIntervalSince1970: 0), 1.0),
      (Date(timeIntervalSince1970: 1), 2.0),
    ]
    let result = AltimeterMonitor.aggregate(samples: samples)
    XCTAssertNil(result.gainMeters)
    XCTAssertNil(result.lossMeters)
  }
}
