'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface HiddenButtonProps {
  onActivate: () => void
  particleProximity: number  // 0-1, how close particles are
}

export default function HiddenButton({ onActivate, particleProximity }: HiddenButtonProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [showMessage, setShowMessage] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (!showMessage) {
      setShowMessage(true)
      onActivate()
      // Auto-hide after 3 seconds
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      hideTimerRef.current = setTimeout(() => setShowMessage(false), 3000)
    }
  }, [showMessage, onActivate])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  // Particle proximity affects visibility — raised cap for discoverability
  const opacity = Math.min(0.6, particleProximity * 0.8 + 0.1)

  return (
    <div
      className="absolute z-30 cursor-pointer"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
      onClick={handleClick}
    >
      <div
        className="w-10 h-10 rounded-full backdrop-blur-[10px] border border-white/5 transition-opacity duration-300"
        style={{ opacity }}
      />

      {showMessage && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap
                        bg-[rgba(255,250,245,0.95)] border-2 border-[#b8860b] rounded-lg
                        text-[#800000] text-sm font-bold p-3
                        shadow-[0_8px_30px_rgba(0,0,0,0.6)]
                        animate-float">
          特别鸣谢你制造更欢乐的我！
        </div>
      )}
    </div>
  )
}
