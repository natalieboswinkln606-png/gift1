/**
 * Generate heart-shaped positions using implicit surface sampling.
 * Heart equation: (x² + 2.25z² + y² - 1)³ - x²y³ - 0.1125z²y³ < 0
 *
 * 返回 Float32Array（每 3 个元素为一个点的 x,y,z），避免大量 Vector3 堆分配。
 */
export function generateChristmasHeartPositions(count: number): Float32Array {
  return generateHeartPositions(count, 14, 45)
}

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
