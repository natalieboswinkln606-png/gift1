import * as THREE from 'three'

/**
 * 双爱心粒子系统
 * 1:1 复刻 星空圣诞树(1).html 的粒子状态与功能
 * 两个爱心分别位于 x 轴 ±50，体积和粒子量为原始的 2/5
 * 使用 InstancedMesh 渲染，材质完全匹配源文件：
 *   MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false })
 * 几何体尺寸完全匹配源文件：
 *   IcosahedronGeometry(0.35, 1) / BoxGeometry(0.45) / TetrahedronGeometry(0.5)
 * 闪烁算法完全匹配源文件：
 *   blink = sin(time * speed + offset), intensity = pow(0.5*blink+0.5, 3.0), scale = baseScale * (0.3 + 1.2*intensity)
 * 爱心按自身中心轴旋转
 *
 * 性能优化：左右各 3 个 InstancedMesh 分别挂到 leftGroup/rightGroup，
 * 由 Three.js 矩阵层级自动处理旋转，消除每帧 12800 次 cos/sin 计算
 */

const BLOOM_LAYER = 1
const HEART_COUNT_PER_SIDE = 6400
const TOTAL_PARTICLES = HEART_COUNT_PER_SIDE * 2
const HEART_OFFSET_X = 50
// 原始 scale=40 * pow(0.4, 1/3) ≈ 29.5，再缩小 1/2 体积 → scale * pow(0.5, 1/3) ≈ 23.4
const HEART_SCALE = 40 * Math.pow(0.4, 1 / 3) * Math.pow(0.5, 1 / 3)
// 爱心自转速度
const HEART_ROTATION_SPEED = 0.3

interface HeartParticle {
  basePos: THREE.Vector3   // 相对于爱心中心的局部坐标
  speed: number
  offset: number
  baseScale: number
  side: 0 | 1             // 0=左, 1=右
  meshIndex: number        // 0=sphere, 1=box, 2=tetra
  internalIndex: number    // 在对应侧 mesh 中的索引
}

/**
 * 心形隐式方程采样（1:1 复刻源文件 lines 472-486）
 * (x² + 2.25z² + y² - 1)³ - x²y³ - 0.1125z²y³ < 0
 * 返回相对于爱心中心的局部坐标
 */
function sampleHeartPoint(scale: number): THREE.Vector3 {
  for (let attempts = 0; attempts < 300; attempts++) {
    const x = Math.random() * 3 - 1.5
    const y = Math.random() * 3 - 1.5
    const z = Math.random() * 3 - 1.5
    const x2 = x * x, y2 = y * y, z2 = z * z
    const a = x2 + 2.25 * z2 + y2 - 1
    const b = x2 * y2 * y + 0.1125 * z2 * y2 * y
    if (a * a * a - b < 0) {
      return new THREE.Vector3(x * scale, y * scale, z * scale)
    }
  }
  return new THREE.Vector3(0, 0, 0)
}

export class HeartDualSystem {
  private leftGroup: THREE.Group
  private rightGroup: THREE.Group
  private outerGroup: THREE.Group

  // 左右各 3 个 InstancedMesh，挂到对应 Group 实现自动旋转
  private leftMeshes: THREE.InstancedMesh[]
  private rightMeshes: THREE.InstancedMesh[]

  private particles: HeartParticle[] = []
  private dummy = new THREE.Object3D()

  constructor(scene: THREE.Scene) {
    this.outerGroup = new THREE.Group()
    this.outerGroup.visible = false

    // 左爱心组（x=-50）
    this.leftGroup = new THREE.Group()
    this.leftGroup.position.x = -HEART_OFFSET_X
    this.outerGroup.add(this.leftGroup)

    // 右爱心组（x=+50）
    this.rightGroup = new THREE.Group()
    this.rightGroup.position.x = HEART_OFFSET_X
    this.outerGroup.add(this.rightGroup)

    // 1:1 复刻源文件材质（line 424-430）
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    // 1:1 复刻源文件几何体尺寸（lines 432-434）
    const sphereGeo = new THREE.IcosahedronGeometry(0.35, 1)
    const boxGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45)
    const tetraGeo = new THREE.TetrahedronGeometry(0.5)

    // 每侧的粒子分配比例：50% sphere, 30% box, 20% tetra
    const countSpherePerSide = Math.floor(HEART_COUNT_PER_SIDE * 0.5)
    const countBoxPerSide = Math.floor(HEART_COUNT_PER_SIDE * 0.3)
    const countTetraPerSide = HEART_COUNT_PER_SIDE - countSpherePerSide - countBoxPerSide

    // 创建左侧 mesh
    const meshSphereL = new THREE.InstancedMesh(sphereGeo, mat.clone(), countSpherePerSide)
    const meshBoxL = new THREE.InstancedMesh(boxGeo, mat.clone(), countBoxPerSide)
    const meshTetraL = new THREE.InstancedMesh(tetraGeo, mat.clone(), countTetraPerSide)
    this.leftMeshes = [meshSphereL, meshBoxL, meshTetraL]

    // 创建右侧 mesh
    const meshSphereR = new THREE.InstancedMesh(sphereGeo, mat.clone(), countSpherePerSide)
    const meshBoxR = new THREE.InstancedMesh(boxGeo, mat.clone(), countBoxPerSide)
    const meshTetraR = new THREE.InstancedMesh(tetraGeo, mat.clone(), countTetraPerSide)
    this.rightMeshes = [meshSphereR, meshBoxR, meshTetraR]

