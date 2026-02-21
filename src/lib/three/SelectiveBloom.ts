import {
  Camera,
  Layers,
  LinearFilter,
  Material,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  Object3D,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

export const BLOOM_LAYER = 1

export class SelectiveBloom {
  private bloomComposer: EffectComposer | null = null
  private finalComposer: EffectComposer | null = null
  private bloomLayer = new Layers()
  private materials = new WeakMap<Object3D, Material | Material[]>()
  private scene: Scene
  private renderer: WebGLRenderer
  private camera: Camera
  private darkMaterial: MeshBasicMaterial
  private mixShader: ShaderMaterial | null = null
  private bloomPass!: UnrealBloomPass
  private bloomScale: number
  private nonBloomMeshes: Mesh[] = []
  private cacheValid = false
  private ultraLowMode = false  // ULTRA_LOW 模式：单 pass bloom
  private ultraLowComposer: EffectComposer | null = null  // ULTRA_LOW 单 pass composer

  constructor(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    bloomScale = 1.0
  ) {
    this.scene = scene
    this.renderer = renderer
    this.camera = camera
    this.bloomScale = Math.max(0.125, Math.min(1.0, bloomScale))
    this.ultraLowMode = bloomScale <= 0.5
    this.bloomLayer.set(BLOOM_LAYER)
    this.darkMaterial = new MeshBasicMaterial({ color: 'black' })

    // Bloom 可以在低分辨率下渲染（bloom 本身就是模糊效果，降分辨率对视觉影响极小）
    const bloomW = Math.floor(window.innerWidth * this.bloomScale)
    const bloomH = Math.floor(window.innerHeight * this.bloomScale)

    if (this.ultraLowMode) {
      // ULTRA_LOW 模式：只创建单 composer，跳过 bloomComposer/finalComposer/mixShader
      // 节省 ~2-4MB GPU 内存（render targets + shader programs）
      const bloomPass = new UnrealBloomPass(
        new Vector2(bloomW, bloomH),
        0.4, 0.3, 0.85
      )
      this.bloomPass = bloomPass
      const ulComposer = new EffectComposer(renderer)
      ulComposer.addPass(new RenderPass(scene, camera))
      ulComposer.addPass(bloomPass)
      ulComposer.addPass(new OutputPass())
      this.ultraLowComposer = ulComposer
    } else {
      // 标准 selective bloom pipeline
      const renderPass1 = new RenderPass(scene, camera)
      const bloomPass = new UnrealBloomPass(
        new Vector2(bloomW, bloomH),
        0.4, 0.3, 0.85
      )
      this.bloomPass = bloomPass

      const bloomRT = new WebGLRenderTarget(bloomW, bloomH, {
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        format: RGBAFormat,
      })
      this.bloomComposer = new EffectComposer(renderer, bloomRT)
      this.bloomComposer.renderToScreen = false
      this.bloomComposer.addPass(renderPass1)
      this.bloomComposer.addPass(bloomPass)

      // Mix shader
      this.mixShader = new ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: this.bloomComposer.renderTarget2.texture },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D baseTexture;
          uniform sampler2D bloomTexture;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(baseTexture, vUv) + vec4(0.5) * texture2D(bloomTexture, vUv);
          }
        `,
      })

      const mixPass = new ShaderPass(this.mixShader, 'baseTexture')
      mixPass.needsSwap = true

      // Final composer
      const renderPass2 = new RenderPass(scene, camera)
      this.finalComposer = new EffectComposer(renderer)
      this.finalComposer.addPass(renderPass2)
      this.finalComposer.addPass(mixPass)
      this.finalComposer.addPass(new OutputPass())
    }
  }

  // 当场景对象发生增删时调用，使缓存失效
  invalidateCache(): void {
    this.cacheValid = false
    this.nonBloomMeshes.length = 0
  }

  private ensureCache(): void {
    if (this.cacheValid) return
    this.nonBloomMeshes.length = 0
    this.scene.traverse((obj) => {
      if ((obj as Mesh).isMesh && !this.bloomLayer.test(obj.layers)) {
        this.nonBloomMeshes.push(obj as Mesh)
      }
    })
    this.cacheValid = true
  }

  private darkenCached(): void {
    for (const mesh of this.nonBloomMeshes) {
      this.materials.set(mesh, mesh.material)
      mesh.material = this.darkMaterial
    }
  }

  private restoreCached(): void {
    for (const mesh of this.nonBloomMeshes) {
      const saved = this.materials.get(mesh)
      if (saved) {
        mesh.material = saved
        this.materials.delete(mesh)
      }
    }
  }

  updateBloomParams(state: 'FIST' | 'OPEN'): void {
    if (state === 'FIST') {
      this.bloomPass.strength = 3.35
      this.bloomPass.radius = 1.0
      this.bloomPass.threshold = 0.1
    } else {
      this.bloomPass.strength = 0.4
      this.bloomPass.radius = 0.3
      this.bloomPass.threshold = 0.85
    }
  }

  // 预分配 overlay 可见性缓存，避免 render() 每帧 new Array
  private prevVisibleCache: boolean[] = []
  private topVisCache: boolean[] = []

  render(overlayMeshes?: Mesh[]): void {
    // 保存 overlay mesh 可见性并隐藏，避免 bloom 溢出到 overlay 上
    if (overlayMeshes) {
      this.prevVisibleCache.length = overlayMeshes.length
      for (let i = 0; i < overlayMeshes.length; i++) {
        this.prevVisibleCache[i] = overlayMeshes[i].visible
        overlayMeshes[i].visible = false
      }
    }

    // 统一禁用 toneMapping（OutputPass 已处理色调映射，避免双重映射导致色差）
    const prevToneMapping = this.renderer.toneMapping
    this.renderer.toneMapping = NoToneMapping

    if (this.ultraLowMode && this.ultraLowComposer) {
      // ULTRA_LOW 模式：单 composer，场景只渲染 1 次（而非 2 次）
      this.ultraLowComposer.render()
    } else if (this.bloomComposer && this.finalComposer) {
      // 标准 selective bloom pipeline (cached)
      this.ensureCache()
      this.darkenCached()
      this.bloomComposer.render()
      this.restoreCached()
      this.finalComposer.render()
    } else {
      // 回退：直接渲染（不应到达此分支）
      this.renderer.render(this.scene, this.camera)
    }

    this.renderer.toneMapping = prevToneMapping

    // 恢复 overlay mesh 可见性并在 bloom 之后渲染
    if (overlayMeshes) {
      for (let i = 0; i < overlayMeshes.length; i++) {
        overlayMeshes[i].visible = this.prevVisibleCache[i]
      }

      const hasVisible = overlayMeshes.some((m) => m.visible)
      if (hasVisible) {
        const prevAutoClear = this.renderer.autoClear
        this.renderer.autoClear = false
        this.renderer.clearDepth()

        // 仅渲染 overlay mesh：临时隐藏所有其他场景子对象
        const topChildren = this.scene.children
        // 复用预分配的可见性缓存，避免每帧 new Array
        if (this.topVisCache.length < topChildren.length) {
          this.topVisCache = new Array(topChildren.length)
        }
        for (let ci = 0; ci < topChildren.length; ci++) {
          this.topVisCache[ci] = topChildren[ci].visible
          let containsOverlay = false
          for (const mesh of overlayMeshes) {
            if (mesh.visible && isDescendantOf(mesh, topChildren[ci])) {
              containsOverlay = true
              break
            }
          }
          if (!containsOverlay) topChildren[ci].visible = false
        }

        try {
          this.renderer.render(this.scene, this.camera)
        } finally {
          for (let i = 0; i < topChildren.length; i++) {
            topChildren[i].visible = this.topVisCache[i]
          }
          this.renderer.autoClear = prevAutoClear
        }
      }
    }
  }

  resize(width: number, height: number): void {
    if (this.ultraLowComposer) {
      // ULTRA_LOW 单 composer
      this.ultraLowComposer.setSize(width, height)
    }
    if (this.bloomComposer) {
      // Bloom composer 使用缩放后的分辨率
      this.bloomComposer.setSize(
        Math.floor(width * this.bloomScale),
        Math.floor(height * this.bloomScale)
      )
    }
    if (this.finalComposer) {
      // Final composer 保持全分辨率
      this.finalComposer.setSize(width, height)
    }
  }

  dispose(): void {
    this.darkMaterial.dispose()
    this.mixShader?.dispose()
    // EffectComposer.dispose() 内部会释放其 renderTarget1/2，无需手动 double-free
    this.bloomComposer?.dispose()
    this.finalComposer?.dispose()
    if (this.ultraLowComposer) {
      this.ultraLowComposer.dispose()
    }
    this.nonBloomMeshes.length = 0
    this.cacheValid = false
    // 重置 render target 绑定，避免下一个场景渲染到已释放的 RT
    this.renderer.setRenderTarget(null)
  }
}

/** Check if obj is a descendant of (or equal to) ancestor */
function isDescendantOf(obj: Object3D, ancestor: Object3D): boolean {
  let current: Object3D | null = obj
  while (current) {
    if (current === ancestor) return true
    current = current.parent
  }
  return false
}
