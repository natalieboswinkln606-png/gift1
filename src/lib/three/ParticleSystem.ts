import * as THREE from 'three'
import type { SceneMode, AnimPhase } from '@/types'
import { generateChristmasHeartPositions } from './ImplicitHeartSampler'

export const BLOOM_LAYER = 1

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
  currentPos: THREE.Vector3
  velocity: THREE.Vector3
  tTree: THREE.Vector3
  tScatter: THREE.Vector3
  tExplode: THREE.Vector3
  tHeart: THREE.Vector3
  baseScatterPos: THREE.Vector3
  noiseOffset: THREE.Vector3
  color: THREE.Color
  speed: number
  offset: number
  baseScale: number
  meshIndex: number
  internalIndex: number
}

export interface ParticleConfig {
  count: number
  trunkCount: number
  textCount: number
  bgStarCount: number
  treeHeight: number
  treeRadius: number
  galaxyRadius: number
  floorRadius: number
  colors: {
    cyan: THREE.Color
    blue: THREE.Color
    purple: THREE.Color
    gold: THREE.Color
    white: THREE.Color
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
    bgStarCount: 8000,
    treeHeight: 85,
    treeRadius: 35,
    galaxyRadius: 280,
    floorRadius: 200,
    colors: {
      cyan: new THREE.Color('#00ffff').multiplyScalar(0.8),
      blue: new THREE.Color('#0055ff').multiplyScalar(1.2),
      purple: new THREE.Color('#aa00ff').multiplyScalar(1.2),
      gold: new THREE.Color('#ffcc00').multiplyScalar(1.2),
      white: new THREE.Color('#ffffff').multiplyScalar(1.2),
    },
  }
}

export class ParticleSystem {
  config: ParticleConfig
  particleData: ParticleItem[] = []
  meshSphere: THREE.InstancedMesh
  meshBox: THREE.InstancedMesh
  meshTetra: THREE.InstancedMesh
  state: {
    mode: SceneMode
    targetMode: SceneMode
    animPhase: AnimPhase
    animTimer: number
    lerpSpeed: number
    rotVelocity: number
  }
  photoGroup: THREE.Group | null = null

  private dummy = new THREE.Object3D()
  private vTmp = new THREE.Vector3()
  private countSphere: number
  private countBox: number
  private countTetra: number

  constructor(scene: THREE.Scene, cfg?: Partial<ParticleConfig>, userName?: string) {
    this.config = { ...defaultConfig(), ...cfg }

    // Generate text coordinates
    const textCoords = generateTextCoordinates(userName || '2026')
    this.config.textCount = textCoords.length

    const C = this.config
    this.countSphere = Math.floor(C.count * 0.5)
    this.countBox = Math.floor(C.count * 0.3)
    this.countTetra = C.count - this.countSphere - this.countBox

    // Create geometries
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const sphereGeo = new THREE.IcosahedronGeometry(0.35, 1)
    const boxGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45)
    const tetraGeo = new THREE.TetrahedronGeometry(0.5)

    this.meshSphere = new THREE.InstancedMesh(sphereGeo, mat.clone(), this.countSphere)
    this.meshBox = new THREE.InstancedMesh(boxGeo, mat.clone(), this.countBox)
    this.meshTetra = new THREE.InstancedMesh(tetraGeo, mat.clone(), this.countTetra)

