'use client'

import { useRef, useCallback, useEffect } from 'react'
import { useGestureStore } from '@/stores/useGestureStore'
import type { GestureType } from '@/types'

interface CursorStyle {
  size: number
  color: string
  shadow: string
  scale: number
  borderRadius: string
  extraClass: string
}

const CURSOR_STYLES: Record<GestureType, CursorStyle> = {
  NONE: { size: 16, color: 'rgba(0,255,255,0.5)', shadow: '0 0 10px cyan', scale: 1, borderRadius: '50%', extraClass: '' },
  PINCH: { size: 12, color: 'rgba(255,215,0,0.7)', shadow: '0 0 12px rgba(255,215,0,0.5)', scale: 0.8, borderRadius: '50%', extraClass: '' },
  FIST: { size: 20, color: 'rgba(255,68,68,0.6)', shadow: '0 0 15px rgba(255,68,68,0.4)', scale: 1.2, borderRadius: '50%', extraClass: 'animate-pulse' },
  POINT: { size: 16, color: 'rgba(0,255,255,0.7)', shadow: '0 0 10px cyan', scale: 1, borderRadius: '50% 50% 50% 0', extraClass: '' },
  OPEN: { size: 24, color: 'rgba(100,140,255,0.5)', shadow: '0 0 18px rgba(100,140,255,0.4)', scale: 1.5, borderRadius: '50%', extraClass: '' },
  THREE_FINGER: { size: 20, color: 'rgba(255,0,255,0.5)', shadow: '0 0 14px rgba(255,0,255,0.3)', scale: 1, borderRadius: '30%', extraClass: '' },
}

const SPRING_STIFFNESS = 150
const SPRING_DAMPING = 15
const SPRING_MASS = 1

interface SpringState {
  x: number
  y: number
  vx: number
  vy: number
}

export default function GestureCursor() {
  const isEnabled = useGestureStore((s) => s.isEnabled)
  const currentGesture = useGestureStore((s) => s.currentGesture)

  const cursorRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const springRef = useRef<SpringState>({ x: 0, y: 0, vx: 0, vy: 0 })
  const initializedRef = useRef(false)
  const lastTimeRef = useRef<number>(0)

  const tick = useCallback(() => {
    const el = cursorRef.current
    if (!el) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    const now = performance.now()
    // Cap dt to avoid spiral-of-death on tab refocus
    const dt = Math.min((now - (lastTimeRef.current || now)) / 1000, 0.064)
    lastTimeRef.current = now

    const state = useGestureStore.getState()
    const targetX = state.cursorPosition.x
    const targetY = state.cursorPosition.y

    const spring = springRef.current

    // Snap to target on first frame
    if (!initializedRef.current) {
      spring.x = targetX
      spring.y = targetY
      spring.vx = 0
      spring.vy = 0
      initializedRef.current = true
    }

    // Spring force: F = -k * displacement - d * velocity
    const dx = spring.x - targetX
    const dy = spring.y - targetY
    const ax = (-SPRING_STIFFNESS * dx - SPRING_DAMPING * spring.vx) / SPRING_MASS
    const ay = (-SPRING_STIFFNESS * dy - SPRING_DAMPING * spring.vy) / SPRING_MASS

    spring.vx += ax * dt
    spring.vy += ay * dt
    spring.x += spring.vx * dt
    spring.y += spring.vy * dt

    // Settle: if close enough and slow enough, snap exactly
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(spring.vx) < 0.1 && Math.abs(spring.vy) < 0.1) {
      spring.x = targetX
      spring.y = targetY
      spring.vx = 0
      spring.vy = 0
    }

    // Read current gesture style for offset
    const gesture = state.currentGesture
    const cursorStyle = CURSOR_STYLES[gesture] ?? CURSOR_STYLES.NONE
    const halfSize = (cursorStyle.size * cursorStyle.scale) / 2

    el.style.transform = `translate3d(${spring.x - halfSize}px, ${spring.y - halfSize}px, 0)`

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [tick])

  // Reset spring when re-enabled so cursor doesn't animate from stale position
  useEffect(() => {
    if (isEnabled) {
      initializedRef.current = false
    }
  }, [isEnabled])

  if (!isEnabled) return null

  const style = CURSOR_STYLES[currentGesture] ?? CURSOR_STYLES.NONE

  return (
    <div
      ref={cursorRef}
      className={`fixed top-0 left-0 pointer-events-none z-50 ${style.extraClass}`}
      style={{
        width: style.size * style.scale,
        height: style.size * style.scale,
        borderRadius: style.borderRadius,
        backgroundColor: style.color,
        boxShadow: style.shadow,
        willChange: 'transform',
        transition: 'width 200ms ease, height 200ms ease, background-color 200ms ease, box-shadow 200ms ease, border-radius 200ms ease',
      }}
    />
  )
}
