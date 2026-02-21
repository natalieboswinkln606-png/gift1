import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  SpotLight,
  Sprite,
  SpriteMaterial,
  Vector2,
  WebGLRenderer,
} from 'three'
import gsap from 'gsap'
import { useAppStore } from '@/stores/useAppStore'
import { createRadialGradientTexture } from './textureFactory'

// --- Canvas Texture Helpers (原封不动翻译自参考HTML) ---

function createRoyalTexture(): CanvasTexture {
  const s = 512  // 从 1024 降到 512，减少 75% 纹理内存
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const ctx = c.getContext('2d')!
  // 用 ImageData 批量写入替代 2000 次 fillRect 调用，性能提升约 10-50 倍
  const imageData = ctx.createImageData(s, s)
  const data = imageData.data
  // 基础色 #660000 = rgb(102, 0, 0)，叠加随机暗化噪点
  for (let i = 0; i < data.length; i += 4) {
    const noise = Math.random() * 0.1
    data[i]     = Math.floor(102 * (1 - noise))  // R
    data[i + 1] = 0                               // G
    data[i + 2] = 0                               // B
    data[i + 3] = 255                             // A
  }
  ctx.putImageData(imageData, 0, 0)
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 10  // 按比例缩小线宽
  ctx.strokeRect(10, 10, s - 20, s - 20)
  const cx = s / 2; const cy = s / 2
  ctx.beginPath(); ctx.arc(cx, cy, 75, 0, Math.PI * 2)  // 按比例缩小圆半径
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(212,175,55,0.4)'; ctx.stroke()
  return new CanvasTexture(c)
}

function createLanternTexture(): CanvasTexture {
  return createRadialGradientTexture(128, [
    { offset: 0, color: '#ffcc00' },
    { offset: 0.5, color: '#ff4500' },
    { offset: 1, color: 'rgba(0,0,0,0)' },
  ])
}

function createRingTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.arc(128, 128, 100, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(128, 128, 115, 0, Math.PI * 2); ctx.stroke()
  return new CanvasTexture(c)
}

function createSoftGlowTex(): CanvasTexture {
  return createRadialGradientTexture(128, [
    { offset: 0, color: 'rgba(255,255,240,1)' },
    { offset: 0.3, color: 'rgba(255,200,100,0.5)' },
    { offset: 1, color: 'rgba(255,100,0,0)' },
  ])
}

// --- Main Class ---

export class GiftBoxSceneManager {
  private scene: Scene
  private camera: PerspectiveCamera
  private renderer: WebGLRenderer
  private container: HTMLElement
  private animationId: number | null = null
  private raycaster: Raycaster
  private mouse: Vector2

  // Scene objects
  private boxGroup!: Group
  private lidGroup!: Group
  private hitBox!: Mesh
  private innerLight!: PointLight

  // Ambient decorations
  private orbitGroup!: Group
  private orbit1!: Mesh
  private orbit2!: Mesh
  private ambientGroup!: Group

  // Soul Cluster
  private soulCluster!: Group
  private coreSprite!: Sprite
  private outerSprite!: Sprite
  private particles!: Points

  // Texture references for cleanup
  private royalTexture: CanvasTexture | null = null
  private skyLanternTex: CanvasTexture | null = null
  private ringTex: CanvasTexture | null = null
  private softGlowTex: CanvasTexture | null = null  // 共享单个纹理（原来 2 个相同的）

  // Resize debounce
  private resizeTimer: ReturnType<typeof setTimeout> | null = null

  private pendingTimers: ReturnType<typeof setTimeout>[] = []
  private disposed = false

  private currentState: 'PHASE_0' | 'RITUAL' | 'DONE' = 'PHASE_0'

