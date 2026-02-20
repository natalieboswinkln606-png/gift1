import { Group, Scene, WebGLRenderer } from 'three'
import { AtomCore } from './AtomCore'
import { OrbitRings } from './OrbitRings'
import { SubtitleScreen } from './SubtitleScreen'

// 整体公转速度（约1分钟一圈）
const ORBIT_ROTATION_SPEED_Y = 0.1
// X/Z 轴轻微摆动，营造自然感
const ORBIT_WOBBLE_SPEED_X = 0.07
const ORBIT_WOBBLE_AMPLITUDE_X = 0.15
const ORBIT_WOBBLE_SPEED_Z = 0.05
const ORBIT_WOBBLE_AMPLITUDE_Z = 0.1

export class StarryParticleSystem {
  /** 旋转容器：AtomCore + OrbitRings + 外部可追加的装饰星点等 */
  readonly orbitGroup: Group
  private atomCore: AtomCore
  private orbitRings: OrbitRings
  private subtitleScreen: SubtitleScreen

  constructor(
    scene: Scene,
    renderer: WebGLRenderer,
    userName?: string,
    blessing?: string,
    qualityOpts?: { coreParticleCount?: number; particlesPerRing?: number },
  ) {
    // 旋转容器：承载除字幕屏外的所有对象
    this.orbitGroup = new Group()
    scene.add(this.orbitGroup)

    // 层1: 中心粒子球体 + 128面牢笼（挂载到旋转容器）
    this.atomCore = new AtomCore(this.orbitGroup, qualityOpts?.coreParticleCount)

    // 层2: 5层马尔可夫链星环（挂载到旋转容器）
    this.orbitRings = new OrbitRings(this.orbitGroup, qualityOpts?.particlesPerRing)

    // 层3: 球面弧形滚动字幕条（直接挂载到 scene，不参与旋转）
    this.subtitleScreen = new SubtitleScreen(scene, renderer, userName, blessing, {
      fontSize: 16,  // ORBIT 场景字幕字体缩小一半（默认 32）
    })
  }

  get visible(): boolean {
    return this.orbitGroup.visible
  }

  set visible(v: boolean) {
    this.orbitGroup.visible = v
    this.subtitleScreen.visible = v
  }

  update(time: number, dt: number): void {
    if (!this.visible) return

    // 整体公转：Y 轴主旋转 + X/Z 轴轻微摆动
    this.orbitGroup.rotation.y = time * ORBIT_ROTATION_SPEED_Y
    this.orbitGroup.rotation.x = Math.sin(time * ORBIT_WOBBLE_SPEED_X) * ORBIT_WOBBLE_AMPLITUDE_X
    this.orbitGroup.rotation.z = Math.sin(time * ORBIT_WOBBLE_SPEED_Z) * ORBIT_WOBBLE_AMPLITUDE_Z

    this.atomCore.update(time, dt)
    this.orbitRings.update(time, dt)
    this.subtitleScreen.update(time, dt)
  }

  dispose(): void {
    this.atomCore.dispose()
    this.orbitRings.dispose()
    this.subtitleScreen.dispose()
    this.orbitGroup.parent?.remove(this.orbitGroup)
  }
}
