'use client'

import { useState, useEffect } from 'react'

interface LoadingScreenProps {
  visible: boolean
}

export default function LoadingScreen({ visible }: LoadingScreenProps) {
  const [show, setShow] = useState(true)

  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => setShow(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [visible])

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-1000"
      style={{
        background: 'radial-gradient(ellipse at center, #0a0a2e 0%, #000 100%)',
        opacity: visible ? 1 : 0,
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
