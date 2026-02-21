'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTypewriter } from '@/hooks/useTypewriter'
import { useAppStore } from '@/stores/useAppStore'

interface HiddenButtonProps {
  /** 点击后显示的祝福语 */
  message?: string
  /** 点击回调 */
  onActivate: () => void
  /** 由父组件传入的固定位置（避免多个按钮重叠） */
  fixedPosition?: { x: number; y: number }
}

const DEFAULT_MESSAGE = '特别鸣谢你制造更欢乐的我！'

export default function HiddenButton({ message = DEFAULT_MESSAGE, onActivate, fixedPosition }: HiddenButtonProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [showBubble, setShowBubble] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activatedRef = useRef(false)
  const quality = useAppStore((s) => s.quality)

  const displayText = useTypewriter(message, showBubble)

  // 使用父组件传入的固定位置
  useEffect(() => {
    if (fixedPosition) {
      setPosition(fixedPosition)
    }
  }, [fixedPosition])

  const handleClick = useCallback(() => {
    if (activatedRef.current) return
    activatedRef.current = true
    setShowBubble(true)
    onActivate()

    // 5秒后收回（留足阅读时间）
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setShowBubble(false)
      activatedRef.current = false
    }, 5000)
  }, [onActivate])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  // 亚克力材质隐藏按钮：极低可见度（比绘画场景更隐蔽）
  const blurClass = quality === 'LOW' || quality === 'ULTRA_LOW' ? 'backdrop-blur-[11px]' : 'backdrop-blur-[16.5px]'

  return (
    <div
      className="absolute z-30"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* 未激活：亚克力材质圆形隐藏按钮 */}
      {!showBubble && (
        <div
          className={`w-12 h-12 rounded-full ${blurClass} border border-white/[0.055] transition-all duration-500 cursor-pointer hover:opacity-[0.242] hover:scale-110`}
          style={{
            opacity: 0.2145,
            background: 'rgba(255,255,255,0.132)',
          }}
          onClick={handleClick}
        />
      )}

      {/* 激活后：气泡在按钮原位显示 */}
      {showBubble && (
        <div
          className={`
            bg-gradient-to-br from-[rgba(255,250,245,0.98)] to-[rgba(255,240,230,0.95)]
            border-2 border-[#ffd700] rounded-xl
            text-[#800000] text-sm font-bold leading-relaxed
            shadow-[0_8px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(255,215,0,0.3)]
            flex items-center justify-center text-center
            backdrop-blur-sm
            w-[240px] min-h-[80px] p-5
            animate-float
          `}
        >
          <div className="relative">
            {displayText}
            <div className="absolute -inset-2 bg-gradient-to-r from-[#ffd700]/20 to-[#ffaa00]/10 blur-xl -z-10 animate-pulse rounded-xl" />
          </div>
        </div>
      )}
    </div>
  )
}
