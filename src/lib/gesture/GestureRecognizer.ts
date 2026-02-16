type GestureType = 'FIST' | 'OPEN' | 'PINCH' | 'THREE_FINGER' | 'POINT' | 'NONE'

interface LM {
  x: number
  y: number
  z: number
}

type DetectionCallback = (
  gesture: GestureType,
  landmarks: LM[] | null,
  wristPos: { x: number; y: number } | null
) => void

type RecognizerState = 'idle' | 'running' | 'paused'

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

// ─── Helpers ────────────────────────────────────────────────

function dist3d(a: LM, b: LM): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function dist2d(a: LM, b: LM): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Bounding box diagonal of all landmarks — hand-size invariant normalization */
function handSize(lm: LM[]): number {
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

function isFingerExtended(lm: LM[], tip: number, dip: number): boolean {
  return dist3d(lm[0], lm[tip]) > dist3d(lm[0], lm[dip]) * 1.15
}

function angleBetweenVectors(
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

// ─── Gesture Classification (hand-size normalized) ──────────

function isPinch(lm: LM[], hs: number, velocity: number): boolean {
  if (hs === 0) return false

  // 1. Distance check (normalized by hand size)
  const tipDist = dist3d(lm[4], lm[8]) / hs
  if (tipDist > 0.12) return false

  // 2. Velocity check — no pinch during fast hand movement
  if (velocity > 0.08) return false

  // 3. Angle check — thumb and index must converge (not parallel)
  const thumbDir = { x: lm[4].x - lm[3].x, y: lm[4].y - lm[3].y, z: lm[4].z - lm[3].z }
  const indexDir = { x: lm[8].x - lm[6].x, y: lm[8].y - lm[6].y, z: lm[8].z - lm[6].z }
  const angle = angleBetweenVectors(thumbDir, indexDir)
  if (angle < 30) return false // Parallel fingers — not a real pinch

  // 4. Depth check — fingers must be on same depth plane
  const depthDiff = Math.abs(lm[4].z - lm[8].z)
  if (depthDiff > 0.06) return false

  return true
}

function isFist(lm: LM[], hs: number): boolean {
  if (hs === 0) return false
  const tips = [4, 8, 12, 16, 20]
  const avgDist = tips.reduce((sum, i) => sum + dist3d(lm[i], lm[0]), 0) / tips.length
  return avgDist / hs < 0.22
}

function isOpen(lm: LM[], hs: number): boolean {
  if (hs === 0) return false
  const tips = [4, 8, 12, 16, 20]
  const avgDist = tips.reduce((sum, i) => sum + dist3d(lm[i], lm[0]), 0) / tips.length
  return avgDist / hs > 0.38
}

function isThreeFinger(lm: LM[]): boolean {
  const middleExt = isFingerExtended(lm, 12, 10)
  const ringExt = isFingerExtended(lm, 16, 14)
  const pinkyExt = isFingerExtended(lm, 20, 18)
  const indexFolded = !isFingerExtended(lm, 8, 6)
  const thumbFolded = !isFingerExtended(lm, 4, 2)
  return middleExt && ringExt && pinkyExt && indexFolded && thumbFolded
}

function isPoint(lm: LM[]): boolean {
  const indexExt = isFingerExtended(lm, 8, 6)
  const middleFolded = !isFingerExtended(lm, 12, 10)
  const ringFolded = !isFingerExtended(lm, 16, 14)
  const pinkyFolded = !isFingerExtended(lm, 20, 18)
  return indexExt && middleFolded && ringFolded && pinkyFolded
}

function classifyGesture(lm: LM[], hs: number, velocity: number): GestureType {
  // Priority order: PINCH > THREE_FINGER > POINT > FIST > OPEN
  if (isPinch(lm, hs, velocity)) return 'PINCH'
  if (isThreeFinger(lm)) return 'THREE_FINGER'
  if (isPoint(lm)) return 'POINT'
  if (isFist(lm, hs)) return 'FIST'
  if (isOpen(lm, hs)) return 'OPEN'
  return 'NONE'
}

// ─── GestureRecognizer ──────────────────────────────────────

export class GestureRecognizer {
  private handLandmarker: { detectForVideo(v: HTMLVideoElement, t: number): { landmarks: LM[][] }; close(): void } | null = null
  private video: HTMLVideoElement | null = null
  private stream: MediaStream | null = null
  private state: RecognizerState = 'idle'
  private animFrameId = 0
  private frameCount = 0
  private callback: DetectionCallback | null = null
  private inFlight = false

  // Velocity tracking for false positive prevention
  private prevCenter: { x: number; y: number } | null = null
  private handVelocity = 0

  // Adaptive frame skip
  private adaptiveSkip = 2

  // Detection timeout to prevent stalling
  private lastDetectionTime = 0
  private readonly DETECTION_TIMEOUT = 100

  async init(): Promise<boolean> {
    try {
      // Dynamic import — avoids SSR evaluation of MediaPipe
      const vision = await import('@mediapipe/tasks-vision')

      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_CDN)

      // Try GPU first, fallback to CPU
      let handLandmarker: typeof this.handLandmarker
      try {
        handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.7,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })
      } catch {
        console.warn('[GestureRecognizer] GPU delegate failed, falling back to CPU')
        handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.7,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })
      }

      this.handLandmarker = handLandmarker

      // Request camera
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      })

      this.video = document.createElement('video')
      this.video.srcObject = this.stream
      this.video.setAttribute('playsinline', 'true')
      this.video.muted = true
      await this.video.play()

      this.state = 'paused'
      return true
    } catch (err) {
      console.warn('[GestureRecognizer] init failed:', err)
      this.fullCleanup()
      return false
    }
  }

  startDetection(callback: DetectionCallback): void {
    if (this.state === 'running') return
    if (!this.handLandmarker || !this.video) return

    this.callback = callback
    this.state = 'running'
    this.frameCount = 0
    this.inFlight = false
    this.prevCenter = null
    this.handVelocity = 0
    this.adaptiveSkip = 2
    this.detectLoop()
  }

  pause(): void {
    if (this.state !== 'running') return
    this.state = 'paused'
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = 0
    }
    // Camera stream stays alive
  }

  resume(): void {
    if (this.state !== 'paused' || !this.callback) return
    this.state = 'running'
    this.inFlight = false
    this.detectLoop()
  }

  dispose(): void {
    this.state = 'idle'
    this.callback = null
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = 0
    }
    this.fullCleanup()
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.video
  }

  getState(): RecognizerState {
    return this.state
  }

  // ─── Internal ────────────────────────────────────────────────

  /** Calculate hand center velocity for adaptive detection + PINCH filtering */
  private updateVelocity(lm: LM[]): void {
    // Use palm center (landmark 9) for velocity
    const center = { x: lm[9].x, y: lm[9].y }

    if (this.prevCenter) {
      this.handVelocity = dist2d(
        { x: center.x, y: center.y, z: 0 },
        { x: this.prevCenter.x, y: this.prevCenter.y, z: 0 }
      )
    }

    this.prevCenter = center

    // Adaptive frame skip based on velocity:
    // Fast movement → detect every frame (skip=1)
    // Medium → every 2nd frame (skip=2)
    // Slow/stationary → every 3rd frame (skip=3)
    if (this.handVelocity > 0.05) {
      this.adaptiveSkip = 1
    } else if (this.handVelocity > 0.02) {
      this.adaptiveSkip = 2
    } else {
      this.adaptiveSkip = 3
    }
  }

  private detectLoop(): void {
    const detect = (): void => {
      if (this.state !== 'running') return

      this.frameCount++

      // Check if detection has stalled (inFlight for too long)
      if (this.inFlight && performance.now() - this.lastDetectionTime > this.DETECTION_TIMEOUT) {
        console.warn('[GestureRecognizer] Detection timeout detected, resetting inFlight flag')
        this.inFlight = false
      }

      // Adaptive frame skip — adjusts based on hand movement speed
      if (this.frameCount % this.adaptiveSkip === 0 && !this.inFlight && this.video && this.handLandmarker && this.callback) {
        this.inFlight = true
        this.lastDetectionTime = performance.now()
        try {
          const result = this.handLandmarker.detectForVideo(
            this.video,
            performance.now()
          )

          if (result.landmarks && result.landmarks.length > 0) {
            const lm = result.landmarks[0]

            // Update velocity tracking
            this.updateVelocity(lm)

            // Classify with hand-size normalization + velocity awareness
            const hs = handSize(lm)
            const gesture = classifyGesture(lm, hs, this.handVelocity)
            const wristPos = { x: lm[0].x, y: lm[0].y }
            this.callback(gesture, lm, wristPos)
          } else {
            this.prevCenter = null
            this.handVelocity = 0
            this.adaptiveSkip = 2
            this.callback('NONE', null, null)
          }
        } catch {
          // Skip frame on detection error
        }
        this.inFlight = false
      }

      this.animFrameId = requestAnimationFrame(detect)
    }

    this.animFrameId = requestAnimationFrame(detect)
  }

  private fullCleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    if (this.handLandmarker) {
      try { this.handLandmarker.close() } catch { /* ignore */ }
      this.handLandmarker = null
    }

    if (this.video) {
      this.video.srcObject = null
      this.video = null
    }
  }
}
