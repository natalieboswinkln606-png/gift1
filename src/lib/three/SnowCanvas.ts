export type DrawingState = 'IDLE' | 'SNOWSTORM' | 'DRAWING' | 'MELTING'

interface Point {
  x: number
  y: number
}

export class SnowCanvas {
  private container: HTMLDivElement
  private wrapper: HTMLDivElement
  private blurLayer: HTMLDivElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  private state: DrawingState = 'IDLE'
  private isDrawing = false
  private lastPoint: Point | null = null
  private drawCallCount = 0
  private erasedArea = 0  // 累计擦除面积（像素²），替代 getImageData 读取
  private idleTimerId: ReturnType<typeof setTimeout> | null = null
  private meltTimerId: ReturnType<typeof setTimeout> | null = null
  private onCompleteCallback: (() => void) | null = null
  private resizeHandler: () => void
  private resizeTimer: ReturnType<typeof setTimeout> | null = null
  private rafIds: number[] = []
  private disposed = false

  brushSize = 20

  constructor(container: HTMLDivElement, blurAmount = 15) {
    this.container = container

    // Wrapper — sits on top of Three.js canvas
    this.wrapper = document.createElement('div')
    Object.assign(this.wrapper.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '30',
      display: 'none',
      pointerEvents: 'auto',
    })

    // Blur layer — acrylic effect showing blurred scene underneath
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

