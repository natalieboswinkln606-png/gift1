'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { WebGLRenderer } from 'three'
import { useAppStore } from '@/stores/useAppStore'
import type { UserConfig } from '@/types'
import { useAnimationLoop } from '@/hooks/useAnimationLoop'
import { getPointerCoords } from '@/lib/utils/pointerUtils'
import BlessingBubble from '@/components/ui/BlessingBubble'
import HiddenButton from '@/components/ui/HiddenButton'

interface WelcomeSceneProps {
  userId: string
  config: UserConfig
  renderer: WebGLRenderer
}

export default function WelcomeScene({ userId, config, renderer }: WelcomeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneManagerRef = useRef<import('@/lib/three/WelcomeSceneManager').WelcomeSceneManager | null>(null)
  const fireworkRef = useRef<import('@/lib/three/FireworkSystem').FireworkSystem | null>(null)
  const setAppState = useAppStore((s) => s.setAppState)

  const hiddenButtonRef = useRef<HTMLDivElement>(null)

  const [bubble, setBubble] = useState<{ text: string; x: number; y: number; visible: boolean }>({
    text: '', x: 0, y: 0, visible: false,
  })
  const [transitioning, setTransitioning] = useState(false)
  const transitioningRef = useRef(false)

  // 统一动画循环：驱动 FireworkSystem（useAnimationLoop 自动处理 RAF + paused + 卸载清理）
  useAnimationLoop(() => {
    fireworkRef.current?.update()
  })

  // Init scene manager + fireworks
  useEffect(() => {
    if (!containerRef.current) return
    let disposed = false

    import('@/lib/three/WelcomeSceneManager').then(({ WelcomeSceneManager }) => {
      if (disposed || !containerRef.current) return

      // Three.js icon sprites
      const mgr = new WelcomeSceneManager(containerRef.current!, renderer)
      mgr.init()
      mgr.animate()
      sceneManagerRef.current = mgr
    })

    // Fireworks (2D canvas overlay)
    import('@/lib/three/FireworkSystem').then(({ FireworkSystem }) => {
      if (disposed || !containerRef.current) return
      const fw = new FireworkSystem()
      fw.start(containerRef.current!)
      fireworkRef.current = fw
    })

    // 预热下一场景 chunk：Welcome 期间并行下载 SelectorScene
    import('@/components/scenes/SelectorScene')

    return () => {
      disposed = true
      sceneManagerRef.current?.dispose()
      sceneManagerRef.current = null
      fireworkRef.current?.dispose()
      fireworkRef.current = null
    }
  }, [])

  // Mouse/touch move → hover detection
  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const mgr = sceneManagerRef.current
    if (!mgr || transitioningRef.current) return

    const coords = getPointerCoords(e)
    if (!coords) return
    const { clientX, clientY } = coords

    const result = mgr.handleMouseMove(clientX, clientY)
    if (result) {
      setBubble({ text: result.text, x: result.screenX, y: result.screenY, visible: true })
    } else {
      setBubble((prev) => (prev.visible ? { ...prev, visible: false } : prev))
    }
  }, [])

  const handleHiddenActivate = useCallback(() => {}, [])

  // Transition to SELECTOR
  const triggerTransition = useCallback(() => {
    if (transitioningRef.current) return
    transitioningRef.current = true
    setTransitioning(true)

    // Hide bubble
    setBubble((prev) => ({ ...prev, visible: false }))

    // Stop fireworks
    fireworkRef.current?.stop()

    // Play exit animation on sprites
    sceneManagerRef.current?.playExitAnimation(() => {
      setAppState('SELECTOR')
    })
  }, [setAppState])

  // Scroll / swipe / key detection for transition
  useEffect(() => {
    let touchStartY = 0

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 30) triggerTransition()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') triggerTransition()
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length) touchStartY = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length && touchStartY - e.touches[0].clientY > 50) {
        triggerTransition()
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [triggerTransition])

  return (
    <div className="fixed inset-0 bg-black">
      <div
        ref={containerRef}
        className="absolute inset-0"
        onMouseMove={handlePointerMove}
        onTouchMove={handlePointerMove}
      />

      {/* Central text overlay */}
      <div
        className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-1000"
        style={{ opacity: transitioning ? 0 : 1, fontFamily: 'var(--font-noto-serif)' }}
      >
        <p className="text-[rgba(255,215,0,0.9)] text-lg tracking-[8px] mb-2">
          祝{config.name}
        </p>
        <p className="text-white text-4xl font-light tracking-[12px] mb-2"
          style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
        >
          2026
        </p>
        <p className="text-[rgba(255,215,0,0.9)] text-lg tracking-[8px]">
          新年快乐
        </p>
      </div>

      {/* Blessing bubble */}
      <BlessingBubble
        text={bubble.text}
        x={bubble.x}
        y={bubble.y}
        visible={bubble.visible}
      />

      {/* Hidden button */}
      <div ref={hiddenButtonRef}>
        <HiddenButton onActivate={handleHiddenActivate} particleProximity={0.2} />
      </div>

      {/* Scroll hint */}
      {!transitioning && (
        <div className="absolute inset-x-0 bottom-[8%] z-10 text-center pointer-events-none animate-pulse">
          <p className="text-white/50 text-xs tracking-[4px]">
            ↓ 向下滑动继续 ↓
          </p>
        </div>
      )}

      {/* "下一场景" button */}
      {!transitioning && (
        <button
          onClick={triggerTransition}
          className="absolute bottom-[3%] right-[5%] z-20 text-white/40 text-xs tracking-[2px] border border-white/20 rounded-full px-4 py-2 hover:text-white/80 hover:border-white/50 transition-all duration-300"
        >
          下一场景
        </button>
      )}
    </div>
  )
}