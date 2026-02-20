/**
 * SnowCanvas — 雪上绘画系统（完全重写 v2）
 *
 * 架构要点：
 * - 所有 pointer 事件自包含在 canvas 元素上，不依赖外部传坐标
 * - 使用 Pointer Events API 统一鼠标和触摸
 * - setPointerCapture 确保拖出边界不断线
 * - position: absolute 挂到传入的 container，避免 fixed 降级问题
 * - touch-action: none + passive: false + preventDefault 三层防触摸滚动
 * - destination-out 合成模式擦除雪层，露出下方 Three.js 场景
 */

export type SnowCanvasState = 'IDLE' | 'SNOWING' | 'DRAWING' | 'MELTING'

interface Point {
  x: number
  y: number
}

export class SnowCanvas {
  // DOM 元素
  private container: HTMLElement
  private wrapper: HTMLDivElement
  private blurLayer: HTMLDivElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  // 状态
  private state: SnowCanvasState = 'IDLE'
  private disposed = false

  // 绘画状态
  private isDrawing = false
  private lastPoint: Point | null = null
  private erasedArea = 0
  private drawCount = 0

  // 定时器 / 动画
  private idleTimerId: ReturnType<typeof setTimeout> | null = null
  private meltTimerId: ReturnType<typeof setTimeout> | null = null
  private snowAnimId: number | null = null
  private resizeTimer: ReturnType<typeof setTimeout> | null = null

  // 回调
  private onCompleteCallback: (() => void) | null = null

  // 公开属性
  brushSize = 20

  // 绑定的事件处理器（用于 removeEventListener）
  private boundPointerDown: (e: PointerEvent) => void
  private boundPointerMove: (e: PointerEvent) => void
  private boundPointerUp: (e: PointerEvent) => void
  private boundResize: () => void

  constructor(container: HTMLElement, blurAmount = 15) {
    this.container = container

    // ---- 创建 DOM 结构 ----

    // wrapper: absolute 定位，覆盖整个 container
    this.wrapper = document.createElement('div')
    Object.assign(this.wrapper.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '60',
      display: 'none',
      pointerEvents: 'none',
    })

    // 模糊层：亚克力效果
    this.blurLayer = document.createElement('div')
    Object.assign(this.blurLayer.style, {
      position: 'absolute',
      inset: '0',
      backdropFilter: blurAmount > 0 ? `blur(${blurAmount}px)` : 'none',
      WebkitBackdropFilter: blurAmount > 0 ? `blur(${blurAmount}px)` : 'none',
      background: 'rgba(255,255,255,0.05)',
      opacity: '0',
      transition: 'opacity 0.5s ease',
    })

