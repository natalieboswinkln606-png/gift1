class FWParticle {
  x: number
  y: number
  color: string
  vx: number
  vy: number
  alpha: number
  decay: number
  gravity: number

  constructor(x: number, y: number, color: string) {
    this.x = x
    this.y = y
    this.color = color
    const a = Math.random() * Math.PI * 2
    const s = Math.random() * 4 + 1
    this.vx = Math.cos(a) * s
    this.vy = Math.sin(a) * s
    this.alpha = 1
    this.decay = Math.random() * 0.015 + 0.01
    this.gravity = 0.05
  }

  update(): void {
    this.vx *= 0.95
    this.vy *= 0.95
    this.vy += this.gravity
    this.x += this.vx
    this.y += this.vy
    this.alpha -= this.decay
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = this.alpha
    ctx.fillStyle = this.color
    ctx.fillRect(this.x, this.y, 2, 2)
  }
}

class Rocket {
  x: number
  y: number
  targetY: number
  speed: number
  color: string
  exploded: boolean
  dead: boolean
  particles: FWParticle[]

  constructor(w: number, h: number) {
    this.x = Math.random() * w
    this.y = h
    this.targetY = h * 0.2 + Math.random() * h * 0.3
    this.speed = 8 + Math.random() * 4
    this.color = `hsla(${Math.random() * 360}, 100%, 70%, 0.8)`
    this.exploded = false
    this.dead = false
    this.particles = []
  }

  update(): void {
    if (!this.exploded) {
      this.y -= this.speed
      if (this.y <= this.targetY) this.explode()
    } else {
      for (const p of this.particles) p.update()
      this.particles = this.particles.filter((p) => p.alpha > 0)
      if (this.particles.length === 0) this.dead = true
    }
  }

  explode(): void {
    this.exploded = true
    for (let i = 0; i < 60; i++) {
      this.particles.push(new FWParticle(this.x, this.y, this.color))
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.exploded) {
      ctx.globalAlpha = 0.5
      ctx.fillStyle = this.color
      ctx.fillRect(this.x, this.y, 2, 8)
    } else {
      for (const p of this.particles) p.draw(ctx)
    }
  }
}

export class FireworkSystem {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private rockets: Rocket[] = []
  private running = false
  private resizeHandler: (() => void) | null = null
  private stopTimeoutId: ReturnType<typeof setTimeout> | null = null
  private fadeInRafId: number | null = null

  start(container: HTMLElement): void {
    this.canvas = document.createElement('canvas')
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    this.canvas.style.position = 'absolute'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.zIndex = '2'
    this.canvas.style.pointerEvents = 'none'
    this.canvas.style.opacity = '0'
    this.canvas.style.transition = 'opacity 1.5s ease'
    this.canvas.style.mixBlendMode = 'screen'
    this.canvas.style.filter = 'blur(2px)'

    container.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')
    this.running = true

    // Fade in
    this.fadeInRafId = requestAnimationFrame(() => {
      if (this.canvas) this.canvas.style.opacity = '1'
    })

    // Resize handler
    this.resizeHandler = () => {
      if (this.canvas) {
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight
      }
    }
    window.addEventListener('resize', this.resizeHandler)
  }

  update(): void {
    if (!this.running || !this.ctx || !this.canvas) return

    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    // Trail effect
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'

    // Spawn rockets
    if (Math.random() < 0.04) {
      this.rockets.push(new Rocket(w, h))
    }

    // Update and draw
    for (const rocket of this.rockets) {
      rocket.update()
      rocket.draw(ctx)
    }
    this.rockets = this.rockets.filter(r => !r.dead)
  }

  stop(): void {
    if (this.canvas) {
      this.canvas.style.opacity = '0'
    }
    this.stopTimeoutId = setTimeout(() => {
      this.rockets.length = 0
      this.running = false
      this.stopTimeoutId = null
    }, 1000)
  }

  getParticlePositions(): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = []
    for (const rocket of this.rockets) {
      if (rocket.exploded) {
        for (const p of rocket.particles) {
          if (p.alpha > 0.3) {
            positions.push({ x: p.x, y: p.y })
          }
        }
      }
    }
    return positions
  }

  dispose(): void {
    this.running = false
    if (this.fadeInRafId !== null) {
      cancelAnimationFrame(this.fadeInRafId)
      this.fadeInRafId = null
    }
    if (this.stopTimeoutId !== null) {
      clearTimeout(this.stopTimeoutId)
      this.stopTimeoutId = null
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler)
      this.resizeHandler = null
    }
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas)
    }
    this.canvas = null
    this.ctx = null
    this.rockets.length = 0
  }
}
