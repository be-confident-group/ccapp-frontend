import XCTest
@testable import Radzi

final class SLCMonitorTests: XCTestCase {
  func test_isRunning_falseBeforeStart() {
    let m = SLCMonitor()
    XCTAssertFalse(m.isRunning)
  }

  func test_startSetsIsRunning() {
    let m = SLCMonitor()
    m.start()
    XCTAssertTrue(m.isRunning)
    m.stop()
    XCTAssertFalse(m.isRunning)
  }
}
