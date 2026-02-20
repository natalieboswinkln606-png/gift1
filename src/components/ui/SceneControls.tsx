'use client'

import { useAppStore } from '@/stores/useAppStore'
import { useAudioStore } from '@/stores/useAudioStore'

export default function SceneControls() {
  const appState = useAppStore((s) => s.appState)
  const audioMuted = useAudioStore((s) => s.audioMuted)
  const toggleMute = useAudioStore((s) => s.toggleMute)

  return (
    <>
      {/* Mute button - top right */}
      <button
        onClick={toggleMute}
        className="fixed top-4 right-4 z-40 w-10 h-10 rounded-full
                   bg-white/10 backdrop-blur-sm border border-white/20
                   flex items-center justify-center
                   hover:bg-white/20 transition-colors duration-300
                   text-white/70 hover:text-white text-lg"
        aria-label={audioMuted ? '取消静音' : '静音'}
      >
        {audioMuted ? '🔇' : '🔊'}
      </button>

      {/* Back button - top left (only in WELCOME and beyond) */}
      {(appState === 'WELCOME' || appState === 'SELECTOR' || appState === 'CHRISTMAS' || appState === 'STARRY') && (
        <button
          onClick={() => {
            if (appState === 'CHRISTMAS' || appState === 'STARRY') {
              useAppStore.getState().setAppState('SELECTOR')
            } else if (appState === 'SELECTOR') {
              useAppStore.getState().setAppState('WELCOME')
            } else if (appState === 'WELCOME') {
              useAppStore.getState().setAppState('GIFTBOX')
            }
          }}
          className="fixed top-4 left-4 z-40 w-10 h-10 rounded-full
                     bg-white/10 backdrop-blur-sm border border-white/20
                     flex items-center justify-center
                     hover:bg-white/20 transition-colors duration-300
                     text-white/70 hover:text-white text-lg"
          aria-label="返回"
        >
          ←
        </button>
      )}
    </>
  )
}
