import Foundation
import os.log

/// Thread-safe ring-buffer log. Snapshots are surfaced to the debug screen via getStatus.
final class TrackingLogger {
  static let shared = TrackingLogger()

  enum Level: String { case info, warn, error }

  struct Entry: Codable {
    let timestamp: Int64
    let level: String
    let message: String
  }

  private let queue = DispatchQueue(label: "com.radzi.tracker.logger")
  private let osLog = OSLog(subsystem: "com.radzi.tracker", category: "tracker")
  private var buffer: [Entry] = []
  private let maxEntries = 500

  private init() {}

  func log(_ level: Level, _ message: String) {
    let entry = Entry(
      timestamp: Int64(Date().timeIntervalSince1970 * 1000),
      level: level.rawValue,
      message: message
    )
    queue.async {
      self.buffer.append(entry)
      if self.buffer.count > self.maxEntries {
        self.buffer.removeFirst(self.buffer.count - self.maxEntries)
      }
    }
    let osType: OSLogType = level == .error ? .error : level == .warn ? .info : .default
    os_log("%{public}@", log: osLog, type: osType, message)
  }

  func snapshot() -> [Entry] {
    queue.sync { self.buffer }
  }

  func clear() {
    queue.async { self.buffer.removeAll() }
  }
}
