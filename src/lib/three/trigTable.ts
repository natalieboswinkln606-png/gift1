// 快速三角函数查找表（512 条目 + 线性插值，误差 < 0.001）
export const TRIG_TABLE_SIZE = 512
const TRIG_TABLE_MASK = TRIG_TABLE_SIZE - 1
const TRIG_FACTOR = TRIG_TABLE_SIZE / (Math.PI * 2)
const SIN_TABLE = new Float32Array(TRIG_TABLE_SIZE)
const COS_TABLE = new Float32Array(TRIG_TABLE_SIZE)
for (let i = 0; i < TRIG_TABLE_SIZE; i++) {
  const a = (i / TRIG_TABLE_SIZE) * Math.PI * 2
  SIN_TABLE[i] = Math.sin(a)
  COS_TABLE[i] = Math.cos(a)
}
export function fastSin(x: number): number {
  // 将 x 归一化到 [0, TABLE_SIZE) 范围
  const idx = ((x * TRIG_FACTOR) % TRIG_TABLE_SIZE + TRIG_TABLE_SIZE) % TRIG_TABLE_SIZE
  const i = idx | 0
  const f = idx - i
  return SIN_TABLE[i] + f * (SIN_TABLE[(i + 1) & TRIG_TABLE_MASK] - SIN_TABLE[i])
}
export function fastCos(x: number): number {
  const idx = ((x * TRIG_FACTOR) % TRIG_TABLE_SIZE + TRIG_TABLE_SIZE) % TRIG_TABLE_SIZE
  const i = idx | 0
  const f = idx - i
  return COS_TABLE[i] + f * (COS_TABLE[(i + 1) & TRIG_TABLE_MASK] - COS_TABLE[i])
}
