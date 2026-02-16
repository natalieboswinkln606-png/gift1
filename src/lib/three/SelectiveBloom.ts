import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

export const BLOOM_LAYER = 1

export class SelectiveBloom {
  private bloomComposer: EffectComposer
  private finalComposer: EffectComposer
  private bloomLayer = new THREE.Layers()
  private materials = new WeakMap<THREE.Object3D, THREE.Material | THREE.Material[]>()
  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  private camera: THREE.Camera
  private darkMaterial: THREE.MeshBasicMaterial
  private mixShader: THREE.ShaderMaterial
  private bloomPass!: UnrealBloomPass
  private nonBloomMeshes: THREE.Mesh[] = []
  private cacheValid = false

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    this.scene = scene
    this.renderer = renderer
    this.camera = camera
    this.bloomLayer.set(BLOOM_LAYER)
    this.darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' })

    // Bloom composer
    const renderPass1 = new RenderPass(scene, camera)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,  // strength (constructor param)
      0.4,  // radius (constructor param)
      0.85  // threshold (constructor param)
    )
    bloomPass.threshold = 0.85
    bloomPass.strength = 0.4
    bloomPass.radius = 0.3
    this.bloomPass = bloomPass

    this.bloomComposer = new EffectComposer(renderer)
    this.bloomComposer.renderToScreen = false
    this.bloomComposer.addPass(renderPass1)
    this.bloomComposer.addPass(bloomPass)

    // Mix shader
    this.mixShader = new THREE.ShaderMaterial({
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

  // 当场景对象发生增删时调用，使缓存失效
  invalidateCache(): void {
    this.cacheValid = false
    this.nonBloomMeshes.length = 0
  }

  private ensureCache(): void {
    if (this.cacheValid) return
    this.nonBloomMeshes.length = 0
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && !this.bloomLayer.test(obj.layers)) {
        this.nonBloomMeshes.push(obj as THREE.Mesh)
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

  render(overlayMeshes?: THREE.Mesh[]): void {
    // Hide overlay meshes during bloom pipeline so bloom glow doesn't bleed onto them
    const prevVisible: boolean[] = []
    if (overlayMeshes) {
      for (const mesh of overlayMeshes) {
        prevVisible.push(mesh.visible)
        mesh.visible = false
      }
    }

    // Standard selective bloom pipeline (cached)
    this.ensureCache()
    this.darkenCached()
    this.bloomComposer.render()
    this.restoreCached()
    this.finalComposer.render()

    // Restore overlay mesh visibility and render them after bloom
    if (overlayMeshes) {
      for (let i = 0; i < overlayMeshes.length; i++) {
        overlayMeshes[i].visible = prevVisible[i]
      }

      const hasVisible = overlayMeshes.some((m) => m.visible)
      if (hasVisible) {
        const prevAutoClear = this.renderer.autoClear
        this.renderer.autoClear = false
        this.renderer.clearDepth()

        // Render only the overlay meshes by temporarily hiding all other scene children
        const topChildren = this.scene.children
        const topVis: boolean[] = []
        for (const child of topChildren) {
          topVis.push(child.visible)
          // Hide everything except parents of overlay meshes
          let containsOverlay = false
          for (const mesh of overlayMeshes) {
            if (mesh.visible && isDescendantOf(mesh, child)) {
              containsOverlay = true
              break
            }
          }
          if (!containsOverlay) child.visible = false
        }

        this.renderer.render(this.scene, this.camera)

        // Restore top-level visibility
        for (let i = 0; i < topChildren.length; i++) {
          topChildren[i].visible = topVis[i]
        }
        this.renderer.autoClear = prevAutoClear
      }
    }
  }

  resize(width: number, height: number): void {
    this.bloomComposer.setSize(width, height)
    this.finalComposer.setSize(width, height)
  }

  dispose(): void {
    this.darkMaterial.dispose()
    this.mixShader.dispose()
    this.bloomComposer.renderTarget1?.dispose()
    this.bloomComposer.renderTarget2?.dispose()
    this.finalComposer.renderTarget1?.dispose()
    this.finalComposer.renderTarget2?.dispose()
    this.bloomComposer.dispose()
    this.finalComposer.dispose()
    this.nonBloomMeshes.length = 0
    this.cacheValid = false
  }
}

/** Check if obj is a descendant of (or equal to) ancestor */
function isDescendantOf(obj: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = obj
  while (current) {
    if (current === ancestor) return true
    current = current.parent
  }
  return false
}