    // 左侧 mesh 挂到 leftGroup
    this.leftMeshes.forEach(m => {
      m.layers.enable(BLOOM_LAYER)
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      m.frustumCulled = false
      this.leftGroup.add(m)
    })

    // 右侧 mesh 挂到 rightGroup
    this.rightMeshes.forEach(m => {
      m.layers.enable(BLOOM_LAYER)
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      m.frustumCulled = false
      this.rightGroup.add(m)
    })

    // 颜色配置：全部蓝色系
    const colors = {
      skyBlue: new THREE.Color('#66bbff').multiplyScalar(1.5),
      lightBlue: new THREE.Color('#aaddff').multiplyScalar(1.5),
      deepBlue: new THREE.Color('#4488ff').multiplyScalar(2.0),
      cyan: new THREE.Color('#44ccff').multiplyScalar(1.3),
      paleBlue: new THREE.Color('#88aaff').multiplyScalar(1.8),
    }

    // 每侧的 mesh 内部索引计数器
    const leftCounters = [0, 0, 0]
    const rightCounters = [0, 0, 0]

    // 生成粒子
    const color = new THREE.Color()
    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const isLeft = i < HEART_COUNT_PER_SIDE
      const side: 0 | 1 = isLeft ? 0 : 1

      // 采样局部坐标（相对于爱心中心）
      const basePos = sampleHeartPoint(HEART_SCALE)

      // 在当前侧内的索引
      const sideLocalIndex = isLeft ? i : i - HEART_COUNT_PER_SIDE

      // 分配到不同 mesh（1:1 复刻源文件比例）
      let meshIndex: number
      if (sideLocalIndex < countSpherePerSide) {
        meshIndex = 0
      } else if (sideLocalIndex < countSpherePerSide + countBoxPerSide) {
        meshIndex = 1
      } else {
        meshIndex = 2
      }

      const counters = isLeft ? leftCounters : rightCounters
      const internalIndex = counters[meshIndex]
      counters[meshIndex]++

      // 1:1 复刻源文件粒子属性（line 496-497）
      const p: HeartParticle = {
        basePos,
        speed: 1.0 + Math.random() * 5.0,
        offset: Math.random() * 100.0,
        baseScale: 0.5 + Math.random() * 0.9,
        side,
        meshIndex,
        internalIndex,
      }
      this.particles.push(p)

      // 蓝色系随机分配
      const r = Math.random()
      if (r < 0.3) color.copy(colors.skyBlue)
      else if (r < 0.5) color.copy(colors.lightBlue)
      else if (r < 0.7) color.copy(colors.deepBlue)
      else if (r < 0.85) color.copy(colors.cyan)
      else color.copy(colors.paleBlue)
      color.multiplyScalar(0.8 + Math.random() * 0.4)

      // 初始矩阵设置（局部坐标，Group 层级自动处理世界偏移）
      this.dummy.position.set(basePos.x, basePos.y, basePos.z)
      this.dummy.scale.setScalar(p.baseScale)
      this.dummy.updateMatrix()

      const meshArr = isLeft ? this.leftMeshes : this.rightMeshes
      meshArr[meshIndex].setMatrixAt(internalIndex, this.dummy.matrix)
      meshArr[meshIndex].setColorAt(internalIndex, color)
    }

    const allMeshes = [...this.leftMeshes, ...this.rightMeshes]
    allMeshes.forEach(m => {
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      m.instanceMatrix.needsUpdate = true
    })

    scene.add(this.outerGroup)
  }

  get visible(): boolean {
    return this.outerGroup.visible
  }

  set visible(v: boolean) {
    this.outerGroup.visible = v
  }

  update(time: number, _dt: number): void {
    if (!this.outerGroup.visible) return

    // 爱心按自身中心轴旋转 — Three.js 矩阵层级自动应用到子 InstancedMesh
    this.leftGroup.rotation.y = time * HEART_ROTATION_SPEED
    this.rightGroup.rotation.y = -time * HEART_ROTATION_SPEED

    // 更新粒子闪烁和自旋（无需手动旋转计算，Group 层级已处理）
    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const p = this.particles[i]

      // 1:1 复刻源文件闪烁算法（lines 846-848）
      const blink = Math.sin(time * p.speed + p.offset)
      const intensity = Math.pow(0.5 * blink + 0.5, 3.0)
      const scale = p.baseScale * (0.3 + 1.2 * intensity)

      // 局部坐标（Group 层级自动处理世界偏移和旋转）
      this.dummy.position.set(p.basePos.x, p.basePos.y, p.basePos.z)
      this.dummy.scale.setScalar(scale)
      // 1:1 复刻源文件旋转（line 853）
      this.dummy.rotation.set(time + p.offset, time * 0.5, 0)
      this.dummy.updateMatrix()

      const meshArr = p.side === 0 ? this.leftMeshes : this.rightMeshes
      meshArr[p.meshIndex].setMatrixAt(p.internalIndex, this.dummy.matrix)
    }

    const allMeshes = [...this.leftMeshes, ...this.rightMeshes]
    allMeshes.forEach(m => { m.instanceMatrix.needsUpdate = true })
  }

  dispose(): void {
    const allMeshes = [...this.leftMeshes, ...this.rightMeshes]
    allMeshes.forEach(m => {
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    })
    this.outerGroup.parent?.remove(this.outerGroup)
  }
}
