import type { QualityLevel } from '@/types'

/**
 * 运行时 FPS 监控器：根据实际帧率动态调整质量等级
 *
 * 适配自参考版本，增加以下改进：
 * - 构造函数接受 initialQuality 参数，ULTRA_LOW 设备跳过动态调整
 * - 降级下限为 LOW（永远不会动态设为 ULTRA_LOW，该等级仅由 QualityDetector 静态检测设定）
 * - 升级需要连续 180 帧（3 秒）高 FPS，避免短暂峰值误触发
 */

// 质量等级排序（用于升降级比较）
const QUALITY_ORDER: QualityLevel[] = ['ULTRA_LOW', 'LOW', 'MEDIUM', 'HIGH']

// 阈值配置
const DOWNGRADE_FPS = 24       // 低于此值触发降级
const UPGRADE_FPS = 50         // 高于此值触发升级
const SAMPLE_FRAMES = 60       // 采样帧数（约 1 秒）
const UPGRADE_STREAK_NEEDED = 3 // 连续 3 个采样周期（~3 秒）高 FPS 才升级

export class PerformanceMonitor {
  private currentQuality: QualityLevel
  private frameTimes: number[] = []
  private onQualityChange: ((quality: QualityLevel) => void) | null = null
  private upgradeStreak = 0
  private skipDynamic: boolean  // ULTRA_LOW 设备跳过动态调整

  constructor(initialQuality: QualityLevel) {
    this.currentQuality = initialQuality
    // ULTRA_LOW 设备已经是最低配置，无需动态调整
    this.skipDynamic = initialQuality === 'ULTRA_LOW'
  }

  /** 注册质量变化回调 */
  setOnQualityChange(callback: (quality: QualityLevel) => void): void {
    this.onQualityChange = callback
  }

  /** 每帧调用，传入 deltaTime（秒） */
  update(dt: number): void {
    if (this.skipDynamic) return

    this.frameTimes.push(dt)

    if (this.frameTimes.length >= SAMPLE_FRAMES) {
      const avgDt = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
      const avgFps = avgDt > 0 ? 1 / avgDt : 60
      this.frameTimes.length = 0

      const currentIndex = QUALITY_ORDER.indexOf(this.currentQuality)

      if (avgFps < DOWNGRADE_FPS && currentIndex > 1) {
        // 降级（下限为 LOW，索引 1）
        this.upgradeStreak = 0
        const newQuality = QUALITY_ORDER[currentIndex - 1]
        // 确保不降到 ULTRA_LOW（索引 0）
        if (newQuality !== 'ULTRA_LOW') {
          this.currentQuality = newQuality
          this.onQualityChange?.(newQuality)
        }
      } else if (avgFps > UPGRADE_FPS && currentIndex < QUALITY_ORDER.length - 1) {
        // 升级需要连续多个周期确认
        this.upgradeStreak++
        if (this.upgradeStreak >= UPGRADE_STREAK_NEEDED) {
          this.upgradeStreak = 0
          const newQuality = QUALITY_ORDER[currentIndex + 1]
          this.currentQuality = newQuality
          this.onQualityChange?.(newQuality)
        }
      } else {
        // FPS 在正常范围，重置升级计数
        this.upgradeStreak = 0
      }
    }
  }

  getQuality(): QualityLevel {
    return this.currentQuality
  }
}
