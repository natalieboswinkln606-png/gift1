import type { Landmark } from '@/types'

/**
 * One Euro Filter — Adaptive low-pass filter for hand tracking.
 *
 * Based on: Casiez et al. 2012 "1€ Filter: A Simple Speed-based Low-pass Filter
 * for Noisy Input in Interactive Systems"
 *
 * Key insight: Adapts cutoff frequency based on signal velocity.
 * - Stationary hand → low cutoff → aggressive smoothing → zero jitter
 * - Fast movement → high cutoff → minimal smoothing → responsive tracking
 *
 * Parameters (research-backed for hand tracking):
 * - minCutoff: 1.0 Hz — base smoothing at rest
 * - beta: 0.007 — velocity sensitivity (from TensorFlow.js production impl)
 * - dCutoff: 1.0 Hz — derivative smoothing
 */

class LowPassFilter {
  private y: number | null = null
  private s: number | null = null

  alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff)
    return 1.0 / (1.0 + tau / dt)
  }

  filter(value: number, alpha: number): number {
    if (this.s === null) {
      this.s = value
    } else {
      this.s = alpha * value + (1 - alpha) * this.s
    }
    this.y = value
    return this.s
  }

  lastRawValue(): number | null {
    return this.y
  }

  lastFilteredValue(): number | null {
    return this.s
  }

  reset(): void {
    this.y = null
    this.s = null
  }
}

export class OneEuroFilter {
  private readonly minCutoff: number
  private readonly beta: number
  private readonly dCutoff: number
  private readonly xFilter: LowPassFilter
  private readonly dxFilter: LowPassFilter
  private lastTimestamp: number | null = null
  private frequency: number

  /**
   * @param minCutoff Minimum cutoff frequency in Hz (lower = more smooth). Default 1.0
   * @param beta Speed coefficient (higher = more responsive to fast movement). Default 0.007
   * @param dCutoff Cutoff frequency for derivative in Hz. Default 1.0
   * @param initialFrequency Initial sampling frequency estimate in Hz. Default 30
   */
  constructor(
    minCutoff = 1.0,
    beta = 0.007,
    dCutoff = 1.0,
    initialFrequency = 30
  ) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
    this.frequency = initialFrequency
    this.xFilter = new LowPassFilter()
    this.dxFilter = new LowPassFilter()
  }

  /**
   * Filter a new measurement.
   * @param value Raw measurement
   * @param timestamp Timestamp in milliseconds (performance.now())
   * @returns Filtered value
   */
  filter(value: number, timestamp: number): number {
    // Guard against zero or negative time deltas
    if (this.lastTimestamp !== null) {
      const dtMs = timestamp - this.lastTimestamp
      if (dtMs <= 0) {
        // Same or earlier timestamp — return raw value without filtering
        return value
      }
      if (dtMs < 500) {
        // Only update frequency for reasonable intervals (< 500ms)
        this.frequency = 1000 / dtMs
      } else if (dtMs >= 500) {
        // Large gap — reset filter state BEFORE updating lastTimestamp
        // to prevent repeated resets on next frame
        this.lastTimestamp = timestamp
        this.reset()
        return value
      }
    }
    this.lastTimestamp = timestamp

    const dt = 1.0 / this.frequency

    // Estimate velocity (derivative)
    const prevRaw = this.xFilter.lastRawValue()
    const dx = prevRaw !== null ? (value - prevRaw) * this.frequency : 0

    // Filter the derivative
    const adx = this.dxFilter.alpha(this.dCutoff, dt)
    const edx = this.dxFilter.filter(dx, adx)

    // Adaptive cutoff: increases with velocity
    const cutoff = this.minCutoff + this.beta * Math.abs(edx)

    // Filter the signal
    const ax = this.xFilter.alpha(cutoff, dt)
    return this.xFilter.filter(value, ax)
  }

  /** Reset filter state (e.g., on scene transition) */
  reset(): void {
    this.xFilter.reset()
    this.dxFilter.reset()
    this.lastTimestamp = null
  }
}

/**
 * 3D One Euro Filter for landmark coordinate smoothing.
 * Wraps three independent 1D filters for x, y, z.
 */
export class OneEuroFilter3D {
  private readonly fx: OneEuroFilter
  private readonly fy: OneEuroFilter
  private readonly fz: OneEuroFilter

  constructor(
    minCutoff = 1.0,
    beta = 0.007,
    dCutoff = 1.0,
    initialFrequency = 30
  ) {
    this.fx = new OneEuroFilter(minCutoff, beta, dCutoff, initialFrequency)
    this.fy = new OneEuroFilter(minCutoff, beta, dCutoff, initialFrequency)
    this.fz = new OneEuroFilter(minCutoff, beta, dCutoff, initialFrequency)
  }

  /**
   * Filter a 3D landmark.
   * @param landmark Raw landmark {x, y, z}
   * @param timestamp Timestamp in milliseconds
   * @returns Filtered landmark
   */
  filter(landmark: Landmark, timestamp: number): Landmark {
    return {
      x: this.fx.filter(landmark.x, timestamp),
      y: this.fy.filter(landmark.y, timestamp),
      z: this.fz.filter(landmark.z, timestamp),
    }
  }

  /** Reset all three filters */
  reset(): void {
    this.fx.reset()
    this.fy.reset()
    this.fz.reset()
  }
}
