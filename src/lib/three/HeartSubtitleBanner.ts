import * as THREE from 'three'
import { getLunarDateString } from '@/lib/lunarCalendar'

/**
 * 爱心场景字幕条系统
 * 参考 新建文本文档 - 副本 (2).html 的球面弧形滚动光幕样式
 * 两条字幕条分别绕 z 轴 ±30°，Canvas 4096x128 纹理 + RepeatWrapping 滚动
 * 字幕条一：公历实时日期时间 + 用户名 + 固定祝福语
 * 字幕条二：农历实时日期时间 + 用户名 + config 祝福语
 * 两条字幕均下移 5 单位
 */

const BLOOM_LAYER = 1
const SCREEN_RADIUS = 25
const SCREEN_HEIGHT = 0.13
const SCROLL_SPEED = 0.03
const PRIMARY_COLOR = 0xffaa00
const FONT_SIZE = 28
const Z_ROTATION_DEG = 30
const Y_OFFSET = -10 // 下移10单位

export class HeartSubtitleBanner {
  private group1: THREE.Group
  private group2: THREE.Group

  // 字幕条一：公历
  private canvas1: HTMLCanvasElement
  private ctx1: CanvasRenderingContext2D
  private texture1: THREE.CanvasTexture
  private screenMesh1: THREE.Mesh
  private bottomRail1: THREE.Mesh

  // 字幕条二：农历
  private canvas2: HTMLCanvasElement
  private ctx2: CanvasRenderingContext2D
  private texture2: THREE.CanvasTexture
  private screenMesh2: THREE.Mesh
  private bottomRail2: THREE.Mesh

  private userName: string
  private blessing: string
  private lastDrawnSecond = -1

  constructor(scene: THREE.Scene, userName: string, blessing: string) {
    this.userName = userName
    this.blessing = blessing

    // --- 字幕条一（公历，z 轴 +30°）---
    const r1 = this.createArcBanner(scene, Z_ROTATION_DEG)
    this.group1 = r1.group
    this.canvas1 = r1.canvas
    this.ctx1 = r1.ctx
    this.texture1 = r1.texture
    this.screenMesh1 = r1.screenMesh
    this.bottomRail1 = r1.bottomRail

    // --- 字幕条二（农历，z 轴 -30°）---
    const r2 = this.createArcBanner(scene, -Z_ROTATION_DEG)
    this.group2 = r2.group
    this.canvas2 = r2.canvas
    this.ctx2 = r2.ctx
    this.texture2 = r2.texture
    this.screenMesh2 = r2.screenMesh
    this.bottomRail2 = r2.bottomRail

    // 初始绘制
    this.drawBannerTextures()
  }

