'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useGestureStore } from '@/stores/useGestureStore'
import type { GestureType } from '@/types'

/**
 * Standardized gesture state tracking hook.
 *
 * Provides ENTER / HOLD / EXIT events for gesture transitions,
 * replacing ad-hoc prevGestureRef patterns across scenes.
 *
 * Usage:
 *   useGestureState({
 *     onEnter: (gesture) => { ... },
 *     onHold:  (gesture, durationMs) => { ... },
 *     onExit:  (prevGesture) => { ... },
 *   })
 */

export interface GestureStateCallbacks {
  /** Fired once when a new gesture is first detected */
  onEnter?: (gesture: GestureType) => void
  /** Fired every ~50ms while a gesture is held */
  onHold?: (gesture: GestureType, durationMs: number) => void
  /** Fired once when a gesture ends (transitions to another or NONE) */
  onExit?: (prevGesture: GestureType) => void
}

export function useGestureState(callbacks: GestureStateCallbacks) {
  const currentGesture = useGestureStore((s) => s.currentGesture)
  const gestureEnabled = useGestureStore((s) => s.isEnabled)
  const cursorPosition = useGestureStore((s) => s.cursorPosition)

  const prevGestureRef = useRef<GestureType>('NONE')
  const gestureStartRef = useRef<number>(0)
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stable callback refs to avoid re-triggering effects
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  // Cleanup hold interval
  const clearHoldInterval = useCallback(() => {
    if (holdIntervalRef.current !== null) {
      clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
  }, [])

   useEffect(() => {
     if (!gestureEnabled) {
       // Gesture system disabled — fire exit for any active gesture
       if (prevGestureRef.current !== 'NONE') {
         callbacksRef.current.onExit?.(prevGestureRef.current)
         clearHoldInterval()
         prevGestureRef.current = 'NONE'
       }
       return
     }

     const prev = prevGestureRef.current

     if (currentGesture === prev) return // No change

     // ── EXIT previous gesture ──
     if (prev !== 'NONE') {
       callbacksRef.current.onExit?.(prev)
       clearHoldInterval()
     }

     // ── ENTER new gesture ──
     if (currentGesture !== 'NONE') {
       callbacksRef.current.onEnter?.(currentGesture)
       gestureStartRef.current = performance.now()

       // Start HOLD interval
       if (callbacksRef.current.onHold) {
         holdIntervalRef.current = setInterval(() => {
           const duration = performance.now() - gestureStartRef.current
           callbacksRef.current.onHold?.(currentGesture, duration)
         }, 50)
       }
     }

     prevGestureRef.current = currentGesture

     // Cleanup: clear interval when effect re-runs or unmounts
     return () => {
       clearHoldInterval()
     }
   }, [gestureEnabled, currentGesture, clearHoldInterval])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearHoldInterval()
    }
  }, [clearHoldInterval])

  return {
    currentGesture,
    cursorPosition,
    gestureEnabled,
    prevGesture: prevGestureRef.current,
  }
}
