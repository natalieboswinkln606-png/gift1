import { create } from 'zustand'
import type { GestureType, Landmark } from '@/types'

interface GestureStore {
  currentGesture: GestureType
  confidence: number
  cursorPosition: { x: number; y: number }
  isEnabled: boolean
  landmarks: Landmark[] | null
  handPosition: { x: number; y: number; z: number } | null
  cameraPermission: 'granted' | 'denied' | 'prompt' | null
  videoElement: HTMLVideoElement | null
  smoothedLandmarks: Landmark[] | null

  setGesture: (gesture: GestureType, confidence: number) => void
  setCursor: (x: number, y: number) => void
  setEnabled: (enabled: boolean) => void
  setLandmarks: (lm: Landmark[] | null) => void
  setHandPosition: (pos: { x: number; y: number; z: number } | null) => void
  setCameraPermission: (status: 'granted' | 'denied' | 'prompt') => void
  setVideoElement: (video: HTMLVideoElement | null) => void
  setSmoothedLandmarks: (lm: Landmark[] | null) => void
  reset: () => void
}

export const useGestureStore = create<GestureStore>((set) => ({
  currentGesture: 'NONE',
  confidence: 0,
  cursorPosition: { x: 0, y: 0 },
  isEnabled: false,
  landmarks: null,
  handPosition: null,
  cameraPermission: null,
  videoElement: null,
  smoothedLandmarks: null,

  setGesture: (gesture, confidence) => set({ currentGesture: gesture, confidence }),
  setCursor: (x, y) => set({ cursorPosition: { x, y } }),
  setEnabled: (enabled) => set({ isEnabled: enabled }),
  setLandmarks: (lm) => set({ landmarks: lm }),
  setHandPosition: (pos) => set({ handPosition: pos }),
  setCameraPermission: (status) => set({ cameraPermission: status }),
  setVideoElement: (video) => set({ videoElement: video }),
  setSmoothedLandmarks: (lm) => set({ smoothedLandmarks: lm }),
  reset: () => set({ currentGesture: 'NONE', confidence: 0, cursorPosition: { x: 0, y: 0 }, isEnabled: false, landmarks: null, handPosition: null, cameraPermission: null, videoElement: null, smoothedLandmarks: null }),
}))
