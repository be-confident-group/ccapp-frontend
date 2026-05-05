import Foundation

enum Segmenter {
  enum SegmentKind { case active, transit }

  struct TimelinePoint {
    let timestamp: Date
    let activity: SegmentActivity
    let speedKmh: Double?
  }

  enum SegmentActivity {
    case walking, running, cycling, automotive, stationary, unknown
    var isActive: Bool { self == .walking || self == .running || self == .cycling }
  }

  struct Segment {
    let start: Date
    let end: Date
    let kind: SegmentKind
    let activity: SegmentActivity
  }

  static let transitWindowSeconds: TimeInterval = 60
  static let transitSpeedThresholdKmh: Double = 25
  static let transitSpeedMinDurationSeconds: TimeInterval = 30

  /// Split a chronological timeline into active and transit segments.
  /// Transit: any continuous ≥60s run of automotive/unknown/stationary.
  /// For unknown activity: if sustained GPS speed > 25 km/h for ≥30s → treated as automotive.
  static func split(timeline: [TimelinePoint]) -> [Segment] {
    guard timeline.count >= 2 else { return [] }

    var segments: [Segment] = []
    var windowStart = timeline[0].timestamp
    var windowActivity = classifyActivity(timeline[0])
    var windowPoints: [TimelinePoint] = [timeline[0]]

    func flush(to endDate: Date) {
      guard windowStart < endDate else { return }
      let duration = endDate.timeIntervalSince(windowStart)
      let isTransit: Bool
      if windowActivity.isActive {
        isTransit = false
      } else {
        isTransit = duration >= transitWindowSeconds
      }
      // Check if unknown activity had sustained high speed for ≥30s (automotive proxy)
      let finalActivity: SegmentActivity
      if windowActivity == .unknown && windowPoints.count >= 2 {
        var sustainedHighSpeedSeconds = 0.0
        for i in 1..<windowPoints.count {
          let prev = windowPoints[i - 1]
          let curr = windowPoints[i]
          if (prev.speedKmh ?? 0) > transitSpeedThresholdKmh && (curr.speedKmh ?? 0) > transitSpeedThresholdKmh {
            sustainedHighSpeedSeconds += curr.timestamp.timeIntervalSince(prev.timestamp)
          }
        }
        finalActivity = sustainedHighSpeedSeconds >= transitSpeedMinDurationSeconds ? .automotive : .unknown
      } else {
        finalActivity = windowActivity
      }
      segments.append(Segment(start: windowStart, end: endDate,
                              kind: isTransit ? .transit : .active,
                              activity: finalActivity))
    }

    for i in 1..<timeline.count {
      let pt = timeline[i]
      let activity = classifyActivity(pt)
      if activity != windowActivity {
        flush(to: pt.timestamp)
        windowStart = pt.timestamp
        windowActivity = activity
        windowPoints = [pt]
      } else {
        windowPoints.append(pt)
      }
    }
    flush(to: timeline.last!.timestamp)
    return segments
  }

  private static func classifyActivity(_ pt: TimelinePoint) -> SegmentActivity { pt.activity }
}
