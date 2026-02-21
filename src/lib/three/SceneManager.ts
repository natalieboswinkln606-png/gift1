import { Clock, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class SceneManager {
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  controls: OrbitControls
  clock: Clock
  private container: HTMLElement
  private resizeHandler: () => void
  private resizeTimer: ReturnType<typeof setTimeout> | null = null
  private onResizeCallbacks: Array<(w: number, h: number) => void> = []

  constructor(container: HTMLElement, renderer: WebGLRenderer, maxPixelRatio = 2) {
    this.container = container
    this.clock = new Clock()
    this.scene = new Scene()

    this.camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000)
    this.camera.position.set(0, 40, 110)

    // 使用外部传入的共享 renderer，不再自行创建
    this.renderer = renderer

    // OrbitControls 绑定到 container 而非 renderer.domElement（共享 canvas 是 pointer-events:none，无法接收事件）
    this.controls = new OrbitControls(this.camera, container)
    this.controls.enableDamping = true
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.5

    this.resizeHandler = this.debouncedResize.bind(this)
    window.addEventListener('resize', this.resizeHandler)
  }

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
    this.renderer.setSize(w, h, false)
    this.onResizeCallbacks.forEach((cb) => cb(w, h))
  }

  /** 重置 renderer 尺寸到当前窗口大小 */
  resetRendererState(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false)
  }

  dispose(): void {
    window.removeEventListener('resize', this.resizeHandler)
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    this.controls.dispose()
    this.onResizeCallbacks.length = 0
    // 防御性重置共享 renderer 的 WebGL 状态，避免 EffectComposer 残留的
    // blend mode / depth test / stencil 等状态影响下一个场景的首帧渲染
    this.renderer.setRenderTarget(null)
    this.renderer.state.reset()
    // 不调用 scene.clear()：各子系统在自己的 dispose 中负责 removeFromParent
    // scene 对象随 SceneManager 一起被 GC 回收
    // renderer 由外部调用方统一管理，不在此处释放
  }
}
