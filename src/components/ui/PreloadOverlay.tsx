'use client'

import { useEffect, useRef } from 'react'

interface PreloadOverlayProps {
  progress: number
}

export default function PreloadOverlay({ progress }: PreloadOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stoppedRef = useRef(false)

  // progress >= 100 时停止 canvas 动画
  useEffect(() => {
    if (progress >= 100) {
      stoppedRef.current = true
    }
  }, [progress])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // 80 white flickering particles
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      alpha: Math.random(),
      speed: (Math.random() - 0.5) * 0.02,
    }))

    let animId: number

    // 响应窗口 resize
    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      // 重新随机化粒子位置，防止飞出画布
      particles.forEach(p => {
        p.x = Math.random() * canvas.width
        p.y = Math.random() * canvas.height
      })
    }
    window.addEventListener('resize', handleResize)

    function animate() {
      if (!ctx || !canvas || stoppedRef.current) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach(p => {
        p.alpha += p.speed
        if (p.alpha > 1 || p.alpha < 0.1) p.speed *= -1
        p.alpha = Math.max(0.1, Math.min(1, p.alpha))

        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      })

      animId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      stoppedRef.current = true
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-1000 ${progress >= 100 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <canvas ref={canvasRef} className="absolute inset-0" />

      <div className="relative z-10 flex flex-col items-center">
        <p className="text-white/80 text-lg tracking-[0.3em] animate-breathe mb-8">
          正在准备...
        </p>

        {/* Progress bar */}
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold/50 to-gold rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-white/40 text-xs mt-2">{Math.round(progress)}%</p>
      </div>
    </div>
  )
}
