'use client'

import { useRef, useEffect } from 'react'

function StarBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.5,
      alpha: Math.random(),
      speed: (Math.random() - 0.5) * 0.01,
    }))

    let animId: number

    function animate() {
      if (!ctx || !canvas) return
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      stars.forEach(star => {
        star.alpha += star.speed
        if (star.alpha > 1 || star.alpha < 0) star.speed *= -1
        star.alpha = Math.max(0, Math.min(1, star.alpha))

        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        ctx.fill()
      })

      animId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      // 重新随机化星星位置，防止飞出画布
      stars.forEach(star => {
        star.x = Math.random() * canvas.width
        star.y = Math.random() * canvas.height
      })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0" />
}

export default function HomePage() {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <StarBackground />

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center"
           style={{ fontFamily: 'var(--font-noto-serif)' }}>
        <p className="text-[rgba(255,215,0,0.9)] text-lg tracking-[8px] mb-4">
          ✦
        </p>
        <h1 className="text-white text-3xl md:text-4xl font-light tracking-[8px] mb-6"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}>
          专属礼物
        </h1>
        <p className="text-white/40 text-sm tracking-[4px]">
          请通过你的专属链接访问
        </p>
      </div>
    </div>
  )
}
