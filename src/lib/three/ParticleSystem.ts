import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Material,
  MeshBasicMaterial,
  Object3D,
  Scene,
  Sphere,
  TetrahedronGeometry,
  Vector3,
} from 'three'
import type { SceneMode, AnimPhase } from '@/types'
import { generateStarPositions } from './ImplicitHeartSampler'
import { fastSin, fastCos } from './trigTable'
import { BLOOM_LAYER } from './SelectiveBloom'

interface AudioEngineInterface {
  volume: number
  bassEnergy: number
  isKick: boolean
  getFreq(index: number): number
  update(): void
}

interface ParticleItem {
  id: number
  isStatic: boolean
  isCore: boolean
  freqIndex: number
  currentPos: Vector3
  velocity: Vector3
  tTree: Vector3
  tScatter: Vector3
  tExplode: Vector3
  baseScatterPos: Vector3
  noiseOffset: Vector3
  color: Color
  speed: number
  offset: number
  baseScale: number
  meshIndex: number
  internalIndex: number
  settled: boolean  // 粒子是否已到达目标位置（可跳过更新）
  // 预计算的 Galaxy 模式常量（避免每帧重复计算）
  scatterDist: number      // sqrt(baseScatterPos.x² + baseScatterPos.z²)
  normDist: number         // scatterDist / galaxyRadius
  shearSpeedFactor: number // 0.2 * (1.0 - normDist * 0.5)
  cosBaseAngle: number     // cos(atan2(baseScatterPos.z, baseScatterPos.x))
  sinBaseAngle: number     // sin(atan2(baseScatterPos.z, baseScatterPos.x))
  kickExpFactor: number    // exp(-normDist * 2.0)
}

export interface ParticleConfig {
  count: number
  trunkCount: number
  textCount: number
  miniHeartCount: number
  bgStarCount: number
  treeHeight: number
  treeRadius: number
  galaxyRadius: number
  floorRadius: number
  colors: {
    cyan: Color
    blue: Color
    purple: Color
    gold: Color
    white: Color
  }
}

function generateTextCoordinates(text: string): Array<{ x: number; y: number }> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  canvas.width = 1200
  canvas.height = 150
  ctx.font = '900 80px "Times New Roman", serif'
  ctx.fillStyle = 'white'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const coords: Array<{ x: number; y: number }> = []
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      if (data[(y * canvas.width + x) * 4 + 3] > 128) {
        coords.push({ x: (x - canvas.width / 2) * 0.1, y: -(y - canvas.height / 2) * 0.1 })
      }
    }
  }
  // Clean up temporary canvas to prevent memory leak
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  canvas.width = 0
  canvas.height = 0
  return coords
}

function defaultConfig(): ParticleConfig {
  return {
    count: 45000,
    trunkCount: 4000,
    textCount: 0,
    miniHeartCount: 0,
    bgStarCount: 8000,
    treeHeight: 85,
    treeRadius: 35,
    galaxyRadius: 280,
    floorRadius: 200,
    colors: {
      cyan: new Color('#00ffff').multiplyScalar(0.8),
      blue: new Color('#0055ff').multiplyScalar(1.2),
      purple: new Color('#aa00ff').multiplyScalar(1.2),
      gold: new Color('#ffcc00').multiplyScalar(1.2),
      white: new Color('#ffffff').multiplyScalar(1.2),
    },
  }
}

export class ParticleSystem {
  config: ParticleConfig
  particleData: ParticleItem[] = []
  meshSphere: InstancedMesh
  meshBox: InstancedMesh
  meshTetra: InstancedMesh
  state: {
    mode: SceneMode
    targetMode: SceneMode
    animPhase: AnimPhase
    animTimer: number
    lerpSpeed: number
    rotVelocity: number
  }
  photoGroup: Group | null = null

  private dummy = new Object3D()
  private vTmp = new Vector3()
  private countSphere: number
  private countBox: number
  private countTetra: number
  private explodeRandoms: Float32Array  // 预生成的爆炸随机数
  private frameCount = 0  // 帧计数器（用于 SCATTER 跳帧优化）
  private dirtyMeshes = [false, false, false]  // 每帧脏标记：[sphere, box, tetra]
  private meshes: InstancedMesh[]  // 缓存 mesh 数组，避免每帧创建
  private fountainRandoms: Float32Array  // 预生成的 fountain 随机数

