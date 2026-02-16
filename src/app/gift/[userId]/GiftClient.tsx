'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { UserConfig } from '@/types'
import dynamic from 'next/dynamic'
import ErrorBoundary from '@/components/ErrorBoundary'

const GiftBoxScene = dynamic(() => import('@/components/scenes/GiftBoxScene'), { ssr: false })
const WelcomeScene = dynamic(() => import('@/components/scenes/WelcomeScene'), { ssr: false })
const SelectorScene = dynamic(() => import('@/components/scenes/SelectorScene'), { ssr: false })
const StarryScene = dynamic(() => import('@/components/scenes/StarryScene'), { ssr: false })
const ChristmasScene = dynamic(() => import('@/components/scenes/ChristmasScene'), { ssr: false })

interface GiftClientProps {
  userId: string
}

function validateConfig(data: unknown): data is UserConfig {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  
  return (
    typeof obj.name === 'string' && obj.name.trim().length > 0 &&
    typeof obj.identifier === 'string' && obj.identifier.trim().length > 0 &&
    Array.isArray(obj.christmasPhotos)
  )
}

export default function GiftClient({ userId }: GiftClientProps) {
  const [config, setConfig] = useState<UserConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const setUser = useAppStore((s) => s.setUser)
  const appState = useAppStore((s) => s.appState)
  const setAppState = useAppStore((s) => s.setAppState)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/users/${userId}/config.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('User not found')
        return r.json()
      })
      .then((data: unknown) => {
        if (!validateConfig(data)) {
          throw new Error('配置无效：缺少 name、identifier 或 christmasPhotos 字段')
        }
        setConfig(data)
        setUser(userId, data)
        setAppState('GIFTBOX')
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message)
      })
    return () => controller.abort()
  }, [userId, setUser, setAppState])

  if (error) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center text-red-400">
        {error}
      </div>
    )
  }

  if (!config) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <span className="text-white/40 text-sm tracking-[6px] animate-pulse">
          星河正在苏醒...
        </span>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="w-screen h-screen overflow-hidden bg-black">
        {appState === 'GIFTBOX' && (
          <GiftBoxScene userId={userId} config={config} />
        )}
        {appState === 'WELCOME' && (
          <WelcomeScene userId={userId} config={config} />
        )}
        {appState === 'SELECTOR' && (
          <SelectorScene userId={userId} config={config} />
        )}
        {appState === 'CHRISTMAS' && (
          <ChristmasScene userId={userId} config={config} />
        )}
        {appState === 'STARRY' && (
          <StarryScene userId={userId} config={config} />
        )}
      </div>
    </ErrorBoundary>
  )
}
