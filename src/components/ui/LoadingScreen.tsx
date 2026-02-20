'use client'

import { useState, useEffect } from 'react'

interface LoadingScreenProps {
  visible: boolean
}

export default function LoadingScreen({ visible }: LoadingScreenProps) {
  const [show, setShow] = useState(true)
  const [mounted, setMounted] = useState(false)

  // 挂载后触发淡入过渡（利用已有的 transition-opacity）
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!visible) {
      // visible 变为 false 后，等待淡出动画完成再隐藏 DOM
      const timer = setTimeout(() => setShow(false), 1000)
      return () => clearTimeout(timer)
    } else {
      // visible 重新变为 true 时，重置 show 状态使组件重新显示
      setShow(true)
    }
  }, [visible])

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-1000"
      style={{
        background: 'radial-gradient(ellipse at center, #0a0a2e 0%, #000 100%)',
        opacity: visible && mounted ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="text-[1rem] tracking-[6px] animate-pulse"
        style={{ color: 'rgba(170,221,255,0.8)' }}
      >
        星河正在苏醒...
      </div>
    </div>
  )
}
