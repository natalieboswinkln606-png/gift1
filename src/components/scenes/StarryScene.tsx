'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import type { UserConfig } from '@/types'
import { useAppStore } from '@/stores/useAppStore'
import type { StarryParticleSystem } from '@/lib/three/StarryParticleSystem'
import type { HeartSceneSystem } from '@/lib/three/HeartSceneSystem'
import type { BackgroundStars } from '@/lib/three/BackgroundStars'
import type { SceneManager } from '@/lib/three/SceneManager'
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'

import LoadingScreen from '@/components/ui/LoadingScreen'

interface StarrySceneProps {
  userId: string
  config: UserConfig
}

// 星轨子场景类型
type StarrySubScene = 'ORBIT' | 'HEART'

export default function StarryScene({ userId, config }: StarrySceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneManagerRef = useRef<SceneManager | null>(null)
  const particleSystemRef = useRef<StarryParticleSystem | null>(null)
  const heartSceneRef = useRef<HeartSceneSystem | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)
  const bgStarsRef = useRef<BackgroundStars | null>(null)
  const decorStarsRef = useRef<{ geo: THREE.BufferGeometry; mat: THREE.PointsMaterial; mesh: THREE.Points } | null>(null)
  const subSceneRef = useRef<StarrySubScene>('ORBIT')
  const keydownRef = useRef<((e: KeyboardEvent) => void) | null>(null)

  const [loading, setLoading] = useState(true)
  const [currentSubScene, setCurrentSubScene] = useState<StarrySubScene>('ORBIT')

  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false
    let rafId = 0

    async function initScene() {
      try {
        const { SceneManager } = await import('@/lib/three/SceneManager')
        const { StarryParticleSystem } = await import('@/lib/three/StarryParticleSystem')
        const { HeartSceneSystem } = await import('@/lib/three/HeartSceneSystem')
        const { BackgroundStars } = await import('@/lib/three/BackgroundStars')
        const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js')
        const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js')
        const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js')

        if (disposed) return

        // 场景管理器
        const sm = new SceneManager(containerRef.current!)
        sm.scene.background = new THREE.Color(0x000000)
        sm.scene.fog = new THREE.FogExp2(0x000000, 0.015)

        // 相机
        sm.camera.position.set(0, 8, 50)
        sm.camera.fov = 55
        sm.camera.updateProjectionMatrix()

        // 渲染器
        sm.renderer.toneMapping = THREE.NoToneMapping

        // 控制器
        sm.controls.target.set(0, 0, 0)
        sm.controls.enableRotate = true
        sm.controls.enablePan = true
        sm.controls.enableZoom = true
        sm.controls.autoRotate = false
        sceneManagerRef.current = sm

        // 第一场景：星轨粒子系统
        const ps = new StarryParticleSystem(
          sm.scene,
          sm.renderer,
          config.name,
          '愿每一秒的流转，都闪烁星辰之光。',
        )
        particleSystemRef.current = ps

        // 第二场景：爱心场景系统
        const hs = new HeartSceneSystem(
          sm.scene,
          sm.renderer,
          config,
          userId,
        )
        heartSceneRef.current = hs

        // 近景金色装饰星点
        const decorStarGeo = new THREE.BufferGeometry()
        const decorStarPos = new Float32Array(800 * 3)
        for (let i = 0; i < 800 * 3; i++) {
          decorStarPos[i] = (Math.random() - 0.5) * 80
        }
        decorStarGeo.setAttribute('position', new THREE.BufferAttribute(decorStarPos, 3))
        // 预计算 bounding sphere 避免每帧自动计算
        decorStarGeo.computeBoundingSphere()
        const decorStarMat = new THREE.PointsMaterial({
          size: 0.04,
          color: 0xffaa00,
          transparent: true,
          opacity: 0.2,
        })
        const decorStars = new THREE.Points(decorStarGeo, decorStarMat)
        sm.scene.add(decorStars)
        decorStarsRef.current = { geo: decorStarGeo, mat: decorStarMat, mesh: decorStars }

        // Bloom
        const composer = new EffectComposer(sm.renderer)
        composer.addPass(new RenderPass(sm.scene, sm.camera))

        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          1.5, 0.4, 0.85
        )
        bloomPass.threshold = 0.1
        bloomPass.strength = 1.8
        bloomPass.radius = 0.6
        composer.addPass(bloomPass)
        composerRef.current = composer

        sm.onResize((w, h) => composer.setSize(w, h))

        // 远景背景星点
        const stars = new BackgroundStars(sm.scene, 8000)
        bgStarsRef.current = stars

        if (disposed) return

        // 场景切换：完全隔离两个子场景
        const switchSubScene = (target: StarrySubScene) => {
          if (subSceneRef.current === target) return
          subSceneRef.current = target

          if (target === 'ORBIT') {
            // 切换到星轨：显示星轨场景，隐藏爱心场景
            ps.visible = true
            decorStars.visible = true
            hs.visible = false
            sm.camera.position.set(0, 8, 50)
            sm.controls.target.set(0, 0, 0)
          } else {
            // 切换到爱心：隐藏星轨场景所有元素，显示爱心场景
            ps.visible = false
            decorStars.visible = false
            hs.visible = true
            sm.camera.position.set(0, 5, 85)
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

        // 动画循环
        const clock = sm.clock
        let lastTime = 0
        const animate = () => {
          if (disposed) return
          rafId = requestAnimationFrame(animate)

          const time = clock.getElapsedTime()
          const dt = time - lastTime
          lastTime = time

          sm.controls.update()

          // 根据当前子场景更新对应系统
          if (subSceneRef.current === 'ORBIT') {
            ps.update(time, dt)
          } else {
            hs.update(time, dt)
          }

          stars.update(time)
          composer.render()
        }

        rafId = requestAnimationFrame(animate)
        setLoading(false)
      } catch (err) {
        console.error('[StarryScene] Failed to init:', err)
        setLoading(false)
      }
    }

    initScene()

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
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
      composerRef.current?.renderTarget1?.dispose()
      composerRef.current?.renderTarget2?.dispose()
      composerRef.current?.dispose()
      composerRef.current = null
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
      <div ref={containerRef} className="w-full h-full" />
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