  constructor(scene: Scene, cfg?: Partial<ParticleConfig>, userName?: string) {
    this.config = { ...defaultConfig(), ...cfg }

    // Generate text coordinates
    const textCoords = generateTextCoordinates(userName || '2026')
    this.config.textCount = textCoords.length
    // 迷你爱心：约 500 粒子，1/10 体积（scale=1.4），位于用户名上方
    this.config.miniHeartCount = userName ? 500 : 0

    const C = this.config
    this.countSphere = Math.floor(C.count * 0.5)
    this.countBox = Math.floor(C.count * 0.3)
    this.countTetra = C.count - this.countSphere - this.countBox

    // Create geometries
    const mat = new MeshBasicMaterial({ color: 0xffffff })
    const sphereGeo = new IcosahedronGeometry(0.35, 1)
    const boxGeo = new BoxGeometry(0.45, 0.45, 0.45)
    const tetraGeo = new TetrahedronGeometry(0.5)

    this.meshSphere = new InstancedMesh(sphereGeo, mat.clone(), this.countSphere)
    this.meshBox = new InstancedMesh(boxGeo, mat.clone(), this.countBox)
    this.meshTetra = new InstancedMesh(tetraGeo, mat.clone(), this.countTetra)

    const meshes = [this.meshSphere, this.meshBox, this.meshTetra]
    this.meshes = meshes
    meshes.forEach((m) => {
      m.layers.enable(BLOOM_LAYER)
      m.instanceMatrix.setUsage(DynamicDrawUsage)
      scene.add(m)
    })

    // 预计算 boundingSphere，避免 Three.js 每帧自动计算
    // 粒子系统覆盖范围很大（galaxyRadius=280），设置足够大的包围球
    const largeSphere = new Sphere(new Vector3(0, 40, 0), 2000)
    this.meshes.forEach((m) => {
      m.geometry.boundingSphere = largeSphere.clone()
      m.frustumCulled = false // 粒子系统始终可见，跳过 frustum check
    })

    this.state = {
      mode: 'TREE',
      targetMode: 'TREE',
      animPhase: 'IDLE',
      animTimer: 0,
      lerpSpeed: 0.05,
      rotVelocity: 0,
    }

    // Initialize particle data
    this.initParticles(textCoords)

    // 预生成爆炸动画随机数（避免 transition 时大量 Math.random 调用）
    this.explodeRandoms = new Float32Array(this.config.count * 3)
    for (let i = 0; i < this.config.count * 3; i++) {
      this.explodeRandoms[i] = Math.random()
    }

    // 预生成 fountain 随机数（避免 TREE 模式每帧 Math.random）
    this.fountainRandoms = new Float32Array(this.config.count)
    for (let i = 0; i < this.config.count; i++) {
      this.fountainRandoms[i] = 1.0 + Math.random() * 4.5
    }
  }

