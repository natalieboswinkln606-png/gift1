import * as THREE from 'three'

/**
 * Sparkle particle system that emits golden particles around hovered icons.
 * Uses THREE.Points with additive blending for a glowing effect.
 */
export class HoverParticleSystem {
  private particles: THREE.Points
  private positions: Float32Array
  private velocities: Float32Array
  private lifetimes: Float32Array
  private alphas: Float32Array
  private particleCount: number
  private active = false

  constructor(scene: THREE.Scene, particleCount = 40) {
    this.particleCount = particleCount
    this.positions = new Float32Array(particleCount * 3)
    this.velocities = new Float32Array(particleCount * 3)
    this.lifetimes = new Float32Array(particleCount)
    this.alphas = new Float32Array(particleCount)

    // Initialize all particles as dead
    this.lifetimes.fill(0)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))

    const material = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.06,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.particles = new THREE.Points(geometry, material)
    this.particles.frustumCulled = false
    scene.add(this.particles)
  }

  /** Emit a burst of sparkle particles at the given world position */
  emit(position: THREE.Vector3): void {
    this.active = true
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3

      // Spawn at icon position with slight random offset
      this.positions[i3] = position.x + (Math.random() - 0.5) * 0.3
      this.positions[i3 + 1] = position.y + (Math.random() - 0.5) * 0.3
      this.positions[i3 + 2] = position.z + (Math.random() - 0.5) * 0.15

      // Random outward velocity
      const angle = Math.random() * Math.PI * 2
      const speed = 0.005 + Math.random() * 0.015
      this.velocities[i3] = Math.cos(angle) * speed
      this.velocities[i3 + 1] = Math.sin(angle) * speed + 0.005 // slight upward bias
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.005

      // Staggered lifetimes for organic feel
      this.lifetimes[i] = 0.6 + Math.random() * 0.4
      this.alphas[i] = 1.0
    }

    this.particles.geometry.attributes.position.needsUpdate = true
  }

  /** Update particle positions and lifetimes each frame */
  update(deltaTime: number): void {
    if (!this.active) return

    let anyAlive = false
    const decay = deltaTime * 0.001 // normalize to ~0.016 per frame at 60fps

    for (let i = 0; i < this.particleCount; i++) {
      if (this.lifetimes[i] <= 0) continue

      anyAlive = true
      const i3 = i * 3

      // Move
      this.positions[i3] += this.velocities[i3]
      this.positions[i3 + 1] += this.velocities[i3 + 1]
      this.positions[i3 + 2] += this.velocities[i3 + 2]

      // Slow down
      this.velocities[i3] *= 0.98
      this.velocities[i3 + 1] *= 0.98
      this.velocities[i3 + 2] *= 0.98

      // Decay
      this.lifetimes[i] -= decay * 0.8
      if (this.lifetimes[i] <= 0) {
        // Move dead particle offscreen
        this.positions[i3] = 0
        this.positions[i3 + 1] = -100
        this.positions[i3 + 2] = 0
      }
    }

    this.particles.geometry.attributes.position.needsUpdate = true

    if (!anyAlive) {
      this.active = false
    }
  }

  dispose(): void {
    this.particles.geometry.dispose()
    ;(this.particles.material as THREE.PointsMaterial).dispose()
    this.particles.removeFromParent()
  }
}
