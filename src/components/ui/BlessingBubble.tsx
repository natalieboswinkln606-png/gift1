'use client'

import { useState, useEffect, useRef } from 'react'

interface BlessingBubbleProps {
  text: string
  x: number
  y: number
  visible: boolean
}

export default function BlessingBubble({ text, x, y, visible }: BlessingBubbleProps) {
  const [displayText, setDisplayText] = useState('')
  const [isAnimating, setIsAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!visible) {
      setDisplayText('')
      setIsAnimating(false)
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    setIsAnimating(true)
    setDisplayText('')

    let index = 0

    function typeChar() {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1))
        index++
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(typeChar, 80)
      }
    }

    typeChar()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [text, visible])

  if (!visible) return null

  return (
    <div
      className="absolute z-[100] pointer-events-none"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className={`
        bg-gradient-to-br from-[rgba(255,250,245,0.98)] to-[rgba(255,240,230,0.95)]
        border-2 border-[#ffd700] rounded-xl
        text-[#800000] text-sm font-bold leading-relaxed
        shadow-[0_8px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,215,0,0.3)]
        flex items-center justify-center text-center
        transition-all duration-200
        backdrop-blur-sm
        ${isAnimating ? 'w-[220px] min-h-[80px] p-5 opacity-100' : 'w-0 h-0 p-0 opacity-0'}
      `}>
        <div className="relative">
          {displayText}
          <div className="absolute -inset-2 bg-gradient-to-r from-[#ffd700]/20 to-[#ffaa00]/10 blur-xl -z-10 animate-pulse rounded-xl" />
        </div>
      </div>
    </div>
  )
}
