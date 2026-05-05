import CoreMotion
import Foundation

// MARK: - Protocols (production types conform; stubs injected in tests)

protocol MotionHistorySource {
  func queryActivities(from: Date, to: Date, completion: @escaping ([CMMotionActivity]) -> Void)
}

protocol PedometerSource {
  func distanceMeters(from: Date, to: Date, completion: @escaping (Double?) -> Void)
}

// MARK: - Output type

struct SynthesizedSubTrip {
  let start: Date
  let end: Date
  let activity: MotionMonitor.Activity
  let distanceM: Double?
}

// MARK: - Reconciler

final class ActivityHistoryReconciler {
  private let motion: MotionHistorySource
  private let pedometer: PedometerSource
  private let minSegmentSeconds: TimeInterval = 90

  init(motion: MotionHistorySource, pedometer: PedometerSource) {
    self.motion = motion
    self.pedometer = pedometer
  }

  /// Synchronously reconcile recent history.
  /// Looks back `lookbackMinutes` from `now`, skipping intervals in `alreadyCovered`.
  func reconcile(
    now: Date,
    lookbackMinutes: Int,
    alreadyCovered: [(start: Date, end: Date)]
  ) -> [SynthesizedSubTrip] {
    let from = now.addingTimeInterval(-Double(lookbackMinutes) * 60)
    var rawActivities: [CMMotionActivity] = []
    let sem = DispatchSemaphore(value: 0)
    motion.queryActivities(from: from, to: now) { activities in
      rawActivities = activities
      sem.signal()
    }
    sem.wait()

    let segments = collapseAdjacent(rawActivities, endDate: now)
    var results: [SynthesizedSubTrip] = []
    let group = DispatchGroup()

    for seg in segments {
      guard seg.activity == .walking || seg.activity == .cycling else { continue }
      guard seg.end.timeIntervalSince(seg.start) >= minSegmentSeconds else { continue }
      if isCovered(seg, alreadyCovered) { continue }

      var distanceM: Double? = nil
      if seg.activity == .walking {
        group.enter()
        pedometer.distanceMeters(from: seg.start, to: seg.end) { d in
          distanceM = d
          group.leave()
        }
        group.wait()
      }
      results.append(SynthesizedSubTrip(start: seg.start, end: seg.end, activity: seg.activity, distanceM: distanceM))
    }
    return results
  }

  // MARK: - Private helpers

  private struct Segment {
    let start: Date
    let end: Date
    let activity: MotionMonitor.Activity
  }

  private func collapseAdjacent(_ activities: [CMMotionActivity], endDate: Date) -> [Segment] {
    guard !activities.isEmpty else { return [] }
    var out: [Segment] = []
    var currentStart = activities[0].startDate
    var currentActivity = primaryActivity(activities[0])
    for i in 1..<activities.count {
      let kind = primaryActivity(activities[i])
      if kind != currentActivity {
        out.append(Segment(start: currentStart, end: activities[i].startDate, activity: currentActivity))
        currentStart = activities[i].startDate
        currentActivity = kind
      }
    }
    out.append(Segment(start: currentStart, end: endDate, activity: currentActivity))
    return out
  }

  private func primaryActivity(_ a: CMMotionActivity) -> MotionMonitor.Activity {
    if a.walking    { return .walking }
    if a.cycling    { return .cycling }
    if a.running    { return .running }
    if a.automotive { return .automotive }
    if a.stationary { return .stationary }
    return .unknown
  }

  private func isCovered(_ seg: Segment, _ covered: [(start: Date, end: Date)]) -> Bool {
    covered.contains { c in seg.start < c.end && c.start < seg.end }
  }
}

// MARK: - Testable entry point (uses SyntheticActivityEntry instead of CMMotionActivity)

extension ActivityHistoryReconciler {
  /// Internal testable entry point that accepts synthetic entries instead of CMMotionActivity
  func reconcileFromEntries(
    entries: [SyntheticActivityEntry],
    now: Date,
    lookbackMinutes: Int,
    alreadyCovered: [(start: Date, end: Date)]
  ) -> [SynthesizedSubTrip] {
    let segments = collapseAdjacentEntries(entries, endDate: now)
    var results: [SynthesizedSubTrip] = []
    let group = DispatchGroup()
    for seg in segments {
      guard seg.activity == .walking || seg.activity == .cycling else { continue }
      guard seg.end.timeIntervalSince(seg.start) >= minSegmentSeconds else { continue }
      if isCovered(seg, alreadyCovered) { continue }
      var distanceM: Double? = nil
      if seg.activity == .walking {
        group.enter()
        pedometer.distanceMeters(from: seg.start, to: seg.end) { d in
          distanceM = d; group.leave()
        }
        group.wait()
      }
      results.append(SynthesizedSubTrip(start: seg.start, end: seg.end, activity: seg.activity, distanceM: distanceM))
    }
    return results
  }

  private func collapseAdjacentEntries(_ entries: [SyntheticActivityEntry], endDate: Date) -> [Segment] {
    guard !entries.isEmpty else { return [] }
    var out: [Segment] = []
    var currentStart = entries[0].start
    var currentActivity = primaryActivityFromEntry(entries[0])
    for i in 1..<entries.count {
      let kind = primaryActivityFromEntry(entries[i])
      if kind != currentActivity {
        out.append(Segment(start: currentStart, end: entries[i].start, activity: currentActivity))
        currentStart = entries[i].start
        currentActivity = kind
      }
    }
    out.append(Segment(start: currentStart, end: endDate, activity: currentActivity))
    return out
  }

  private func primaryActivityFromEntry(_ e: SyntheticActivityEntry) -> MotionMonitor.Activity {
    if e.walking    { return .walking }
    if e.cycling    { return .cycling }
    if e.running    { return .running }
    if e.automotive { return .automotive }
    if e.stationary { return .stationary }
    return .unknown
  }
}

// MARK: - SyntheticActivityEntry (always available — used by reconcileFromEntries)

struct SyntheticActivityEntry {
  let start: Date
  let walking: Bool
  let cycling: Bool
  let automotive: Bool
  let stationary: Bool
  let running: Bool
}

// MARK: - Debug stubs

#if DEBUG
// Production CMMotionActivityManager conformance
extension CMMotionActivityManager: MotionHistorySource {
  func queryActivities(from: Date, to: Date, completion: @escaping ([CMMotionActivity]) -> Void) {
    queryActivityStarting(from: from, to: to, to: OperationQueue.main) { activities, _ in
      completion(activities ?? [])
    }
  }
}

// Stub types for unit tests
final class MotionHistoryStub: MotionHistorySource {
  let history: [SyntheticActivityEntry]
  init(history: [SyntheticActivityEntry]) { self.history = history }
  func queryActivities(from: Date, to: Date, completion: @escaping ([CMMotionActivity]) -> Void) {
    // CMMotionActivity cannot be directly instantiated; return empty and let tests
    // use reconcileFromEntries directly (see below)
    completion([])
  }
}

final class PedometerStub: PedometerSource {
  let distanceM: Double
  init(distanceM: Double) { self.distanceM = distanceM }
  func distanceMeters(from: Date, to: Date, completion: @escaping (Double?) -> Void) {
    completion(distanceM)
  }
}
#endif
