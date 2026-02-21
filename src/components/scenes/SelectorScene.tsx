'use client'

import { useState, useCallback, useEffect, memo } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import type { UserConfig } from '@/types'

interface SelectorSceneProps {
  userId: string
  config: UserConfig
}

interface SelectorPanelProps {
  type: 'christmas' | 'starry'
  icon: string
  title: string
  subtitle: string
  bgImage: string
  gradientOverlay: string
  hoveredPanel: 'christmas' | 'starry' | null
  onHover: (panel: 'christmas' | 'starry' | null) => void
  onClick: () => void
  isFirst?: boolean
}

const SelectorPanel = memo(function SelectorPanel({
  type,
  icon,
  title,
  subtitle,
  bgImage,
  gradientOverlay,
  hoveredPanel,
  onHover,
  onClick,
  isFirst,
}: SelectorPanelProps) {
  const isHovered = hoveredPanel === type
  const isOtherHovered = hoveredPanel !== null && !isHovered

  return (
    <div
      className={`relative overflow-hidden cursor-pointer${isFirst ? ' border-r border-white/10' : ''}`}
      style={{
        flex: isHovered ? 1.5 : isOtherHovered ? 0.7 : 1,
        transition: 'flex 0.6s cubic-bezier(0.25, 1, 0.5, 1), filter 0.5s ease',
        filter: isOtherHovered ? 'brightness(0.4)' : 'none',
      }}
      onMouseEnter={() => onHover(type)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${bgImage})`,
          transition: 'transform 8s ease-out',
          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        <div className={`absolute inset-0 bg-gradient-to-b ${gradientOverlay}`} />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-center items-center">
        <div
          className="w-[60px] h-[60px] mb-5 border border-white/30 rounded-full flex items-center justify-center text-2xl transition-all duration-500"
          style={{ color: isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)' }}
        >
          {icon}
        </div>
        <div
          className="text-[2rem] font-light tracking-[12px] pb-4 mb-4 transition-all duration-500"
          style={{
            color: isHovered ? '#fff' : 'rgba(255,255,255,0.9)',
            borderBottom: isHovered ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          {title}
        </div>
        <div
          className="text-[0.9rem] tracking-[4px] transition-all duration-500"
          style={{
            color: isHovered ? '#fff' : 'rgba(255,255,255,0.6)',
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  )
})

export default function SelectorScene({ userId, config }: SelectorSceneProps) {
  const [hoveredPanel, setHoveredPanel] = useState<'christmas' | 'starry' | null>(null)
  const setAppState = useAppStore((s) => s.setAppState)

  // 预热最终场景 chunk：用户在选择器停留时并行下载两个场景
  useEffect(() => {
    import('@/components/scenes/ChristmasScene').catch(() => {})
    import('@/components/scenes/StarryScene').catch(() => {})
  }, [])

  const handlePanelClick = useCallback((panel: 'christmas' | 'starry') => {
    setAppState(panel === 'christmas' ? 'CHRISTMAS' : 'STARRY')
  }, [setAppState])

  const handleChristmasClick = useCallback(() => handlePanelClick('christmas'), [handlePanelClick])
  const handleStarryClick = useCallback(() => handlePanelClick('starry'), [handlePanelClick])

  return (
    <div className="fixed inset-0 z-10 flex" style={{ fontFamily: 'var(--font-noto-serif)' }}>
      <SelectorPanel
        type="christmas"
        icon="圣"
        title="圣诞"
        subtitle="温暖归途 · 灯火阑珊"
        bgImage="/images/selector-christmas.webp"
        gradientOverlay="from-[rgba(60,10,10,0.2)] to-[rgba(30,5,5,0.9)]"
        hoveredPanel={hoveredPanel}
        onHover={setHoveredPanel}
        onClick={handleChristmasClick}
        isFirst
      />
      <SelectorPanel
        type="starry"
        icon="星"
        title="星河"
        subtitle="终极浪漫 · 永恒答案"
        bgImage="/images/selector-starry.webp"
        gradientOverlay="from-[rgba(20,0,40,0.2)] to-[rgba(10,0,20,0.95)]"
        hoveredPanel={hoveredPanel}
        onHover={setHoveredPanel}
        onClick={handleStarryClick}
      />
    </div>
  )
}
