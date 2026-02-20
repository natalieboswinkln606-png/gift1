import { Scene, WebGLRenderer } from 'three'
import type { UserConfig } from '@/types'
import { HeartDualSystem } from './HeartDualSystem'
import { HeartSubtitleBanner } from './HeartSubtitleBanner'
import { SilhouetteDisplay } from './SilhouetteDisplay'
import { detectQuality, getQualityPreset } from '@/lib/utils/QualityDetector'

/**
 * 爱心场景组合系统
 * 组合双爱心粒子 + 字幕条 + 人物轮廓，作为星轨场景的第二个子场景
 */
export class HeartSceneSystem {
  private heartDual: HeartDualSystem
  private subtitleBanner: HeartSubtitleBanner
  private silhouetteDisplay: SilhouetteDisplay
  private _visible = false

  constructor(
    scene: Scene,
    renderer: WebGLRenderer,
    config: UserConfig,
    userId: string,
  ) {
    // 双爱心粒子系统（根据质量等级调整粒子数）
    const qualityLevel = detectQuality(renderer)
    const preset = getQualityPreset(qualityLevel)
    this.heartDual = new HeartDualSystem(scene, preset.heartParticleCount)

    // 字幕条
    const blessing = config.starryBlessing || '星河璀璨，入梦皆甜，万般心意皆有回响。'
    this.subtitleBanner = new HeartSubtitleBanner(scene, renderer, config.name, blessing)

    // 人物轮廓
    this.silhouetteDisplay = new SilhouetteDisplay(scene, renderer)

    // 异步加载轮廓图
    if (config.starrySilhouette) {
      this.silhouetteDisplay.loadSilhouette(userId, config.starrySilhouette)
    }
  }

  get visible(): boolean {
    return this._visible
  }

  set visible(v: boolean) {
    this._visible = v
    this.heartDual.visible = v
    this.subtitleBanner.visible = v
    this.silhouetteDisplay.visible = v
  }

  update(time: number, dt: number): void {
    if (!this._visible) return
    this.heartDual.update(time, dt)
    this.subtitleBanner.update(time, dt)
    this.silhouetteDisplay.update(time, dt)
  }

  dispose(): void {
    this.heartDual.dispose()
    this.subtitleBanner.dispose()
    this.silhouetteDisplay.dispose()
  }
}