    // 绘画画布
    this.canvas = document.createElement('canvas')
    Object.assign(this.canvas.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      touchAction: 'none',
      userSelect: 'none',
      cursor: 'crosshair',
      transition: 'opacity 1.5s ease, transform 1.5s ease',
    })

    // canvas 尺寸匹配容器（像素缓冲区 + CSS 显示尺寸同步）
    this.syncCanvasSize()

    this.ctx = this.canvas.getContext('2d')!

    // 组装 DOM — 挂到 container 内部（不是 document.body）
    this.wrapper.appendChild(this.blurLayer)
    this.wrapper.appendChild(this.canvas)
    container.appendChild(this.wrapper)

    // ---- 绑定 Pointer Events（自包含，不依赖外部） ----

    this.boundPointerDown = this.handlePointerDown.bind(this)
    this.boundPointerMove = this.handlePointerMove.bind(this)
    this.boundPointerUp = this.handlePointerUp.bind(this)
    this.boundResize = this.handleResize.bind(this)

    this.canvas.addEventListener('pointerdown', this.boundPointerDown, { passive: false })
    this.canvas.addEventListener('pointermove', this.boundPointerMove, { passive: false })
    this.canvas.addEventListener('pointerup', this.boundPointerUp, { passive: false })
    this.canvas.addEventListener('pointercancel', this.boundPointerUp, { passive: false })
    window.addEventListener('resize', this.boundResize)
  }

  // ==== 公开 API ====

  getState(): SnowCanvasState {
    return this.state
  }

  setOnComplete(callback: () => void): void {
    this.onCompleteCallback = callback
  }

  setBrushSize(size: number): void {
    this.brushSize = Math.max(10, Math.min(80, size))
  }

  /**
   * 进入绘画模式：播放雪花填充动画，完成后自动进入 DRAWING 状态
   */
  enter(): void {
    if (this.state !== 'IDLE' || this.disposed) return
    this.state = 'SNOWING'

    // 显示 wrapper，启用事件拦截（覆盖 Three.js canvas，自然屏蔽 OrbitControls）
    this.wrapper.style.display = 'block'
    this.wrapper.style.pointerEvents = 'auto'

    // 重置 canvas 样式
    this.canvas.style.transition = 'none'
    this.canvas.style.opacity = '1'
    this.canvas.style.transform = 'translateY(0)'
    this.blurLayer.style.opacity = '0'

    // 同步 canvas 尺寸
    this.syncCanvasSize()

    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // 雪花填充动画（800ms）
    const startTime = performance.now()
    const duration = 800
    const w = this.canvas.width
    const h = this.canvas.height

    const animate = (now: number) => {
      if (this.state !== 'SNOWING' || this.disposed) return

      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)

      // 渐进填充白色
      this.ctx.fillStyle = `rgba(255, 255, 255, ${progress * 0.95})`
      this.ctx.fillRect(0, 0, w, h)

      // 雪花粒子
      const flakeCount = Math.floor(progress * 200)
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      for (let i = 0; i < flakeCount; i++) {
        const fx = Math.random() * w
        const fy = Math.random() * h * progress
        const size = 1 + Math.random() * 3
        this.ctx.beginPath()
        this.ctx.arc(fx, fy, size, 0, Math.PI * 2)
        this.ctx.fill()
      }

      if (progress < 1) {
        this.snowAnimId = requestAnimationFrame(animate)
      } else {
        this.snowAnimId = null
        // 填充完成 → 进入 DRAWING
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
        this.ctx.fillRect(0, 0, w, h)
        this.blurLayer.style.opacity = '1'
        this.canvas.style.transition = 'opacity 1.5s ease, transform 1.5s ease'
        this.state = 'DRAWING'
        this.drawCount = 0
        this.erasedArea = 0
        this.resetIdleTimer()
      }
    }

    this.snowAnimId = requestAnimationFrame(animate)
  }

  /**
   * 强制退出绘画模式，立即恢复到 IDLE
   */
  exit(): void {
    if (this.state === 'IDLE') return

    this.cancelAnimations()
    this.clearTimers()
    this.isDrawing = false
    this.lastPoint = null
    this.state = 'IDLE'

    // 隐藏 DOM，禁用事件拦截
    this.wrapper.style.display = 'none'
    this.wrapper.style.pointerEvents = 'none'
    this.canvas.style.opacity = '0'
    this.canvas.style.transform = 'translateY(0)'
    this.blurLayer.style.opacity = '0'
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  dispose(): void {
    this.disposed = true
    this.exit()

    // 移除事件
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown)
    this.canvas.removeEventListener('pointermove', this.boundPointerMove)
    this.canvas.removeEventListener('pointerup', this.boundPointerUp)
    this.canvas.removeEventListener('pointercancel', this.boundPointerUp)
    window.removeEventListener('resize', this.boundResize)

    // 移除 DOM
    if (this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper)
    }
  }

  // ==== Pointer 事件处理（自包含在 canvas 上） ====

  private handlePointerDown(e: PointerEvent): void {
    if (this.disposed) return
    if (this.state !== 'DRAWING' && this.state !== 'SNOWING') return
    if (e.button !== 0 && e.pointerType === 'mouse') return

    e.preventDefault()
    // 捕获 pointer，拖出 canvas 边界也不断线
    this.canvas.setPointerCapture(e.pointerId)

    if (this.state === 'DRAWING') {
      this.isDrawing = true
      this.lastPoint = this.getPoint(e)
      this.resetIdleTimer()
    }
    // SNOWING 阶段：按下不做事，等动画完成后 pointermove 自动开始画
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.disposed || this.state !== 'DRAWING') return
    e.preventDefault()

    // 如果 pointerdown 发生在 SNOWING 阶段，现在 state 变成 DRAWING 了，自动开始
    if (!this.isDrawing) {
      this.isDrawing = true
      this.lastPoint = this.getPoint(e)
      return
    }

    const current = this.getPoint(e)

    if (this.lastPoint) {
      // 累计擦除面积：笔触长度 × 笔刷直径
      const dx = current.x - this.lastPoint.x
      const dy = current.y - this.lastPoint.y
      this.erasedArea += Math.sqrt(dx * dx + dy * dy) * this.brushSize
      this.drawStroke(this.lastPoint, current)
    }

    this.lastPoint = current
    this.drawCount++
    this.resetIdleTimer()

    // 每 5 次检查擦除百分比
    if (this.drawCount % 5 === 0) {
      this.checkCompletion()
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (this.disposed) return
    e.preventDefault()

    try {
      this.canvas.releasePointerCapture(e.pointerId)
    } catch {
      // pointerId 可能已经不存在，忽略
    }

    this.isDrawing = false
    this.lastPoint = null
  }

  // ==== 内部方法 ====

  /** 将 pointer 事件的 clientX/Y 转换为 canvas 像素坐标 */
  private getPoint(e: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
    }
  }

  private drawStroke(from: Point, to: Point): void {
    const ctx = this.ctx
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)'
    ctx.lineWidth = this.brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.restore()
  }

  private checkCompletion(): void {
    const totalArea = this.canvas.width * this.canvas.height
    if (totalArea === 0) return
    const pct = (this.erasedArea / totalArea) * 100
    if (pct >= 50 && this.state === 'DRAWING') {
      this.triggerMelting()
    }
  }

  private triggerMelting(): void {
    if (this.state !== 'DRAWING') return
    this.state = 'MELTING'
    this.isDrawing = false
    this.lastPoint = null
    this.clearTimers()

    // 融化动画：下滑 + 淡出
    this.canvas.style.transform = 'translateY(80px)'
    this.canvas.style.opacity = '0'
    this.blurLayer.style.transition = 'opacity 1.5s ease'
    this.blurLayer.style.opacity = '0'

    this.meltTimerId = setTimeout(() => {
      this.meltTimerId = null
      if (this.disposed) return
      this.state = 'IDLE'
      this.wrapper.style.display = 'none'
      this.wrapper.style.pointerEvents = 'none'
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      this.onCompleteCallback?.()
    }, 1600)
  }

  private syncCanvasSize(): void {
    const rect = this.container.getBoundingClientRect()
    // fallback: 如果容器还没有布局，使用 window 尺寸
    const w = Math.round(rect.width) || window.innerWidth
    const h = Math.round(rect.height) || window.innerHeight
    this.canvas.width = w
    this.canvas.height = h
    this.canvas.style.width = w + 'px'
    this.canvas.style.height = h + 'px'
  }

  private handleResize(): void {
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    this.resizeTimer = setTimeout(() => {
      this.resizeTimer = null
      if (this.disposed) return
      this.syncCanvasSize()
      this.erasedArea = 0
      if (this.state === 'DRAWING') {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
      }
    }, 150)
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer()
    this.idleTimerId = setTimeout(() => {
      this.idleTimerId = null
      if (this.disposed) return
      if (this.state === 'DRAWING') {
        this.exit()
        this.onCompleteCallback?.()
      }
    }, 30000)
  }

  private clearIdleTimer(): void {
    if (this.idleTimerId !== null) {
      clearTimeout(this.idleTimerId)
      this.idleTimerId = null
    }
  }

  private clearTimers(): void {
    this.clearIdleTimer()
    if (this.meltTimerId !== null) {
      clearTimeout(this.meltTimerId)
      this.meltTimerId = null
    }
    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer)
      this.resizeTimer = null
    }
  }

  private cancelAnimations(): void {
    if (this.snowAnimId !== null) {
      cancelAnimationFrame(this.snowAnimId)
      this.snowAnimId = null
    }
  }
}
