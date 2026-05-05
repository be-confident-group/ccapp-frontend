import XCTest
@testable import Radzi

final class SegmenterTests: XCTestCase {

  func test_60sUnknownSplitsSegment() {
    let base = Date(timeIntervalSince1970: 0)
    var points: [Segmenter.TimelinePoint] = []
    // 2 min walk
    for s in stride(from: 0, through: 120, by: 10) {
      points.append(.init(timestamp: base.addingTimeInterval(Double(s)), activity: .walking, speedKmh: 5))
    }
    // 90s unknown (> 60s threshold)
    for s in stride(from: 130, through: 220, by: 10) {
      points.append(.init(timestamp: base.addingTimeInterval(Double(s)), activity: .unknown, speedKmh: nil))
    }
    // 2 min walk
    for s in stride(from: 230, through: 350, by: 10) {
      points.append(.init(timestamp: base.addingTimeInterval(Double(s)), activity: .walking, speedKmh: 5))
    }

    let result = Segmenter.split(timeline: points)

    XCTAssertGreaterThanOrEqual(result.count, 3)
    let transitSeg = result.first { $0.kind == .transit }
    XCTAssertNotNil(transitSeg)
    let activeSeg = result.filter { $0.kind == .active }
    XCTAssertGreaterThanOrEqual(activeSeg.count, 2)
  }

  func test_shortUnknownUnder60sIsNotTransit() {
    let base = Date(timeIntervalSince1970: 0)
    var points: [Segmenter.TimelinePoint] = []
    for s in stride(from: 0, through: 60, by: 10) {
      points.append(.init(timestamp: base.addingTimeInterval(Double(s)), activity: .walking, speedKmh: 5))
    }
    // 30s unknown gap (below 60s threshold)
    for s in stride(from: 70, through: 100, by: 10) {
      points.append(.init(timestamp: base.addingTimeInterval(Double(s)), activity: .unknown, speedKmh: nil))
    }
    for s in stride(from: 110, through: 170, by: 10) {
      points.append(.init(timestamp: base.addingTimeInterval(Double(s)), activity: .walking, speedKmh: 5))
    }
    let result = Segmenter.split(timeline: points)
    XCTAssertTrue(result.filter { $0.kind == .transit }.isEmpty)
  }

  func test_unknownWithSustained30sHighSpeed_isAutomotive() {
    let base = Date(timeIntervalSince1970: 0)
    var points: [Segmenter.TimelinePoint] = []
    // 90s of unknown with sustained 40 km/h
    for s in stride(from: 0, through: 90, by: 10) {
      points.append(.init(timestamp: base.addingTimeInterval(Double(s)), activity: .unknown, speedKmh: 40))
    }
    let result = Segmenter.split(timeline: points)
    XCTAssertFalse(result.isEmpty)
    // The automotive-via-speed path should classify the segment as automotive
    let automotiveSeg = result.first { $0.activity == .automotive }
    XCTAssertNotNil(automotiveSeg)
  }

  func test_unknownWithSingleHighSpeedPoint_isNotAutomotive() {
    let base = Date(timeIntervalSince1970: 0)
    var points: [Segmenter.TimelinePoint] = []
    // 2 min unknown, only one 10s window at high speed
    for s in stride(from: 0, through: 120, by: 10) {
      let speed: Double = (s == 50) ? 40.0 : 5.0  // only at t=50 is speed high
      points.append(.init(timestamp: base.addingTimeInterval(Double(s)), activity: .unknown, speedKmh: speed))
    }
    let result = Segmenter.split(timeline: points)
    // Should not be automotive (only 1 point at high speed, not sustained 30s)
    let automotiveSeg = result.first { $0.activity == .automotive }
    XCTAssertNil(automotiveSeg)
  }
}
