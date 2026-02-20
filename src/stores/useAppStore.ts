import { create } from 'zustand'
import type { UserConfig, QualityLevel, AppState, SceneMode } from '@/types'

interface AppStore {
  // State
  appState: AppState
  userId: string | null
  userConfig: UserConfig | null
  quality: QualityLevel
  preloadProgress: number
  sceneMode: SceneMode
  /** 标签页不可见时为 true，用于暂停 rAF 渲染循环以节省 GPU/CPU */
  paused: boolean

  // Actions
  setAppState: (state: AppState) => void
  setUser: (userId: string, config: UserConfig) => void
  setQuality: (quality: QualityLevel) => void
  setPreloadProgress: (progress: number) => void
  setSceneMode: (mode: SceneMode) => void
  setPaused: (paused: boolean) => void
  resetState: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  appState: 'PRELOAD',
  userId: null,
  userConfig: null,
  quality: 'HIGH',
  preloadProgress: 0,
  sceneMode: 'TREE',
  paused: false,

  setAppState: (appState) => set({ appState }),
  setUser: (userId, userConfig) => set({ userId, userConfig }),
  setQuality: (quality) => set({ quality }),
  setPreloadProgress: (preloadProgress) => set({ preloadProgress }),
  setSceneMode: (sceneMode) => set({ sceneMode }),
  setPaused: (paused) => set({ paused }),
  resetState: () => set({ appState: 'PRELOAD', preloadProgress: 0, sceneMode: 'TREE' }),
}))
