import Foundation
import CoreLocation

protocol LocationSessionDelegate: AnyObject {
  func locationSession(_ session: LocationSession,
                       didReceive location: CLLocation,
                       mode: LocationSession.AccuracyMode)
  func locationSession(_ session: LocationSession,
                       didChangeAuthorization status: CLAuthorizationStatus)
  func locationSession(_ session: LocationSession, didFailWithError error: Error)
}

final class LocationSession: NSObject, CLLocationManagerDelegate {

  enum AccuracyMode: String {
    case off
    case low      // kCLLocationAccuracyKilometer
    case hundred  // kCLLocationAccuracyHundredMeters
    case best     // kCLLocationAccuracyBest
  }

  weak var delegate: LocationSessionDelegate?

  private let manager = CLLocationManager()
  private(set) var currentMode: AccuracyMode = .off

  override init() {
    super.init()
    manager.delegate = self
    manager.activityType = .fitness
    manager.pausesLocationUpdatesAutomatically = false
    manager.allowsBackgroundLocationUpdates = false
  }

  func setMode(_ mode: AccuracyMode) {
    guard mode != currentMode else { return }
    let previous = currentMode
    currentMode = mode
    TrackingLogger.shared.log(.info, "LocationSession: \(previous.rawValue) → \(mode.rawValue)")
    switch mode {
    case .off:
      manager.stopUpdatingLocation()
      manager.allowsBackgroundLocationUpdates = false
    case .low:
      manager.desiredAccuracy = kCLLocationAccuracyKilometer
      manager.distanceFilter = 100
      manager.allowsBackgroundLocationUpdates = true
      manager.startUpdatingLocation()
    case .hundred:
      manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
      manager.distanceFilter = 25
      manager.allowsBackgroundLocationUpdates = true
      manager.startUpdatingLocation()
    case .best:
      manager.desiredAccuracy = kCLLocationAccuracyBest
      manager.distanceFilter = 5
      manager.allowsBackgroundLocationUpdates = true
      manager.startUpdatingLocation()
    }
  }

  func requestPermission() {
    manager.requestWhenInUseAuthorization()
  }

  func requestAlwaysPermission() {
    manager.requestAlwaysAuthorization()
  }

  func currentAuthorization() -> CLAuthorizationStatus {
    if #available(iOS 14, *) { return manager.authorizationStatus }
    return CLLocationManager.authorizationStatus()
  }

  // MARK: - CLLocationManagerDelegate

  func locationManager(_ manager: CLLocationManager,
                       didUpdateLocations locations: [CLLocation]) {
    for loc in locations {
      delegate?.locationSession(self, didReceive: loc, mode: currentMode)
    }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    TrackingLogger.shared.log(.error, "LocationSession: \(error.localizedDescription)")
    delegate?.locationSession(self, didFailWithError: error)
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    delegate?.locationSession(self, didChangeAuthorization: manager.authorizationStatus)
  }
}
