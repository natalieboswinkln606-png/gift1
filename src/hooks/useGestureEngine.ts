'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useGestureStore } from '@/stores/useGestureStore'

/**
 * React hook for GestureEngine lifecycle management.
 *
 * Lazy-loads and initializes the gesture engine when `enabled` is true.
 * Handles cleanup on unmount or when disabled.
 * Uses pause/resume for toggling (camera stays alive).
 *
 * @param enabled - Whether gesture detection should be active
 * @returns { isReady, isDetecting, error, initialize, stop }
 */
export function useGestureEngine(enabled: boolean) {
  const [isReady, setIsReady] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const engineRef = useRef<Awaited<typeof import('@/lib/gesture/GestureEngine')> | null>(null)
  const initializingRef = useRef(false)
  const isReadyRef = useRef(false)
  const isDetectingRef = useRef(false)

  const videoElement = useGestureStore((s) => s.videoElement)

  // Initialize engine when enabled
  useEffect(() => {
    if (!enabled) {
      // Pause detection if running
      if (engineRef.current && isDetectingRef.current) {
        engineRef.current.gestureEngine.stopDetection()
        isDetectingRef.current = false
        setIsDetecting(false)
      }
      return
    }

    if (initializingRef.current || isReadyRef.current) {
      // Already initialized — resume if paused
      if (isReadyRef.current && !isDetectingRef.current && engineRef.current) {
        engineRef.current.gestureEngine.resumeDetection()
        isDetectingRef.current = true
        setIsDetecting(true)
      }
      return
    }

    initializingRef.current = true
    let cancelled = false

    ;(async () => {
      try {
        const mod = await import('@/lib/gesture/GestureEngine')
        if (cancelled) return

        engineRef.current = mod
        const success = await mod.gestureEngine.initialize()

        if (cancelled) return

        if (!success) {
          setError('手势系统初始化失败')
          initializingRef.current = false
          return
        }

        isReadyRef.current = true
        setIsReady(true)
        setError(null)

        // Auto-start detection
        mod.gestureEngine.startDetection()
        isDetectingRef.current = true
        setIsDetecting(true)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '未知错误')
        }
      } finally {
        if (!cancelled) {
          initializingRef.current = false
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.gestureEngine.dispose()
        engineRef.current = null
        setIsReady(false)
        setIsDetecting(false)
      }
    }
  }, [])

  // Manual stop/start
  const stop = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.gestureEngine.stopDetection()
      setIsDetecting(false)
    }
  }, [])

  const start = useCallback(() => {
    if (engineRef.current && isReady) {
      engineRef.current.gestureEngine.startDetection()
      setIsDetecting(true)
    }
  }, [isReady])

  return {
    isReady,
    isDetecting,
    error,
    videoElement,
    stop,
    start,
  }
}
