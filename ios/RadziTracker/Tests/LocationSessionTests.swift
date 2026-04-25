import XCTest
import CoreLocation
@testable import Radzi

final class LocationSessionTests: XCTestCase {

  func test_initialMode_isOff() {
    let session = LocationSession()
    XCTAssertEqual(session.currentMode, .off)
  }

  func test_setMode_transitionsCorrectly() {
    let session = LocationSession()
    session.setMode(.hundred)
    XCTAssertEqual(session.currentMode, .hundred)
    session.setMode(.best)
    XCTAssertEqual(session.currentMode, .best)
    session.setMode(.off)
    XCTAssertEqual(session.currentMode, .off)
  }

  func test_setMode_idempotent() {
    let session = LocationSession()
    session.setMode(.best)
    session.setMode(.best)
    XCTAssertEqual(session.currentMode, .best)
  }
}
