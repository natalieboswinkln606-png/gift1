'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAudioStore } from '@/stores/useAudioStore'
import type { AudioEngine } from '@/lib/audio/AudioEngine'

interface MusicPlayerProps {
  audioEngine: AudioEngine | null
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MusicPlayer({ audioEngine }: MusicPlayerProps) {
  const { isPlaying, currentSong, volume, playlist, currentIndex } = useAudioStore()
  const [collapsed, setCollapsed] = useState(true)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)

  // RAF-driven progress update
  useEffect(() => {
    if (!audioEngine || collapsed) return
    let raf: number
    const update = () => {
      const current = audioEngine.getCurrentTime()
      const dur = audioEngine.getDuration()
      setProgress(dur > 0 ? current / dur : 0)
      setCurrentTime(current)
      setDuration(dur)
      raf = requestAnimationFrame(update)
    }
    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [audioEngine, collapsed])

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioEngine || !progressBarRef.current) return
      const rect = progressBarRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      audioEngine.seek(percent)
    },
    [audioEngine],
  )

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!audioEngine) return
      audioEngine.setVolume(parseFloat(e.target.value))
    },
    [audioEngine],
  )

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!audioEngine || !e.target.files || e.target.files.length === 0) return
      audioEngine.loadFiles(e.target.files)
      e.target.value = ''
    },
    [audioEngine],
  )

  if (!audioEngine) return null

  // Collapsed state — small floating orb
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full
                   bg-black/80 backdrop-blur-md border border-white/10
                   flex items-center justify-center
                   text-amber-400/70 hover:text-amber-300 hover:bg-white/10
                   transition-all duration-300 shadow-2xl shadow-black/50
                   group"
        aria-label="Open music player"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="group-hover:scale-110 transition-transform duration-200"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        {/* Subtle pulse ring when playing */}
        {isPlaying && (
          <span className="absolute inset-0 rounded-full border border-amber-400/30 animate-ping" />
        )}
      </button>
    )
  }

  // Expanded player
  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-72
                 bg-black/80 backdrop-blur-md rounded-xl
                 border border-white/10 shadow-2xl shadow-black/60
                 p-4 flex flex-col gap-3
                 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {/* Header row: song name + collapse button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-white/30 mb-0.5">
            Now Playing
          </p>
          <p className="text-sm text-white/90 truncate font-medium">
            {currentSong}
          </p>
          {playlist.length > 1 && (
            <p className="text-[10px] text-white/30 mt-0.5">
              {currentIndex + 1} / {playlist.length}
            </p>
          )}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 rounded-full bg-white/5 border border-white/10
                     flex items-center justify-center flex-shrink-0
                     text-white/40 hover:text-white/80 hover:bg-white/10
                     transition-colors duration-200"
          aria-label="Collapse player"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          className="w-full h-1.5 bg-white/10 rounded-full cursor-pointer
                     group relative overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Playback progress"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full
                       bg-gradient-to-r from-amber-500 to-orange-400
                       transition-[width] duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
          {/* Hover glow */}
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {/* Time display */}
        <div className="flex justify-between text-[10px] text-white/30 tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Transport controls */}
      <div className="flex items-center justify-center gap-3">
        {/* Prev */}
        <button
          onClick={() => audioEngine.prev()}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10
                     flex items-center justify-center
                     text-white/50 hover:text-white hover:bg-white/10
                     transition-colors duration-200"
          aria-label="Previous track"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          onClick={() => audioEngine.togglePlay()}
          className="w-10 h-10 rounded-full
                     bg-gradient-to-br from-amber-500 to-orange-500
                     flex items-center justify-center
                     text-black hover:from-amber-400 hover:to-orange-400
                     transition-all duration-200 shadow-lg shadow-amber-500/20"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Next */}
        <button
          onClick={() => audioEngine.next()}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10
                     flex items-center justify-center
                     text-white/50 hover:text-white hover:bg-white/10
                     transition-colors duration-200"
          aria-label="Next track"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
      </div>

      {/* Volume control */}
      <div className="flex items-center gap-2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white/30 flex-shrink-0"
        >
          {volume === 0 ? (
            <>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </>
          ) : volume < 0.5 ? (
            <>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </>
          ) : (
            <>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </>
          )}
        </svg>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="flex-1 h-1 appearance-none bg-white/10 rounded-full
                     accent-amber-500 cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-3
                     [&::-webkit-slider-thumb]:h-3
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-amber-400
                     [&::-webkit-slider-thumb]:shadow-sm
                     [&::-webkit-slider-thumb]:shadow-amber-500/30"
          aria-label="Volume"
        />
        <span className="text-[10px] text-white/30 tabular-nums w-7 text-right">
          {Math.round(volume * 100)}
        </span>
      </div>

      {/* File upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
        aria-label="Upload audio files"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-1.5 rounded-lg
                   bg-white/5 border border-dashed border-white/10
                   text-[11px] text-white/40 hover:text-white/70
                   hover:bg-white/10 hover:border-white/20
                   transition-colors duration-200
                   flex items-center justify-center gap-1.5"
        aria-label="Upload music files"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Add Music
      </button>
    </div>
  )
}
