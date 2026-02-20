// User configuration from config.json
export interface UserConfig {
  name: string
  identifier: string
  christmasPhotos: string[]
  starrySilhouette: string
  starryBlessing: string
  constellation?: string
}

// Scene modes
export type SceneMode = 'TREE' | 'SCATTER' | 'HEART'
export type AnimPhase = 'IDLE' | 'EXPLODE' | 'CONVERGE'
export type QualityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'ULTRA_LOW'

// App state machine
export type AppState = 'PRELOAD' | 'GIFTBOX' | 'WELCOME' | 'SELECTOR' | 'CHRISTMAS' | 'STARRY'

// Audio state
export interface PlaylistItem {
  name: string
  url: string
}

// 质量预设参数
export interface QualityPreset {
  particleCount: number
  bgStarCount: number
  pixelRatioMax: number
  bloomScale: number  // 0 = 完全禁用 bloom
  trunkCount: number
  heartParticleCount: number  // HeartDualSystem 每侧粒子数
}

// 用户注册表条目（由 scripts/generate-users.js 生成）
export interface UserEntry {
  id: string
  displayName: string
  subtitle: string
  emoji: string
  gradient: string
  hoverBorder: string
  iconBg: string
  iconBgHover: string
}
