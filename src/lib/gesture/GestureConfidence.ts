import type { GestureType, Landmark } from '@/types'

/**
 * Confidence score for a gesture classification.
 */
export interface GestureConfidenceScore {
  gesture: GestureType
  /** Overall confidence 0.0 - 1.0 */
  confidence: number
  metrics: {
    /** How well landmarks match the gesture pattern (0-1) */
    geometricScore: number
    /** How stable landmarks are over time (0-1) */
    stabilityScore: number
    /** Penalty for high hand velocity — gestures during movement are suspect (0-1) */
    velocityScore: number
  }
}

/**
 * GestureConfidence — Multi-criteria gesture evaluation.
 *
 * Scores each gesture type with a continuous 0-1 confidence value
 * based on geometric fit, temporal stability, and velocity penalty.
 * Eliminates false positives by requiring high confidence across all metrics.
 */
export class GestureConfidence {
  private previousLandmarks: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
  private hasPreviousLandmarks = false

  /**
   * Score a specific gesture type against current landmarks.
   */
  scoreGesture(
    gesture: GestureType,
    landmarks: Landmark[],
    handSize: number
  ): GestureConfidenceScore {
    const geometricScore = this.calculateGeometricScore(gesture, landmarks, handSize)
    const stabilityScore = this.calculateStabilityScore(landmarks)
    const velocityScore = this.calculateVelocityScore(landmarks)

    // Weighted: geometric is most important
    const confidence = Math.max(0, Math.min(1,
      geometricScore * 0.6 +
      stabilityScore * 0.2 +
      velocityScore * 0.2
    ))

    return {
      gesture,
      confidence,
      metrics: { geometricScore, stabilityScore, velocityScore },
    }
  }

  /**
   * Score all gesture types and return the best one above threshold.
   */
  getBestGesture(
    landmarks: Landmark[],
    handSize: number,
    minConfidence = 0.6
  ): { gesture: GestureType; confidence: number } {
    const gestures: GestureType[] = ['PINCH', 'FIST', 'OPEN', 'POINT', 'THREE_FINGER']
    let bestGesture: GestureType = 'NONE'
    let bestConfidence = 0

    for (const g of gestures) {
      const score = this.scoreGesture(g, landmarks, handSize)
      if (score.confidence > bestConfidence) {
        bestConfidence = score.confidence
        bestGesture = g
      }
    }

    // Update previous landmarks for next frame
    for (let i = 0; i < landmarks.length && i < this.previousLandmarks.length; i++) {
      this.previousLandmarks[i].x = landmarks[i].x
      this.previousLandmarks[i].y = landmarks[i].y
      this.previousLandmarks[i].z = landmarks[i].z
    }
    this.hasPreviousLandmarks = true

    return {
      gesture: bestConfidence >= minConfidence ? bestGesture : 'NONE',
      confidence: bestConfidence,
    }
  }

  /** Reset state (e.g., on scene transition) */
  reset(): void {
    this.hasPreviousLandmarks = false
  }

  // ─── Geometric Scoring ──────────────────────────────────────

  private calculateGeometricScore(
    gesture: GestureType,
    lm: Landmark[],
    handSize: number
  ): number {
    if (handSize <= 0) return 0

    switch (gesture) {
      case 'PINCH':
        return this.scorePinch(lm, handSize)
      case 'FIST':
        return this.scoreFist(lm, handSize)
      case 'OPEN':
        return this.scoreOpen(lm, handSize)
      case 'POINT':
        return this.scorePoint(lm)
      case 'THREE_FINGER':
        return this.scoreThreeFinger(lm)
      default:
        return 0
    }
  }

  /** PINCH: thumb tip (4) close to index tip (8), normalized by hand size */
  private scorePinch(lm: Landmark[], handSize: number): number {
    const tipDist = this.dist(lm[4], lm[8]) / handSize
    const threshold = 0.12 // Tight threshold for precision

    // Distance score: 1.0 when touching, 0.0 when >= threshold
    const distScore = Math.max(0, 1 - tipDist / threshold)

    // Depth check: thumb and index should be on same depth plane
    const depthDiff = Math.abs(lm[4].z - lm[8].z)
    const depthScore = depthDiff < 0.05 ? 1.0 : Math.max(0, 1 - (depthDiff - 0.05) / 0.05)

    // Angle check: finger directions should converge (not parallel)
    const thumbDir = this.vec(lm[3], lm[4])
    const indexDir = this.vec(lm[6], lm[8])
    const angle = this.angleBetween(thumbDir, indexDir)
    // Converging fingers: angle 60-180° is good
    const angleScore = angle >= 60 ? 1.0 : angle / 60

    return distScore * 0.6 + depthScore * 0.2 + angleScore * 0.2
  }

