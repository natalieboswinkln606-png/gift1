'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { WebGLRenderer } from 'three'
import { useAppStore } from '@/stores/useAppStore'
import type { UserConfig } from '@/types'
import { useAnimationLoop } from '@/hooks/useAnimationLoop'
import { getPointerCoords } from '@/lib/utils/pointerUtils'
import BlessingBubble from '@/components/ui/BlessingBubble'
import HiddenButton from '@/components/ui/HiddenButton'

/** 隐藏彩蛋音乐路径（仅在本场景播放） */
const EASTER_EGG_MUSIC = '/music/我们万岁.mp3'

/** 生成 N 个互不重叠的随机位置（避开中心区域，按钮间距 ≥ minDist） */
function generateNonOverlappingPositions(count: number, minDist = 120): Array<{ x: number; y: number }> {
  if (typeof window === 'undefined') return Array.from({ length: count }, () => ({ x: 0, y: 0 }))
  const w = window.innerWidth
  const h = window.innerHeight
  const margin = 100
  const cx = { x: w * 0.3, y: h * 0.3, w: w * 0.4, h: h * 0.4 }
  const positions: Array<{ x: number; y: number }> = []

  for (let i = 0; i < count; i++) {
    let x: number, y: number, attempts = 0
    do {
      x = margin + Math.random() * (w - margin * 2)
      y = margin + Math.random() * (h - margin * 2)
      attempts++
    } while (
      attempts < 200 && (
        // 排除中心区域
        (x > cx.x && x < cx.x + cx.w && y > cx.y && y < cx.y + cx.h) ||
        // 排除与已有位置重叠
        positions.some(p => Math.hypot(p.x - x, p.y - y) < minDist)
      )
    )
    positions.push({ x, y })
  }
  return positions
}

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

  // 彩蛋音乐 Audio 实例（场景级生命周期）
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const musicStartedRef = useRef(false)
  const fadeOutIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 生成 2 个互不重叠的随机位置（仅 mount 时计算一次）
  const [hiddenPositions] = useState(() => generateNonOverlappingPositions(2))

  const [bubble, setBubble] = useState<{ text: string; x: number; y: number; visible: boolean }>({
    text: '', x: 0, y: 0, visible: false,
  })
  const [transitioning, setTransitioning] = useState(false)
  const transitioningRef = useRef(false)

  // 统一动画循环：驱动 FireworkSystem
  useAnimationLoop(() => {
    fireworkRef.current?.update()
  })

  // Init scene manager + fireworks
  useEffect(() => {
    if (!containerRef.current) return
    let disposed = false

    import('@/lib/three/WelcomeSceneManager').then(({ WelcomeSceneManager }) => {
      if (disposed || !containerRef.current) return
      const mgr = new WelcomeSceneManager(containerRef.current!, renderer)
      mgr.init()
      mgr.animate()
      sceneManagerRef.current = mgr
    })

    import('@/lib/three/FireworkSystem').then(({ FireworkSystem }) => {
      if (disposed || !containerRef.current) return
      const fw = new FireworkSystem()
      fw.start(containerRef.current!)
      fireworkRef.current = fw
    })

    // 预热下一场景 chunk
    import('@/components/scenes/SelectorScene')

    return () => {
      disposed = true
      sceneManagerRef.current?.dispose()
      sceneManagerRef.current = null
      fireworkRef.current?.dispose()
      fireworkRef.current = null
      // 清理淡出 interval
      if (fadeOutIntervalRef.current) {
        clearInterval(fadeOutIntervalRef.current)
        fadeOutIntervalRef.current = null
      }
      // 场景卸载时停止并释放彩蛋音乐
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
      musicStartedRef.current = false
    }
  }, [])

  // 隐藏按钮激活 → 播放彩蛋音乐（任一按钮触发，仅播放一次）
  const handleHiddenActivate = useCallback(() => {
    if (musicStartedRef.current) return

    const audio = new Audio(EASTER_EGG_MUSIC)
    audio.volume = 0.6
    audio.loop = false
    audioRef.current = audio
    audio.play().then(() => {
      musicStartedRef.current = true
    }).catch((err) => {
      console.warn('[WelcomeScene] Easter egg music play failed:', err)
      audioRef.current = null
    })
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

  // Transition to SELECTOR
  const triggerTransition = useCallback(() => {
    if (transitioningRef.current) return
    transitioningRef.current = true
    setTransitioning(true)

    setBubble((prev) => ({ ...prev, visible: false }))
    fireworkRef.current?.stop()

    // 淡出彩蛋音乐（存储 interval ID 以便清理）
    if (audioRef.current && !audioRef.current.paused) {
      const audio = audioRef.current
      const fadeOutId = setInterval(() => {
        if (!audio || audio.paused) {
          clearInterval(fadeOutId)
          return
        }
        if (audio.volume > 0.05) {
          audio.volume = Math.max(0, audio.volume - 0.05)
        } else {
          clearInterval(fadeOutId)
          audio.pause()
        }
      }, 50)
      // 存储到 ref 以便组件卸载时清理
      fadeOutIntervalRef.current = fadeOutId
    }

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

      {/* 隐藏彩蛋按钮 ×2（亚克力材质，互不重叠的随机位置） */}
      <HiddenButton
        message="特别鸣谢你制造更欢乐的我！"
        onActivate={handleHiddenActivate}
        fixedPosition={hiddenPositions[0]}
      />
      <HiddenButton
        message="在有生的瞬间能遇到你，竟花光所有运气。"
        onActivate={handleHiddenActivate}
        fixedPosition={hiddenPositions[1]}
      />

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