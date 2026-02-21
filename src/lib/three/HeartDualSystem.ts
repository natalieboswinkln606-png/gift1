import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Material,
  Matrix4,
  MeshBasicMaterial,
  Scene,
  TetrahedronGeometry,
  Vector3,
} from 'three'
import { fastSin, fastCos } from './trigTable'
import { BLOOM_LAYER } from './SelectiveBloom'

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

const DEFAULT_HEART_COUNT_PER_SIDE = 6400
const HEART_OFFSET_X = 50
// 原始 scale=40 * pow(0.4, 1/3) ≈ 29.5，再缩小 1/2 体积 → scale * pow(0.5, 1/3) ≈ 23.4
const HEART_SCALE = 40 * Math.pow(0.4, 1 / 3) * Math.pow(0.5, 1 / 3)
// 爱心自转速度
const HEART_ROTATION_SPEED = 0.3

interface HeartParticle {
  basePos: Vector3   // 相对于爱心中心的局部坐标
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
function sampleHeartPoint(scale: number): Vector3 {
  for (let attempts = 0; attempts < 300; attempts++) {
    const x = Math.random() * 3 - 1.5
    const y = Math.random() * 3 - 1.5
    const z = Math.random() * 3 - 1.5
    const x2 = x * x, y2 = y * y, z2 = z * z
    const a = x2 + 2.25 * z2 + y2 - 1
    const b = x2 * y2 * y + 0.1125 * z2 * y2 * y
    if (a * a * a - b < 0) {
      return new Vector3(x * scale, y * scale, z * scale)
    }
  }
  return new Vector3(0, 0, 0)
}

export class HeartDualSystem {
  private leftGroup: Group
  private rightGroup: Group
  private outerGroup: Group

  // 左右各 3 个 InstancedMesh，挂到对应 Group 实现自动旋转
  private leftMeshes: InstancedMesh[]
  private rightMeshes: InstancedMesh[]
  private allMeshes: InstancedMesh[] = []  // 缓存，避免每帧创建临时数组

  private particles: HeartParticle[] = []
  private heartCountPerSide: number  // 每侧粒子数（质量分级）

  private sharedGeos: [IcosahedronGeometry, BoxGeometry, TetrahedronGeometry]
  private baseMat: MeshBasicMaterial
  private frameCount = 0  // 帧计数器（用于左右心交替更新）

  constructor(scene: Scene, heartCountPerSide = DEFAULT_HEART_COUNT_PER_SIDE) {
    const HEART_COUNT_PER_SIDE = heartCountPerSide
    const TOTAL_PARTICLES = HEART_COUNT_PER_SIDE * 2
    this.heartCountPerSide = heartCountPerSide
    this.outerGroup = new Group()
    this.outerGroup.visible = false

    // 左爱心组（x=-50）
    this.leftGroup = new Group()
    this.leftGroup.position.x = -HEART_OFFSET_X
    this.outerGroup.add(this.leftGroup)

    // 右爱心组（x=+50）
    this.rightGroup = new Group()
    this.rightGroup.position.x = HEART_OFFSET_X
    this.outerGroup.add(this.rightGroup)

    // 1:1 复刻源文件材质（line 424-430）
    const mat = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.baseMat = mat

    // 1:1 复刻源文件几何体尺寸（lines 432-434）
    const sphereGeo = new IcosahedronGeometry(0.35, 1)
    const boxGeo = new BoxGeometry(0.45, 0.45, 0.45)
    const tetraGeo = new TetrahedronGeometry(0.5)
    this.sharedGeos = [sphereGeo, boxGeo, tetraGeo]

    // 每侧的粒子分配比例：50% sphere, 30% box, 20% tetra
    const countSpherePerSide = Math.floor(HEART_COUNT_PER_SIDE * 0.5)
    const countBoxPerSide = Math.floor(HEART_COUNT_PER_SIDE * 0.3)
    const countTetraPerSide = HEART_COUNT_PER_SIDE - countSpherePerSide - countBoxPerSide

    // 创建左侧 mesh（共享同一个材质，避免 6 个冗余 shader programs）
    const meshSphereL = new InstancedMesh(sphereGeo, mat, countSpherePerSide)
    const meshBoxL = new InstancedMesh(boxGeo, mat, countBoxPerSide)
    const meshTetraL = new InstancedMesh(tetraGeo, mat, countTetraPerSide)
    this.leftMeshes = [meshSphereL, meshBoxL, meshTetraL]

    // 创建右侧 mesh（共享同一个材质）
    const meshSphereR = new InstancedMesh(sphereGeo, mat, countSpherePerSide)
    const meshBoxR = new InstancedMesh(boxGeo, mat, countBoxPerSide)
    const meshTetraR = new InstancedMesh(tetraGeo, mat, countTetraPerSide)
    this.rightMeshes = [meshSphereR, meshBoxR, meshTetraR]

    // 左侧 mesh 挂到 leftGroup
    this.leftMeshes.forEach(m => {
      m.layers.enable(BLOOM_LAYER)
      m.instanceMatrix.setUsage(DynamicDrawUsage)
      m.frustumCulled = false
      this.leftGroup.add(m)
    })

    // 右侧 mesh 挂到 rightGroup
    this.rightMeshes.forEach(m => {
      m.layers.enable(BLOOM_LAYER)
      m.instanceMatrix.setUsage(DynamicDrawUsage)
      m.frustumCulled = false
      this.rightGroup.add(m)
    })

    // 颜色配置：全部蓝色系
    const colors = {
      skyBlue: new Color('#66bbff').multiplyScalar(1.5),
      lightBlue: new Color('#aaddff').multiplyScalar(1.5),
      deepBlue: new Color('#4488ff').multiplyScalar(2.0),
      cyan: new Color('#44ccff').multiplyScalar(1.3),
      paleBlue: new Color('#88aaff').multiplyScalar(1.8),
    }

    // 每侧的 mesh 内部索引计数器
    const leftCounters = [0, 0, 0]
    const rightCounters = [0, 0, 0]

    // 生成粒子
    const color = new Color()
    const tmpMatrix = new Matrix4()  // 复用单个实例，避免循环中创建 12800 个
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
      // 复用单个 Matrix4 实例，避免循环中创建 12800 个临时对象
      tmpMatrix.makeScale(p.baseScale, p.baseScale, p.baseScale)
      tmpMatrix.setPosition(basePos.x, basePos.y, basePos.z)

      const meshArr = isLeft ? this.leftMeshes : this.rightMeshes
      meshArr[meshIndex].setMatrixAt(internalIndex, tmpMatrix)
      meshArr[meshIndex].setColorAt(internalIndex, color)
    }

