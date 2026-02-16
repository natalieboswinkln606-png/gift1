import * as THREE from 'three'

// 借鉴 新建文本文档.html 的中心球体与牢笼
// 中心球体：1200粒子球面均匀分布 + 发光精灵
// 牢笼：OctahedronGeometry(5.2, 2) 线框粒子化

// --- 纹理工厂 ---

/** 核心粒子纹理：柔和径向渐变 */
function createCoreParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.3, 'rgba(255,220,100,0.8)')
  grad.addColorStop(0.6, 'rgba(255,150,50,0.2)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

/** 牢笼粒子纹理：纯白径向渐变 */
function createCageParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.8)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

// --- 配置常量 ---
const CORE_PARTICLE_COUNT = 1200
const CORE_RADIUS = 3.2
const CORE_PARTICLE_SIZE = 0.45
const CORE_COLOR = 0xffdd66
const CORE_GLOW_COLOR = 0xffaa00
const CORE_GLOW_SCALE = 8.5

const CAGE_GEOMETRY_RADIUS = 5.2
const CAGE_GEOMETRY_DETAIL = 2
const CAGE_STEPS_PER_EDGE = 22
const CAGE_JITTER = 0.15
const CAGE_PARTICLE_SIZE = 0.375
const CAGE_COLOR = 0xffd700

export class AtomCore {
  private nucleusGroup: THREE.Group
  private nucleusParticles: THREE.Points
  private coreGlow: THREE.Sprite
  private cage: THREE.Points
  private coreTex: THREE.CanvasTexture
  private cageTex: THREE.CanvasTexture

  constructor(scene: THREE.Scene) {
    this.coreTex = createCoreParticleTexture()
    this.cageTex = createCageParticleTexture()

    // --- 核心球体 ---
    this.nucleusGroup = new THREE.Group()

    // 1200粒子球面均匀分布
    const nucleusGeo = new THREE.BufferGeometry()
    const positions: number[] = []
    for (let i = 0; i < CORE_PARTICLE_COUNT; i++) {
      const r = CORE_RADIUS * Math.cbrt(Math.random())
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      )
    }
    nucleusGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

    const nucleusMat = new THREE.PointsMaterial({
      color: CORE_COLOR,
      size: CORE_PARTICLE_SIZE,
      map: this.coreTex,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.nucleusParticles = new THREE.Points(nucleusGeo, nucleusMat)
    this.nucleusGroup.add(this.nucleusParticles)

    // 发光精灵
    const spriteMat = new THREE.SpriteMaterial({
      map: this.coreTex,
      color: CORE_GLOW_COLOR,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    })
    this.coreGlow = new THREE.Sprite(spriteMat)
    this.coreGlow.scale.set(CORE_GLOW_SCALE, CORE_GLOW_SCALE, 1)
    this.nucleusGroup.add(this.coreGlow)

    scene.add(this.nucleusGroup)

    // --- 128面多面体牢笼 ---
    this.cage = this.createPolyhedralCage()
    scene.add(this.cage)
  }

  /** 借鉴源文件1的牢笼生成逻辑：线框边采样+抖动+堆叠 */
  private createPolyhedralCage(): THREE.Points {
    const baseGeo = new THREE.OctahedronGeometry(CAGE_GEOMETRY_RADIUS, CAGE_GEOMETRY_DETAIL)
    const wireGeo = new THREE.WireframeGeometry(baseGeo)
    const linePositions = wireGeo.attributes.position.array

    const particlePositions: number[] = []
    // 复用临时 Vector3 避免循环内大量分配
    const start = new THREE.Vector3()
    const end = new THREE.Vector3()
    const basePoint = new THREE.Vector3()

    for (let i = 0; i < linePositions.length; i += 6) {
      start.set(linePositions[i], linePositions[i + 1], linePositions[i + 2])
      end.set(linePositions[i + 3], linePositions[i + 4], linePositions[i + 5])

      for (let j = 0; j <= CAGE_STEPS_PER_EDGE; j++) {
        // 40%概率跳过
        if (Math.random() < 0.4) continue

        const t = j / CAGE_STEPS_PER_EDGE
        basePoint.lerpVectors(start, end, t)
        const stackCount = Math.floor(Math.random() * 3) + 1

        for (let k = 0; k < stackCount; k++) {
          const jx = (Math.random() - 0.5) * CAGE_JITTER
          const jy = (Math.random() - 0.5) * CAGE_JITTER
          const jz = (Math.random() - 0.5) * CAGE_JITTER
          particlePositions.push(
            basePoint.x + jx,
            basePoint.y + jy,
            basePoint.z + jz
          )
        }
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3))

    const material = new THREE.PointsMaterial({
      color: CAGE_COLOR,
      size: CAGE_PARTICLE_SIZE,
      map: this.cageTex,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    // 清理临时几何体
    baseGeo.dispose()
    wireGeo.dispose()

    return new THREE.Points(geometry, material)
  }

  get visible(): boolean {
    return this.nucleusGroup.visible
  }

  set visible(v: boolean) {
    this.nucleusGroup.visible = v
    this.cage.visible = v
  }

  update(time: number, _dt: number): void {
    // 核心旋转
    this.nucleusGroup.rotation.y = time * 0.5
    this.nucleusGroup.rotation.z = Math.sin(time * 0.5) * 0.2

    // 牢笼旋转
    this.cage.rotation.x = Math.sin(time * 0.2) * 0.1
    this.cage.rotation.y = -time * 0.2

    // 核心脉冲
    const pulse = 1 + Math.sin(time * 3) * 0.08
    this.coreGlow.scale.set(
      CORE_GLOW_SCALE * pulse,
      CORE_GLOW_SCALE * pulse,
      1
    )
  }

  dispose(): void {
    this.nucleusParticles.geometry.dispose()
    ;(this.nucleusParticles.material as THREE.Material).dispose()
    this.coreGlow.material.dispose()
    this.cage.geometry.dispose()
    ;(this.cage.material as THREE.Material).dispose()
    this.coreTex.dispose()
    this.cageTex.dispose()
    this.nucleusGroup.parent?.remove(this.nucleusGroup)
    this.cage.parent?.remove(this.cage)
  }
}
