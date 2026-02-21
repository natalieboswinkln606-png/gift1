import { create } from 'zustand'
import type { PlaylistItem } from '@/types'

interface AudioStore {
  isPlaying: boolean
  volume: number
  playlist: PlaylistItem[]
  currentIndex: number
  audioMuted: boolean

  setPlaying: (v: boolean) => void
  setVolume: (v: number) => void
  setPlaylist: (playlist: PlaylistItem[]) => void
  addToPlaylist: (items: PlaylistItem[]) => void
  toggleMute: () => void
  reset: () => void
}

export const useAudioStore = create<AudioStore>((set) => ({
  isPlaying: false,
  volume: 0.8,
  playlist: [],
  currentIndex: 0,
  audioMuted: false,

  setPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume }),
  setPlaylist: (playlist) => set({ playlist }),
  addToPlaylist: (items) => set((s) => ({ playlist: [...s.playlist, ...items] })),
  toggleMute: () => set((s) => ({ audioMuted: !s.audioMuted })),
  reset: () => set({ isPlaying: false, volume: 0.8, playlist: [], currentIndex: 0, audioMuted: false }),
}))
