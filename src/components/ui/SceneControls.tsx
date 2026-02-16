'use client'

import { useAppStore } from '@/stores/useAppStore'

export default function SceneControls() {
  const { appState, audioMuted, toggleMute } = useAppStore()

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
            const store = useAppStore.getState()
            const state = store.appState
            if (state === 'CHRISTMAS' || state === 'STARRY') {
              store.setAppState('SELECTOR')
            } else if (state === 'SELECTOR') {
              store.setAppState('WELCOME')
            } else if (state === 'WELCOME') {
              store.setAppState('GIFTBOX')
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
