'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTypewriter } from '@/hooks/useTypewriter'
import { useAppStore } from '@/stores/useAppStore'

interface HiddenButtonProps {
  onActivate: () => void
  particleProximity: number  // 0-1, how close particles are
}

export default function HiddenButton({ onActivate, particleProximity }: HiddenButtonProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [showBubble, setShowBubble] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activatedRef = useRef(false)
  const quality = useAppStore((s) => s.quality)

  const message = '特别鸣谢你制造更欢乐的我！'
  const displayText = useTypewriter(message, showBubble)

  // Random position on mount, excluding center area
  useEffect(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    const margin = 100
    const centerExclusion = { x: w * 0.3, y: h * 0.3, w: w * 0.4, h: h * 0.4 }

    let x: number, y: number
    do {
      x = margin + Math.random() * (w - margin * 2)
      y = margin + Math.random() * (h - margin * 2)
    } while (
      x > centerExclusion.x &&
      x < centerExclusion.x + centerExclusion.w &&
      y > centerExclusion.y &&
      y < centerExclusion.y + centerExclusion.h
    )

    setPosition({ x, y })
  }, [])

  const handleClick = useCallback(() => {
    if (activatedRef.current) return
    activatedRef.current = true
    setShowBubble(true)
    onActivate()

    // 3秒后收回
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setShowBubble(false)
      activatedRef.current = false
    }, 3000)
  }, [onActivate])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  // Particle proximity affects visibility — subtle presence
  const opacity = Math.min(0.2, particleProximity * 0.27 + 0.033)

  return (
    <div
      className="absolute z-30"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* 未激活：圆形隐藏按钮 */}
      {!showBubble && (
        <div
          className={`w-10 h-10 rounded-full ${quality === 'LOW' || quality === 'ULTRA_LOW' ? 'backdrop-blur-sm' : 'backdrop-blur-[15px]'} bg-white/5 border border-white/5 transition-opacity duration-300 cursor-pointer`}
          style={{ opacity }}
          onClick={handleClick}
        />
      )}

      {/* 激活后：气泡在按钮原位显示（按钮化身为气泡） */}
      {showBubble && (
        <div>
          <div
            className={`
              bg-gradient-to-br from-[rgba(255,250,245,0.98)] to-[rgba(255,240,230,0.95)]
              border-2 border-[#ffd700] rounded-xl
              text-[#800000] text-sm font-bold leading-relaxed
              shadow-[0_8px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,215,0,0.3)]
              flex items-center justify-center text-center
              backdrop-blur-sm
              w-[220px] min-h-[80px] p-5
              animate-float
            `}
          >
            <div className="relative">
              {displayText}
              <div className="absolute -inset-2 bg-gradient-to-r from-[#ffd700]/20 to-[#ffaa00]/10 blur-xl -z-10 animate-pulse rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
