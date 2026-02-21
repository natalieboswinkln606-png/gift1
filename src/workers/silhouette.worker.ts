/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope
export {} // 确保被视为模块

interface WorkerInput {
  type: 'PROCESS'
  buffer: ArrayBuffer
  width: number
  height: number
  bgTolerance: number
  edgeThreshold: number
}

interface WorkerOutput {
  type: 'RESULT'
  buffer: ArrayBuffer
  width: number
  height: number
}

/**
 * 优化版图像处理流水线（减少内存分配 + 合并循环）：
 * 灰度化+边框采样(合并) → Sobel 边缘检测 → 膨胀+归一化+输出(合并)
 */
self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { type, buffer, width: w, height: h, bgTolerance, edgeThreshold } = e.data
  if (type !== 'PROCESS') return

  const src = new Uint8ClampedArray(buffer)
  const total = w * h

  // Pass 1: 灰度化 + 边框采样（合并为一次遍历）
  const gray = new Float32Array(total)
  let borderSum = 0
  let borderCount = 0

  for (let i = 0; i < total; i++) {
    const g = src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114
    gray[i] = g
    const x = i % w
    const y = (i - x) / w
    if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
      borderSum += g
      borderCount++
    }
  }

  const avgBg = borderCount > 0 ? borderSum / borderCount : 128

  // Pass 2: Sobel 边缘检测 + 跟踪最大值
  const edges = new Float32Array(total)
  let maxEdge = 0

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      if (Math.abs(gray[idx] - avgBg) < bgTolerance) continue

      const tl = gray[(y - 1) * w + (x - 1)]
      const tr = gray[(y - 1) * w + (x + 1)]
      const ml = gray[y * w + (x - 1)]
      const mr = gray[y * w + (x + 1)]
      const bl = gray[(y + 1) * w + (x - 1)]
      const bc = gray[(y + 1) * w + x]
      const br = gray[(y + 1) * w + (x + 1)]
      const tc = gray[(y - 1) * w + x]

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br
      const mag = Math.sqrt(gx * gx + gy * gy)
      edges[idx] = mag
      if (mag > maxEdge) maxEdge = mag
    }
  }

  // Pass 3: 膨胀(3×3 max) + 归一化 + 输出（合并，不再分配 dilated 数组）
  // 膨胀不会增大最大值，maxEdge 仍然有效
  const invMax = maxEdge > 0 ? 1 / maxEdge : 0
  const out = new Uint8ClampedArray(total * 4)

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      // 内联 3×3 max pooling（避免内层循环开销）
      const row0 = (y - 1) * w + x
      const row1 = y * w + x
      const row2 = (y + 1) * w + x
      let maxVal = edges[row0 - 1]
      const v1 = edges[row0]; if (v1 > maxVal) maxVal = v1
      const v2 = edges[row0 + 1]; if (v2 > maxVal) maxVal = v2
      const v3 = edges[row1 - 1]; if (v3 > maxVal) maxVal = v3
      const v4 = edges[row1]; if (v4 > maxVal) maxVal = v4
      const v5 = edges[row1 + 1]; if (v5 > maxVal) maxVal = v5
      const v6 = edges[row2 - 1]; if (v6 > maxVal) maxVal = v6
      const v7 = edges[row2]; if (v7 > maxVal) maxVal = v7
      const v8 = edges[row2 + 1]; if (v8 > maxVal) maxVal = v8

      const normalized = maxVal * invMax
      if (normalized > edgeThreshold) {
        const i4 = row1 * 4
        out[i4] = 255
        out[i4 + 1] = 255
        out[i4 + 2] = 255
        out[i4 + 3] = Math.min(255, normalized * 220)
      }
    }
  }

  const resultBuffer = out.buffer

  const output: WorkerOutput = {
    type: 'RESULT',
    buffer: resultBuffer,
    width: w,
    height: h,
  }

  self.postMessage(output, { transfer: [resultBuffer] })
}
