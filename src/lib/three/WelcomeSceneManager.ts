import * as THREE from 'three'
import gsap from 'gsap'
import { getRandomBlessing, getRandomBlessings } from '@/data/blessings'

/** Layout config: 6 inner + 9 outer = 15 icons (cycling 9 source PNGs) */
const INNER_COUNT = 6
const OUTER_COUNT = 9
const ICON_COUNT = INNER_COUNT + OUTER_COUNT
const SOURCE_COUNT = 9
const ICON_SCALE = 0.55

export class WelcomeSceneManager {
  onSpriteHover: ((text: string, screenX: number, screenY: number) => void) | null = null
  onSpriteLeave: (() => void) | null = null

  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private container: HTMLElement
  private animationId: number | null = null
  private raycaster: THREE.Raycaster
  private mouse: THREE.Vector2

  private iconGroup: THREE.Group
  private iconGroups: THREE.Group[] = []
  private blessings: string[] = []
  private activeIcon: THREE.Group | null = null
  private startTime = 0
  private disposed = false
  private exitTimeoutId: ReturnType<typeof setTimeout> | null = null
  private resizeTimer: ReturnType<typeof setTimeout> | null = null

  // Enhanced systems
  private pointLight1!: THREE.PointLight
  private pointLight2!: THREE.PointLight

  constructor(container: HTMLElement) {
    this.container = container
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()

    this.scene = new THREE.Scene()

    const w = window.innerWidth
    const h = window.innerHeight
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100)
    this.camera.position.set(0, 0, 6)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(w, h)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    // Disable tone mapping to prevent color shift on icon textures
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.style.position = 'absolute'
    this.renderer.domElement.style.top = '0'
    this.renderer.domElement.style.left = '0'
    this.renderer.domElement.style.zIndex = '5'
    this.renderer.domElement.style.pointerEvents = 'none'
    container.appendChild(this.renderer.domElement)

    this.iconGroup = new THREE.Group()
    this.scene.add(this.iconGroup)

