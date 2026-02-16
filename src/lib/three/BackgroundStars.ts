import * as THREE from 'three'

export class BackgroundStars {
  private points: THREE.Points
  private material: THREE.ShaderMaterial

  constructor(scene: THREE.Scene, count = 8000) {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const shifts = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const r = 800 + Math.random() * 1700
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      sizes[i] = Math.random() * 5 + 3
      shifts[i] = Math.random() * 100
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('shift', new THREE.BufferAttribute(shifts, 1))

    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, color: { value: new THREE.Color(0xffffff) } },
      vertexShader: `
        attribute float size;
        attribute float shift;
        uniform float uTime;
        void main(){
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          float shine = sin(uTime * 1.0 + shift);
          float scale = 0.7 + 0.3 * shine;
          gl_PointSize = size * scale * (800.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        void main(){
          float d = distance(gl_PointCoord, vec2(0.5));
          if(d > 0.5) discard;
          gl_FragColor = vec4(color, 1.0 - smoothstep(0.1, 0.5, d));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    })

    this.points = new THREE.Points(geo, this.material)
    this.points.renderOrder = -1000
    scene.add(this.points)
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time
  }

  dispose(): void {
    this.points.geometry.dispose()
    this.material.dispose()
    this.points.removeFromParent()
  }
}
