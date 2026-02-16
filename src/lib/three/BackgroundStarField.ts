import * as THREE from 'three'

/**
 * Subtle animated star field rendered behind the 3D icons.
 * Uses THREE.Points with additive blending for a soft, ambient glow.
 */
export class BackgroundStarField {
  private particles: THREE.Points
  private basePositions: Float32Array
  private count: number

  constructor(scene: THREE.Scene, count = 250) {
    this.count = count
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    this.basePositions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // Spread across visible area, behind icons (z: -2 to -5)
      positions[i3] = (Math.random() - 0.5) * 22
      positions[i3 + 1] = (Math.random() - 0.5) * 16
      positions[i3 + 2] = -2 - Math.random() * 3

      // Store base positions for animation
      this.basePositions[i3] = positions[i3]
      this.basePositions[i3 + 1] = positions[i3 + 1]
      this.basePositions[i3 + 2] = positions[i3 + 2]

      // Varied sizes for depth illusion
      sizes[i] = 0.02 + Math.random() * 0.04
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.04,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.particles = new THREE.Points(geometry, material)
    this.particles.frustumCulled = false
    scene.add(this.particles)
  }

  /** Gentle drift and twinkle animation */
  update(time: number): void {
    const posAttr = this.particles.geometry.attributes.position as THREE.BufferAttribute
    const positions = posAttr.array as Float32Array

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3
      // Gentle sine-wave drift
      positions[i3] = this.basePositions[i3] + Math.sin(time * 0.0003 + i * 0.7) * 0.08
      positions[i3 + 1] = this.basePositions[i3 + 1] + Math.cos(time * 0.0004 + i * 0.5) * 0.06
    }

    posAttr.needsUpdate = true

    // Slow overall rotation for parallax feel
    this.particles.rotation.z = time * 0.00003
  }

  dispose(): void {
    this.particles.geometry.dispose()
    ;(this.particles.material as THREE.PointsMaterial).dispose()
    this.particles.removeFromParent()
  }
}
