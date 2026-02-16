import * as THREE from 'three'

// 球面弧形光幕 + Canvas滚动文字 + 底部轨道线
// 内容：实时日期时间 + 用户名 + 祝福语

// --- 配置常量 ---
const SCREEN_RADIUS = 20
const SCREEN_HEIGHT = 0.08
const SCROLL_SPEED = 0.03
const PRIMARY_COLOR = 0xffaa00
const FONT_SIZE = 28
const TILT_Z_DEG = 30

export class SubtitleScreen {
  private group: THREE.Group
  private textCanvas: HTMLCanvasElement
  private textCtx: CanvasRenderingContext2D
  private textTexture: THREE.CanvasTexture
  private screenMesh: THREE.Mesh
  private bottomRail: THREE.Mesh
  private userName: string
  private blessing: string
  private lastDrawnSecond = -1  // 降频：仅秒数变化时重绘Canvas

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, userName?: string, blessing?: string) {
    this.userName = userName || ''
    this.blessing = blessing || '愿每一秒的流转，都闪烁星辰之光。'
    this.group = new THREE.Group()

    // --- Canvas 纹理 ---
    this.textCanvas = document.createElement('canvas')
    this.textCanvas.width = 4096
    this.textCanvas.height = 128
    this.textCtx = this.textCanvas.getContext('2d')!

    this.textTexture = new THREE.CanvasTexture(this.textCanvas)
    this.textTexture.wrapS = THREE.RepeatWrapping
    this.textTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()
    this.textTexture.minFilter = THREE.LinearFilter
    this.textTexture.magFilter = THREE.LinearFilter

    // --- 球面弧形光幕 ---
    const phiStart = Math.PI / 2 - SCREEN_HEIGHT / 2
    const screenGeo = new THREE.SphereGeometry(
      SCREEN_RADIUS, 128, 32,
      0, Math.PI * 2,
      phiStart, SCREEN_HEIGHT
    )

    const screenMat = new THREE.MeshBasicMaterial({
      map: this.textTexture,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      depthWrite: false,
    })

    this.screenMesh = new THREE.Mesh(screenGeo, screenMat)
    this.group.add(this.screenMesh)

    // --- 底部静态轨道线 ---
    const railPhi = phiStart + SCREEN_HEIGHT
    const railRadius = SCREEN_RADIUS * Math.sin(railPhi)
    const railY = SCREEN_RADIUS * Math.cos(railPhi)

    const railGeo = new THREE.TorusGeometry(railRadius, 0.02, 16, 128)
    const railMat = new THREE.MeshBasicMaterial({
      color: PRIMARY_COLOR,
      opacity: 0.7,
      transparent: true,
    })
    this.bottomRail = new THREE.Mesh(railGeo, railMat)
    this.bottomRail.rotation.x = Math.PI / 2
    this.bottomRail.position.y = railY
    this.group.add(this.bottomRail)

    // Z轴30度倾斜
    this.group.rotation.x = 0
    this.group.rotation.y = 0
    this.group.rotation.z = TILT_Z_DEG * (Math.PI / 180)

    scene.add(this.group)

    // 初始绘制
    this.drawText()
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
    ctx.moveTo(0, h - 10)
    ctx.lineTo(w, h - 10)
    ctx.stroke()

    // 绘制文字
    ctx.fillStyle = '#ffaa00'
    ctx.font = `bold ${FONT_SIZE}px "Courier New", monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    const dateTime = this.formatDateTime()
    const content = `  ${dateTime}  |  ${this.userName}  |  ${this.blessing}  |  `
    const textWidth = ctx.measureText(content).width

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

    // 文字滚动（每帧更新offset，不涉及Canvas重绘）
    this.textTexture.offset.x += SCROLL_SPEED * dt
  }

  dispose(): void {
    this.screenMesh.geometry.dispose()
    ;(this.screenMesh.material as THREE.Material).dispose()
    this.bottomRail.geometry.dispose()
    ;(this.bottomRail.material as THREE.Material).dispose()
    this.textTexture.dispose()
    this.group.parent?.remove(this.group)
  }
}
