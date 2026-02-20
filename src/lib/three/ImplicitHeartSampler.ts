import { Vector3 } from 'three'

/**
 * Generate heart-shaped positions using implicit surface sampling.
 * Heart equation: (x² + 2.25z² + y² - 1)³ - x²y³ - 0.1125z²y³ < 0
 */
export function generateChristmasHeartPositions(count: number): Vector3[] {
  return generateHeartPositions(count, 14, 45)
}

/**
 * 参数化爱心位置生成：可自定义缩放和 Y 偏移
 */
export function generateHeartPositions(count: number, scale: number, yOffset: number): Vector3[] {
  const positions: Vector3[] = []

  while (positions.length < count) {
    // 收紧包围盒至心形实际范围，接受率从 ~15% 提升至 ~35%
    const x = Math.random() * 2.6 - 1.3
    const y = Math.random() * 2.5 - 1.2
    const z = Math.random() * 1.6 - 0.8

    const x2 = x * x
    const y2 = y * y
    const z2 = z * z
    const a = x2 + 2.25 * z2 + y2 - 1
    const b = x2 * y2 * y + 0.1125 * z2 * y2 * y

    if (a * a * a - b < 0) {
      positions.push(
        new Vector3(
          x * scale,
          y * scale + yOffset,
          z * scale
        )
      )
    }
  }

  return positions
}