  private initParticles(textCoords: Array<{ x: number; y: number }>): void {
    const C = this.config
    const trunkLerpColor = new Color('#331100')

    // 迷你五角星位置：scale=1.4，位于圣诞树顶部上方（与树顶五角星呼应）
    const miniStarPositions = C.miniHeartCount > 0
      ? generateStarPositions(C.miniHeartCount, 1.4, C.treeHeight + 15)
      : null

    for (let i = 0; i < C.count; i++) {
      const isText = i < C.textCount
      const isMiniHeart = !isText && i < C.textCount + C.miniHeartCount
      const isTrunk = !isText && !isMiniHeart && i < C.textCount + C.miniHeartCount + C.trunkCount

      const p: ParticleItem = {
        id: i,
        isStatic: false,
        isCore: false,
        freqIndex: Math.floor(Math.random() * 200),
        currentPos: new Vector3(),
        velocity: new Vector3(),
        tTree: new Vector3(),
        tScatter: new Vector3(),
        tExplode: new Vector3(),
        baseScatterPos: new Vector3(),
        noiseOffset: new Vector3(Math.random() * 100, Math.random() * 100, Math.random() * 100),
        color: new Color(),
        speed: 1 + Math.random() * 5,
        offset: Math.random() * 100,
        baseScale: 0.5 + Math.random() * 0.9,
        meshIndex: i < this.countSphere ? 0 : i < this.countSphere + this.countBox ? 1 : 2,
        internalIndex: i < this.countSphere ? i : i < this.countSphere + this.countBox ? i - this.countSphere : i - this.countSphere - this.countBox,
        settled: false,
        // Galaxy 预计算字段（initParticles 末尾填充）
        scatterDist: 0,
        normDist: 0,
        shearSpeedFactor: 0,
        cosBaseAngle: 1,
        sinBaseAngle: 0,
        kickExpFactor: 0,
      }

      if (isText) {
        const coord = textCoords[i]
        p.tScatter.set(coord.x, coord.y + 12, 0)
        p.isCore = true
        // 圣诞树模式：文字粒子散落在地面（用户名仅在星璇模式显示）
        const rText = Math.random() * C.floorRadius
        const aText = Math.random() * Math.PI * 2
        p.tTree.set(rText * Math.cos(aText), 0, rText * Math.sin(aText))
        p.color.set(C.colors.gold)
      } else if (isMiniHeart) {
        // 迷你五角星：仅在星璇模式显示，圣诞树模式散落在地面
        const mhIdx = i - C.textCount
        const mhBase = mhIdx * 3
        const rMh = Math.random() * C.floorRadius
        const aMh = Math.random() * Math.PI * 2
        p.tTree.set(rMh * Math.cos(aMh), 0, rMh * Math.sin(aMh))
        p.tScatter.set(
          miniStarPositions![mhBase],
          miniStarPositions![mhBase + 1] - C.treeHeight + 12,
          0
        )
        p.isCore = true
        p.color.set(C.colors.gold)
      } else if (isTrunk) {
        const trunkIdx = i - C.textCount - C.miniHeartCount
        const h = (trunkIdx / C.trunkCount) * (C.treeHeight * 0.9)
        const r = Math.random() * 2.0
        const a = Math.random() * Math.PI * 2
        p.tTree.set(r * Math.cos(a), h, r * Math.sin(a))
        p.isStatic = true
        p.color.set(C.colors.gold).lerp(trunkLerpColor, Math.random() * 0.5)
        const gr = Math.random() * 15
        const ga = Math.random() * Math.PI * 2
        p.tScatter.set(gr * Math.cos(ga), (Math.random() - 0.5) * 8, gr * Math.sin(ga))
        p.isCore = true
      } else {
        const typeRand = Math.random()
        if (typeRand > 0.3) {
          // Tree leaves
          const h = Math.random() * C.treeHeight
          const layerMod = 1.0 + 0.3 * Math.sin(h * 0.8)
          const rBase = C.treeRadius * (1 - h / C.treeHeight)
          const rMax = rBase * layerMod
          const r = rMax * (0.4 + 0.6 * Math.sqrt(Math.random()))
          const a = h * 0.5 + Math.random() * Math.PI * 2
          p.tTree.set(r * Math.cos(a), h, r * Math.sin(a))
          p.isStatic = true
          if (Math.random() > 0.9) p.color.set(C.colors.gold)
          else p.color.set(C.colors.cyan).lerp(C.colors.purple, Math.random())
        } else {
          // Floor
          const fr = 5 + Math.random() * C.floorRadius
          const fa = Math.random() * Math.PI * 2
          p.tTree.set(fr * Math.cos(fa), 0, fr * Math.sin(fa))
          p.color.set(C.colors.blue).lerp(C.colors.purple, Math.random())
        }

        // Galaxy config
        const minR = 15
        const maxR = C.galaxyRadius
        const t = Math.pow(Math.random(), 1.5)
        const gr = minR + t * (maxR - minR)
        const arms = 3
        const ga = Math.floor(Math.random() * arms) * ((Math.PI * 2) / arms) + (gr / maxR) * 6.0 * Math.PI + (Math.random() - 0.5) * (1.0 + (gr / maxR) * 3.0)
        const gy = -20 * Math.exp(-(gr - minR) / 30) + (Math.random() - 0.5) * (5 + (gr / maxR) * 15)
        p.tScatter.set(gr * Math.cos(ga), gy, gr * Math.sin(ga))
        p.baseScatterPos.copy(p.tScatter)

        // 预计算 Galaxy 模式常量
        const sd = Math.sqrt(p.baseScatterPos.x * p.baseScatterPos.x + p.baseScatterPos.z * p.baseScatterPos.z)
        p.scatterDist = sd
        p.normDist = sd / C.galaxyRadius
        p.shearSpeedFactor = 0.2 * (1.0 - p.normDist * 0.5)
        const ba = Math.atan2(p.baseScatterPos.z, p.baseScatterPos.x)
        p.cosBaseAngle = Math.cos(ba)
        p.sinBaseAngle = Math.sin(ba)
        p.kickExpFactor = Math.exp(-p.normDist * 2.0)
      }

      p.currentPos.copy(p.tTree)
      this.particleData.push(p)
    }

    // Set colors
    this.particleData.forEach((p) => {
      if (p.meshIndex === 0) this.meshSphere.setColorAt(p.internalIndex, p.color)
      else if (p.meshIndex === 1) this.meshBox.setColorAt(p.internalIndex, p.color)
      else this.meshTetra.setColorAt(p.internalIndex, p.color)
    })
    if (this.meshSphere.instanceColor) this.meshSphere.instanceColor.needsUpdate = true
    if (this.meshBox.instanceColor) this.meshBox.instanceColor.needsUpdate = true
    if (this.meshTetra.instanceColor) this.meshTetra.instanceColor.needsUpdate = true
  }