    // --- Enhanced 6-light system ---
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5))

    const keyLight = new THREE.DirectionalLight(0xfff5e0, 0.8)
    keyLight.position.set(5, 8, 6)
    this.scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x88ccff, 0.3)
    fillLight.position.set(-4, 3, -5)
    this.scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xffd700, 0.4)
    rimLight.position.set(0, -3, -8)
    this.scene.add(rimLight)

    this.pointLight1 = new THREE.PointLight(0xffd700, 0.6, 15)
    this.pointLight1.position.set(3, 2, 4)
    this.scene.add(this.pointLight1)

    this.pointLight2 = new THREE.PointLight(0xff6b6b, 0.5, 12)
    this.pointLight2.position.set(-3, -2, 3)
    this.scene.add(this.pointLight2)

    window.addEventListener('resize', this.handleResize)
  }

  private handleResize = () => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    this.resizeTimer = setTimeout(() => {
      const w = window.innerWidth
      const h = window.innerHeight
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(w, h)
    }, 150)
  }

  init(): void {
    this.startTime = performance.now()
    this.blessings = getRandomBlessings(ICON_COUNT)

    // Initialize enhanced systems (particles removed)

    // Compute visible area at camera distance
    const dist = 6
    const vFOV = THREE.MathUtils.degToRad(60)
    const vH = 2 * Math.tan(vFOV / 2) * dist
    const vW = vH * (window.innerWidth / window.innerHeight)

    const innerRX = vW * 0.20
    const innerRY = vH * 0.20
    const outerRX = vW * 0.38
    const outerRY = vH * 0.38

    // Load 9 source PNG textures (transparent backgrounds)
    const loader = new THREE.TextureLoader()
    const iconPaths = Array.from({ length: ICON_COUNT }, (_, i) =>
      `/icons/icon-${String((i % SOURCE_COUNT) + 1).padStart(2, '0')}.png`
    )

    for (let i = 0; i < ICON_COUNT; i++) {
      const isInner = i < INNER_COUNT
      const ringIndex = isInner ? i : i - INNER_COUNT
      const ringTotal = isInner ? INNER_COUNT : OUTER_COUNT
      const rx = isInner ? innerRX : outerRX
      const ry = isInner ? innerRY : outerRY

      const baseAngle = (ringIndex / ringTotal) * Math.PI * 2 +
        (isInner ? 0 : Math.PI / OUTER_COUNT)
      const angle = baseAngle + (Math.random() - 0.5) * 0.15

      const x = Math.cos(angle) * rx
      const y = Math.sin(angle) * ry
      const z = (Math.random() - 0.5) * 0.2

      const rotX = (Math.random() - 0.5) * THREE.MathUtils.degToRad(16)
      const rotY = (Math.random() - 0.5) * THREE.MathUtils.degToRad(24)
      const rotZ = (Math.random() - 0.5) * THREE.MathUtils.degToRad(6)

       // Load PNG texture — use MeshBasicMaterial to preserve original colors (no lighting tint)
       const tex = loader.load(iconPaths[i], (loadedTex) => {
         if (this.disposed) return
         loadedTex.colorSpace = THREE.SRGBColorSpace
       }, undefined, (err) => {
         console.warn(`[WelcomeScene] Failed to load icon ${iconPaths[i]}:`, err)
       })
       tex.colorSpace = THREE.SRGBColorSpace

      const geometry = new THREE.PlaneGeometry(1, 1)
      const material = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        alphaTest: 0.05,
      })

      const mesh = new THREE.Mesh(geometry, material)
      // Wrap in group for consistent API with rest of the system
      const group = new THREE.Group()
      group.add(mesh)

      group.userData = {
        text: this.blessings[i],
        baseY: y,
        index: i,
        targetPosition: { x, y, z },
        originalRotation: { x: rotX, y: rotY, z: rotZ },
      }

      // Start at center, invisible (for spiral entry)
      group.position.set(0, 0, 0)
      group.scale.set(0, 0, 0)
      group.rotation.set(0, 0, Math.PI * 4)

      this.iconGroup.add(group)
      this.iconGroups.push(group)
    }

    this.playSpiralEntry()
  }

  /** Spiral-out entry: icons fly from center to their ellipse positions */
  private playSpiralEntry(): void {
    this.iconGroups.forEach((group, i) => {
      const delay = i * 0.06
      const target = group.userData.targetPosition as { x: number; y: number; z: number }
      const targetRot = group.userData.originalRotation as { x: number; y: number; z: number }

      gsap.to(group.position, {
        x: target.x, y: target.y, z: target.z,
        duration: 1.5, delay, ease: 'power2.out',
      })

      gsap.to(group.scale, {
        x: ICON_SCALE, y: ICON_SCALE, z: ICON_SCALE,
        duration: 1.2, delay, ease: 'elastic.out(1, 0.6)',
      })

      gsap.to(group.rotation, {
        x: targetRot.x, y: targetRot.y, z: targetRot.z,
        duration: 1.5, delay, ease: 'power3.out',
      })
    })
  }

  animate(): void {
    const loop = () => {
      this.animationId = requestAnimationFrame(loop)
      const time = performance.now() - this.startTime

      // Pulsing point lights
      this.pointLight1.intensity = 0.6 + Math.sin(time * 0.002) * 0.3
      this.pointLight2.intensity = 0.5 + Math.cos(time * 0.0015) * 0.25
      this.pointLight1.position.x = 3 + Math.sin(time * 0.0008) * 1
      this.pointLight2.position.y = -2 + Math.cos(time * 0.001) * 1

      // Idle animation: floating + wobble
      this.iconGroups.forEach((g) => {
        const idx = g.userData.index as number
        g.position.y = (g.userData.baseY as number) + Math.sin(time * 0.001 + idx * 0.8) * 0.08

        if (this.activeIcon !== g) {
          const orig = g.userData.originalRotation as { x: number; y: number; z: number }
          g.rotation.x = orig.x + Math.sin(time * 0.0008 + idx * 0.5) * 0.03
          g.rotation.y = orig.y + Math.cos(time * 0.0007 + idx * 0.7) * 0.04
        }
      })

      this.renderer.render(this.scene, this.camera)
    }
    loop()
  }

  handleMouseMove(clientX: number, clientY: number): { text: string; screenX: number; screenY: number } | null {
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1
    this.raycaster.setFromCamera(this.mouse, this.camera)

    // Recursive intersection to hit children inside groups
    const hits = this.raycaster.intersectObjects(this.iconGroup.children, true)

    if (hits.length > 0) {
      // Walk up to find the icon group (direct child of iconGroup)
      let hitGroup: THREE.Group | null = null
      let obj: THREE.Object3D | null = hits[0].object
      while (obj && obj.parent !== this.iconGroup) {
        obj = obj.parent
      }
      if (obj) hitGroup = obj as THREE.Group

      if (hitGroup && this.activeIcon !== hitGroup) {
        if (this.activeIcon) {
          this.restoreIcon(this.activeIcon)
        }
        this.activeIcon = hitGroup

        // Re-randomize blessing each time a new icon is hovered
        hitGroup.userData.text = getRandomBlessing()

        // Hover: scale up, face camera
        gsap.to(hitGroup.scale, { x: 0.55, y: 0.55, z: 0.55, duration: 0.3, ease: 'power2.out' })
        gsap.to(hitGroup.rotation, { x: 0, y: 0, z: 0, duration: 0.3, ease: 'power2.out' })

        // Fade out icon meshes
        hitGroup.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            gsap.to(child.material, { opacity: 0.15, duration: 0.2 })
          }
        })

        // Emit hover sparkles (removed)
      }

      if (hitGroup) {
        const v = hitGroup.position.clone().project(this.camera)
        const screenX = (v.x * 0.5 + 0.5) * window.innerWidth
        const screenY = (-(v.y * 0.5) + 0.5) * window.innerHeight
        const text = hitGroup.userData.text as string

        if (this.onSpriteHover) {
          this.onSpriteHover(text, screenX, screenY)
        }
        return { text, screenX, screenY }
      }
    }

    // No hit — restore
    if (this.activeIcon) {
      this.restoreIcon(this.activeIcon)
      this.activeIcon = null
      if (this.onSpriteLeave) {
        this.onSpriteLeave()
      }
    }
    return null
  }

  private restoreIcon(group: THREE.Group): void {
    const orig = group.userData.originalRotation as { x: number; y: number; z: number }
    gsap.to(group.scale, { x: ICON_SCALE, y: ICON_SCALE, z: ICON_SCALE, duration: 0.3 })
    gsap.to(group.rotation, { x: orig.x, y: orig.y, z: orig.z, duration: 0.3 })

    group.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        gsap.to(child.material, { opacity: 1, duration: 0.3 })
      }
    })
  }

  playExitAnimation(onComplete: () => void): void {
    this.iconGroups.forEach((g, i) => {
      gsap.to(g.position, {
        y: g.position.y + 10,
        duration: 1 + i * 0.04,
        ease: 'power3.in',
      })

      g.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          gsap.to(child.material, { opacity: 0, duration: 0.8 })
        }
      })
    })

    this.exitTimeoutId = setTimeout(() => {
      this.exitTimeoutId = null
      onComplete()
    }, 1500)
  }

  stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  dispose(): void {
    this.disposed = true
    this.stopAnimation()

    if (this.exitTimeoutId !== null) {
      clearTimeout(this.exitTimeoutId)
      this.exitTimeoutId = null
    }

    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer)
      this.resizeTimer = null
    }

    // Kill all GSAP tweens on icon groups to prevent leaks
    this.iconGroups.forEach((g) => {
      gsap.killTweensOf(g.position)
      gsap.killTweensOf(g.scale)
      gsap.killTweensOf(g.rotation)
      g.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          gsap.killTweensOf(child.material)
        }
      })
    })

    // Kill GSAP tweens on point lights
    gsap.killTweensOf(this.pointLight1)
    gsap.killTweensOf(this.pointLight1.position)
    gsap.killTweensOf(this.pointLight2)
    gsap.killTweensOf(this.pointLight2.position)

    window.removeEventListener('resize', this.handleResize)

    this.iconGroups.forEach((g) => {
      g.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          const m = child.material as THREE.Material & { map?: THREE.Texture }
          m.map?.dispose()
          m.dispose()
        }
      })
    })
    this.iconGroups = []

    this.renderer.renderLists.dispose()
    this.renderer.dispose()
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
