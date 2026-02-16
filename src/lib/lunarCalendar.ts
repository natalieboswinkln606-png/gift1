/**
 * Gregorian → Chinese Lunar Calendar converter.
 * Self-contained with inline lookup tables (1900-2100).
 */

// Lunar calendar data: each hex encodes month lengths + leap month info
const LUNAR_INFO = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
  0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
  0x0d520,
]

const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
const MONTH_NAMES = ['正','二','三','四','五','六','七','八','九','十','冬','腊']
const DAY_NAMES = ['日','一','二','三','四','五','六','七','八','九','十']

function lYearDays(y: number): number {
  let sum = 348
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0
  }
  return sum + leapDays(y)
}

function leapMonth(y: number): number {
  return LUNAR_INFO[y - 1900] & 0xf
}

function leapDays(y: number): number {
  if (leapMonth(y)) {
    return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29
  }
  return 0
}

function monthDays(y: number, m: number): number {
  return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29
}

function formatDay(day: number): string {
  if (day === 10) return '初十'
  if (day === 20) return '二十'
  if (day === 30) return '三十'
  const prefixes = ['初','十','廿','卅']
  return prefixes[Math.floor(day / 10)] + DAY_NAMES[day % 10]
}

// Cache: lunar date string only changes once per day
let _cachedKey = ''
let _cachedResult = ''

/**
 * Convert a Date to formatted Chinese lunar date string.
 * e.g. "乙巳年正月十九"
 * Results are cached per calendar day.
 */
export function getLunarDateString(date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const key = `${y}-${m}-${d}`

  if (key === _cachedKey) return _cachedResult

  // Bounds check
  if (y < 1900 || y > 2100) return `${y}年`

  let offset = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 31)) / 86400000)

  let lunarYear = 1900
  let temp = 0
  for (lunarYear = 1900; lunarYear < 2101 && offset > 0; lunarYear++) {
    temp = lYearDays(lunarYear)
    offset -= temp
  }
  if (offset < 0) {
    offset += temp
    lunarYear--
  }

  const leap = leapMonth(lunarYear)
  let isLeap = false
  let lunarMonth = 0
  let i = 1

  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === leap + 1 && !isLeap) {
      i--
      isLeap = true
      temp = leapDays(lunarYear)
    } else {
      temp = monthDays(lunarYear, i)
    }
    if (isLeap && i === leap + 1) {
      isLeap = false
    }
    offset -= temp
  }

  if (offset === 0 && leap > 0 && i === leap + 1) {
    isLeap = !isLeap
    if (!isLeap) i--
  }
  if (offset < 0) {
    offset += temp
    i--
  }

  lunarMonth = i
  const lunarDay = offset + 1

  const ganIdx = (lunarYear - 3) % 10
  const zhiIdx = (lunarYear - 3) % 12
  const ganZhi = GAN[(ganIdx + 10) % 10] + ZHI[(zhiIdx + 12) % 12]
  const leapStr = isLeap ? '闰' : ''
  const monthStr = leapStr + MONTH_NAMES[lunarMonth - 1] + '月'
  const dayStr = formatDay(lunarDay)

  const result = `${ganZhi}年${monthStr}${dayStr}`
  _cachedKey = key
  _cachedResult = result
  return result
}