  /**
   * 创建单条球面弧形光幕（1:1 参考 新建文本文档 - 副本 (2).html）
   */
  private createArcBanner(scene: THREE.Scene, zRotDeg: number) {
    const group = new THREE.Group()
    group.visible = false

    // Canvas 纹理（4096x128，极高宽度确保文字不拉伸）
    const canvas = document.createElement('canvas')
    canvas.width = 4096
    canvas.height = 128
    const ctx = canvas.getContext('2d')!

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    // 球面弧形光幕
    const phiStart = Math.PI / 2 - SCREEN_HEIGHT / 2
    const screenGeo = new THREE.SphereGeometry(
      SCREEN_RADIUS, 128, 32,
      0, Math.PI * 2,
      phiStart, SCREEN_HEIGHT
    )

    const screenMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      depthWrite: false,
    })

    const screenMesh = new THREE.Mesh(screenGeo, screenMat)
    screenMesh.layers.enable(BLOOM_LAYER)
    group.add(screenMesh)

    // 底部静态轨道线
    const railPhi = phiStart + SCREEN_HEIGHT
    const railRadius = SCREEN_RADIUS * Math.sin(railPhi)
    const railY = SCREEN_RADIUS * Math.cos(railPhi)

    const railGeo = new THREE.TorusGeometry(railRadius, 0.02, 16, 128)
    const railMat = new THREE.MeshBasicMaterial({
      color: PRIMARY_COLOR,
      opacity: 0.7,
      transparent: true,
    })
    const bottomRail = new THREE.Mesh(railGeo, railMat)
    bottomRail.rotation.x = Math.PI / 2
    bottomRail.position.y = railY
    group.add(bottomRail)

    // Z轴倾斜 + 下移5单位
    group.rotation.z = (zRotDeg * Math.PI) / 180
    group.position.y = Y_OFFSET

    scene.add(group)

    return { group, canvas, ctx, texture, screenMesh, bottomRail }
  }

  /**
   * 绘制滚动文字到 Canvas（参考 新建文本文档 - 副本 (2).html 的 drawClearText）
   */
  private drawTextOnCanvas(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    content: string
  ): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 底部细装饰线（实线，保持清晰）
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, canvas.height - 10)
    ctx.lineTo(canvas.width, canvas.height - 10)
    ctx.stroke()

    // 绘制文字（不使用 shadow 或 blur，保持清晰）
    ctx.fillStyle = '#ffaa00'
    ctx.font = `bold ${FONT_SIZE}px "Courier New", monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    const textWidth = ctx.measureText(content).width
    let xPos = 0
    while (xPos < canvas.width) {
      ctx.fillText(content, xPos, canvas.height / 2)
      xPos += textWidth
    }
  }

  private formatGregorianDateTime(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const weekDay = weekDays[now.getDay()]
    return `${year}年${month}月${day}日 星期${weekDay} ${hours}:${minutes}:${seconds}`
  }

  private formatLunarDateTime(): string {
    const now = new Date()
    const lunarDate = getLunarDateString(now)
    const hour = now.getHours()
    const zhiNames = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    const zhiIndex = Math.floor(((hour + 1) % 24) / 2)
    const shichen = zhiNames[zhiIndex] + '时'
    return `${lunarDate} ${shichen}`
  }

  private drawBannerTextures(): void {
    // 字幕条一：公历 + 用户名 + 固定祝福语
    const gregorian = this.formatGregorianDateTime()
    const content1 = `  ${gregorian}  |  ${this.userName}  |  愿每一秒的流转，都闪烁星辰之光。  |  `
    this.drawTextOnCanvas(this.ctx1, this.canvas1, content1)
    this.texture1.needsUpdate = true

    // 字幕条二：农历 + 用户名 + 祝福语
    const lunar = this.formatLunarDateTime()
    const content2 = `  ${lunar}  |  ${this.userName}  |  ${this.blessing}  |  `
    this.drawTextOnCanvas(this.ctx2, this.canvas2, content2)
    this.texture2.needsUpdate = true
  }

  get visible(): boolean {
    return this.group1.visible
  }

  set visible(v: boolean) {
    this.group1.visible = v
    this.group2.visible = v
  }

  update(_time: number, dt: number): void {
    if (!this.group1.visible) return

    // 仅当秒数变化时重绘文字（从 60fps 降到 1fps）
    const sec = new Date().getSeconds()
    if (sec !== this.lastDrawnSecond) {
      this.lastDrawnSecond = sec
      this.drawBannerTextures()
    }

    // 文字滚动（通过 texture.offset.x）
    this.texture1.offset.x += SCROLL_SPEED * dt
    this.texture2.offset.x += SCROLL_SPEED * dt
  }

  dispose(): void {
    this.texture1.dispose()
    this.texture2.dispose()
    this.screenMesh1.geometry.dispose()
    ;(this.screenMesh1.material as THREE.Material).dispose()
    this.screenMesh2.geometry.dispose()
    ;(this.screenMesh2.material as THREE.Material).dispose()
    this.bottomRail1.geometry.dispose()
    ;(this.bottomRail1.material as THREE.Material).dispose()
    this.bottomRail2.geometry.dispose()
    ;(this.bottomRail2.material as THREE.Material).dispose()
    this.group1.parent?.remove(this.group1)
    this.group2.parent?.remove(this.group2)
  }
}