    // Snow canvas — white layer that gets erased
    this.canvas = document.createElement('canvas')
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      cursor: 'crosshair',
      transition: 'opacity 1.5s ease, transform 1.5s ease',
    })

    this.ctx = this.canvas.getContext('2d')!

    this.wrapper.appendChild(this.blurLayer)
    this.wrapper.appendChild(this.canvas)
    this.container.appendChild(this.wrapper)

    this.resizeHandler = () => {
      if (this.resizeTimer) clearTimeout(this.resizeTimer)
      this.resizeTimer = setTimeout(() => {
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight
        // If in drawing state, refill white
        if (this.state === 'DRAWING') {
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
        }
      }, 150)
    }
    window.addEventListener('resize', this.resizeHandler)
  }

  // ---- Public API ----

  getState(): DrawingState {
    return this.state
  }

  setOnComplete(callback: () => void): void {
    this.onCompleteCallback = callback
  }

  setBrushSize(size: number): void {
    this.brushSize = Math.max(10, Math.min(80, size))
  }

  startSnowstorm(): void {
    if (this.state !== 'IDLE') return
    this.state = 'SNOWSTORM'

    // Show wrapper
    this.wrapper.style.display = 'block'
    this.canvas.style.opacity = '0'
    this.canvas.style.transform = 'translateY(0)'
    this.blurLayer.style.opacity = '0'

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Animate snowstorm: fill white with snowflake particles over 800ms
    const startTime = performance.now()
    const duration = 800
    const w = this.canvas.width
    const h = this.canvas.height

    const animateSnow = (now: number) => {
      if (this.state !== 'SNOWSTORM') return

      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Gradually fill with white + random snow dots
      this.ctx.fillStyle = `rgba(255, 255, 255, ${progress * 0.95})`
      this.ctx.fillRect(0, 0, w, h)

      // Draw falling snowflakes
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
        const rafId = requestAnimationFrame(animateSnow)
        this.rafIds.push(rafId)
      } else {
        // Snowstorm complete — fill solid white and enter drawing mode
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
        this.ctx.fillRect(0, 0, w, h)
        this.canvas.style.opacity = '1'
        this.blurLayer.style.opacity = '1'
        this.state = 'DRAWING'
        this.drawCallCount = 0
        this.erasedArea = 0
        this.resetIdleTimer()
      }
    }

    // Fade in canvas
    const rafId1 = requestAnimationFrame(() => {
      this.canvas.style.opacity = '1'
      const rafId2 = requestAnimationFrame(animateSnow)
      this.rafIds.push(rafId2)
    })
    this.rafIds.push(rafId1)
  }

  startDrawing(x: number, y: number): void {
    if (this.state !== 'DRAWING') return
    this.isDrawing = true
    this.lastPoint = { x, y }
    this.resetIdleTimer()
  }

  draw(x: number, y: number): void {
    if (!this.isDrawing || this.state !== 'DRAWING') return

    const currentPoint = { x, y }

    if (this.lastPoint) {
      // 累计擦除面积：笔触长度 × 笔刷直径（近似矩形覆盖）
      const dx = currentPoint.x - this.lastPoint.x
      const dy = currentPoint.y - this.lastPoint.y
      const strokeLen = Math.sqrt(dx * dx + dy * dy)
      this.erasedArea += strokeLen * this.brushSize
      this.drawStroke(this.lastPoint, currentPoint)
    }

    this.lastPoint = currentPoint
    this.drawCallCount++
    this.resetIdleTimer()

    // Check erased percentage every 5 draw calls
    if (this.drawCallCount % 5 === 0) {
      this.checkErasedPercentage()
    }
  }

  stopDrawing(): void {
    this.isDrawing = false
    this.lastPoint = null
  }

  getErasedPercentage(): number {
    const totalArea = this.canvas.width * this.canvas.height
    if (totalArea === 0) return 0
    return (this.erasedArea / totalArea) * 100
  }

  triggerMelting(): void {
    if (this.state !== 'DRAWING') return
    this.state = 'MELTING'
    this.isDrawing = false
    this.lastPoint = null
    this.clearIdleTimer()

    // Animate: slide down + fade out
    this.canvas.style.transform = 'translateY(80px)'
    this.canvas.style.opacity = '0'
    this.blurLayer.style.transition = 'opacity 1.5s ease'
    this.blurLayer.style.opacity = '0'

    this.meltTimerId = setTimeout(() => {
      this.meltTimerId = null
      if (this.disposed) return
      this.cleanup()
      this.onCompleteCallback?.()
    }, 1600)
  }

  forceExit(): void {
    this.isDrawing = false
    this.lastPoint = null
    this.clearIdleTimer()
    if (this.meltTimerId !== null) {
      clearTimeout(this.meltTimerId)
      this.meltTimerId = null
    }
    this.rafIds.forEach((id) => cancelAnimationFrame(id))
    this.rafIds = []
    this.state = 'IDLE'
    this.wrapper.style.display = 'none'
    this.canvas.style.opacity = '0'
    this.canvas.style.transform = 'translateY(0)'
    this.blurLayer.style.opacity = '0'
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  dispose(): void {
    this.disposed = true
    this.clearIdleTimer()
    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer)
      this.resizeTimer = null
    }
    if (this.meltTimerId !== null) {
      clearTimeout(this.meltTimerId)
      this.meltTimerId = null
    }
    this.rafIds.forEach((id) => cancelAnimationFrame(id))
    this.rafIds = []
    window.removeEventListener('resize', this.resizeHandler)
    this.isDrawing = false
    this.state = 'IDLE'
    if (this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper)
    }
  }

  // ---- Private methods ----

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

  private checkErasedPercentage(): void {
    const totalArea = this.canvas.width * this.canvas.height
    if (totalArea === 0) return
    const pct = (this.erasedArea / totalArea) * 100
    if (pct >= 50 && this.state === 'DRAWING') {
      this.triggerMelting()
    }
  }

  private cleanup(): void {
    this.state = 'IDLE'
    this.wrapper.style.display = 'none'
    this.canvas.style.opacity = '0'
    this.canvas.style.transform = 'translateY(0)'
    this.blurLayer.style.opacity = '0'
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer()
    this.idleTimerId = setTimeout(() => {
      if (this.state === 'DRAWING') {
        this.forceExit()
        this.onCompleteCallback?.()
      }
    }, 30000) // 30 seconds idle timeout
  }

  private clearIdleTimer(): void {
    if (this.idleTimerId !== null) {
      clearTimeout(this.idleTimerId)
      this.idleTimerId = null
    }
  }
}
