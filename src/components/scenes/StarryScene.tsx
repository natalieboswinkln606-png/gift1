'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  FogExp2,
  LinearFilter,
  NoToneMapping,
  Points,
  PointsMaterial,
  RGBAFormat,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import type { UserConfig } from '@/types'
import { useAppStore } from '@/stores/useAppStore'
import type { StarryParticleSystem } from '@/lib/three/StarryParticleSystem'
import type { HeartSceneSystem } from '@/lib/three/HeartSceneSystem'
import type { BackgroundStars } from '@/lib/three/BackgroundStars'
import type { SceneManager } from '@/lib/three/SceneManager'
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import type { PerformanceMonitor } from '@/lib/utils/PerformanceMonitor'

import { detectQuality, getQualityPreset } from '@/lib/utils/QualityDetector'
import { useAnimationLoop } from '@/hooks/useAnimationLoop'
import LoadingScreen from '@/components/ui/LoadingScreen'

interface StarrySceneProps {
  userId: string
  config: UserConfig
  renderer: WebGLRenderer
}

// 星轨子场景类型
type StarrySubScene = 'ORBIT' | 'HEART'

export default function StarryScene({ userId, config, renderer }: StarrySceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneManagerRef = useRef<SceneManager | null>(null)
  const particleSystemRef = useRef<StarryParticleSystem | null>(null)
  const heartSceneRef = useRef<HeartSceneSystem | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)
  const bgStarsRef = useRef<BackgroundStars | null>(null)
  const decorStarsRef = useRef<{ geo: BufferGeometry; mat: PointsMaterial; mesh: Points } | null>(null)
  const perfMonRef = useRef<PerformanceMonitor | null>(null)
  const subSceneRef = useRef<StarrySubScene>('ORBIT')
  const keydownRef = useRef<((e: KeyboardEvent) => void) | null>(null)

  const [loading, setLoading] = useState(true)
  const [currentSubScene, setCurrentSubScene] = useState<StarrySubScene>('ORBIT')
  const lastTimeRef = useRef(0)

  // 动画循环（useAnimationLoop 自动处理 RAF + paused + 卸载清理）
  useAnimationLoop(() => {
    const sm = sceneManagerRef.current
    const ps = particleSystemRef.current
    const hs = heartSceneRef.current
    const stars = bgStarsRef.current
    if (!sm || !ps || !stars) return

    const time = sm.clock.getElapsedTime()
    const dt = time - lastTimeRef.current
    lastTimeRef.current = time

    sm.controls.update()

    // 根据当前子场景更新对应系统
    if (subSceneRef.current === 'ORBIT') {
      ps.update(time, dt)
    } else {
      if (hs) hs.update(time, dt)
    }

    stars.update(time)

    // 运行时 FPS 监控
    perfMonRef.current?.update(dt)

    // ULTRA_LOW 禁用 bloom 时直接渲染，否则走 composer
    const composer = composerRef.current
    if (composer) {
      composer.render()
    } else {
      sm.renderer.render(sm.scene, sm.camera)
    }
  })

  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false

    async function initScene() {
      try {
        // 并行加载所有模块（消除串行 await 链，7 个 import 同时发起；HeartSceneSystem 延迟到切换时加载）
        const [
          { SceneManager },
          { StarryParticleSystem },
          { BackgroundStars },
          { EffectComposer },
          { RenderPass },
          { UnrealBloomPass },
          { PerformanceMonitor },
        ] = await Promise.all([
          import('@/lib/three/SceneManager'),
          import('@/lib/three/StarryParticleSystem'),
          import('@/lib/three/BackgroundStars'),
          import('three/examples/jsm/postprocessing/EffectComposer.js'),
          import('three/examples/jsm/postprocessing/RenderPass.js'),
          import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
          import('@/lib/utils/PerformanceMonitor'),
        ])

        if (disposed) return

        // 场景管理器
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
          console.log(`[StarryScene] 质量等级: ${qualityLevel}`, preset)
        }
        // 应用 pixelRatio 限制
        sm.renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatioMax))

        // 设置 toneMapping（共享 renderer 需要每个场景自行设置）
        sm.renderer.toneMapping = NoToneMapping
        sm.scene.background = new Color(0x000000)
        sm.scene.fog = new FogExp2(0x000000, 0.015)

        // 相机
        sm.camera.position.set(0, 8, 50)
        sm.camera.fov = 55
        sm.camera.updateProjectionMatrix()

        // 控制器
        sm.controls.target.set(0, 0, 0)
        sm.controls.enableRotate = true
        sm.controls.enablePan = true
        sm.controls.enableZoom = true
        sm.controls.autoRotate = false
        sceneManagerRef.current = sm

        // 第一场景：星轨粒子系统
        const qualityOpts = qualityLevel === 'ULTRA_LOW'
          ? { coreParticleCount: 400, particlesPerRing: 500 }
          : qualityLevel === 'LOW'
            ? { coreParticleCount: 800, particlesPerRing: 1000 }
            : undefined
        const ps = new StarryParticleSystem(
          sm.scene,
          sm.renderer,
          config.name,
          '愿每一秒的流转，都闪烁星辰之光。',
          qualityOpts,
        )
        particleSystemRef.current = ps

        // 第二场景：爱心场景系统（延迟初始化，切换到 HEART 时才创建）
        const decorStarGeo = new BufferGeometry()
        const decorStarPos = new Float32Array(800 * 3)
        for (let i = 0; i < 800 * 3; i++) {
          decorStarPos[i] = (Math.random() - 0.5) * 80
        }
        decorStarGeo.setAttribute('position', new BufferAttribute(decorStarPos, 3))
        // 预计算 bounding sphere 避免每帧自动计算
        decorStarGeo.computeBoundingSphere()
        const decorStarMat = new PointsMaterial({
          size: 0.04,
          color: 0xffaa00,
          transparent: true,
          opacity: 0.2,
        })
        const decorStars = new Points(decorStarGeo, decorStarMat)
        ps.orbitGroup.add(decorStars)
        decorStarsRef.current = { geo: decorStarGeo, mat: decorStarMat, mesh: decorStars }

        // Bloom（bloomScale=0 时完全禁用，直接 renderer.render 节省 ~50% GPU 开销）
        const bloomDisabled = preset.bloomScale === 0
        let composer: InstanceType<typeof EffectComposer> | null = null

        if (!bloomDisabled) {
          const bloomW = Math.floor(window.innerWidth * preset.bloomScale)
          const bloomH = Math.floor(window.innerHeight * preset.bloomScale)
          const bloomRT = new WebGLRenderTarget(bloomW, bloomH, {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
          })
          composer = new EffectComposer(sm.renderer, bloomRT)
          composer.addPass(new RenderPass(sm.scene, sm.camera))

          const bloomPass = new UnrealBloomPass(
            new Vector2(bloomW, bloomH),
            1.5, 0.4, 0.85
          )
          bloomPass.threshold = 0.1
          bloomPass.strength = 1.8
          bloomPass.radius = 0.6
          composer.addPass(bloomPass)
          composerRef.current = composer

          sm.onResize((w, h) => composer!.setSize(
            Math.floor(w * preset.bloomScale),
            Math.floor(h * preset.bloomScale)
          ))
        }

        // 远景背景星点
        const stars = new BackgroundStars(sm.scene, preset.bgStarCount)
        bgStarsRef.current = stars

        // 运行时 FPS 监控（PerformanceMonitor 已在首批 Promise.all 中并行加载）
        const perfMon = new PerformanceMonitor(qualityLevel)
        perfMon.setOnQualityChange((q) => {
          useAppStore.getState().setQuality(q)
        })
        perfMonRef.current = perfMon

        if (disposed) return

        // 场景切换：完全隔离两个子场景
        const switchSubScene = async (target: StarrySubScene) => {
          if (subSceneRef.current === target) return
          subSceneRef.current = target

          if (target === 'ORBIT') {
            // 切换到星轨：显示星轨场景，隐藏爱心场景
            ps.visible = true
            decorStars.visible = true
            const hs = heartSceneRef.current
            if (hs) hs.visible = false
            sm.camera.position.set(0, 8, 50)
            sm.controls.target.set(0, 0, 0)
          } else {
            // 切换到爱心：延迟初始化 HeartSceneSystem（首次切换时才创建）
            if (!heartSceneRef.current) {
              const { HeartSceneSystem } = await import('@/lib/three/HeartSceneSystem')
              // await 后重新校验：组件可能已卸载，或用户已切回 ORBIT
              if (disposed || subSceneRef.current !== 'HEART') return
              const hs = new HeartSceneSystem(sm.scene, sm.renderer, config, userId)
              heartSceneRef.current = hs
            }
            // 隐藏星轨场景所有元素，显示爱心场景
            ps.visible = false
            decorStars.visible = false
            heartSceneRef.current.visible = true
            sm.camera.position.set(0, 5, 63.75)
            sm.controls.target.set(0, 0, 0)
          }
        }

        // 键盘事件：1=星轨，2=爱心
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key === '1') {
            switchSubScene('ORBIT')
            setCurrentSubScene('ORBIT')
          } else if (e.key === '2') {
            switchSubScene('HEART')
            setCurrentSubScene('HEART')
          }
        }
        window.addEventListener('keydown', onKeyDown)
        keydownRef.current = onKeyDown

        setLoading(false)
      } catch (err) {
        console.error('[StarryScene] Failed to init:', err)
        setLoading(false)
      }
    }

    initScene()

    return () => {
      disposed = true
      if (keydownRef.current) {
        window.removeEventListener('keydown', keydownRef.current)
        keydownRef.current = null
      }
      bgStarsRef.current?.dispose()
      bgStarsRef.current = null
      if (decorStarsRef.current) {
        decorStarsRef.current.geo.dispose()
        decorStarsRef.current.mat.dispose()
        decorStarsRef.current.mesh.removeFromParent()
        decorStarsRef.current = null
      }
      composerRef.current?.dispose()
      composerRef.current = null
      // 重置 render target 绑定，避免下一个场景渲染到已释放的 RT
      if (sceneManagerRef.current) {
        sceneManagerRef.current.renderer.setRenderTarget(null)
      }
      heartSceneRef.current?.dispose()
      heartSceneRef.current = null
      particleSystemRef.current?.dispose()
      particleSystemRef.current = null
      sceneManagerRef.current?.dispose()
      sceneManagerRef.current = null
    }
  }, [config, userId])

  const handleBack = useCallback(() => {
    useAppStore.getState().setAppState('SELECTOR')
  }, [])

  return (
    <>
      <LoadingScreen visible={loading} />
      <div ref={containerRef} className="absolute inset-0" />
      {/* 返回按钮 */}
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
      {/* 场景指示器 */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3
                      pointer-events-none select-none">
        <span className={`text-xs tracking-[3px] transition-all duration-500 ${
          currentSubScene === 'ORBIT'
            ? 'text-amber-300/80 scale-110'
            : 'text-white/25 scale-100'
        }`}>
          1 · 星轨
        </span>
        <span className="text-white/15 text-xs">|</span>
        <span className={`text-xs tracking-[3px] transition-all duration-500 ${
          currentSubScene === 'HEART'
            ? 'text-amber-300/80 scale-110'
            : 'text-white/25 scale-100'
        }`}>
          2 · 爱心
        </span>
      </div>
    </>
  )
}
