import {
  DoubleSide,
  Group,
  Material,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import gsap from 'gsap'
import { getRandomBlessing, getRandomBlessings } from '@/data/blessings'
import { useAppStore } from '@/stores/useAppStore'

/** Layout config: 6 inner + 9 outer = 15 icons (cycling 9 source PNGs) */
const INNER_COUNT = 6
const OUTER_COUNT = 9
const ICON_COUNT = INNER_COUNT + OUTER_COUNT
const SOURCE_COUNT = 9
const ICON_SCALE = 0.55

export class WelcomeSceneManager {
  onSpriteHover: ((text: string, screenX: number, screenY: number) => void) | null = null
  onSpriteLeave: (() => void) | null = null

  private scene: Scene
  private camera: PerspectiveCamera
  private renderer: WebGLRenderer
  private container: HTMLElement
  private animationId: number | null = null
  private raycaster: Raycaster
  private mouse: Vector2

  private iconGroup: Group
  private iconGroups: Group[] = []
  private blessings: string[] = []
  private activeIcon: Group | null = null
  private startTime = 0
  private disposed = false
  private exitTimeoutId: ReturnType<typeof setTimeout> | null = null
  private _projTmp = new Vector3()
  private resizeTimer: ReturnType<typeof setTimeout> | null = null
  private sharedGeometry: PlaneGeometry | null = null

  constructor(container: HTMLElement, renderer: WebGLRenderer) {
    this.container = container
    this.raycaster = new Raycaster()
    this.mouse = new Vector2()

    this.scene = new Scene()

    const w = window.innerWidth
    const h = window.innerHeight
    this.camera = new PerspectiveCamera(60, w / h, 0.1, 100)
    this.camera.position.set(0, 0, 6)
    this.camera.lookAt(0, 0, 0)

    // 使用外部传入的共享 renderer，不自行创建
    this.renderer = renderer
    // 重置 renderer 状态以适配当前场景
    this.renderer.toneMapping = NoToneMapping
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setSize(window.innerWidth, window.innerHeight, false)

    this.iconGroup = new Group()
    this.scene.add(this.iconGroup)

    window.addEventListener('resize', this.handleResize)
  }

  private handleResize = () => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    this.resizeTimer = setTimeout(() => {
      const w = window.innerWidth
      const h = window.innerHeight
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(w, h, false)
    }, 150)
  }

  init(): void {
    this.startTime = performance.now()
    this.blessings = getRandomBlessings(ICON_COUNT)

    // Initialize enhanced systems (particles removed)

    // Compute visible area at camera distance
    const dist = 6
    const vFOV = MathUtils.degToRad(60)
    const vH = 2 * Math.tan(vFOV / 2) * dist
    const vW = vH * (window.innerWidth / window.innerHeight)

    const innerRX = vW * 0.20
    const innerRY = vH * 0.20
    const outerRX = vW * 0.38
    const outerRY = vH * 0.38

    // Load 9 source PNG textures (transparent backgrounds)
    // 纹理去重：只加载 SOURCE_COUNT 个纹理，循环复用
    const loader = new TextureLoader()
    const textures: Texture[] = []
    const texturePromises: Promise<void>[] = []
    for (let s = 0; s < SOURCE_COUNT; s++) {
      const path = `/icons/icon-${String(s + 1).padStart(2, '0')}.png`
      const tex = loader.load(path, (loadedTex) => {
        if (this.disposed) return
        loadedTex.colorSpace = SRGBColorSpace
      }, undefined, (err) => {
        console.warn(`[WelcomeScene] Failed to load icon ${path}:`, err)
      })
      tex.colorSpace = SRGBColorSpace
      textures.push(tex)
    }

    // 共享单个 PlaneGeometry（15 个图标复用，减少 14 个 geometry 对象）
    const sharedGeometry = new PlaneGeometry(1, 1)
    this.sharedGeometry = sharedGeometry

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

      const rotX = (Math.random() - 0.5) * MathUtils.degToRad(16)
      const rotY = (Math.random() - 0.5) * MathUtils.degToRad(24)
      const rotZ = (Math.random() - 0.5) * MathUtils.degToRad(6)

       // 复用共享纹理和几何体
       const tex = textures[i % SOURCE_COUNT]

      const material = new MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 1,
        side: DoubleSide,
        alphaTest: 0.05,
      })

      const mesh = new Mesh(sharedGeometry, material)
      // Wrap in group for consistent API with rest of the system
      const group = new Group()
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
      // 标签页隐藏时跳过渲染，节省 GPU/CPU
      if (useAppStore.getState().paused) return
      const time = performance.now() - this.startTime

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
      let hitGroup: Group | null = null
      let obj: Object3D | null = hits[0].object
      while (obj && obj.parent !== this.iconGroup) {
        obj = obj.parent
      }
      if (obj) hitGroup = obj as Group

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
        hitGroup.traverse((child: Object3D) => {
          if (child instanceof Mesh) {
            gsap.to(child.material, { opacity: 0.15, duration: 0.2 })
          }
        })

        // Emit hover sparkles (removed)
      }

      if (hitGroup) {
        const v = this._projTmp.copy(hitGroup.position).project(this.camera)
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

  private restoreIcon(group: Group): void {
    const orig = group.userData.originalRotation as { x: number; y: number; z: number }
    gsap.to(group.scale, { x: ICON_SCALE, y: ICON_SCALE, z: ICON_SCALE, duration: 0.3 })
    gsap.to(group.rotation, { x: orig.x, y: orig.y, z: orig.z, duration: 0.3 })

    group.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
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

      g.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
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
      g.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          gsap.killTweensOf(child.material)
        }
      })
    })

    window.removeEventListener('resize', this.handleResize)

    this.iconGroups.forEach((g) => {
      g.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          // geometry 是共享的，不在此处 dispose（下方统一释放）
          const m = child.material as Material & { map?: Texture }
          m.map?.dispose()
          m.dispose()
        }
      })
    })
    // 统一释放共享 geometry（只 dispose 一次，避免 15 次 double-free）
    this.sharedGeometry?.dispose()
    this.sharedGeometry = null
    this.iconGroups = []
    this.renderer = null as unknown as WebGLRenderer
    this.scene = null as unknown as Scene
    this.camera = null as unknown as PerspectiveCamera
  }
}
