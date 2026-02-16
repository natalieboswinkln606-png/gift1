'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useGestureStore } from '@/stores/useGestureStore'
import { HAND_CONNECTIONS } from '@/types'
import type { GestureType } from '@/types'

const WIDTH = 220
const HEIGHT = 165

/** Human-readable gesture labels */
const GESTURE_LABELS: Record<GestureType, string> = {
  NONE: '无手势',
  FIST: '握拳',
  OPEN: '张开',
  PINCH: '捏合',
  THREE_FINGER: '三指',
  POINT: '指向',
}

/** Confidence bar color */
function getConfidenceColor(conf: number): string {
  if (conf >= 0.7) return '#22c55e'
  if (conf >= 0.5) return '#eab308'
  return '#ef4444'
}

export default function HandCamera() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  // Prefer smoothed landmarks for stable skeleton; fall back to raw
  const smoothedLandmarks = useGestureStore((s) => s.smoothedLandmarks)
  const rawLandmarks = useGestureStore((s) => s.landmarks)
  const landmarks = smoothedLandmarks ?? rawLandmarks

  const isEnabled = useGestureStore((s) => s.isEnabled)
  const videoElement = useGestureStore((s) => s.videoElement)
  const currentGesture = useGestureStore((s) => s.currentGesture)
  const confidence = useGestureStore((s) => s.confidence)

  const [visible, setVisible] = useState(true)

  // Attach shared video element to container
  useEffect(() => {
    const container = videoContainerRef.current
    if (!container || !videoElement) return

    // Prevent duplicate appending
    if (container.contains(videoElement)) return

    videoElement.style.width = '100%'
    videoElement.style.height = '100%'
    videoElement.style.objectFit = 'cover'
    videoElement.style.opacity = '0.2'
    videoElement.style.transform = 'scaleX(-1)'
    videoElement.style.position = 'absolute'
    videoElement.style.inset = '0'

    container.appendChild(videoElement)

    return () => {
      if (container.contains(videoElement)) {
        container.removeChild(videoElement)
      }
    }
  }, [videoElement])

  // Draw skeleton using smoothed landmarks
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !landmarks) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, WIDTH, HEIGHT)

    // Draw connections
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'

    HAND_CONNECTIONS.forEach(([start, end]) => {
      if (!landmarks[start] || !landmarks[end]) return
      ctx.beginPath()
      ctx.moveTo(landmarks[start].x * WIDTH, landmarks[start].y * HEIGHT)
      ctx.lineTo(landmarks[end].x * WIDTH, landmarks[end].y * HEIGHT)
      ctx.stroke()
    })

    // Draw landmark points
    landmarks.forEach((lm) => {
      if (!lm) return
      ctx.fillStyle = '#ffff00'
      ctx.beginPath()
      ctx.arc(lm.x * WIDTH, lm.y * HEIGHT, 2.5, 0, Math.PI * 2)
      ctx.fill()
    })

    // Highlight index fingertip (landmark 8)
    if (landmarks[8]) {
      ctx.fillStyle = '#00ff88'
      ctx.beginPath()
      ctx.arc(landmarks[8].x * WIDTH, landmarks[8].y * HEIGHT, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [landmarks])

  const toggleVisible = useCallback(() => setVisible((v) => !v), [])

  if (!isEnabled) return null

  return (
    <>
      {/* Toggle button — always visible when gesture enabled */}
      <button
        onClick={toggleVisible}
        className="fixed bottom-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 transition-colors duration-200"
        title={visible ? '隐藏摄像头' : '显示摄像头'}
        style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}
      >
        {visible ? '\u{1F4F7}' : '\u{1F441}'}
      </button>

      {/* Camera preview */}
      {visible && (
        <div
          className="fixed bottom-14 right-4 rounded-lg overflow-hidden border border-white/15 z-40"
          style={{
            width: WIDTH,
            height: HEIGHT,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Video feed */}
          <div ref={videoContainerRef} className="absolute inset-0" />

          {/* Skeleton overlay */}
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            className="absolute inset-0"
          />

          {/* Gesture info overlay */}
          <div
            className="absolute top-1.5 left-1.5 px-2 py-1 rounded"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          >
            {/* Gesture label */}
            <div
              className="font-medium tracking-wider"
              style={{
                fontSize: '0.65rem',
                color: currentGesture === 'NONE' ? 'rgba(255,255,255,0.4)' : '#ffd700',
              }}
            >
              {GESTURE_LABELS[currentGesture]}
            </div>

            {/* Confidence percentage */}
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
              {(confidence * 100).toFixed(0)}%
            </div>

            {/* Confidence bar */}
            <div
              className="rounded-full overflow-hidden"
              style={{ width: 50, height: 3, background: 'rgba(255,255,255,0.1)', marginTop: 3 }}
            >
              <div
                style={{
                  width: `${Math.min(100, confidence * 100)}%`,
                  height: '100%',
                  background: getConfidenceColor(confidence),
                  transition: 'width 200ms ease, background-color 300ms ease',
                  borderRadius: 'inherit',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
