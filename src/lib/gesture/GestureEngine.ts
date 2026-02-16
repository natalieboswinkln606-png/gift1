import { GestureStabilizer } from './GestureStabilizer'
import { GestureInterpolator } from './GestureInterpolator'
import { useGestureStore } from '@/stores/useGestureStore'
import type { GestureType, Landmark } from '@/types'

/**
 * GestureEngine — Singleton orchestrator for the entire gesture system.
 *
 * Manages: MediaPipe initialization, camera stream, detection loop,
 * 4-layer stabilization, RAF-batched store updates, and shared video element.
 *
 * Optimizations:
 * - RAF-batched store updates (max 60/sec, single setState per frame)
 * - Uses smoothed landmarks for cursor position (not raw)
 * - Interpolation for dropped frames
 */

class GestureEngine {
  private static instance: GestureEngine | null = null

  // Dynamic import type — GestureRecognizer loaded lazily to avoid SSR
  private recognizer: import('./GestureRecognizer').GestureRecognizer | null = null
  private stabilizer: GestureStabilizer | null = null
  private interpolator: GestureInterpolator | null = null

  private _initialized = false
  private _detecting = false
  private _detectionGeneration = 0

  // RAF batching — accumulate updates, flush once per frame
  private pendingUpdate: Record<string, unknown> | null = null
  private batchRafId = 0

  // Cursor fallback — track last known position when hand disappears
  private lastKnownCursor = { x: 0, y: 0 }

  // ─── Singleton ───────────────────────────────────────────────

  static getInstance(): GestureEngine {
    if (!GestureEngine.instance) {
      GestureEngine.instance = new GestureEngine()
    }
    return GestureEngine.instance
  }

  private constructor() {}

  // ─── Lifecycle ───────────────────────────────────────────────

  /**
   * Initialize MediaPipe HandLandmarker + camera stream.
   * Call once after user grants camera permission.
   * Returns true if successful, false if camera/MediaPipe failed.
   */
  async initialize(): Promise<boolean> {
    if (this._initialized) return true

    try {
      // Dynamic import to avoid SSR issues — GestureRecognizer imports MediaPipe
      const { GestureRecognizer } = await import('./GestureRecognizer')

      this.recognizer = new GestureRecognizer()
      this.stabilizer = new GestureStabilizer()
      this.interpolator = new GestureInterpolator()

      const success = await this.recognizer.init()
      if (!success) {
        console.warn('[GestureEngine] Recognizer init failed')
        this.cleanup()
        return false
      }

      // Share video element with the store (for HandCamera)
      const video = this.recognizer.getVideoElement()
      if (video) {
        useGestureStore.getState().setVideoElement(video)
      }

      this._initialized = true
      useGestureStore.getState().setCameraPermission('granted')
      return true
    } catch (err) {
      console.warn('[GestureEngine] Initialize failed:', err)
      this.cleanup()
      return false
    }
  }

  /**
   * Start the detection loop. Updates useGestureStore via RAF batching.
   */
  startDetection(): void {
    if (!this._initialized || this._detecting || !this.recognizer) return

    this._detecting = true
    this._detectionGeneration++
    const detectionGen = this._detectionGeneration
    useGestureStore.getState().setEnabled(true)

    this.recognizer.startDetection((
      gesture: string,
      landmarks: Landmark[] | null,
      wristPos: { x: number; y: number } | null
    ) => {
      if (detectionGen !== this._detectionGeneration || !this.stabilizer || !this.interpolator) return

      const rawGesture = gesture as GestureType
      const confidence = rawGesture !== 'NONE' ? 1.0 : 0

      // Run through 4-layer stabilization pipeline
      const result = this.stabilizer.stabilize(rawGesture, confidence, landmarks)

       // Compute cursor position from SMOOTHED landmarks (not raw)
       let cursorX: number
       let cursorY: number

       const smoothed = result.smoothedLandmarks
       if (smoothed && smoothed.length > 8) {
         // Use smoothed index fingertip, mirrored on X axis
         cursorX = (1 - smoothed[8].x) * window.innerWidth
         cursorY = smoothed[8].y * window.innerHeight
         this.interpolator.update({ x: cursorX, y: cursorY })
         this.lastKnownCursor = { x: cursorX, y: cursorY }
       } else if (landmarks && landmarks.length > 8) {
         // Fallback to raw landmarks if smoothed not available
         cursorX = (1 - landmarks[8].x) * window.innerWidth
         cursorY = landmarks[8].y * window.innerHeight
         this.interpolator.update({ x: cursorX, y: cursorY })
         this.lastKnownCursor = { x: cursorX, y: cursorY }
       } else {
         // No hand detected — predict position from velocity
         // If interpolator not initialized, use last known position
         if (this.interpolator.isInitialized()) {
           const predicted = this.interpolator.predict(33) // ~30fps
           cursorX = predicted.x
           cursorY = predicted.y
         } else {
           cursorX = this.lastKnownCursor.x
           cursorY = this.lastKnownCursor.y
         }
       }

      // Batch all updates into a single setState per RAF frame
      this.scheduleStoreUpdate({
        currentGesture: result.gesture,
        confidence: result.confidence,
        cursorPosition: { x: cursorX, y: cursorY },
        landmarks,
        smoothedLandmarks: result.smoothedLandmarks,
        handPosition: wristPos ? { x: wristPos.x, y: wristPos.y, z: 0 } : null,
      })
    })
  }

