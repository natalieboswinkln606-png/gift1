import {
  CanvasTexture, DoubleSide, Group, LinearFilter,
  Material, Mesh, MeshBasicMaterial, NormalBlending,
  RepeatWrapping, Scene, SphereGeometry, TorusGeometry,
  WebGLRenderer,
} from 'three'
import { BLOOM_LAYER } from './SelectiveBloom'

// 球面弧形光幕 + Canvas滚动文字 + 底部轨道线
// 内容：实时日期时间 + 用户名 + 祝福语

// --- 配置常量 ---
const SCREEN_RADIUS = 20
const SCREEN_HEIGHT = 0.08
const SCROLL_SPEED = 0.03
const PRIMARY_COLOR = 0xffaa00
const FONT_SIZE = 32  // 缩小 1/3（48→32），字幕条字体更精致
const TILT_Z_DEG = 30

/** 可选配置，用于自定义字幕条参数（不传则使用默认值，行为与原版完全一致） */
export interface SubtitleScreenConfig {
  radius?: number        // 默认 20
  screenHeight?: number  // 默认 0.08
  tiltZDeg?: number      // 默认 30
  yOffset?: number       // 默认 0
  enableBloom?: boolean  // 默认 false
  fontSize?: number      // 默认 17
  rotationY?: number     // 初始 Y 轴旋转弧度，用于对准摄像头方向（默认 0）
  contentFn?: (userName: string, blessing: string) => string  // 自定义内容生成函数
  initialVisible?: boolean  // 默认 true
}

export class SubtitleScreen {
  private group: Group
  private textCanvas: HTMLCanvasElement
  private textCtx: CanvasRenderingContext2D
  private textTexture: CanvasTexture
  private screenMesh: Mesh
  private bottomRail: Mesh
  private userName: string
  private blessing: string
  private lastDrawnSecond = -1  // 降频：仅秒数变化时重绘Canvas
  private contentFn?: (userName: string, blessing: string) => string
  private fontSize: number

  constructor(scene: Scene, renderer: WebGLRenderer, userName?: string, blessing?: string, config?: SubtitleScreenConfig) {
    this.userName = userName || ''
    this.blessing = blessing || '愿每一秒的流转，都闪烁星辰之光。'
    this.contentFn = config?.contentFn
    this.fontSize = config?.fontSize ?? FONT_SIZE
    this.group = new Group()

    const radius = config?.radius ?? SCREEN_RADIUS
    const screenHeight = config?.screenHeight ?? SCREEN_HEIGHT
    const tiltZDeg = config?.tiltZDeg ?? TILT_Z_DEG

    // --- Canvas 纹理（低端设备使用较小尺寸）---
    this.textCanvas = document.createElement('canvas')
    this.textCanvas.width = 1024   // 从 2048 降到 1024，进一步减少 50% 纹理内存
    this.textCanvas.height = 48    // 从 64 降到 48
    this.textCtx = this.textCanvas.getContext('2d')!

    this.textTexture = new CanvasTexture(this.textCanvas)
    this.textTexture.wrapS = RepeatWrapping
    this.textTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())  // 限制 anisotropy
    this.textTexture.minFilter = LinearFilter
    this.textTexture.magFilter = LinearFilter

    // --- 球面弧形光幕 ---
    const phiStart = Math.PI / 2 - screenHeight / 2
    const screenGeo = new SphereGeometry(
      radius, 64, 16,  // 从 128,32 降到 64,16，减少 75% 顶点数
      0, Math.PI * 2,
      phiStart, screenHeight
    )

    const screenMat = new MeshBasicMaterial({
      map: this.textTexture,
      transparent: true,
      opacity: 1.0,
      side: DoubleSide,
      blending: NormalBlending,
      depthWrite: false,
    })

    this.screenMesh = new Mesh(screenGeo, screenMat)
    if (config?.enableBloom) {
      this.screenMesh.layers.enable(BLOOM_LAYER)
    }
    this.group.add(this.screenMesh)

