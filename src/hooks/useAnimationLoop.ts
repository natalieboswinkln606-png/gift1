'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'

/**
 * 封装 requestAnimationFrame + disposed + paused 模式的动画循环 hook。
 * callback 每帧调用（paused 时跳过），组件卸载时自动取消。
 *
 * 注意：callback 应使用 useCallback 包裹或在 ref 中保持稳定引用，
 * 以避免不必要的循环重启。
 */
export function useAnimationLoop(callback: () => void, enabled = true): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let rafId = 0

    const animate = () => {
      if (disposed) return
      rafId = requestAnimationFrame(animate)
      if (useAppStore.getState().paused) return
      callbackRef.current()
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
    }
  }, [enabled])
}
