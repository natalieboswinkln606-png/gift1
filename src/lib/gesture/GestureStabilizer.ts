import { OneEuroFilter3D } from './OneEuroFilter'
import { GestureConfidence } from './GestureConfidence'
import type { GestureType, Landmark } from '@/types'

/** Number of MediaPipe hand landmarks */
const LANDMARK_COUNT = 21

/** Hysteresis thresholds — enter requires stronger signal than exit */
const HYSTERESIS: Partial<Record<GestureType, { enter: number; exit: number }>> = {
  PINCH:        { enter: 0.55, exit: 0.35 },
  FIST:         { enter: 0.50, exit: 0.30 },
  OPEN:         { enter: 0.50, exit: 0.30 },
  POINT:        { enter: 0.50, exit: 0.30 },
  THREE_FINGER: { enter: 0.50, exit: 0.30 },
}

/** Target voting window duration in ms — adapts to actual frame rate */
const VOTE_WINDOW_TARGET_MS = 150
const VOTE_WINDOW_MIN = 3
const VOTE_WINDOW_MAX = 12

const COOLDOWN_MS = 150

export interface StabilizedResult {
  gesture: GestureType
  confidence: number
  smoothedLandmarks: Landmark[] | null
}

export class GestureStabilizer {
  // Layer 1: One Euro Filters — 21 landmarks × 3D
  private landmarkFilters: OneEuroFilter3D[] = []

  // Layer 2: Voting window (frame-rate aware)
  private voteHistory: Array<{ gesture: GestureType; confidence: number }> = []
  private dynamicVoteWindow = 5

  // Layer 3: Hysteresis state
  private confirmedGesture: GestureType = 'NONE'
  private confirmedConfidence = 0

  // Layer 4: Cooldown
  private lastChangeTime = 0

  // FPS tracking for dynamic vote window
  private lastFrameTime = 0
  private fpsEstimate = 30

  // Confidence scorer
  private confidenceScorer: GestureConfidence

