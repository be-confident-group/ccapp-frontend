import Foundation
import React

@objc(RadziTracker)
final class RadziTracker: RCTEventEmitter {

  override func supportedEvents() -> [String]! {
    return ["tripStarted", "tripEnded", "activityChanged", "stateChanged", "locationStored"]
  }

  override static func requiresMainQueueSetup() -> Bool { return false }

  @objc(start:rejecter:)
  func start(_ resolve: @escaping RCTPromiseResolveBlock,
             rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(nil)
  }

  @objc(stop:rejecter:)
  func stop(_ resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(nil)
  }

  @objc(getStatus:rejecter:)
  func getStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(["state": "idle", "activity": "unknown", "tripId": NSNull()])
  }

  @objc(forceStartTrip:rejecter:)
  func forceStartTrip(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    reject("not_implemented", "forceStartTrip not yet implemented", nil)
  }

  @objc(forceStopTrip:rejecter:)
  func forceStopTrip(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    reject("not_implemented", "forceStopTrip not yet implemented", nil)
  }

  @objc(requestPermissions:rejecter:)
  func requestPermissions(_ resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(["location": "denied", "motion": "denied"])
  }

  @objc(checkPermissions:rejecter:)
  func checkPermissions(_ resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(["location": "denied", "motion": "denied"])
  }

  @objc(setConfig:resolver:rejecter:)
  func setConfig(_ config: NSDictionary,
                 resolver resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(nil)
  }

  @objc(getConfig:rejecter:)
  func getConfig(_ resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve([:])
  }
}