    // --- 底部静态轨道线 ---
    const railPhi = phiStart + screenHeight
    const railRadius = radius * Math.sin(railPhi)
    const railY = radius * Math.cos(railPhi)

    const railGeo = new TorusGeometry(railRadius, 0.02, 16, 64)
    const railMat = new MeshBasicMaterial({
      color: PRIMARY_COLOR,
      opacity: 0.7,
      transparent: true,
    })
    this.bottomRail = new Mesh(railGeo, railMat)
    this.bottomRail.rotation.x = Math.PI / 2
    this.bottomRail.position.y = railY
    this.group.add(this.bottomRail)

    // Z轴倾斜 + 可选 Y 偏移
    this.group.rotation.x = 0
    this.group.rotation.y = 0
    this.group.rotation.z = tiltZDeg * (Math.PI / 180)
    this.group.position.y = config?.yOffset ?? 0

    // 初始可见性
    this.group.visible = config?.initialVisible ?? true

    scene.add(this.group)

    // Y 轴旋转（用于对准摄像头方向）
    if (config?.rotationY !== undefined) {
      this.group.rotation.y = config.rotationY
    }

    // 初始绘制
    this.drawText()

    // 初始纹理偏移：让文字起始内容出现在 +Z 方向（摄像头正前方）
    // SphereGeometry 的 u=0.25 对应 +Z 方向，从外部看 u 从左到右递增，
    // 文字自然正向显示，无需翻转 repeat.x。
    // offset.x = -0.25 使 u_sphere=0.25 处采样到 u_texture=0（文字开头）
    this.textTexture.offset.x = -0.25
  }

  get visible(): boolean {
    return this.group.visible
  }

  set visible(v: boolean) {
    this.group.visible = v
  }

  /** 格式化当前日期时间 */
  private formatDateTime(): string {
    const now = new Date()
    const y = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const h = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')
    const s = String(now.getSeconds()).padStart(2, '0')
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const wd = weekDays[now.getDay()]
    return `${y}年${mo}月${d}日 星期${wd} ${h}:${mi}:${s}`
  }

  /** 绘制滚动文字到 Canvas */
  private drawText(): void {
    const ctx = this.textCtx
    const w = this.textCanvas.width
    const h = this.textCanvas.height

    ctx.clearRect(0, 0, w, h)

    // 底部细装饰线
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, h - 4)
    ctx.lineTo(w, h - 4)
    ctx.stroke()

    // 绘制文字
    ctx.fillStyle = '#ffaa00'
    ctx.font = `bold ${this.fontSize}px "Courier New", monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    const content = this.contentFn
      ? this.contentFn(this.userName, this.blessing)
      : `  ${this.formatDateTime()}  |  ${this.userName}  |  ${this.blessing}  |  `
    const textWidth = ctx.measureText(content).width

    // 防御：textWidth 为 0 时（空内容或字体未加载），避免无限循环
    if (textWidth <= 0) return

    let xPos = 0
    while (xPos < w) {
      ctx.fillText(content, xPos, h / 2)
      xPos += textWidth
    }
  }

  update(_time: number, dt: number): void {
    if (!this.group.visible) return

    // 仅当秒数变化时重绘Canvas（从60fps降到1fps的Canvas操作）
    const currentSecond = new Date().getSeconds()
    if (currentSecond !== this.lastDrawnSecond) {
      this.lastDrawnSecond = currentSecond
      this.drawText()
      this.textTexture.needsUpdate = true
    }

    // 文字滚动：增加 offset.x 使文字向左滚动（u 从左到右递增，offset 增加 = 纹理右移 = 文字左移）
    this.textTexture.offset.x += SCROLL_SPEED * dt
  }

  dispose(): void {
    this.screenMesh.geometry.dispose()
    ;(this.screenMesh.material as Material).dispose()
    this.bottomRail.geometry.dispose()
    ;(this.bottomRail.material as Material).dispose()
    this.textTexture.dispose()
    // 释放 Canvas 内存
    this.textCanvas.width = 0
    this.textCanvas.height = 0
    this.group.parent?.remove(this.group)
  }
}
