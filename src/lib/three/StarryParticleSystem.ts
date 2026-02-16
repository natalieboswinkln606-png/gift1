import * as THREE from 'three'
import { AtomCore } from './AtomCore'
import { OrbitRings } from './OrbitRings'
import { SubtitleScreen } from './SubtitleScreen'

export class StarryParticleSystem {
  private atomCore: AtomCore
  private orbitRings: OrbitRings
  private subtitleScreen: SubtitleScreen

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    userName?: string,
    blessing?: string,
  ) {
    // 层1: 中心粒子球体 + 128面牢笼
    this.atomCore = new AtomCore(scene)

    // 层2: 5层马尔可夫链星环
    this.orbitRings = new OrbitRings(scene)

    // 层3: 球面弧形滚动字幕条（Z轴30°倾斜）
    this.subtitleScreen = new SubtitleScreen(scene, renderer, userName, blessing)
  }

  get visible(): boolean {
    return this.atomCore.visible
  }

  set visible(v: boolean) {
    this.atomCore.visible = v
    this.orbitRings.visible = v
    this.subtitleScreen.visible = v
  }

  update(time: number, dt: number): void {
    if (!this.visible) return
    this.atomCore.update(time, dt)
    this.orbitRings.update(time, dt)
    this.subtitleScreen.update(time, dt)
  }

  dispose(): void {
    this.atomCore.dispose()
    this.orbitRings.dispose()
    this.subtitleScreen.dispose()
  }
}
