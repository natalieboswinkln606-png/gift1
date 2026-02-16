/**
 * 1D Kalman Filter for landmark coordinate smoothing.
 *
 * Tuned for hand-tracking: balances responsiveness with jitter reduction.
 * Each filter instance handles one scalar value (e.g., landmark.x or landmark.y).
 */
export class KalmanFilter {
  private estimate: number
  private errorEstimate: number
  private errorMeasure: number
  private q: number // process noise
  private initialized = false

  /**
   * @param q Process noise — higher = more responsive, lower = smoother (default 0.5)
   * @param r Measurement noise — higher = more smoothing (default 0.01)
   */
  constructor(q = 0.5, r = 0.01) {
    this.q = q
    this.errorMeasure = r
    this.estimate = 0
    this.errorEstimate = 1
  }

  /**
   * Filter a new measurement and return the smoothed value.
   */
  filter(measurement: number): number {
    if (!this.initialized) {
      this.estimate = measurement
      this.errorEstimate = 1
      this.initialized = true
      return measurement
    }

    // Prediction step
    const errorEstimate = this.errorEstimate + this.q

    // Update step
    const kalmanGain = errorEstimate / (errorEstimate + this.errorMeasure)
    this.estimate = this.estimate + kalmanGain * (measurement - this.estimate)
    this.errorEstimate = (1 - kalmanGain) * errorEstimate

    return this.estimate
  }

  /**
   * Reset filter state (e.g., on scene transition).
   */
  reset(): void {
    this.initialized = false
    this.estimate = 0
    this.errorEstimate = 1
  }
}
