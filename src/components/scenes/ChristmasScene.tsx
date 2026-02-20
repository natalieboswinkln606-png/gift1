'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  FogExp2,
  HemisphereLight,
  Mesh,
  Raycaster,
  Vector2,
  WebGLRenderer,
} from 'three'
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
import type { PerformanceMonitor } from '@/lib/utils/PerformanceMonitor'

import { useAnimationLoop } from '@/hooks/useAnimationLoop'
import { detectQuality, getQualityPreset } from '@/lib/utils/QualityDetector'
import SceneControls from '@/components/ui/SceneControls'
import LoadingScreen from '@/components/ui/LoadingScreen'
import MusicPlayer from '@/components/ui/MusicPlayer'

interface ChristmasSceneProps {
  userId: string
  config: UserConfig
  renderer: WebGLRenderer
}

export default function ChristmasScene({ userId, config, renderer }: ChristmasSceneProps) {
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
  const perfMonRef = useRef<PerformanceMonitor | null>(null)

  // Raycaster for mouse picking
  const raycasterRef = useRef(new Raycaster())
  const mouseNDC = useRef(new Vector2())

  const [loading, setLoading] = useState(true)
  const [currentMode, setCurrentMode] = useState<SceneMode>('TREE')
  const [drawingActive, setDrawingActive] = useState(false)
  // 用 state 追踪 audioEngine 以触发重渲染，解决 ref 不触发重渲染导致 MusicPlayer 收到 null 的问题
  const [audioReady, setAudioReady] = useState(false)

  // Track mouse drawing state via ref
  const mouseDrawingRef = useRef(false)
  // Track mode before photo activation (to restore on close)
  const modeBeforePhotoRef = useRef<SceneMode | null>(null)
  // Track previous activePhoto to detect changes in animation loop
  const prevActivePhotoRef = useRef<Mesh | null>(null)
  const lastTimeRef = useRef(0)

  // 动画循环（useAnimationLoop 自动处理 RAF + paused + 卸载清理）
  useAnimationLoop(() => {
    const sm = sceneManagerRef.current
    const ps = particleSystemRef.current
    const photos = photoSystemRef.current
    const audio = audioEngineRef.current
    const star = starBuilderRef.current
    const stars = bgStarsRef.current
    const bloom = selectiveBloomRef.current
    if (!sm || !ps || !photos || !audio || !star || !stars || !bloom) return

    const time = sm.clock.getElapsedTime()
    const dt = time - lastTimeRef.current
    lastTimeRef.current = time
    const isTree = ps.state.mode === 'TREE'

    // Auto-switch to SCATTER when a photo becomes active
    const curActive = photos.activePhoto
    const prevActive = prevActivePhotoRef.current
    if (curActive && !prevActive) {
      modeBeforePhotoRef.current = ps.state.mode as SceneMode
      if (ps.state.mode !== 'SCATTER') {
        ps.setTargetMode('SCATTER')
        setCurrentMode('SCATTER')
      }
    } else if (!curActive && prevActive) {
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

    // 运行时 FPS 监控
    perfMonRef.current?.update(dt)

    photos.update(time, isTree, sm.camera, sm.controls)
    star.update(time, isTree, 85)
    stars.update(time)

    // Pass active photo as overlay so it renders after bloom (avoids glow bleed)
    const overlayMeshes = photos.activePhoto ? [photos.activePhoto] : undefined
    bloom.render(overlayMeshes)
  })

  // ============================================================
  // Initialize Three.js scene + SnowCanvas
  // ============================================================
  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false

    async function initScene() {
      try {
        // 并行加载所有模块（消除串行 await 链，8 个 import 同时发起）
        const [
          { SceneManager },
          { ParticleSystem },
          { SelectiveBloom },
          { BackgroundStars },
          { StarBuilder },
          { PhotoSystem },
          { AudioEngine },
          { SnowCanvas },
        ] = await Promise.all([
          import('@/lib/three/SceneManager'),
          import('@/lib/three/ParticleSystem'),
          import('@/lib/three/SelectiveBloom'),
          import('@/lib/three/BackgroundStars'),
          import('@/lib/three/StarBuilder'),
          import('@/lib/three/PhotoSystem'),
          import('@/lib/audio/AudioEngine'),
          import('@/lib/three/SnowCanvas'),
        ])

        if (disposed) return

        // Scene manager
        const sm = new SceneManager(containerRef.current!, renderer)

        // 防御性重置：确保共享 renderer 处于干净状态（上一个场景的 EffectComposer 可能残留 WebGL 状态）
        renderer.setRenderTarget(null)
        renderer.state.reset()
        renderer.clear()

        // 检测设备性能等级
        const qualityLevel = detectQuality(sm.renderer)
        const preset = getQualityPreset(qualityLevel)
        // 质量等级日志（仅开发环境）
        if (process.env.NODE_ENV === 'development') {
          console.log(`[ChristmasScene] 质量等级: ${qualityLevel}`, preset)
        }

        // 根据质量预设重设像素比
        sm.renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatioMax))

        // 设置 toneMapping（共享 renderer 需要每个场景自行设置）
        sm.renderer.toneMapping = ACESFilmicToneMapping
        sm.renderer.toneMappingExposure = 0.9

        sm.scene.background = new Color('#000510')
        sm.scene.fog = new FogExp2(0x050202, 0.003)
        sm.camera.position.set(0, 40, 110)
        // Look at lower-third of tree (treeHeight=85, 85/3≈28)
        sm.controls.target.set(0, 28, 0)
        sceneManagerRef.current = sm
        sm.controls.autoRotate = false  // 圣诞场景关闭相机自转

        // Lights
        const ambient = new AmbientLight(0x112244, 0.3)
        sm.scene.add(ambient)
        const hemi = new HemisphereLight(0x001133, 0x000000, 0.4)
        sm.scene.add(hemi)

        // Particle system
        const ps = new ParticleSystem(sm.scene, { count: preset.particleCount, trunkCount: preset.trunkCount }, config.name)
        particleSystemRef.current = ps

        // Selective bloom
        const bloom = new SelectiveBloom(sm.renderer, sm.scene, sm.camera, preset.bloomScale)
        selectiveBloomRef.current = bloom
        sm.onResize((w, h) => bloom.resize(w, h))

        // Background stars
        const stars = new BackgroundStars(sm.scene, preset.bgStarCount)
        bgStarsRef.current = stars

        // Tree-top star
        const star = new StarBuilder(sm.scene)
        starBuilderRef.current = star

        // Photo system + Audio engine — 并行加载照片和音乐列表（消除串行网络等待）
        const photos = new PhotoSystem(sm.scene)
        const audio = new AudioEngine()

        const [, musicResult] = await Promise.all([
          photos.loadFromConfig(config, userId),
          fetch('/music.json')
            .then(r => r.ok ? r.json() as Promise<Array<{ name: string; url: string }>> : null)
            .catch(() => null),
        ])

        ps.setPhotoGroup(photos.photoGroup)
        photoSystemRef.current = photos

        if (musicResult && musicResult.length > 0) {
          audio.setPlaylist(musicResult)
        } else {
          audio.setPlaylist([{ name: 'Harbor', url: '/music/Harbor.mp3' }])
        }
        audioEngineRef.current = audio
        setAudioReady(true)

        // SnowCanvas (painting system) — 低端设备降低 backdrop-filter blur
        const blurAmount = qualityLevel === 'ULTRA_LOW' ? 0 : qualityLevel === 'LOW' ? 6 : 15
        const snow = new SnowCanvas(containerRef.current!, blurAmount)
        snow.setOnComplete(() => {
          setDrawingActive(false)
          setCurrentMode(ps.state.mode)
          if (sm.controls) sm.controls.enabled = true
        })
        snowCanvasRef.current = snow

        // 运行时 FPS 监控（ULTRA_LOW 设备跳过动态调整）
        const { PerformanceMonitor } = await import('@/lib/utils/PerformanceMonitor')
        const perfMon = new PerformanceMonitor(qualityLevel)
        perfMon.setOnQualityChange((q) => {
          useAppStore.getState().setQuality(q)
        })
        perfMonRef.current = perfMon

        if (disposed) {
          // 异步加载期间组件已卸载，清理刚创建但未赋给 ref 的对象
          snow.dispose()
          photos.dispose()
          audio.dispose()
          return
        }

        setLoading(false)
      } catch (err) {
        console.error('[ChristmasScene] Failed to init:', err)
        setLoading(false)
      }
    }

    initScene()

    return () => {
      disposed = true

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

      {/* Three.js container — absolute 定位确保填满父容器并接收 OrbitControls 事件 */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Music player — audioReady 触发重渲染确保 ref 非 null */}
      {audioReady && <MusicPlayer audioEngine={audioEngineRef.current} />}

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
