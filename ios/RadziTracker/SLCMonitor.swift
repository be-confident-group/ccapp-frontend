import CoreLocation
import Foundation

final class SLCMonitor: NSObject {
  private let manager = CLLocationManager()
  private(set) var isRunning = false
  var onWake: ((CLLocation) -> Void)?

  override init() {
    super.init()
    manager.delegate = self
  }

  func start() {
    manager.allowsBackgroundLocationUpdates = true
    manager.pausesLocationUpdatesAutomatically = false
    manager.startMonitoringSignificantLocationChanges()
    isRunning = true
    TrackingLogger.shared.log(.info, "SLCMonitor: started")
  }

  func stop() {
    manager.stopMonitoringSignificantLocationChanges()
    isRunning = false
    TrackingLogger.shared.log(.info, "SLCMonitor: stopped")
  }
}

extension SLCMonitor: CLLocationManagerDelegate {
  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let loc = locations.last else { return }
    TrackingLogger.shared.log(.info, "SLCMonitor: wake — \(loc.coordinate)")
    onWake?(loc)
  }
}
