'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import type { UserConfig, SceneMode } from '@/types'
import { useAppStore } from '@/stores/useAppStore'
import type { SceneManager } from '@/lib/three/SceneManager'
import type { ParticleSystem } from '@/lib/three/ParticleSystem'
import type { SelectiveBloom } from '@/lib/three/SelectiveBloom'
import type { BackgroundStars } from '@/lib/three/BackgroundStars'
import type { StarBuilder } from '@/lib/three/StarBuilder'
import type { PhotoSystem } from '@/lib/three/PhotoSystem'
import type { AudioEngine } from '@/lib/audio/AudioEngine'
import type { SnowCanvas } from '@/lib/three/SnowCanvas'

import SceneControls from '@/components/ui/SceneControls'
import LoadingScreen from '@/components/ui/LoadingScreen'
import MusicPlayer from '@/components/ui/MusicPlayer'

interface ChristmasSceneProps {
  userId: string
  config: UserConfig
}

export default function ChristmasScene({ userId, config }: ChristmasSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Three.js system refs
  const sceneManagerRef = useRef<SceneManager | null>(null)
  const particleSystemRef = useRef<ParticleSystem | null>(null)
  const selectiveBloomRef = useRef<SelectiveBloom | null>(null)
  const bgStarsRef = useRef<BackgroundStars | null>(null)
  const starBuilderRef = useRef<StarBuilder | null>(null)
  const photoSystemRef = useRef<PhotoSystem | null>(null)
  const audioEngineRef = useRef<AudioEngine | null>(null)

  // SnowCanvas ref
  const snowCanvasRef = useRef<SnowCanvas | null>(null)

  // Raycaster for mouse picking
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseNDC = useRef(new THREE.Vector2())

  const [loading, setLoading] = useState(true)
  const [currentMode, setCurrentMode] = useState<SceneMode>('TREE')
  const [drawingActive, setDrawingActive] = useState(false)

  // Track mouse drawing state via ref
  const mouseDrawingRef = useRef(false)
  // Track mode before photo activation (to restore on close)
  const modeBeforePhotoRef = useRef<SceneMode | null>(null)
  // Track previous activePhoto to detect changes in animation loop
  const prevActivePhotoRef = useRef<THREE.Mesh | null>(null)

  // ============================================================
  // Initialize Three.js scene + SnowCanvas
  // ============================================================
  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false
    let rafId = 0

    async function initScene() {
      try {
        const { SceneManager } = await import('@/lib/three/SceneManager')
        const { ParticleSystem } = await import('@/lib/three/ParticleSystem')
        const { SelectiveBloom } = await import('@/lib/three/SelectiveBloom')
        const { BackgroundStars } = await import('@/lib/three/BackgroundStars')
        const { StarBuilder } = await import('@/lib/three/StarBuilder')
        const { PhotoSystem } = await import('@/lib/three/PhotoSystem')
        const { AudioEngine } = await import('@/lib/audio/AudioEngine')
        const { SnowCanvas } = await import('@/lib/three/SnowCanvas')

        if (disposed) return

        // Scene manager
        const sm = new SceneManager(containerRef.current!)
        sm.scene.background = new THREE.Color('#000510')
        sm.scene.fog = new THREE.FogExp2(0x050202, 0.003)
        sm.camera.position.set(0, 40, 110)
        // Look at lower-third of tree (treeHeight=85, 85/3≈28)
        sm.controls.target.set(0, 28, 0)
        sceneManagerRef.current = sm

        // Lights
        const ambient = new THREE.AmbientLight(0x112244, 0.3)
        sm.scene.add(ambient)
        const hemi = new THREE.HemisphereLight(0x001133, 0x000000, 0.4)
        sm.scene.add(hemi)

        // Particle system (45000 particles)
        const ps = new ParticleSystem(sm.scene, undefined, config.name)
        particleSystemRef.current = ps

        // Selective bloom
        const bloom = new SelectiveBloom(sm.renderer, sm.scene, sm.camera)
        selectiveBloomRef.current = bloom
        sm.onResize((w, h) => bloom.resize(w, h))

        // Background stars
        const stars = new BackgroundStars(sm.scene, 8000)
        bgStarsRef.current = stars

        // Tree-top star
        const star = new StarBuilder(sm.scene)
        starBuilderRef.current = star

        // Photo system
        const photos = new PhotoSystem(sm.scene)
        await photos.loadFromConfig(config, userId)
        ps.setPhotoGroup(photos.photoGroup)
        photoSystemRef.current = photos

        // Audio engine
        const audio = new AudioEngine()
        audio.setPlaylist([{ name: 'Harbor', url: '/music/Harbor.mp3' }])
        audioEngineRef.current = audio

        // SnowCanvas (painting system)
        const snow = new SnowCanvas(containerRef.current!)
        snow.setOnComplete(() => {
          setDrawingActive(false)
          setCurrentMode(ps.state.mode)
          if (sm.controls) sm.controls.enabled = true
        })
        snowCanvasRef.current = snow

        if (disposed) return

        // 动画循环
        let lastTime = 0
        const animate = () => {
          if (disposed) return
          rafId = requestAnimationFrame(animate)

          if (!sceneManagerRef.current) return
          const time = sm.clock.getElapsedTime()
          const dt = time - lastTime
          lastTime = time
          const isTree = ps.state.mode === 'TREE'

          // Auto-switch to SCATTER when a photo becomes active
          const curActive = photos.activePhoto
          const prevActive = prevActivePhotoRef.current
          if (curActive && !prevActive) {
            // Photo just activated — save current mode and switch to SCATTER
            modeBeforePhotoRef.current = ps.state.mode as SceneMode
            if (ps.state.mode !== 'SCATTER') {
              ps.setTargetMode('SCATTER')
              setCurrentMode('SCATTER')
            }
          } else if (!curActive && prevActive) {
            // Photo just closed — restore previous mode
            const restoreMode = modeBeforePhotoRef.current
            if (restoreMode && restoreMode !== ps.state.mode) {
              ps.setTargetMode(restoreMode)
              setCurrentMode(restoreMode)
            }
            modeBeforePhotoRef.current = null
          }
          prevActivePhotoRef.current = curActive

          audio.update()
          sm.controls.update()
          ps.update(dt, time, audio)
          photos.update(time, isTree, sm.camera, sm.controls)
          star.update(time, isTree, 85)
          stars.update(time)

          // Pass active photo as overlay so it renders after bloom (avoids glow bleed)
          const overlayMeshes = photos.activePhoto ? [photos.activePhoto] : undefined
          bloom.render(overlayMeshes)
        }

        rafId = requestAnimationFrame(animate)
        setLoading(false)
      } catch (err) {
        console.error('[ChristmasScene] Failed to init:', err)
        setLoading(false)
      }
    }

    initScene()

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)

      snowCanvasRef.current?.dispose()
      snowCanvasRef.current = null
      audioEngineRef.current?.dispose()
      audioEngineRef.current = null
      photoSystemRef.current?.dispose()
      photoSystemRef.current = null
      starBuilderRef.current?.dispose()
      starBuilderRef.current = null
      bgStarsRef.current?.dispose()
      bgStarsRef.current = null
      selectiveBloomRef.current?.dispose()
      selectiveBloomRef.current = null
      particleSystemRef.current?.dispose()
      particleSystemRef.current = null
      sceneManagerRef.current?.dispose()
      sceneManagerRef.current = null
    }
  }, [config, userId])

  // ============================================================
  // Helper: enter/exit painting mode
  // ============================================================
  const enterPaintMode = useCallback(() => {
    const snow = snowCanvasRef.current
    if (!snow || snow.getState() !== 'IDLE') return
    snow.startSnowstorm()
    setDrawingActive(true)
    setCurrentMode('TREE') // keep underlying mode, just overlay
    // Disable OrbitControls during painting
    if (sceneManagerRef.current?.controls) {
      sceneManagerRef.current.controls.enabled = false
    }
  }, [])

  const exitPaintMode = useCallback(() => {
    const snow = snowCanvasRef.current
    if (!snow) return
    const state = snow.getState()
    if (state === 'DRAWING' || state === 'SNOWSTORM') {
      snow.forceExit()
    }
    setDrawingActive(false)
    const ps = particleSystemRef.current
    if (ps) setCurrentMode(ps.state.mode)
    if (sceneManagerRef.current?.controls) {
      sceneManagerRef.current.controls.enabled = true
    }
  }, [])

  // ============================================================
  // Keyboard controls (expanded)
  // ============================================================
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const ps = particleSystemRef.current
      const photos = photoSystemRef.current
      const snow = snowCanvasRef.current
      if (!ps) return

      const isInPaintMode = snow && (snow.getState() === 'DRAWING' || snow.getState() === 'SNOWSTORM')

      // Escape always exits paint mode first, then dismisses photo
      if (e.key === 'Escape') {
        if (isInPaintMode) {
          exitPaintMode()
          return
        }
        photos?.closeActivePhoto()
        return
      }

      // In paint mode, only Escape and brush size keys work
      if (isInPaintMode) {
        if (e.key === '+' || e.key === '=') {
          snow.setBrushSize(Math.min((snow.brushSize ?? 40) + 10, 80))
        } else if (e.key === '-' || e.key === '_') {
          snow.setBrushSize(Math.max((snow.brushSize ?? 40) - 10, 10))
        }
        return
      }

      switch (e.key) {
        case '1':
          ps.setTargetMode('TREE')
          setCurrentMode('TREE')
          photos?.closeActivePhoto()
          break
        case '2':
          ps.setTargetMode('SCATTER')
          setCurrentMode('SCATTER')
          photos?.closeActivePhoto()
          break
        case '3':
          ps.setTargetMode('SCATTER')
          setCurrentMode('SCATTER')
          if (!photos?.hasActivePhoto() && photos && photos.photos.length > 0) {
            photos.setActivePhoto(photos.photos[0])
          }
          break
        case '5':
          ps.setTargetMode('HEART')
          setCurrentMode('HEART')
          photos?.closeActivePhoto()
          break
        case 'ArrowRight':
          if (ps.state.mode !== 'SCATTER') {
            ps.setTargetMode('SCATTER')
            setCurrentMode('SCATTER')
          }
          photos?.nextPhoto()
          break
        case 'ArrowLeft':
          if (ps.state.mode !== 'SCATTER') {
            ps.setTargetMode('SCATTER')
            setCurrentMode('SCATTER')
          }
          photos?.prevPhoto()
          break
        case 'p':
        case 'P':
          enterPaintMode()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enterPaintMode, exitPaintMode])

  // ============================================================
  // Mouse: click to select/dismiss photos + drawing
  // ============================================================
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function handleClick(e: MouseEvent) {
      const photos = photoSystemRef.current
      const sm = sceneManagerRef.current
      const snow = snowCanvasRef.current
      const container = containerRef.current
      if (!photos || !sm || !container) return

      // Don't handle photo clicks when in paint mode
      const isInPaintMode = snow && (snow.getState() === 'DRAWING' || snow.getState() === 'SNOWSTORM')
      if (isInPaintMode) return

      // If a photo is active, click anywhere to dismiss
      if (photos.hasActivePhoto()) {
        photos.closeActivePhoto()
        return
      }

      // Raycast to find clicked photo (auto-switches to SCATTER via animation loop)
      const rect = container.getBoundingClientRect()
      mouseNDC.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseNDC.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycasterRef.current.setFromCamera(mouseNDC.current, sm.camera)
      const targets = photos.getAllRaycastTargets()
      const intersects = raycasterRef.current.intersectObjects(targets, false)

      if (intersects.length > 0) {
        const frame = photos.findFrameForObject(intersects[0].object)
        if (frame) {
          photos.setActivePhoto(frame)
        }
      }
    }

    // Mouse drawing handlers
    function handleMouseDown(e: MouseEvent) {
      const snow = snowCanvasRef.current
      if (!snow || snow.getState() !== 'DRAWING') return
      if (e.button !== 0) return

      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      snow.startDrawing(e.clientX - rect.left, e.clientY - rect.top)
      mouseDrawingRef.current = true
    }

    function handleMouseMove(e: MouseEvent) {
      if (!mouseDrawingRef.current) return
      const snow = snowCanvasRef.current
      if (!snow || snow.getState() !== 'DRAWING') return

      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      snow.draw(e.clientX - rect.left, e.clientY - rect.top)
    }

    function handleMouseUp() {
      if (!mouseDrawingRef.current) return
      const snow = snowCanvasRef.current
      if (snow) snow.stopDrawing()
      mouseDrawingRef.current = false
    }

    el.addEventListener('click', handleClick)
    el.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      el.removeEventListener('click', handleClick)
      el.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // ============================================================
  // Back to selector
  // ============================================================
  const handleBack = useCallback(() => {
    exitPaintMode()
    photoSystemRef.current?.closeActivePhoto()
    useAppStore.getState().setAppState('SELECTOR')
  }, [exitPaintMode])

  return (
    <>
      <LoadingScreen visible={loading} />

      {/* Three.js container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Music player */}
      <MusicPlayer audioEngine={audioEngineRef.current} />

      {/* Scene controls */}
      <SceneControls />

      {/* Drawing mode exit button */}
      {drawingActive && (
        <>
          <button
            onClick={exitPaintMode}
            className="fixed top-4 right-4 z-[100] w-8 h-8 flex items-center justify-center
                       rounded-full bg-white/15 backdrop-blur-sm border border-white/25
                       text-white/70 hover:text-white hover:bg-white/30
                       transition-colors duration-200 text-sm"
            aria-label="退出绘画"
          >
            ✕
          </button>
        </>
      )}

      {/* Back button */}
      <button
        onClick={handleBack}
        className="fixed top-4 left-16 z-40 w-8 h-8 flex items-center justify-center
                   rounded-full bg-white/10 backdrop-blur-sm border border-white/20
                   text-white/40 hover:text-white hover:bg-white/20
                   transition-colors duration-300 text-xs"
        aria-label="返回选择"
      >
        ←
      </button>
    </>
  )
}
