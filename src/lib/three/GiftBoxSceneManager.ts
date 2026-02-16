import * as THREE from 'three'
import gsap from 'gsap'

// --- Canvas Texture Helpers (原封不动翻译自参考HTML) ---

function createRoyalTexture(): THREE.CanvasTexture {
  const s = 1024
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#660000'
  ctx.fillRect(0, 0, s, s)
  for (let i = 0; i < 10000; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`
    ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2)
  }
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 20
  ctx.strokeRect(20, 20, s - 40, s - 40)
  const cx = s / 2; const cy = s / 2
  ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI * 2)
  ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(212,175,55,0.4)'; ctx.stroke()
  return new THREE.CanvasTexture(c)
}

function createLanternTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, '#ffcc00')
  g.addColorStop(0.5, '#ff4500')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

function createRingTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.arc(128, 128, 100, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(128, 128, 115, 0, Math.PI * 2); ctx.stroke()
  return new THREE.CanvasTexture(c)
}

function createSoftGlowTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,240,1)')
  g.addColorStop(0.3, 'rgba(255,200,100,0.5)')
  g.addColorStop(1, 'rgba(255,100,0,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

// --- Main Class ---

export class GiftBoxSceneManager {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private container: HTMLElement
  private animationId: number | null = null
  private raycaster: THREE.Raycaster
  private mouse: THREE.Vector2

  // Scene objects
  private boxGroup!: THREE.Group
  private lidGroup!: THREE.Group
  private hitBox!: THREE.Mesh
  private innerLight!: THREE.PointLight

  // Ambient decorations
  private orbitGroup!: THREE.Group
  private orbit1!: THREE.Mesh
  private orbit2!: THREE.Mesh
  private ambientGroup!: THREE.Group

  // Soul Cluster
  private soulCluster!: THREE.Group
  private coreSprite!: THREE.Sprite
  private outerSprite!: THREE.Sprite
  private particles!: THREE.Points

  // Texture references for cleanup
  private royalTexture: THREE.CanvasTexture | null = null
  private skyLanternTex: THREE.CanvasTexture | null = null
  private ringTex: THREE.CanvasTexture | null = null
  private softGlowTex1: THREE.CanvasTexture | null = null
  private softGlowTex2: THREE.CanvasTexture | null = null

  // Resize debounce
  private resizeTimer: ReturnType<typeof setTimeout> | null = null

  private currentState: 'PHASE_0' | 'RITUAL' | 'DONE' = 'PHASE_0'

  constructor(container: HTMLElement) {
    this.container = container
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()

    // Scene
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x050202, 0.012)

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.camera.position.set(0, 4, 8)
    this.camera.lookAt(0, 0, 0)

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.style.position = 'absolute'
    this.renderer.domElement.style.top = '0'
    this.renderer.domElement.style.left = '0'
    this.renderer.domElement.style.zIndex = '5'
    container.appendChild(this.renderer.domElement)

    // Resize
    window.addEventListener('resize', this.handleResize)
  }

  private handleResize = () => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    this.resizeTimer = setTimeout(() => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    }, 150)
  }

  init(): void {
    // --- 光照 ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    const spotLight = new THREE.SpotLight(0xffeeb1, 1.8)
    spotLight.position.set(5, 12, 5)
    spotLight.castShadow = true
    spotLight.shadow.mapSize.width = 1024
    spotLight.shadow.mapSize.height = 1024
    this.scene.add(spotLight)

    const hemiLight = new THREE.HemisphereLight(0x001133, 0x000000, 0.6)
    this.scene.add(hemiLight)

    this.innerLight = new THREE.PointLight(0xffaa00, 0, 15)
    this.innerLight.position.set(0, 0.5, 0)
    this.scene.add(this.innerLight)

    // --- 材质 ---
    this.royalTexture = createRoyalTexture()
    this.skyLanternTex = createLanternTexture()
    this.ringTex = createRingTexture()

    // --- 1. Golden Orbits ---
    this.orbitGroup = new THREE.Group()
    this.scene.add(this.orbitGroup)
    const ringGeo = new THREE.PlaneGeometry(6, 6)
    const ringMat = new THREE.MeshBasicMaterial({
      map: this.ringTex, color: 0xffaa00, transparent: true, opacity: 0.6,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    })
    this.orbit1 = new THREE.Mesh(ringGeo, ringMat)
    this.orbit1.rotation.x = -Math.PI / 2
    this.orbit1.position.y = -0.5
    this.orbitGroup.add(this.orbit1)

    this.orbit2 = new THREE.Mesh(ringGeo, ringMat)
    this.orbit2.rotation.x = -Math.PI / 2
    this.orbit2.position.y = -0.8
    this.orbit2.scale.set(1.5, 1.5, 1)
    this.orbitGroup.add(this.orbit2)

    // --- 2. Ambient Lanterns ---
    this.ambientGroup = new THREE.Group()
    this.scene.add(this.ambientGroup)
    const lanternMat = new THREE.SpriteMaterial({
      map: this.skyLanternTex, color: 0xffccaa, blending: THREE.AdditiveBlending,
      transparent: true, opacity: 0.7,
    })
    for (let i = 0; i < 40; i++) {
      const l = new THREE.Sprite(lanternMat)
      const lx = (Math.random() - 0.5) * 35
      const ly = (Math.random() - 0.5) * 15 - 5
      const lz = -10 - Math.random() * 20
      l.position.set(lx, ly, lz)
      l.scale.set(0.8, 0.8, 1)
      l.userData = { speed: 0.003 + Math.random() * 0.005, originalY: ly, limit: ly + 10 }
      this.ambientGroup.add(l)
    }

    // --- 3. The Box ---
    this.boxGroup = new THREE.Group()
    this.lidGroup = new THREE.Group()
    const boxMat = new THREE.MeshStandardMaterial({
      map: this.royalTexture, color: 0xffffff, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide,
    })
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700, roughness: 0.3, metalness: 0.8,
    })
    const boxSize = 2.4; const boxH = 0.9; const wallT = 0.1

    const base = new THREE.Mesh(new THREE.BoxGeometry(boxSize, wallT, boxSize), boxMat)
    base.position.y = -boxH / 2
    this.boxGroup.add(base)

    const w1 = new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxH, wallT), boxMat)
    w1.position.z = -boxSize / 2 + wallT / 2
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxH, wallT), boxMat)
    w2.position.z = boxSize / 2 - wallT / 2
    const w3 = new THREE.Mesh(new THREE.BoxGeometry(wallT, boxH, boxSize - wallT * 2), boxMat)
    w3.position.x = -boxSize / 2 + wallT / 2
    const w4 = new THREE.Mesh(new THREE.BoxGeometry(wallT, boxH, boxSize - wallT * 2), boxMat)
    w4.position.x = boxSize / 2 - wallT / 2
    ;[w1, w2, w3, w4].forEach(w => { w.castShadow = true; w.receiveShadow = true })
    this.boxGroup.add(w1, w2, w3, w4)

    const lid = new THREE.Mesh(new THREE.BoxGeometry(boxSize, wallT, boxSize), boxMat)
    lid.castShadow = true
    lid.geometry.translate(0, 0, boxSize / 2)
    const deco = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 32), goldMat)
    lid.add(deco)
    deco.position.set(0, 0.08, boxSize / 2)
    this.lidGroup.add(lid)

    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.05), goldMat)
    latch.position.set(0, 0, boxSize / 2 + 0.02)
    this.boxGroup.add(latch)

    this.lidGroup.position.set(0, boxH / 2, -boxSize / 2)
    this.lidGroup.rotation.x = 0
    this.scene.add(this.boxGroup)
    this.scene.add(this.lidGroup)

    this.hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(boxSize * 2, boxH * 2, boxSize * 2),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    this.scene.add(this.hitBox)

    // --- Soul Cluster ---
    this.soulCluster = new THREE.Group()
    this.scene.add(this.soulCluster)
    this.soulCluster.visible = false

    this.coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: (this.softGlowTex1 = createSoftGlowTex()), color: 0xffffff, blending: THREE.AdditiveBlending, opacity: 1,
    }))
    this.coreSprite.scale.set(1.2, 1.2, 1.2)
    this.soulCluster.add(this.coreSprite)

    this.outerSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: (this.softGlowTex2 = createSoftGlowTex()), color: 0xffaa00, blending: THREE.AdditiveBlending, opacity: 0.6,
    }))
    this.outerSprite.scale.set(3.5, 3.5, 3.5)
    this.soulCluster.add(this.outerSprite)

    const pGeo = new THREE.BufferGeometry()
    const pCount = 200
    const pPos = new Float32Array(pCount * 3)
    for (let i = 0; i < pCount * 3; i++) {
      pPos[i] = (Math.random() - 0.5) * 2
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
    const pMat = new THREE.PointsMaterial({
      color: 0xffd700, size: 0.05, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending,
    })
    this.particles = new THREE.Points(pGeo, pMat)
    this.soulCluster.add(this.particles)
  }

  // --- Animation --- 原封不动翻译自参考HTML的animate函数
  animate(): void {
    const loop = () => {
      this.animationId = requestAnimationFrame(loop)
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
        setTimeout(() => {
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
              setTimeout(() => {
                gsap.to(this.soulCluster.scale, { x: 8, y: 8, z: 8, duration: 1.2 })
                gsap.to(this.coreSprite.material, { opacity: 0, duration: 1 })
                gsap.to(this.outerSprite.material, { opacity: 0, duration: 1 })
                gsap.to(this.particles.material, { opacity: 0, duration: 1 })

                // setTimeout(enterPhase1, 1000)
                setTimeout(() => {
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
              }, 1000)
            },
          })
        }, 300)
      },
    })
  }

  // --- fadeGroup --- 原封不动翻译自参考HTML
  // function fadeGroup(grp){ grp.traverse(c=>{ if(c.isMesh){ c.material.transparent=true; new TWEEN.Tween(c.material).to({opacity:0}, 1000).start() } }) }
  private fadeGroup(grp: THREE.Group): void {
    grp.traverse(c => {
      if ((c as THREE.Mesh).isMesh) {
        const mat = (c as THREE.Mesh).material as THREE.Material
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
      if ((obj as THREE.Mesh).isMesh) {
        gsap.killTweensOf((obj as THREE.Mesh).material)
      }
    })

    // Explicitly dispose canvas textures
    this.royalTexture?.dispose()
    this.skyLanternTex?.dispose()
    this.ringTex?.dispose()
    this.softGlowTex1?.dispose()
    this.softGlowTex2?.dispose()

    window.removeEventListener('resize', this.handleResize)

    this.scene.traverse(obj => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry?.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach(m => { if (m instanceof THREE.Material) m.dispose() })
      }
      if (obj instanceof THREE.Sprite) {
        (obj.material as THREE.SpriteMaterial).map?.dispose()
        obj.material.dispose()
      }
    })

    this.renderer.renderLists.dispose()
    this.renderer.dispose()
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