  setTargetMode(mode: SceneMode): void {
    if (mode !== this.state.targetMode) {
      this.state.targetMode = mode
      // 重置所有粒子的 settled 标记
      for (const p of this.particleData) {
        p.settled = false
      }
    }
  }

  setPhotoGroup(group: Group): void {
    this.photoGroup = group
  }

  update(dt: number, time: number, audio: AudioEngineInterface): void {
    const { state, config: C, particleData } = this
    this.frameCount++
    this.dirtyMeshes[0] = false
    this.dirtyMeshes[1] = false
    this.dirtyMeshes[2] = false

    // Mode transition
    if (state.mode !== state.targetMode) {
      state.mode = state.targetMode
      state.animPhase = 'EXPLODE'
      state.animTimer = 0
      const randoms = this.explodeRandoms
      for (let i = 0; i < particleData.length; i++) {
        const p = particleData[i]
        const ri = i * 3
        const r = 200 + randoms[ri] * 400
        const th = randoms[ri + 1] * Math.PI * 2
        const ph = Math.acos(2 * randoms[ri + 2] - 1)
        const sinPh = Math.sin(ph)
        p.tExplode.set(r * sinPh * Math.cos(th), r * sinPh * Math.sin(th), r * Math.cos(ph))
        p.settled = false  // 重置 settled 标记
      }
    }

    const isTree = state.mode === 'TREE'

    // Rotation
    if (isTree) {
      state.rotVelocity = 0
      const spd = 0.2 * dt
      this.meshes.forEach((m) => { m.rotation.y += spd })
      if (this.photoGroup) this.photoGroup.rotation.y += spd
    } else {
      state.rotVelocity *= 0.95
      state.rotVelocity = Math.max(-1.5, Math.min(1.5, state.rotVelocity))
      const spd = (0.01 + state.rotVelocity) * dt
      this.meshes.forEach((m) => { m.rotation.y += spd })
      if (this.photoGroup) this.photoGroup.rotation.y = this.meshSphere.rotation.y
    }

    // 预计算共享的 rotY 的 sin/cos（所有非文字粒子的 ry = time * 0.5 相同）
    const sharedRy = time * 0.5
    const sharedCy = Math.cos(sharedRy)
    const sharedSy = Math.sin(sharedRy)

    // 预计算 mesh 反向旋转（用于文字粒子在星璇模式下抵消 mesh 整体旋转，保持面向摄像头）
    const meshRotY = this.meshSphere.rotation.y
    const compensateCy = Math.cos(-meshRotY)
    const compensateSy = Math.sin(-meshRotY)

    // Update particles
    for (let i = 0; i < C.count; i++) {
      const p = particleData[i]

      if (state.animPhase === 'EXPLODE') {
        p.currentPos.lerp(p.tExplode, 0.05)
        if (i === 0) {
          state.animTimer += dt
          if (state.animTimer > 0.4) state.animPhase = 'CONVERGE'
        }
      } else if (state.animPhase === 'CONVERGE') {
        const target = isTree ? p.tTree : p.baseScatterPos
        p.currentPos.lerp(target, 0.08)
        if (i === 0 && p.currentPos.distanceTo(target) < 5) state.animPhase = 'IDLE'
      } else {
        // IDLE physics
        if (isTree) {
          if (p.isStatic) {
            if (!p.settled) {
              p.currentPos.lerp(p.tTree, 0.2)
              if (p.currentPos.distanceToSquared(p.tTree) < 0.01) {
                p.currentPos.copy(p.tTree)
                p.settled = true
              }
            }
          } else {
            // Fountain logic
            const freq = audio.getFreq(p.freqIndex)
            p.velocity.y -= 0.05
            if (p.velocity.y < -0.5) p.velocity.y = -0.5
            if (p.currentPos.y <= 0.5 && freq > 100) {
              p.velocity.y = (freq / 255.0) * this.fountainRandoms[i]
            }
            p.currentPos.y += p.velocity.y
            if (p.currentPos.y < 0) {
              p.currentPos.y = 0
              p.velocity.y = 0
            }
            p.currentPos.x = p.tTree.x
            p.currentPos.z = p.tTree.z
          }
        } else {
          // Galaxy logic
          // SCATTER 跳帧优化：远距离粒子每 3 帧更新一次
          if (p.scatterDist > 100 && (this.frameCount + i) % 3 !== 0) {
            // 跳过此帧的物理更新，但仍需写入矩阵（使用当前位置）
          } else if (p.isCore) {
            p.currentPos.lerp(p.tScatter, 0.1)
          } else {
            const noise1 = fastSin(time * 0.5 + p.noiseOffset.x)
            const noise2 = fastCos(time * 0.3 + p.noiseOffset.y)
            const breath = (noise1 + noise2) * (2 + audio.volume * 0.1)

            const shearAngle = time * p.shearSpeedFactor
            const ca = fastCos(shearAngle)
            const sa = fastSin(shearAngle)
            const bx = p.baseScatterPos.x
            const bz = p.baseScatterPos.z
            const rx = bx * ca - bz * sa
            const rz = bx * sa + bz * ca

            let surge = 0
            if (audio.isKick) {
              surge = 40.0 * p.kickExpFactor
            }
            p.velocity.x += (surge - p.velocity.x) * 0.5

            // 消除 Math.atan2 + Math.cos/sin(angle)：
            // angle = baseAngle + shearAngle，用角度加法公式展开
            // cos(baseAngle + shearAngle) = cosBase*ca - sinBase*sa
            // sin(baseAngle + shearAngle) = sinBase*ca + cosBase*sa
            const cosAngle = p.cosBaseAngle * ca - p.sinBaseAngle * sa
            const sinAngle = p.sinBaseAngle * ca + p.cosBaseAngle * sa
            const waveX = cosAngle * p.velocity.x
            const waveZ = sinAngle * p.velocity.x

            const tx = rx + waveX
            const ty = p.baseScatterPos.y + breath
            const tz = rz + waveZ

            p.currentPos.x += (tx - p.currentPos.x) * 0.05
            p.currentPos.y += (ty - p.currentPos.y) * 0.05
            p.currentPos.z += (tz - p.currentPos.z) * 0.05

            p.velocity.x *= 0.7
          }
        }
      }

      // settled 粒子跳帧优化：每 3 帧更新一次 blink/scale/matrix
      if (p.settled && (this.frameCount + i) % 3 !== 0) continue

      // Scale/blink + 直接写入矩阵（跳过 Object3D.updateMatrix 开销）
      const blink = fastSin(time * p.speed + p.offset)
      // Math.pow(x, 6) → 手动乘法（V8 中 ~3x 更快）
      const halfBlink = 0.5 * blink + 0.5
      const hb2 = halfBlink * halfBlink
      const hb3 = hb2 * halfBlink
      const scale = p.baseScale * (1.5 * hb3 * hb3)

      // 确定目标 mesh 和数组
      let targetArray: Float32Array
      let matOffset: number
      if (p.meshIndex === 0) {
        targetArray = this.meshSphere.instanceMatrix.array as Float32Array
        matOffset = p.internalIndex * 16
      } else if (p.meshIndex === 1) {
        targetArray = this.meshBox.instanceMatrix.array as Float32Array
        matOffset = p.internalIndex * 16
      } else {
        targetArray = this.meshTetra.instanceMatrix.array as Float32Array
        matOffset = p.internalIndex * 16
      }

      // 内联矩阵写入，使用预计算的 sharedCy/sharedSy
      let cy: number, sy: number
      if (!isTree && i < C.textCount + C.miniHeartCount) {
        // 星璇模式下文字粒子 + 迷你爱心粒子：反向补偿 mesh 旋转，保持 z=0 正面朝向摄像头
        // Ry(-meshRotY) × scale 矩阵：
        // [cos  0  -sin] × scale
        // [0    1   0  ] × scale
        // [sin  0   cos] × scale
        targetArray[matOffset]      = compensateCy * scale
        targetArray[matOffset + 1]  = 0
        targetArray[matOffset + 2]  = compensateSy * scale
        targetArray[matOffset + 3]  = 0
        targetArray[matOffset + 4]  = 0
        targetArray[matOffset + 5]  = scale
        targetArray[matOffset + 6]  = 0
        targetArray[matOffset + 7]  = 0
        targetArray[matOffset + 8]  = -compensateSy * scale
        targetArray[matOffset + 9]  = 0
        targetArray[matOffset + 10] = compensateCy * scale
        targetArray[matOffset + 11] = 0
        targetArray[matOffset + 12] = p.currentPos.x
        targetArray[matOffset + 13] = p.currentPos.y
        targetArray[matOffset + 14] = p.currentPos.z
        targetArray[matOffset + 15] = 1
      } else {
        // 非文字粒子：rx 每粒子不同，ry 共享预计算，查找表替代 Math.cos/sin
        const rx = time + p.offset
        const cx = fastCos(rx), sx = fastSin(rx)
        cy = sharedCy; sy = sharedSy

        targetArray[matOffset]      = cy * scale
        targetArray[matOffset + 1]  = sx * sy * scale
        targetArray[matOffset + 2]  = -cx * sy * scale
        targetArray[matOffset + 3]  = 0
        targetArray[matOffset + 4]  = 0
        targetArray[matOffset + 5]  = cx * scale
        targetArray[matOffset + 6]  = sx * scale
        targetArray[matOffset + 7]  = 0
        targetArray[matOffset + 8]  = sy * scale
        targetArray[matOffset + 9]  = -sx * cy * scale
        targetArray[matOffset + 10] = cx * cy * scale
        targetArray[matOffset + 11] = 0
        targetArray[matOffset + 12] = p.currentPos.x
        targetArray[matOffset + 13] = p.currentPos.y
        targetArray[matOffset + 14] = p.currentPos.z
        targetArray[matOffset + 15] = 1
      }
      this.dirtyMeshes[p.meshIndex] = true
    }

    if (this.dirtyMeshes[0]) this.meshSphere.instanceMatrix.needsUpdate = true
    if (this.dirtyMeshes[1]) this.meshBox.instanceMatrix.needsUpdate = true
    if (this.dirtyMeshes[2]) this.meshTetra.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    this.meshes.forEach((m) => {
      m.geometry.dispose()
      ;(m.material as Material).dispose()
      m.removeFromParent()
    })
    this.particleData = []
  }
}
