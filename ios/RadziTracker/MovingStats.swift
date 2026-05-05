import Foundation

enum MovingStats {
  static let stationaryThresholdMps: Double = 0.5

  struct Result {
    let totalDistanceM: Double
    let movingDurationS: Int
    let movingAvgSpeedKmh: Double?
  }

  static func compute(intervals: [(distanceM: Double, seconds: Double)]) -> Result {
    var totalDistance = 0.0
    var movingSeconds = 0.0
    for interval in intervals {
      totalDistance += interval.distanceM
      if interval.seconds > 0 {
        let speed = interval.distanceM / interval.seconds
        if speed > stationaryThresholdMps {
          movingSeconds += interval.seconds
        }
      }
    }
    let avg: Double? = movingSeconds > 0 ? (totalDistance / movingSeconds) * 3.6 : nil
    return Result(
      totalDistanceM: totalDistance,
      movingDurationS: Int(movingSeconds.rounded()),
      movingAvgSpeedKmh: avg
    )
  }
}
