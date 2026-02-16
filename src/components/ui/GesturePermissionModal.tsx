'use client'

import { useState, useEffect, useCallback } from 'react'

interface GesturePermissionModalProps {
  isOpen: boolean
  onGrant: () => void
  onDeny: () => void
}

export default function GesturePermissionModal({
  isOpen,
  onGrant,
  onDeny,
}: GesturePermissionModalProps) {
  const [visible, setVisible] = useState(false)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setVisible(true)
      // Trigger enter animation on next frame
      const raf = requestAnimationFrame(() => {
        setAnimate(true)
      })
      return () => cancelAnimationFrame(raf)
    } else {
      setAnimate(false)
      const timeout = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timeout)
    }
  }, [isOpen])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onDeny()
      }
    },
    [onDeny]
  )

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{
        opacity: animate ? 1 : 0,
        transition: 'opacity 300ms ease',
      }}
      onClick={handleBackdropClick}
    >
      {/* Card */}
      <div
        className="relative bg-[#0a0a1a]/90 border border-white/10 rounded-2xl"
        style={{
          maxWidth: 400,
          width: '90%',
          padding: '2rem',
          transform: animate ? 'scale(1)' : 'scale(0.95)',
          opacity: animate ? 1 : 0,
          transition: 'transform 300ms ease, opacity 300ms ease',
        }}
      >
        {/* Subtle gold glow behind card */}
        <div
          className="absolute -inset-px rounded-2xl pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.06) 0%, transparent 70%)',
          }}
        />

        {/* Hand icon */}
        <div className="flex justify-center mb-4">
          <span
            className="block text-4xl"
            style={{
              filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.3))',
            }}
          >
            ✋
          </span>
        </div>

        {/* Title */}
        <h2
          className="text-center tracking-wider font-semibold mb-3"
          style={{
            color: '#ffd700',
            fontSize: '1.3rem',
          }}
        >
          开启手势控制？
        </h2>

        {/* Description */}
        <p
          className="text-center text-white/60 mb-2"
          style={{ fontSize: '0.85rem', lineHeight: 1.6 }}
        >
          使用摄像头识别手势，解锁更沉浸的交互体验
        </p>

        {/* Subtitle */}
        <p
          className="text-center text-white/30 mb-8"
          style={{ fontSize: '0.75rem' }}
        >
          需要摄像头权限 · 仅在本地处理
        </p>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-3">
          {/* Primary — Grant */}
          <button
            type="button"
            onClick={onGrant}
            className="rounded-full px-6 py-2.5 font-medium text-black"
            style={{
              background: 'linear-gradient(135deg, #ffd700, #f59e0b)',
              fontSize: '0.85rem',
              transition: 'transform 150ms ease, filter 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.filter = 'brightness(1.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.filter = 'brightness(1)'
            }}
          >
            开启手势
          </button>

          {/* Secondary — Deny */}
          <button
            type="button"
            onClick={onDeny}
            className="rounded-full px-6 py-2.5 border border-white/20 text-white/50"
            style={{
              fontSize: '0.85rem',
              transition: 'transform 150ms ease, filter 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.filter = 'brightness(1.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.filter = 'brightness(1)'
            }}
          >
            仅鼠标
          </button>
        </div>
      </div>
    </div>
  )
}