  /** FIST: all fingertips close to wrist */
  private scoreFist(lm: Landmark[], handSize: number): number {
    const tips = [4, 8, 12, 16, 20]
    const avgDist = tips.reduce((sum, i) => sum + this.dist(lm[i], lm[0]), 0) / tips.length
    const normalized = avgDist / handSize

    // Score: 1.0 when normalized < 0.18, 0.0 when > 0.35
    if (normalized < 0.18) return 1.0
    if (normalized > 0.35) return 0.0
    return 1.0 - (normalized - 0.18) / (0.35 - 0.18)
  }

  /** OPEN: all fingertips far from wrist */
  private scoreOpen(lm: Landmark[], handSize: number): number {
    const tips = [4, 8, 12, 16, 20]
    const avgDist = tips.reduce((sum, i) => sum + this.dist(lm[i], lm[0]), 0) / tips.length
    const normalized = avgDist / handSize

    // Score: 1.0 when normalized > 0.38, 0.0 when < 0.22
    if (normalized > 0.38) return 1.0
    if (normalized < 0.22) return 0.0
    return (normalized - 0.22) / (0.38 - 0.22)
  }

  /** POINT: only index finger extended */
  private scorePoint(lm: Landmark[]): number {
    const indexExt = this.isExtended(lm, 8, 6) ? 1.0 : 0.0
    const middleFolded = this.isExtended(lm, 12, 10) ? 0.0 : 1.0
    const ringFolded = this.isExtended(lm, 16, 14) ? 0.0 : 1.0
    const pinkyFolded = this.isExtended(lm, 20, 18) ? 0.0 : 1.0

    return indexExt * 0.4 + middleFolded * 0.2 + ringFolded * 0.2 + pinkyFolded * 0.2
  }

  /** THREE_FINGER: middle + ring + pinky extended, index + thumb folded */
  private scoreThreeFinger(lm: Landmark[]): number {
    const middleExt = this.isExtended(lm, 12, 10) ? 1.0 : 0.0
    const ringExt = this.isExtended(lm, 16, 14) ? 1.0 : 0.0
    const pinkyExt = this.isExtended(lm, 20, 18) ? 1.0 : 0.0
    const indexFolded = this.isExtended(lm, 8, 6) ? 0.0 : 1.0
    const thumbFolded = this.isExtended(lm, 4, 2) ? 0.0 : 1.0

    return (middleExt + ringExt + pinkyExt + indexFolded + thumbFolded) / 5
  }

  // ─── Stability & Velocity ───────────────────────────────────

  /** Low movement between frames = high stability */
  private calculateStabilityScore(landmarks: Landmark[]): number {
    if (!this.hasPreviousLandmarks || this.previousLandmarks.length !== landmarks.length) {
      return 0.8 // Neutral on first frame
    }

    let totalMovement = 0
    for (let i = 0; i < landmarks.length; i++) {
      totalMovement += this.dist(landmarks[i], this.previousLandmarks[i])
    }
    const avgMovement = totalMovement / landmarks.length

    // Movement > 0.05 = unstable (score 0), < 0.005 = very stable (score 1)
    if (avgMovement < 0.005) return 1.0
    if (avgMovement > 0.05) return 0.0
    return 1.0 - (avgMovement - 0.005) / (0.05 - 0.005)
  }

  /** High hand velocity = likely transition, not intentional gesture */
  private calculateVelocityScore(landmarks: Landmark[]): number {
    if (!this.hasPreviousLandmarks || this.previousLandmarks.length !== landmarks.length) {
      return 0.8 // Neutral on first frame
    }

    // Use palm center (landmark 9) for velocity
    const velocity = this.dist(landmarks[9], this.previousLandmarks[9])

    // Velocity > 0.08 = moving fast (score 0), < 0.01 = stationary (score 1)
    if (velocity < 0.01) return 1.0
    if (velocity > 0.08) return 0.0
    return 1.0 - (velocity - 0.01) / (0.08 - 0.01)
  }

  // ─── Helpers ────────────────────────────────────────────────

  private dist(a: Landmark, b: Landmark): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    const dz = a.z - b.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  private vec(from: Landmark, to: Landmark): { x: number; y: number; z: number } {
    return { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
  }

  private angleBetween(
    v1: { x: number; y: number; z: number },
    v2: { x: number; y: number; z: number }
  ): number {
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z
    const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2)
    const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2)
    if (mag1 === 0 || mag2 === 0) return 0
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)))
    return Math.acos(cosAngle) * (180 / Math.PI)
  }

  /** Check if a finger is extended: tip farther from wrist than DIP */
  private isExtended(lm: Landmark[], tipIdx: number, dipIdx: number): boolean {
    return this.dist(lm[0], lm[tipIdx]) > this.dist(lm[0], lm[dipIdx]) * 1.15
  }
}
