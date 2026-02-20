'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * 打字机效果 hook
 * @param text 要显示的完整文本
 * @param active 是否激活打字机效果（false 时清空文本）
 * @param speed 每个字符的间隔毫秒数，默认 80
 * @returns 当前显示的文本
 */
export function useTypewriter(text: string, active: boolean, speed = 80): string {
  const [displayText, setDisplayText] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!active) {
      setDisplayText('')
      return
    }

    setDisplayText('')
    let cancelled = false
    let index = 0

    function typeChar() {
      if (cancelled) return
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1))
        index++
        timerRef.current = setTimeout(typeChar, speed)
      }
    }

    typeChar()

    return () => {
      cancelled = true
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [text, active, speed])

  return displayText
}
