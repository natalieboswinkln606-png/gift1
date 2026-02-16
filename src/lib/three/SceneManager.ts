import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { QualityLevel } from '@/types'

export class SceneManager {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  clock: THREE.Clock
  private container: HTMLElement
  private resizeHandler: () => void
  private resizeTimer: ReturnType<typeof setTimeout> | null = null
  private onResizeCallbacks: Array<(w: number, h: number) => void> = []

  constructor(container: HTMLElement) {
    this.container = container
    this.clock = new THREE.Clock()
    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000)
    this.camera.position.set(0, 40, 110)

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.9
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.5

    this.resizeHandler = this.debouncedResize.bind(this)
    window.addEventListener('resize', this.resizeHandler)
  }

  init(): void { /* placeholder */ }

  onResize(cb: (w: number, h: number) => void): void {
    this.onResizeCallbacks.push(cb)
  }

  /** resize 事件节流：150ms 内只执行最后一次 */
  private debouncedResize(): void {
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    this.resizeTimer = setTimeout(() => {
      this.handleResize()
      this.resizeTimer = null
    }, 150)
  }

  private handleResize(): void {
    const w = window.innerWidth, h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.onResizeCallbacks.forEach((cb) => cb(w, h))
  }

  setQuality(quality: QualityLevel): void {
    const pr: Record<QualityLevel, number> = { HIGH: 2, MEDIUM: 1.5, LOW: 1 }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pr[quality]))
  }

  dispose(): void {
    window.removeEventListener('resize', this.resizeHandler)
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    this.controls.dispose()
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.InstancedMesh || obj instanceof THREE.Sprite || obj instanceof THREE.Line) {
        obj.geometry?.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => {
          if (m instanceof THREE.Material) {
            // Dispose textures attached to material
            for (const value of Object.values(m)) {
              if (value instanceof THREE.Texture) value.dispose()
            }
            m.dispose()
          }
        })
      }
    })
    this.renderer.renderLists.dispose()
    this.renderer.dispose()
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