  constructor() {
    // 21 landmarks, each with a 3D One Euro Filter
    // Params: minCutoff=1.0 Hz, beta=0.007, dCutoff=1.0 Hz, initialFreq=30
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      this.landmarkFilters.push(new OneEuroFilter3D(1.0, 0.007, 1.0, 30))
    }
    this.confidenceScorer = new GestureConfidence()
  }

  /**
   * Full 4-layer stabilization pipeline.
   * Returns the stabilized gesture, confidence, and smoothed landmarks.
   */
  stabilize(
    rawGesture: GestureType,
    _rawConfidence: number,
    landmarks: Landmark[] | null
  ): StabilizedResult {
    // Update FPS estimate
    this.updateFps()

    // Layer 1: One Euro filter ALL 21 landmarks
    const smoothedLandmarks = landmarks ? this.smoothLandmarks(landmarks) : null

    // Compute confidence via GestureConfidence scorer (replaces raw binary confidence)
    let confidence: number
    let scoredGesture: GestureType

    if (smoothedLandmarks && smoothedLandmarks.length >= 21) {
      const hs = this.handSize(smoothedLandmarks)
      const best = this.confidenceScorer.getBestGesture(smoothedLandmarks, hs, 0.4)
      scoredGesture = best.gesture
      confidence = best.confidence
    } else {
      scoredGesture = rawGesture
      confidence = rawGesture !== 'NONE' ? 0.5 : 0
    }

    // Layer 2: Voting — push scored gesture + confidence into window
    this.voteHistory.push({ gesture: scoredGesture, confidence })
    while (this.voteHistory.length > this.dynamicVoteWindow) {
      this.voteHistory.shift()
    }
    const voted = this.vote()

    // Layer 3: Hysteresis — only switch if confidence exceeds threshold
    const hysteresisResult = this.applyHysteresis(voted.gesture, voted.confidence)

    // Layer 4: Cooldown — prevent rapid switching
    const finalGesture = this.applyCooldown(hysteresisResult)

    return {
      gesture: finalGesture,
      confidence: finalGesture === this.confirmedGesture ? this.confirmedConfidence : voted.confidence,
      smoothedLandmarks,
    }
  }

  /** Get the current confirmed gesture without processing a new frame */
  getCurrentGesture(): GestureType {
    return this.confirmedGesture
  }

  /** Reset all state (e.g., on scene transition) */
  reset(): void {
    this.voteHistory = []
    this.confirmedGesture = 'NONE'
    this.confirmedConfidence = 0
    this.lastChangeTime = 0
    this.lastFrameTime = 0
    this.fpsEstimate = 30
    this.dynamicVoteWindow = 5
    for (const f of this.landmarkFilters) {
      f.reset()
    }
    this.confidenceScorer.reset()
  }

  // ─── Layer 1: One Euro Filtering (ALL 21 landmarks) ─────────

  private smoothLandmarks(landmarks: Landmark[]): Landmark[] {
    const now = performance.now()
    const result: Landmark[] = []

    for (let i = 0; i < landmarks.length; i++) {
      if (i < this.landmarkFilters.length) {
        result.push(this.landmarkFilters[i].filter(landmarks[i], now))
      } else {
        // Shouldn't happen with 21 landmarks, but safety fallback
        result.push({ x: landmarks[i].x, y: landmarks[i].y, z: landmarks[i].z })
      }
    }

    return result
  }

  // ─── Layer 2: Confidence-Weighted Voting ─────────────────────

  private vote(): { gesture: GestureType; confidence: number } {
    if (this.voteHistory.length < VOTE_WINDOW_MIN) {
      const last = this.voteHistory[this.voteHistory.length - 1]
      return last ?? { gesture: 'NONE', confidence: 0 }
    }

    // Confidence-weighted vote counting
    const weights = new Map<GestureType, number>()
    const counts = new Map<GestureType, number>()

    for (const entry of this.voteHistory) {
      weights.set(entry.gesture, (weights.get(entry.gesture) ?? 0) + entry.confidence)
      counts.set(entry.gesture, (counts.get(entry.gesture) ?? 0) + 1)
    }

    let bestGesture: GestureType = 'NONE'
    let bestWeight = 0
    let bestCount = 0

    weights.forEach((weight, gesture) => {
      const count = counts.get(gesture) ?? 0
      if (weight > bestWeight) {
        bestWeight = weight
        bestGesture = gesture
        bestCount = count
      }
    })

    // Require at least 60% frame consensus
    const consensusThreshold = Math.ceil(this.voteHistory.length * 0.6)
    if (bestCount < consensusThreshold) {
      return { gesture: this.confirmedGesture, confidence: this.confirmedConfidence }
    }

    // Average confidence for the winning gesture
    const avgConfidence = bestCount > 0 ? bestWeight / bestCount : 0

    return { gesture: bestGesture, confidence: avgConfidence }
  }

  // ─── Layer 3: Hysteresis ─────────────────────────────────────

  private applyHysteresis(votedGesture: GestureType, confidence: number): GestureType {
    if (votedGesture === this.confirmedGesture) {
      this.confirmedConfidence = confidence
      return this.confirmedGesture
    }

    const enterThreshold = HYSTERESIS[votedGesture]?.enter ?? 0.45
    const exitThreshold = HYSTERESIS[this.confirmedGesture]?.exit ?? 0.25

    if (confidence >= enterThreshold || this.confirmedConfidence <= exitThreshold) {
      return votedGesture
    }

    return this.confirmedGesture
  }

  // ─── Layer 4: Cooldown ───────────────────────────────────────

  private applyCooldown(gesture: GestureType): GestureType {
    if (gesture === this.confirmedGesture) {
      return this.confirmedGesture
    }

    const now = performance.now()
    if (now - this.lastChangeTime < COOLDOWN_MS) {
      return this.confirmedGesture
    }

    this.confirmedGesture = gesture
    this.confirmedConfidence = 0
    this.lastChangeTime = now
    return gesture
  }

  // ─── FPS Tracking & Dynamic Vote Window ─────────────────────

  private updateFps(): void {
    const now = performance.now()
    if (this.lastFrameTime > 0) {
      const dt = now - this.lastFrameTime
      if (dt > 0 && dt < 500) {
        // Exponential moving average for FPS
        const instantFps = 1000 / dt
        this.fpsEstimate = this.fpsEstimate * 0.8 + instantFps * 0.2

        // Dynamic vote window: ~150ms worth of frames
        // 60fps → 9 frames, 30fps → 5 frames, 20fps → 3 frames
        const targetFrames = Math.round(VOTE_WINDOW_TARGET_MS / (1000 / this.fpsEstimate))
        this.dynamicVoteWindow = Math.max(VOTE_WINDOW_MIN, Math.min(VOTE_WINDOW_MAX, targetFrames))
      }
    }
    this.lastFrameTime = now
  }

  // ─── Helpers ────────────────────────────────────────────────

  /** Bounding box diagonal of all landmarks — hand-size invariant normalization */
  private handSize(lm: Landmark[]): number {
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    for (const p of lm) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    const w = maxX - minX
    const h = maxY - minY
    return Math.sqrt(w * w + h * h)
  }
}
