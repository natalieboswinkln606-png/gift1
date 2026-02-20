'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { UserConfig } from '@/types'
import dynamic from 'next/dynamic'
import ErrorBoundary from '@/components/ErrorBoundary'
import type * as THREE from 'three'

const GiftBoxScene = dynamic(() => import('@/components/scenes/GiftBoxScene'), { ssr: false })
const WelcomeScene = dynamic(() => import('@/components/scenes/WelcomeScene'), { ssr: false })
const SelectorScene = dynamic(() => import('@/components/scenes/SelectorScene'), { ssr: false })
const StarryScene = dynamic(() => import('@/components/scenes/StarryScene'), { ssr: false })
const ChristmasScene = dynamic(() => import('@/components/scenes/ChristmasScene'), { ssr: false })

// 模块级预热：GiftClient 加载时立即开始下载 SharedRenderer chunk
const sharedRendererPromise = typeof window !== 'undefined'
  ? import('@/lib/three/SharedRenderer')
  : null

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
  const setPaused = useAppStore((s) => s.setPaused)
  const resetState = useAppStore((s) => s.resetState)

  // 共享 WebGLRenderer：整个应用生命周期只创建一个 WebGL 上下文
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [rendererReady, setRendererReady] = useState(false)

  // 创建共享 renderer + 固定 canvas 到根容器
  // canvasContainerRef 始终存在于 DOM 中，不受 config/error 条件渲染影响
  useEffect(() => {
    if (!canvasContainerRef.current || rendererRef.current) return
    let disposed = false
    sharedRendererPromise?.then(({ createSharedRenderer }) => {
      if (disposed || !canvasContainerRef.current || rendererRef.current) return
      const renderer = createSharedRenderer()
      const canvas = renderer.domElement
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5'
      canvasContainerRef.current.appendChild(canvas)
      rendererRef.current = renderer
      setRendererReady(true)
    }).catch((err) => {
      console.error('[GiftClient] SharedRenderer 加载失败:', err)
    })
    return () => {
      disposed = true
      const renderer = rendererRef.current
      if (renderer) {
        renderer.renderLists.dispose()
        renderer.dispose()
        if (canvasContainerRef.current?.contains(renderer.domElement)) {
          canvasContainerRef.current.removeChild(renderer.domElement)
        }
        rendererRef.current = null
        setRendererReady(false)
      }
    }
  }, [])

  // 预热 GiftBoxScene chunk：与 renderer 创建和 config fetch 并行
  useEffect(() => {
    import('@/components/scenes/GiftBoxScene')
  }, [])

  // 标签页可见性监听：隐藏时暂停所有 rAF 渲染循环，节省 GPU/CPU
  useEffect(() => {
    const onVisChange = () => {
      setPaused(document.hidden)
    }
    document.addEventListener('visibilitychange', onVisChange)
    return () => document.removeEventListener('visibilitychange', onVisChange)
  }, [setPaused])

  // 切换到 SELECTOR 时清除 canvas 残留帧（避免 WebGL canvas 遮挡 DOM 选择器）
  useEffect(() => {
    if (appState === 'SELECTOR' && rendererRef.current) {
      rendererRef.current.clear()
    }
  }, [appState])

  useEffect(() => {
    resetState()
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
  }, [userId, setUser, setAppState, resetState])

  // canvasContainerRef 始终渲染，loading/error 作为覆盖层显示
  return (
    <ErrorBoundary>
      <div ref={canvasContainerRef} className="w-screen h-screen overflow-hidden bg-black relative">
        {/* 错误状态覆盖层 */}
        {error && (
          <div className="absolute inset-0 z-50 flex items-center justify-center text-red-400">
            {error}
          </div>
        )}

        {/* 加载状态覆盖层 */}
        {!error && !config && (
          <div className="absolute inset-0 z-50 flex items-center justify-center">
            <span className="text-white/40 text-sm tracking-[6px] animate-pulse">
              星河正在苏醒...
            </span>
          </div>
        )}

        {/* 场景组件 — 需要 config 和 rendererReady 同时就绪 */}
        {config && rendererReady && appState === 'GIFTBOX' && (
          <GiftBoxScene userId={userId} config={config} renderer={rendererRef.current!} />
        )}
        {config && rendererReady && appState === 'WELCOME' && (
          <WelcomeScene userId={userId} config={config} renderer={rendererRef.current!} />
        )}
        {config && appState === 'SELECTOR' && (
          <SelectorScene userId={userId} config={config} />
        )}
        {config && rendererReady && appState === 'CHRISTMAS' && (
          <ChristmasScene userId={userId} config={config} renderer={rendererRef.current!} />
        )}
        {config && rendererReady && appState === 'STARRY' && (
          <StarryScene userId={userId} config={config} renderer={rendererRef.current!} />
        )}
      </div>
    </ErrorBoundary>
  )
}
