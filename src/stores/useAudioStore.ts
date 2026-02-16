import { create } from 'zustand'
import type { PlaylistItem } from '@/types'

interface AudioStore {
  isPlaying: boolean
  currentSong: string
  volume: number
  playlist: PlaylistItem[]
  currentIndex: number

  setPlaying: (v: boolean) => void
  setCurrentSong: (name: string) => void
  setVolume: (v: number) => void
  setPlaylist: (playlist: PlaylistItem[]) => void
  setCurrentIndex: (index: number) => void
  addToPlaylist: (items: PlaylistItem[]) => void
  reset: () => void
}

export const useAudioStore = create<AudioStore>((set) => ({
  isPlaying: false,
  currentSong: 'No Music Loaded',
  volume: 0.8,
  playlist: [],
  currentIndex: 0,

  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentSong: (currentSong) => set({ currentSong }),
  setVolume: (volume) => set({ volume }),
  setPlaylist: (playlist) => set({ playlist }),
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  addToPlaylist: (items) => set((s) => ({ playlist: [...s.playlist, ...items] })),
  reset: () => set({ isPlaying: false, currentSong: 'No Music Loaded', volume: 0.8, playlist: [], currentIndex: 0 }),
}))
