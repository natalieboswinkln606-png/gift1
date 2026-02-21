/**
 * 参数化爱心位置生成：可自定义缩放和 Y 偏移。
 * 返回 Float32Array[count * 3]，布局为 [x0,y0,z0, x1,y1,z1, ...]
 */
export function generateHeartPositions(count: number, scale: number, yOffset: number): Float32Array {
  const positions = new Float32Array(count * 3)
  let filled = 0
  const maxIter = count * 10  // 安全阀：防止极端情况下无限循环

  for (let iter = 0; iter < maxIter && filled < count; iter++) {
    // 收紧包围盒至心形实际范围，接受率 ~35%
    const x = Math.random() * 2.6 - 1.3
    const y = Math.random() * 2.5 - 1.2
    const z = Math.random() * 1.6 - 0.8

    const x2 = x * x
    const y2 = y * y
    const z2 = z * z
    const a = x2 + 2.25 * z2 + y2 - 1
    const b = x2 * y2 * y + 0.1125 * z2 * y2 * y

    if (a * a * a - b < 0) {
      const idx = filled * 3
      positions[idx] = x * scale
      positions[idx + 1] = y * scale + yOffset
      positions[idx + 2] = z * scale
      filled++
    }
  }

  // 如果未填满（极端情况），用已有点填充剩余位置
  if (filled < count && filled > 0) {
    for (let i = filled; i < count; i++) {
      const src = (i % filled) * 3
      const dst = i * 3
      positions[dst] = positions[src]
      positions[dst + 1] = positions[src + 1]
      positions[dst + 2] = positions[src + 2]
    }
  }

  return positions
}

/**
 * 五角星位置采样：在五角星 2D 轮廓内均匀采样，加少量 Z 厚度。
 * 返回 Float32Array[count * 3]，布局为 [x0,y0,z0, x1,y1,z1, ...]
 *
 * 五角星由 5 个外顶点和 5 个内顶点交替连接构成。
 * 采样方法：将五角星分解为 10 个三角形（中心到每条边），在三角形内均匀采样。
 */
export function generateStarPositions(count: number, scale: number, yOffset: number): Float32Array {
  const positions = new Float32Array(count * 3)

  // 生成五角星顶点（10 个点交替内外）
  const outerR = 1.0
  const innerR = 0.382  // 标准五角星内外比 ≈ sin(18°)/sin(54°)
  const vertices: Array<[number, number]> = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2  // 顶点朝上
    vertices.push([Math.cos(angle) * r, Math.sin(angle) * r])
  }

  // 将五角星分解为 10 个三角形（中心 → 相邻两顶点）
  const triangles: Array<[[number, number], [number, number], [number, number]]> = []
  for (let i = 0; i < 10; i++) {
    triangles.push([[0, 0], vertices[i], vertices[(i + 1) % 10]])
  }

  // 预计算每个三角形面积用于加权采样
  const areas: number[] = []
  let totalArea = 0
  for (const [a, b, c] of triangles) {
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) * 0.5
    areas.push(area)
    totalArea += area
  }

  // Z 轴厚度
  const zThickness = 0.15

  for (let i = 0; i < count; i++) {
    // 按面积加权选择三角形
    let r = Math.random() * totalArea
    let triIdx = 0
    for (let t = 0; t < areas.length; t++) {
      r -= areas[t]
      if (r <= 0) { triIdx = t; break }
    }

    // 在三角形内均匀采样（重心坐标）
    const [a, b, c] = triangles[triIdx]
    let u = Math.random()
    let v = Math.random()
    if (u + v > 1) { u = 1 - u; v = 1 - v }
    const x = a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0])
    const y = a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1])
    const z = (Math.random() - 0.5) * zThickness

    const idx = i * 3
    positions[idx] = x * scale
    positions[idx + 1] = y * scale + yOffset
    positions[idx + 2] = z * scale
  }

  return positions
}