  constructor(container: HTMLElement, renderer: WebGLRenderer) {
    this.container = container
    this.raycaster = new Raycaster()
    this.mouse = new Vector2()

    // Scene
    this.scene = new Scene()
    this.scene.fog = new FogExp2(0x050202, 0.012)

    // Camera
    this.camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.camera.position.set(0, 4, 8)
    this.camera.lookAt(0, 0, 0)

    // 使用外部传入的共享 renderer，禁用 shadowMap
    this.renderer = renderer
    this.renderer.shadowMap.enabled = false

    // Resize
    window.addEventListener('resize', this.handleResize)
  }

  private handleResize = () => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    this.resizeTimer = setTimeout(() => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight, false)
    }, 150)
  }

  init(): void {
    // --- 光照 ---
    const ambientLight = new AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    const spotLight = new SpotLight(0xffeeb1, 1.8)
    spotLight.position.set(5, 12, 5)
    // shadowMap 已禁用，不需要 castShadow
    this.scene.add(spotLight)

    const hemiLight = new HemisphereLight(0x001133, 0x000000, 0.6)
    this.scene.add(hemiLight)

    this.innerLight = new PointLight(0xffaa00, 0, 15)
    this.innerLight.position.set(0, 0.5, 0)
    this.scene.add(this.innerLight)

    // --- 材质 ---
    this.royalTexture = createRoyalTexture()
    this.skyLanternTex = createLanternTexture()
    this.ringTex = createRingTexture()

    // --- 1. Golden Orbits ---
    this.orbitGroup = new Group()
    this.scene.add(this.orbitGroup)
    const ringGeo = new PlaneGeometry(6, 6)
    const ringMat = new MeshBasicMaterial({
      map: this.ringTex, color: 0xffaa00, transparent: true, opacity: 0.6,
      side: DoubleSide, blending: AdditiveBlending,
    })
    this.orbit1 = new Mesh(ringGeo, ringMat)
    this.orbit1.rotation.x = -Math.PI / 2
    this.orbit1.position.y = -0.5
    this.orbitGroup.add(this.orbit1)

    this.orbit2 = new Mesh(ringGeo, ringMat)
    this.orbit2.rotation.x = -Math.PI / 2
    this.orbit2.position.y = -0.8
    this.orbit2.scale.set(1.5, 1.5, 1)
    this.orbitGroup.add(this.orbit2)

    // --- 2. Ambient Lanterns ---
    this.ambientGroup = new Group()
    this.scene.add(this.ambientGroup)
    const lanternMat = new SpriteMaterial({
      map: this.skyLanternTex, color: 0xffccaa, blending: AdditiveBlending,
      transparent: true, opacity: 0.7,
    })
    for (let i = 0; i < 20; i++) {  // 从 40 降到 20，减少 50% draw calls
      const l = new Sprite(lanternMat)
      const lx = (Math.random() - 0.5) * 35
      const ly = (Math.random() - 0.5) * 15 - 5
      const lz = -10 - Math.random() * 20
      l.position.set(lx, ly, lz)
      l.scale.set(0.8, 0.8, 1)
      l.userData = { speed: 0.003 + Math.random() * 0.005, originalY: ly, limit: ly + 10 }
      this.ambientGroup.add(l)
    }

    // --- 3. The Box ---
    this.boxGroup = new Group()
    this.lidGroup = new Group()
    const boxMat = new MeshStandardMaterial({
      map: this.royalTexture, color: 0xffffff, roughness: 0.4, metalness: 0.1, side: DoubleSide,
    })
    const goldMat = new MeshStandardMaterial({
      color: 0xffd700, roughness: 0.3, metalness: 0.8,
    })
    const boxSize = 2.4; const boxH = 0.9; const wallT = 0.1

    const base = new Mesh(new BoxGeometry(boxSize, wallT, boxSize), boxMat)
    base.position.y = -boxH / 2
    this.boxGroup.add(base)

    const w1 = new Mesh(new BoxGeometry(boxSize, boxH, wallT), boxMat)
    w1.position.z = -boxSize / 2 + wallT / 2
    const w2 = new Mesh(new BoxGeometry(boxSize, boxH, wallT), boxMat)
    w2.position.z = boxSize / 2 - wallT / 2
    const w3 = new Mesh(new BoxGeometry(wallT, boxH, boxSize - wallT * 2), boxMat)
    w3.position.x = -boxSize / 2 + wallT / 2
    const w4 = new Mesh(new BoxGeometry(wallT, boxH, boxSize - wallT * 2), boxMat)
    w4.position.x = boxSize / 2 - wallT / 2
    ;[w1, w2, w3, w4].forEach(w => { w.castShadow = false; w.receiveShadow = false })
    this.boxGroup.add(w1, w2, w3, w4)

    const lid = new Mesh(new BoxGeometry(boxSize, wallT, boxSize), boxMat)
    lid.castShadow = false
    lid.geometry.translate(0, 0, boxSize / 2)
    const deco = new Mesh(new CylinderGeometry(0.3, 0.3, 0.05, 32), goldMat)
    lid.add(deco)
    deco.position.set(0, 0.08, boxSize / 2)
    this.lidGroup.add(lid)

    const latch = new Mesh(new BoxGeometry(0.3, 0.2, 0.05), goldMat)
    latch.position.set(0, 0, boxSize / 2 + 0.02)
    this.boxGroup.add(latch)

    this.lidGroup.position.set(0, boxH / 2, -boxSize / 2)
    this.lidGroup.rotation.x = 0
    this.scene.add(this.boxGroup)
    this.scene.add(this.lidGroup)

    this.hitBox = new Mesh(
      new BoxGeometry(boxSize * 2, boxH * 2, boxSize * 2),
      new MeshBasicMaterial({ visible: false }),
    )
    this.scene.add(this.hitBox)

    // --- Soul Cluster ---
    this.soulCluster = new Group()
    this.scene.add(this.soulCluster)
    this.soulCluster.visible = false

    this.coreSprite = new Sprite(new SpriteMaterial({
      map: (this.softGlowTex = createSoftGlowTex()), color: 0xffffff, blending: AdditiveBlending, opacity: 1,
    }))
    this.coreSprite.scale.set(1.2, 1.2, 1.2)
    this.soulCluster.add(this.coreSprite)

    this.outerSprite = new Sprite(new SpriteMaterial({
      map: this.softGlowTex, color: 0xffaa00, blending: AdditiveBlending, opacity: 0.6,  // 共享同一个纹理
    }))
    this.outerSprite.scale.set(3.5, 3.5, 3.5)
    this.soulCluster.add(this.outerSprite)

    const pGeo = new BufferGeometry()
    const pCount = 200
    const pPos = new Float32Array(pCount * 3)
    for (let i = 0; i < pCount * 3; i++) {
      pPos[i] = (Math.random() - 0.5) * 2
    }
    pGeo.setAttribute('position', new BufferAttribute(pPos, 3))
    const pMat = new PointsMaterial({
      color: 0xffd700, size: 0.05, transparent: true, opacity: 0.8, blending: AdditiveBlending,
    })
    this.particles = new Points(pGeo, pMat)
    this.soulCluster.add(this.particles)
  }

  // --- Animation --- 原封不动翻译自参考HTML的animate函数
  animate(): void {
    const loop = () => {
      this.animationId = requestAnimationFrame(loop)
      // 标签页隐藏时跳过渲染，节省 GPU/CPU
      if (useAppStore.getState().paused) return
      const time = performance.now()

      if (this.currentState === 'PHASE_0') {
        this.orbit1.rotation.z = time * 0.0002
        this.orbit2.rotation.z = -time * 0.0003
        this.ambientGroup.children.forEach(l => {
          l.position.y += (l.userData as { speed: number }).speed
          if (l.position.y > (l.userData as { limit: number }).limit) {
            l.position.y = -5
          }
        })
      }

      if (this.soulCluster.visible) {
        this.coreSprite.scale.setScalar(1.2 + Math.sin(time * 0.005) * 0.1)
        this.outerSprite.scale.setScalar(3.5 + Math.sin(time * 0.002) * 0.2)
        this.particles.rotation.y = time * 0.0005
        this.particles.rotation.z = time * 0.0002
      }

      this.renderer.render(this.scene, this.camera)
    }
    loop()
  }

  // --- Interaction --- 原封不动翻译自参考HTML的onClick
  checkHit(ndcX: number, ndcY: number): boolean {
    this.mouse.x = ndcX
    this.mouse.y = ndcY
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const hits = this.raycaster.intersectObjects([this.hitBox, this.boxGroup, this.lidGroup], true)
    return hits.length > 0
  }

  // --- performRitual --- 原封不动翻译自参考HTML，用gsap嵌套回调精确复刻TWEEN.js嵌套时序
  performOpening(onComplete: () => void): void {
    if (this.currentState !== 'PHASE_0') return
    this.currentState = 'RITUAL'

    // new TWEEN.Tween(ambientGroup.scale).to({x:0,y:0,z:0}, 1000).start()
    gsap.to(this.ambientGroup.scale, { x: 0, y: 0, z: 0, duration: 1 })

    // new TWEEN.Tween(lidGroup.rotation).to({x: -Math.PI/1.5}, 2000).easing(TWEEN.Easing.Quadratic.Out).start()
    gsap.to(this.lidGroup.rotation, { x: -Math.PI / 1.5, duration: 2, ease: 'power2.out' })

    // soulCluster.visible = true; soulCluster.scale.set(0.1, 0.1, 0.1)
    // new TWEEN.Tween(soulCluster.scale).to({x:1,y:1,z:1}, 1500).easing(TWEEN.Easing.Elastic.Out).start()
    this.soulCluster.visible = true
    this.soulCluster.scale.set(0.1, 0.1, 0.1)
    gsap.to(this.soulCluster.scale, { x: 1, y: 1, z: 1, duration: 1.5, ease: 'elastic.out(1, 0.3)' })

    // new TWEEN.Tween(innerLight).to({intensity:2}, 1500).start()
    gsap.to(this.innerLight, { intensity: 2, duration: 1.5 })

    // new TWEEN.Tween(camera.position).to({x:0, y:8, z:3}, 2000).easing(TWEEN.Easing.Cubic.Out)
    //   .onUpdate(()=>camera.lookAt(0,0,0))
    //   .onComplete(() => { setTimeout(() => { ... }, 300) }).start()
    gsap.to(this.camera.position, {
      x: 0, y: 8, z: 3, duration: 2, ease: 'power3.out',
      onUpdate: () => this.camera.lookAt(0, 0, 0),
      onComplete: () => {
        const t1 = setTimeout(() => {
          if (this.disposed) return
          // new TWEEN.Tween(camera.position).to({x:0, y:0.5, z:0}, 1500).easing(TWEEN.Easing.Cubic.InOut)
          //   .onUpdate(()=>camera.lookAt(0,0,0))
          //   .onComplete(() => { fadeGroup...; setTimeout(()=>{...}, 1000) }).start()
          gsap.to(this.camera.position, {
            x: 0, y: 0.5, z: 0, duration: 1.5, ease: 'power3.inOut',
            onUpdate: () => this.camera.lookAt(0, 0, 0),
            onComplete: () => {
              // fadeGroup(boxGroup); fadeGroup(lidGroup); fadeGroup(orbitGroup)
              this.fadeGroup(this.boxGroup)
              this.fadeGroup(this.lidGroup)
              this.fadeGroup(this.orbitGroup)

              // setTimeout(() => { soulCluster爆炸...; setTimeout(enterPhase1, 1000) }, 1000)
              const t2 = setTimeout(() => {
                if (this.disposed) return
                gsap.to(this.soulCluster.scale, { x: 8, y: 8, z: 8, duration: 1.2 })
                gsap.to(this.coreSprite.material, { opacity: 0, duration: 1 })
                gsap.to(this.outerSprite.material, { opacity: 0, duration: 1 })
                gsap.to(this.particles.material, { opacity: 0, duration: 1 })

                // setTimeout(enterPhase1, 1000)
                const t3 = setTimeout(() => {
                  if (this.disposed) return
                  this.currentState = 'DONE'
                  this.scene.remove(this.boxGroup)
                  this.scene.remove(this.lidGroup)
                  this.scene.remove(this.soulCluster)
                  this.scene.remove(this.hitBox)
                  this.scene.remove(this.ambientGroup)
                  this.scene.remove(this.orbitGroup)

                  this.camera.position.set(0, 0, 6)
                  this.camera.lookAt(0, 0, 0)

                  onComplete()
                }, 1000)
                this.pendingTimers.push(t3)
              }, 1000)
              this.pendingTimers.push(t2)
            },
          })
        }, 300)
        this.pendingTimers.push(t1)
      },
    })
  }

  // --- fadeGroup --- 原封不动翻译自参考HTML
  // function fadeGroup(grp){ grp.traverse(c=>{ if(c.isMesh){ c.material.transparent=true; new TWEEN.Tween(c.material).to({opacity:0}, 1000).start() } }) }
  private fadeGroup(grp: Group): void {
    grp.traverse(c => {
      if ((c as Mesh).isMesh) {
        const mat = (c as Mesh).material as Material
        mat.transparent = true
        gsap.to(mat, { opacity: 0, duration: 1 })
      }
    })
  }

  stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  dispose(): void {
    this.disposed = true
    this.pendingTimers.forEach(t => clearTimeout(t))
    this.pendingTimers.length = 0

    this.stopAnimation()

    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer)
      this.resizeTimer = null
    }

    // Kill all gsap tweens on known targets
    gsap.killTweensOf(this.ambientGroup?.scale)
    gsap.killTweensOf(this.lidGroup?.rotation)
    gsap.killTweensOf(this.soulCluster?.scale)
    gsap.killTweensOf(this.innerLight)
    gsap.killTweensOf(this.camera?.position)
    gsap.killTweensOf(this.coreSprite?.material)
    gsap.killTweensOf(this.outerSprite?.material)
    gsap.killTweensOf(this.particles?.material)

    // Kill fadeGroup material tweens
    this.scene.traverse(obj => {
      if ((obj as Mesh).isMesh) {
        gsap.killTweensOf((obj as Mesh).material)
      }
    })

    // Explicitly dispose canvas textures
    this.royalTexture?.dispose()
    this.skyLanternTex?.dispose()
    this.ringTex?.dispose()
    this.softGlowTex?.dispose()

    window.removeEventListener('resize', this.handleResize)

    // 收集所有需要清理的对象（包括已从 scene 移除的 groups）
    // performOpening() 会 scene.remove() 这些 groups，导致 scene.traverse() 找不到它们
    const disposedMats = new Set<Material>()
    const allRoots: Group[] = [
      this.boxGroup, this.lidGroup, this.soulCluster,
      this.ambientGroup, this.orbitGroup,
    ].filter(Boolean)

    const disposeObj = (obj: Object3D) => {
      if (obj instanceof Mesh || obj instanceof Points) {
        obj.geometry?.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach(m => {
          if (m instanceof Material && !disposedMats.has(m)) {
            disposedMats.add(m)
            m.dispose()
          }
        })
      }
      if (obj instanceof Sprite) {
        const sm = obj.material as SpriteMaterial
        if (!disposedMats.has(sm)) {
          disposedMats.add(sm)
          sm.map?.dispose()
          sm.dispose()
        }
      }
    }

    // 遍历已移除的 groups
    for (const root of allRoots) {
      root.traverse(disposeObj)
    }
    // 遍历 scene 中剩余对象（lights, hitBox 等）
    this.scene.traverse(disposeObj)
    // hitBox 单独处理（可能已从 scene 移除）
    if (this.hitBox) {
      disposeObj(this.hitBox)
    }

    this.renderer = null as unknown as WebGLRenderer
    this.scene = null as unknown as Scene
    this.camera = null as unknown as PerspectiveCamera

  }
}