  /**
   * Pause detection loop. Camera stream stays alive for quick resume.
   */
  stopDetection(): void {
    if (!this._detecting || !this.recognizer) return

    this._detecting = false
    this._detectionGeneration++
    this.recognizer.pause()

    // Cancel pending batch
    if (this.batchRafId) {
      cancelAnimationFrame(this.batchRafId)
      this.batchRafId = 0
      this.pendingUpdate = null
    }

    // Reset gesture state but keep permission/video
    useGestureStore.setState({
      currentGesture: 'NONE' as GestureType,
      confidence: 0,
      isEnabled: false,
      landmarks: null,
      smoothedLandmarks: null,
      handPosition: null,
    })

    this.stabilizer?.reset()
    this.interpolator?.reset()
  }

  /**
   * Resume detection after pause. Camera stream is still alive.
   */
  resumeDetection(): void {
    if (!this._initialized || this._detecting || !this.recognizer) return
    if (this.recognizer.getState() !== 'paused') return

    this._detecting = true
    useGestureStore.getState().setEnabled(true)
    this.recognizer.resume()
  }

  /**
   * Full cleanup — release all resources. Call on app unmount.
   */
  dispose(): void {
    this._detecting = false
    this._detectionGeneration++

    // Cancel pending batch
    if (this.batchRafId) {
      cancelAnimationFrame(this.batchRafId)
      this.batchRafId = 0
      this.pendingUpdate = null
    }

    if (this.recognizer) {
      this.recognizer.dispose()
      this.recognizer = null
    }

    this.stabilizer = null
    this.interpolator = null
    this._initialized = false

    // Clear store in one call
    useGestureStore.setState({
      currentGesture: 'NONE' as GestureType,
      confidence: 0,
      isEnabled: false,
      landmarks: null,
      smoothedLandmarks: null,
      handPosition: null,
      videoElement: null,
    })

    GestureEngine.instance = null
  }

  // ─── Accessors ───────────────────────────────────────────────

  getVideoElement(): HTMLVideoElement | null {
    return this.recognizer?.getVideoElement() ?? null
  }

  isInitialized(): boolean {
    return this._initialized
  }

  isDetecting(): boolean {
    return this._detecting
  }

  // ─── Internal ────────────────────────────────────────────────

  /**
   * RAF-batched store update. Accumulates updates and flushes once per frame.
   * Reduces React re-renders from ~30/sec (per detection) to max 60/sec (per display frame).
   * Multiple detection callbacks within the same frame are merged.
   */
  private scheduleStoreUpdate(data: Record<string, unknown>): void {
    // Merge into pending update
    this.pendingUpdate = { ...this.pendingUpdate, ...data }

    // Schedule flush if not already scheduled
    if (!this.batchRafId) {
      this.batchRafId = requestAnimationFrame(() => {
        if (this.pendingUpdate) {
          useGestureStore.setState(this.pendingUpdate)
          this.pendingUpdate = null
        }
        this.batchRafId = 0
      })
    }
  }

  private cleanup(): void {
    if (this.recognizer) {
      this.recognizer.dispose()
      this.recognizer = null
    }
    this.stabilizer = null
    this.interpolator = null
    this._initialized = false
    this._detecting = false
    useGestureStore.getState().setVideoElement(null)
  }
}

export const gestureEngine = GestureEngine.getInstance()
export { GestureEngine }
