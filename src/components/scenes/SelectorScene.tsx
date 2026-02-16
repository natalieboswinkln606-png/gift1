'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { UserConfig } from '@/types'

interface SelectorSceneProps {
  userId: string
  config: UserConfig
}

export default function SelectorScene({ userId, config }: SelectorSceneProps) {
  const [hoveredPanel, setHoveredPanel] = useState<'christmas' | 'starry' | null>(null)
  const setAppState = useAppStore((s) => s.setAppState)

  const handlePanelClick = useCallback((panel: 'christmas' | 'starry') => {
    setAppState(panel === 'christmas' ? 'CHRISTMAS' : 'STARRY')
  }, [setAppState])

  return (
    <div className="fixed inset-0 flex" style={{ fontFamily: 'var(--font-noto-serif)' }}>
      {/* Christmas Panel */}
      <div
        className="relative overflow-hidden cursor-pointer border-r border-white/10"
        style={{
          flex: hoveredPanel === 'christmas' ? 1.5 : hoveredPanel === 'starry' ? 0.7 : 1,
          transition: 'flex 0.6s cubic-bezier(0.25, 1, 0.5, 1), filter 0.5s ease',
          filter: hoveredPanel && hoveredPanel !== 'christmas' ? 'brightness(0.4)' : 'none',
        }}
        onMouseEnter={() => setHoveredPanel('christmas')}
        onMouseLeave={() => setHoveredPanel(null)}
        onClick={() => handlePanelClick('christmas')}
      >
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/images/selector-christmas.png)',
            transition: 'transform 8s ease-out',
            transform: hoveredPanel === 'christmas' ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[rgba(60,10,10,0.2)] to-[rgba(30,5,5,0.9)]" />
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-center items-center">
          <div
            className="w-[60px] h-[60px] mb-5 border border-white/30 rounded-full flex items-center justify-center text-2xl transition-all duration-500"
            style={{ color: hoveredPanel === 'christmas' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)' }}
          >
            圣
          </div>
          <div
            className="text-[2rem] font-light tracking-[12px] pb-4 mb-4 transition-all duration-500"
            style={{
              color: hoveredPanel === 'christmas' ? '#fff' : 'rgba(255,255,255,0.9)',
              borderBottom: hoveredPanel === 'christmas' ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            圣诞
          </div>
          <div
            className="text-[0.9rem] tracking-[4px] transition-all duration-500"
            style={{
              color: hoveredPanel === 'christmas' ? '#fff' : 'rgba(255,255,255,0.6)',
              opacity: hoveredPanel === 'christmas' ? 1 : 0,
              transform: hoveredPanel === 'christmas' ? 'translateY(0)' : 'translateY(20px)',
            }}
          >
            温暖归途 · 灯火阑珊
          </div>
        </div>
      </div>

      {/* Starry Panel */}
      <div
        className="relative overflow-hidden cursor-pointer"
        style={{
          flex: hoveredPanel === 'starry' ? 1.5 : hoveredPanel === 'christmas' ? 0.7 : 1,
          transition: 'flex 0.6s cubic-bezier(0.25, 1, 0.5, 1), filter 0.5s ease',
          filter: hoveredPanel && hoveredPanel !== 'starry' ? 'brightness(0.4)' : 'none',
        }}
        onMouseEnter={() => setHoveredPanel('starry')}
        onMouseLeave={() => setHoveredPanel(null)}
        onClick={() => handlePanelClick('starry')}
      >
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/images/selector-starry.png)',
            transition: 'transform 8s ease-out',
            transform: hoveredPanel === 'starry' ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[rgba(20,0,40,0.2)] to-[rgba(10,0,20,0.95)]" />
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-center items-center">
          <div
            className="w-[60px] h-[60px] mb-5 border border-white/30 rounded-full flex items-center justify-center text-2xl transition-all duration-500"
            style={{ color: hoveredPanel === 'starry' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)' }}
          >
            星
          </div>
          <div
            className="text-[2rem] font-light tracking-[12px] pb-4 mb-4 transition-all duration-500"
            style={{
              color: hoveredPanel === 'starry' ? '#fff' : 'rgba(255,255,255,0.9)',
              borderBottom: hoveredPanel === 'starry' ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            星河
          </div>
          <div
            className="text-[0.9rem] tracking-[4px] transition-all duration-500"
            style={{
              color: hoveredPanel === 'starry' ? '#fff' : 'rgba(255,255,255,0.6)',
              opacity: hoveredPanel === 'starry' ? 1 : 0,
              transform: hoveredPanel === 'starry' ? 'translateY(0)' : 'translateY(20px)',
            }}
          >
            终极浪漫 · 永恒答案
          </div>
        </div>
      </div>
    </div>
  )
}