    const meshes = [this.meshSphere, this.meshBox, this.meshTetra]
    meshes.forEach((m) => {
      m.layers.enable(BLOOM_LAYER)
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      scene.add(m)
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
  }

  private initParticles(textCoords: Array<{ x: number; y: number }>): void {
    const C = this.config
    const trunkLerpColor = new THREE.Color('#331100')

    // Pre-generate heart positions using implicit surface sampling
    const heartPositions = generateChristmasHeartPositions(C.count)

    for (let i = 0; i < C.count; i++) {
      const isText = i < C.textCount
      const isTrunk = !isText && i < C.textCount + C.trunkCount

      const p: ParticleItem = {
        id: i,
        isStatic: false,
        isCore: false,
        freqIndex: Math.floor(Math.random() * 200),
        currentPos: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        tTree: new THREE.Vector3(),
        tScatter: new THREE.Vector3(),
        tExplode: new THREE.Vector3(),
        tHeart: heartPositions[i].clone(),
        baseScatterPos: new THREE.Vector3(),
        noiseOffset: new THREE.Vector3(Math.random() * 100, Math.random() * 100, Math.random() * 100),
        color: new THREE.Color(),
        speed: 1 + Math.random() * 5,
        offset: Math.random() * 100,
        baseScale: 0.5 + Math.random() * 0.9,
        meshIndex: i < this.countSphere ? 0 : i < this.countSphere + this.countBox ? 1 : 2,
        internalIndex: i < this.countSphere ? i : i < this.countSphere + this.countBox ? i - this.countSphere : i - this.countSphere - this.countBox,
      }

      if (isText) {
        const coord = textCoords[i]
        p.tScatter.set(coord.x, coord.y + 12, 0)
        p.isCore = true
        const r = Math.random() * C.floorRadius
        const a = Math.random() * Math.PI * 2
        p.tTree.set(r * Math.cos(a), 0, r * Math.sin(a))
        p.color.set(C.colors.gold)
      } else if (isTrunk) {
        const h = ((i - C.textCount) / C.trunkCount) * (C.treeHeight * 0.9)
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
    this.state.targetMode = mode
  }

  setPhotoGroup(group: THREE.Group): void {
    this.photoGroup = group
  }

  update(dt: number, time: number, audio: AudioEngineInterface): void {
    const { state, config: C, particleData, dummy, vTmp } = this

    // Mode transition
    if (state.mode !== state.targetMode) {
      state.mode = state.targetMode
      state.animPhase = 'EXPLODE'
      state.animTimer = 0
      particleData.forEach((p) => {
        const r = 200 + Math.random() * 400
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        p.tExplode.set(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph))
      })
    }

    const isTree = state.mode === 'TREE'
    const isHeart = state.mode === 'HEART'

    // Rotation
    if (isTree || isHeart) {
      state.rotVelocity = 0
      const spd = 0.2 * dt
      ;[this.meshSphere, this.meshBox, this.meshTetra].forEach((m) => { m.rotation.y += spd })
      if (this.photoGroup) this.photoGroup.rotation.y += spd
    } else {
      state.rotVelocity *= 0.95
      state.rotVelocity = Math.max(-1.5, Math.min(1.5, state.rotVelocity))
      const spd = (0.02 + state.rotVelocity) * dt
      ;[this.meshSphere, this.meshBox, this.meshTetra].forEach((m) => { m.rotation.y += spd })
      if (this.photoGroup) this.photoGroup.rotation.y = this.meshSphere.rotation.y
    }

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
        const target = isHeart ? p.tHeart : isTree ? p.tTree : p.baseScatterPos
        p.currentPos.lerp(target, 0.08)
        if (i === 0 && p.currentPos.distanceTo(target) < 5) state.animPhase = 'IDLE'
      } else {
        // IDLE physics
        if (isHeart) {
          p.currentPos.lerp(p.tHeart, 0.1)
        } else if (isTree) {
          if (p.isStatic) {
            p.currentPos.lerp(p.tTree, 0.2)
          } else {
            // Fountain logic
            const freq = audio.getFreq(p.freqIndex)
            p.velocity.y -= 0.05
            if (p.velocity.y < -0.5) p.velocity.y = -0.5
            if (p.currentPos.y <= 0.5 && freq > 100) {
              const randomBoost = 1.0 + Math.random() * 4.5
              p.velocity.y = (freq / 255.0) * randomBoost
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
          if (p.isCore) {
            p.currentPos.lerp(p.tScatter, 0.1)
          } else {
            const noise1 = Math.sin(time * 0.5 + p.noiseOffset.x)
            const noise2 = Math.cos(time * 0.3 + p.noiseOffset.y)
            const breath = (noise1 + noise2) * (2 + audio.volume * 0.1)

            const dist = Math.sqrt(p.baseScatterPos.x ** 2 + p.baseScatterPos.z ** 2)
            const normDist = dist / C.galaxyRadius

            const shearAngle = time * (0.2 * (1.0 - normDist * 0.5))
            const ca = Math.cos(shearAngle)
            const sa = Math.sin(shearAngle)
            const bx = p.baseScatterPos.x
            const bz = p.baseScatterPos.z
            const rx = bx * ca - bz * sa
            const rz = bx * sa + bz * ca

            let surge = 0
            if (audio.isKick) {
              surge = 40.0 * Math.exp(-normDist * 2.0)
            }
            p.velocity.x += (surge - p.velocity.x) * 0.5

            const angle = Math.atan2(rz, rx)
            const waveX = Math.cos(angle) * p.velocity.x
            const waveZ = Math.sin(angle) * p.velocity.x

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

      // Scale/blink
      const blink = Math.sin(time * p.speed + p.offset)
      const scale = p.baseScale * (0.0 + 1.5 * Math.pow(0.5 * blink + 0.5, 6.0))
      dummy.position.copy(p.currentPos)
      dummy.scale.setScalar(scale)
      if (!isTree && i < C.textCount) dummy.rotation.set(0, 0, 0)
      else dummy.rotation.set(time + p.offset, time * 0.5, 0)
      dummy.updateMatrix()

      if (p.meshIndex === 0) this.meshSphere.setMatrixAt(p.internalIndex, dummy.matrix)
      else if (p.meshIndex === 1) this.meshBox.setMatrixAt(p.internalIndex, dummy.matrix)
      else this.meshTetra.setMatrixAt(p.internalIndex, dummy.matrix)
    }

    this.meshSphere.instanceMatrix.needsUpdate = true
    this.meshBox.instanceMatrix.needsUpdate = true
    this.meshTetra.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    ;[this.meshSphere, this.meshBox, this.meshTetra].forEach((m) => {
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
      m.removeFromParent()
    })
    this.particleData = []
  }
}
