import { create } from 'zustand'
import type { UserConfig, QualityLevel, AppState, SceneMode } from '@/types'

interface AppStore {
  // State
  appState: AppState
  userId: string | null
  userConfig: UserConfig | null
  quality: QualityLevel
  audioMuted: boolean
  preloadProgress: number
  sceneMode: SceneMode

  // Actions
  setAppState: (state: AppState) => void
  setUser: (userId: string, config: UserConfig) => void
  setQuality: (quality: QualityLevel) => void
  toggleMute: () => void
  setPreloadProgress: (progress: number) => void
  setSceneMode: (mode: SceneMode) => void
}

export const useAppStore = create<AppStore>((set) => ({
  appState: 'PRELOAD',
  userId: null,
  userConfig: null,
  quality: 'HIGH',
  audioMuted: false,
  preloadProgress: 0,
  sceneMode: 'TREE',

  setAppState: (appState) => set({ appState }),
  setUser: (userId, userConfig) => set({ userId, userConfig }),
  setQuality: (quality) => set({ quality }),
  toggleMute: () => set((s) => ({ audioMuted: !s.audioMuted })),
  setPreloadProgress: (preloadProgress) => set({ preloadProgress }),
  setSceneMode: (sceneMode) => set({ sceneMode }),
}))
