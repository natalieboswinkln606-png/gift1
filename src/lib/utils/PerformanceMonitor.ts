import type { QualityLevel } from '@/types'

export class PerformanceMonitor {
  private fps = 60
  private frameCount = 0
  private lastTime = performance.now()
  private emaFps = 60
  private readonly EMA_ALPHA = 0.1
  private currentQuality: QualityLevel
  private lastCheckTime = 0
  private consecutiveLowFrames = 0
  private consecutiveHighFrames = 0
  private onQualityChange: ((quality: QualityLevel) => void) | null = null

  constructor() {
    this.currentQuality = PerformanceMonitor.detectInitialQuality()
  }

  // 根据设备硬件能力预判初始质量等级
  static detectInitialQuality(): QualityLevel {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'HIGH'
    const cores = navigator.hardwareConcurrency || 4
    const dpr = window.devicePixelRatio || 1
    if (cores <= 2) return 'LOW'
    if (cores <= 4 || dpr <= 1) return 'MEDIUM'
    return 'HIGH'
  }

  setOnQualityChange(callback: (quality: QualityLevel) => void): void {
    this.onQualityChange = callback
  }

  update(): void {
    this.frameCount++
    const now = performance.now()
    const delta = now - this.lastTime

    if (delta >= 1000) {
      const instantFps = Math.round((this.frameCount * 1000) / delta)
      this.fps = instantFps
      this.emaFps = this.EMA_ALPHA * instantFps + (1 - this.EMA_ALPHA) * this.emaFps

      this.frameCount = 0
      this.lastTime = now

      if (now - this.lastCheckTime >= 1000) {
        this.checkQuality()
        this.lastCheckTime = now
      }
    }
  }

  private checkQuality(): void {
    if (this.emaFps < 25 && this.currentQuality !== 'LOW') {
      this.consecutiveLowFrames++
      this.consecutiveHighFrames = 0
      if (this.consecutiveLowFrames >= 2) {
        this.setQuality('LOW')
        this.consecutiveLowFrames = 0
      }
    } else if (this.emaFps < 40 && this.currentQuality === 'HIGH') {
      this.consecutiveLowFrames++
      this.consecutiveHighFrames = 0
      if (this.consecutiveLowFrames >= 2) {
        this.setQuality('MEDIUM')
        this.consecutiveLowFrames = 0
      }
    } else if (this.emaFps >= 40 && this.currentQuality !== 'HIGH') {
      this.consecutiveHighFrames++
      this.consecutiveLowFrames = 0
      if (this.consecutiveHighFrames >= 3) {
        this.setQuality('HIGH')
        this.consecutiveHighFrames = 0
      }
    } else {
      this.consecutiveLowFrames = 0
      this.consecutiveHighFrames = 0
    }
  }

  private setQuality(quality: QualityLevel): void {
    if (quality === this.currentQuality) return
    this.currentQuality = quality
    this.onQualityChange?.(quality)
  }

  getFPS(): number {
    return this.fps
  }

  getQuality(): QualityLevel {
    return this.currentQuality
  }
}
