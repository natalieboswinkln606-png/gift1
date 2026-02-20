import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  Scene,
  ShaderMaterial,
} from 'three'

export class BackgroundStars {
  private points: Points
  private material: ShaderMaterial

  constructor(scene: Scene, count = 8000) {
    const geo = new BufferGeometry()
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const shifts = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const r = 400 + Math.random() * 800  // 从 800-2500 缩小到 400-1200，减少远距离无效渲染
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      sizes[i] = Math.random() * 5 + 3
      shifts[i] = Math.random() * 100
    }

    geo.setAttribute('position', new BufferAttribute(positions, 3))
    geo.setAttribute('size', new BufferAttribute(sizes, 1))
    geo.setAttribute('shift', new BufferAttribute(shifts, 1))

    this.material = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, color: { value: new Color(0xffffff) } },
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
          // 优化：先用 dot() 计算距离平方，在 discard 分支前避免 sqrt()
          // 约 21.5% 的片元会被 discard，这些片元无需执行 sqrt
          vec2 c = gl_PointCoord - 0.5;
          float d2 = dot(c, c);
          if(d2 > 0.25) discard;
          float d = sqrt(d2);
          gl_FragColor = vec4(color, 1.0 - smoothstep(0.1, 0.5, d));
        }
      `,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    })

    this.points = new Points(geo, this.material)
    this.points.frustumCulled = false  // 背景星空始终可见，跳过 frustum check
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