    const allMeshes = [...this.leftMeshes, ...this.rightMeshes]
    this.allMeshes = allMeshes
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
    this.frameCount++

    // 爱心按自身中心轴旋转 — Three.js 矩阵层级自动应用到子 InstancedMesh
    this.leftGroup.rotation.y = time * HEART_ROTATION_SPEED
    this.rightGroup.rotation.y = -time * HEART_ROTATION_SPEED

    // 左右心交替更新：奇数帧更新左心，偶数帧更新右心
    const updateLeft = this.frameCount % 2 === 0
    const startIdx = updateLeft ? 0 : this.heartCountPerSide
    const endIdx = updateLeft ? this.heartCountPerSide : this.particles.length

    // 预计算共享的 ry 的 sin/cos（所有粒子的 ry = time * 0.5 相同）
    const ry = time * 0.5
    const cy = Math.cos(ry), sy = Math.sin(ry)

    for (let i = startIdx; i < endIdx; i++) {
      const p = this.particles[i]

      // 1:1 复刻源文件闪烁算法（lines 846-848）— 使用查找表替代 Math.sin/cos
      const blink = fastSin(time * p.speed + p.offset)
      // Math.pow(x, 3) → 手动乘法（V8 中更快）
      const halfBlink = 0.5 * blink + 0.5
      const intensity = halfBlink * halfBlink * halfBlink
      const scale = p.baseScale * (0.3 + 1.2 * intensity)

      // 1:1 复刻源文件旋转（line 853）— rx 每粒子不同，ry 共享预计算，查找表替代 Math.cos/sin
      const rx = time + p.offset
      const cx = fastCos(rx), sx = fastSin(rx)

      const meshArr = p.side === 0 ? this.leftMeshes : this.rightMeshes
      const targetArray = meshArr[p.meshIndex].instanceMatrix.array as Float32Array
      const matOffset = p.internalIndex * 16

      // 直接写入 4x4 变换矩阵（列主序）：T * Ry * Rx * S
      targetArray[matOffset]      = cy * scale
      targetArray[matOffset + 1]  = sx * sy * scale
      targetArray[matOffset + 2]  = -cx * sy * scale
      targetArray[matOffset + 3]  = 0
      targetArray[matOffset + 4]  = 0
      targetArray[matOffset + 5]  = cx * scale
      targetArray[matOffset + 6]  = sx * scale
      targetArray[matOffset + 7]  = 0
      targetArray[matOffset + 8]  = sy * scale
      targetArray[matOffset + 9]  = -sx * cy * scale
      targetArray[matOffset + 10] = cx * cy * scale
      targetArray[matOffset + 11] = 0
      targetArray[matOffset + 12] = p.basePos.x
      targetArray[matOffset + 13] = p.basePos.y
      targetArray[matOffset + 14] = p.basePos.z
      targetArray[matOffset + 15] = 1
    }

    // 只标记更新的那一侧的 mesh 需要上传
    const updatedMeshes = updateLeft ? this.leftMeshes : this.rightMeshes
    updatedMeshes.forEach(m => { m.instanceMatrix.needsUpdate = true })
  }

  dispose(): void {
    // 材质是共享的，只释放一次（baseMat）
    // 统一释放共享几何体和基础材质
    this.sharedGeos.forEach(g => g.dispose())
    this.baseMat.dispose()
    this.outerGroup.parent?.remove(this.outerGroup)
  }
}
