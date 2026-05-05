import BackgroundTasks
import Foundation

enum BackgroundSyncTask {
  static let identifier = "com.radzi.beactive.sync"

  static func register() {
    BGTaskScheduler.shared.register(
      forTaskWithIdentifier: identifier,
      using: nil
    ) { task in
      guard let refreshTask = task as? BGAppRefreshTask else {
        task.setTaskCompleted(success: false)
        return
      }
      handle(task: refreshTask)
    }
  }

  static func schedule() {
    let request = BGAppRefreshTaskRequest(identifier: identifier)
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
    do {
      try BGTaskScheduler.shared.submit(request)
    } catch {
      TrackingLogger.shared.log(.warn, "BackgroundSyncTask: schedule failed — \(error)")
    }
  }

  private static func handle(task: BGAppRefreshTask) {
    schedule() // Re-arm before doing work (in case task expires)
    task.expirationHandler = { task.setTaskCompleted(success: false) }
    // Signal completion — actual sync is triggered by the JS layer on next foreground.
    // We just want the app to wake so the JS sync service can run.
    TrackingLogger.shared.log(.info, "BackgroundSyncTask: woke for sync")
    task.setTaskCompleted(success: true)
  }
}
