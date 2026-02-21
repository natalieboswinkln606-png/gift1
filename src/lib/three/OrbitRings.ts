import {
  AdditiveBlending, BufferAttribute, BufferGeometry,
  CanvasTexture, Color, Object3D, Points, ShaderMaterial,
} from 'three'
import { createRadialGradientTexture } from './textureFactory'

// 借鉴 新建文本文档 - 副本.html 的5层外围星环
// 马尔可夫链分布 + ShaderMaterial 驱动粒子运动

// --- 配置常量 ---
const RING_COUNT = 5
const PARTICLES_PER_RING = 1500
const BASE_RADIUS = 7.0
const LAYER_GROWTH = 2.5
const SPEED_SCALE = 0.2
const ANGLE_STEP_DEG = 40
const DEG2RAD = Math.PI / 180
const GOLD_COLOR = new Color(0xffd700)

/** 星环粒子纹理：柔和金色渐变 */
function createGlowSprite(): CanvasTexture {
  return createRadialGradientTexture(64, [
    { offset: 0, color: 'rgba(255, 255, 255, 1)' },
    { offset: 0.15, color: 'rgba(255, 235, 180, 0.8)' },
    { offset: 0.5, color: 'rgba(100, 80, 0, 0.2)' },
    { offset: 1, color: 'rgba(0, 0, 0, 0)' },
  ])
}

/** 马尔可夫链分布：生成 CLUSTER/GAP/STRAY 三态可见性掩码 */
function generateDistributionMask(count: number): Float32Array {
  const visibility = new Float32Array(count)
  let state: 'GAP' | 'CLUSTER' | 'STRAY' = 'GAP'
  let remainingInState = 0

  for (let i = 0; i < count; i++) {
    if (remainingInState <= 0) {
      if (state === 'GAP') {
        const r = Math.random()
        if (r > 0.4) {
          state = 'CLUSTER'
          remainingInState = Math.floor(Math.random() * 50 + 20)
        } else {
          state = 'STRAY'
          remainingInState = Math.floor(Math.random() * 5 + 1)
        }
      } else if (state === 'CLUSTER') {
        state = 'GAP'
        remainingInState = Math.floor(Math.random() * 40 + 15)
      } else {
        state = 'GAP'
        remainingInState = Math.floor(Math.random() * 30 + 10)
      }
    }

    if (state === 'GAP') {
      visibility[i] = 0.0
    } else {
      visibility[i] = Math.random() > 0.15 ? 1.0 : 0.0
    }

    remainingInState--
  }
  return visibility
}

// --- Shader 代码 ---
const RING_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uRadius;

  attribute float aAngle;
  attribute float aRandom;
  attribute float aVisible;
  attribute vec3 aOffset;

  varying float vAlpha;
  varying float vRandom;

  void main() {
    vRandom = aRandom;

    float currentAngle = aAngle + uTime * uSpeed;

    vec3 pos;
    pos.x = cos(currentAngle) * uRadius;
    pos.y = sin(currentAngle) * uRadius;
    pos.z = 0.0;

    pos += aOffset;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = (5.0 * aRandom + 3.0) * (50.0 / -mvPosition.z);

    vAlpha = aVisible;
  }
`

const RING_FRAGMENT_SHADER = `
  uniform sampler2D uTex;
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vRandom;

  void main() {
    if (vAlpha < 0.01) discard;
    vec4 tex = texture2D(uTex, gl_PointCoord);

    // 混合稍亮的金色变化
    vec3 highlight = vec3(1.0, 0.95, 0.8);
    vec3 finalColor = mix(uColor, highlight, vRandom * 0.4);

    // 柔和透明度混合
    gl_FragColor = vec4(finalColor, tex.a * vAlpha * (0.8 + vRandom * 0.2));
  }
`

interface RingData {
  mesh: Points
  material: ShaderMaterial
}

export class OrbitRings {
  private rings: RingData[] = []
  private glowTex: CanvasTexture
  private baseMaterial: ShaderMaterial  // 保存基础材质引用，dispose 时释放

  constructor(parent: Object3D, particlesPerRing = PARTICLES_PER_RING) {
    this.glowTex = createGlowSprite()

    // 基础材质模板
    const baseMaterial = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 1.0 },
        uTex: { value: this.glowTex },
        uRadius: { value: 10.0 },
        uColor: { value: GOLD_COLOR },
      },
      vertexShader: RING_VERTEX_SHADER,
      fragmentShader: RING_FRAGMENT_SHADER,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.baseMaterial = baseMaterial

    // 5层环
    for (let i = 0; i < RING_COUNT; i++) {
      const angle = (i + 1) * ANGLE_STEP_DEG * DEG2RAD
      const speed = 1.0 + (Math.random() * 0.3 - 0.15)
      const ring = this.createOrbitRing(baseMaterial, angle, speed, i, particlesPerRing)
      parent.add(ring.mesh)
      this.rings.push(ring)
    }
  }

  private createOrbitRing(
    baseMat: ShaderMaterial,
    rotAngle: number,
    speedOffset: number,
    layerIndex: number,
    particlesPerRing: number
  ): RingData {
    const count = particlesPerRing
    const currentRadius = BASE_RADIUS + layerIndex * LAYER_GROWTH

    const geometry = new BufferGeometry()
    const positions = new Float32Array(count * 3)
    const angles = new Float32Array(count)
    const randoms = new Float32Array(count)
    const offsets = new Float32Array(count * 3)
    const visibles = generateDistributionMask(count)

    for (let i = 0; i < count; i++) {
      angles[i] = (i / count) * Math.PI * 2
      randoms[i] = Math.random()

      // 球面随机偏移
      const r = 0.4 * Math.random()
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      offsets[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      offsets[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      offsets[i * 3 + 2] = r * Math.cos(phi)
    }

    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('aAngle', new BufferAttribute(angles, 1))
    geometry.setAttribute('aRandom', new BufferAttribute(randoms, 1))
    geometry.setAttribute('aVisible', new BufferAttribute(visibles, 1))
    geometry.setAttribute('aOffset', new BufferAttribute(offsets, 3))

    const mat = baseMat.clone()
    // 共享不变的 uniform 引用，减少 GPU uniform upload
    mat.uniforms.uTex = baseMat.uniforms.uTex
    mat.uniforms.uColor = baseMat.uniforms.uColor
    mat.uniforms.uTime = baseMat.uniforms.uTime  // 共享 uTime，update() 只需写一次
    mat.uniforms.uSpeed.value = SPEED_SCALE * speedOffset
    mat.uniforms.uRadius.value = currentRadius

    const mesh = new Points(geometry, mat)
    mesh.frustumCulled = false  // 星环始终可见，跳过 frustum check
    mesh.rotation.x = rotAngle
    mesh.rotation.y = rotAngle
    mesh.rotation.z = rotAngle

    return { mesh, material: mat }
  }

  get visible(): boolean {
    return this.rings.length > 0 ? this.rings[0].mesh.visible : true
  }

  set visible(v: boolean) {
    for (const ring of this.rings) {
      ring.mesh.visible = v
    }
  }

  update(time: number, _dt: number): void {
    // uTime 是共享引用，只需写一次即可更新所有 5 个环
    this.baseMaterial.uniforms.uTime.value = time
  }

  dispose(): void {
    this.glowTex.dispose()
    this.baseMaterial.dispose()  // 释放基础材质
    for (const ring of this.rings) {
      ring.mesh.geometry.dispose()
      ring.material.dispose()
      ring.mesh.parent?.remove(ring.mesh)
    }
  }
}
