/**
 * GestureInterpolator — velocity-based position prediction for dropped frames.
 *
 * When MediaPipe misses a frame (no hand detected), this predicts cursor
 * position from recent velocity to avoid cursor freezing.
 */
export class GestureInterpolator {
  private lastPos: { x: number; y: number } = { x: 0, y: 0 }
  private velocity: { x: number; y: number } = { x: 0, y: 0 }
  private lastTime = 0
  private lastDampTime = 0
  private initialized = false

  /** Damping factor — velocity decays each frame to prevent runaway prediction */
  private readonly DAMPING = 0.85
  /** Minimum velocity threshold — below this, stop predicting */
  private readonly MIN_VELOCITY = 0.5

  /**
   * Update with a new observed position. Call on every frame with hand detected.
   */
  update(pos: { x: number; y: number }): void {
    const now = performance.now()

    if (this.initialized) {
      const dt = now - this.lastTime
      if (dt > 0 && dt < 200) {
        // dt in ms, velocity in px/ms
        this.velocity.x = (pos.x - this.lastPos.x) / dt
        this.velocity.y = (pos.y - this.lastPos.y) / dt
      }
    }

    this.lastPos = { x: pos.x, y: pos.y }
    this.lastTime = now
    this.initialized = true
  }

  /**
   * Predict position after `dtMs` milliseconds from last known position.
   * Call when no hand is detected to keep cursor moving smoothly.
   */
  predict(dtMs: number): { x: number; y: number } {
    if (!this.initialized) return { x: 0, y: 0 }

    const now = performance.now()
    const timeSinceLastDamp = now - this.lastDampTime

    // Only apply damping once per frame (~8ms at 120fps)
    if (timeSinceLastDamp > 8) {
      const dtSeconds = timeSinceLastDamp / 1000
      // Time-based decay: Math.pow(dampingFactor, dtSeconds * 60)
      const decayFactor = Math.pow(this.DAMPING, dtSeconds * 60)
      this.velocity.x *= decayFactor
      this.velocity.y *= decayFactor
      this.lastDampTime = now
    }

    const vMag = Math.hypot(this.velocity.x, this.velocity.y)
    if (vMag < this.MIN_VELOCITY / 1000) {
      return { x: this.lastPos.x, y: this.lastPos.y }
    }

    return {
      x: this.lastPos.x + this.velocity.x * dtMs,
      y: this.lastPos.y + this.velocity.y * dtMs,
    }
  }

  /**
   * Check if interpolator has been initialized with at least one position update.
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Reset state (e.g., on scene transition or gesture system restart).
   */
  reset(): void {
    this.lastPos = { x: 0, y: 0 }
    this.velocity = { x: 0, y: 0 }
    this.lastTime = 0
    this.lastDampTime = 0
    this.initialized = false
  }
}
