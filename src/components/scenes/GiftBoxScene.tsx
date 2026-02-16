'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { UserConfig } from '@/types'

interface GiftBoxSceneProps {
  userId: string
  config: UserConfig
}

export default function GiftBoxScene({ userId, config }: GiftBoxSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const managerRef = useRef<import('@/lib/three/GiftBoxSceneManager').GiftBoxSceneManager | null>(null)
  const openedRef = useRef<boolean>(false)
  const hintRef = useRef<HTMLDivElement>(null)
  const setAppState = useAppStore((s) => s.setAppState)

  const triggerOpening = useCallback(() => {
    const mgr = managerRef.current
    if (!mgr || openedRef.current) return
    openedRef.current = true
    // 参考HTML: document.getElementById('interaction-hint').style.display = 'none'
    if (hintRef.current) hintRef.current.style.display = 'none'
    mgr.performOpening(() => {
      setAppState('WELCOME')
    })
  }, [setAppState])

  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false

    import('@/lib/three/GiftBoxSceneManager').then(({ GiftBoxSceneManager }) => {
      if (disposed || !containerRef.current) return
      const mgr = new GiftBoxSceneManager(containerRef.current)
      mgr.init()
      mgr.animate()
      managerRef.current = mgr
    })

    return () => {
      disposed = true
      managerRef.current?.dispose()
      managerRef.current = null
    }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const mgr = managerRef.current
    if (!mgr || openedRef.current) return

    let clientX: number, clientY: number
    if ('touches' in e) {
      if (!e.touches.length) return
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    // 参考HTML: mouse.x = (e.clientX/window.innerWidth)*2-1; mouse.y = -(e.clientY/window.innerHeight)*2+1
    const ndcX = (clientX / window.innerWidth) * 2 - 1
    const ndcY = -(clientY / window.innerHeight) * 2 + 1

    if (mgr.checkHit(ndcX, ndcY)) {
      triggerOpening()
    }
  }, [triggerOpening])

  return (
    <div className="fixed inset-0 bg-black">
      {/* 参考HTML: #canvas-container 背景 */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        onClick={handleClick}
        onTouchStart={handleClick}
        style={{ background: 'radial-gradient(circle at center, #051024 0%, #000205 80%, #000000 100%)' }}
      />
      {/* 参考HTML: #interaction-hint — 轻启礼盒 · 纳福迎祥 */}
      <div
        ref={hintRef}
        className="absolute inset-x-0 bottom-[15%] z-10 text-center pointer-events-none"
        style={{
          fontSize: '12px',
          letterSpacing: '4px',
          color: 'rgba(255, 215, 0, 0.8)',
          textShadow: '0 2px 5px rgba(0,0,0,0.8)',
          fontFamily: 'var(--font-noto-serif)',
          animation: 'breathe 3s infinite ease-in-out',
        }}
      >
        轻启礼盒 · 纳福迎祥
      </div>
      {/* 参考HTML: @keyframes breathe */}
      <style jsx>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}
