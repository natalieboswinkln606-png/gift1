/**
 * auto-generate-config.js
 * 
 * 扫描 public/users/ 下每个用户目录，根据 name.txt + christmas/ + starry/ 自动生成 config.json
 * 
 * 用户只需要：
 *   1. 创建文件夹 public/users/{userId}/
 *   2. 放一个 name.txt（内容为显示名字，如"小明"）
 *   3. 放照片到 christmas/ 子目录（可选）
 *   4. 放剪影图到 starry/ 子目录（可选，取第一张）
 * 
 * 脚本会自动生成/更新 config.json，已有的 config.json 也会同步照片列表变化
 */

const fs = require('fs')
const path = require('path')

const usersDir = path.join(__dirname, '..', 'public', 'users')
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])
const DEFAULT_BLESSING = '星河璀璨，入梦皆甜，万般心意皆有回响。'

// 星座日期范围
const ZODIAC_RANGES = [
  { sign: 'Capricorn',   startMonth: 12, startDay: 22, endMonth: 1,  endDay: 19 },
  { sign: 'Aquarius',    startMonth: 1,  startDay: 20, endMonth: 2,  endDay: 18 },
  { sign: 'Pisces',      startMonth: 2,  startDay: 19, endMonth: 3,  endDay: 20 },
  { sign: 'Aries',       startMonth: 3,  startDay: 21, endMonth: 4,  endDay: 19 },
  { sign: 'Taurus',      startMonth: 4,  startDay: 20, endMonth: 5,  endDay: 20 },
  { sign: 'Gemini',      startMonth: 5,  startDay: 21, endMonth: 6,  endDay: 21 },
  { sign: 'Cancer',      startMonth: 6,  startDay: 22, endMonth: 7,  endDay: 22 },
  { sign: 'Leo',         startMonth: 7,  startDay: 23, endMonth: 8,  endDay: 22 },
  { sign: 'Virgo',       startMonth: 8,  startDay: 23, endMonth: 9,  endDay: 22 },
  { sign: 'Libra',       startMonth: 9,  startDay: 23, endMonth: 10, endDay: 23 },
  { sign: 'Scorpio',     startMonth: 10, startDay: 24, endMonth: 11, endDay: 22 },
  { sign: 'Sagittarius', startMonth: 11, startDay: 23, endMonth: 12, endDay: 21 },
]

function getConstellation(birthday) {
  const parts = birthday.split('-')
  if (parts.length !== 2) return ''
  const month = parseInt(parts[0], 10)
  const day = parseInt(parts[1], 10)
  if (isNaN(month) || isNaN(day)) return ''

  for (const range of ZODIAC_RANGES) {
    if (range.startMonth > range.endMonth) {
      if ((month === range.startMonth && day >= range.startDay) ||
          (month === range.endMonth && day <= range.endDay)) {
        return range.sign
      }
    } else {
      if ((month === range.startMonth && day >= range.startDay) ||
          (month === range.endMonth && day <= range.endDay) ||
          (month > range.startMonth && month < range.endMonth)) {
        return range.sign
      }
    }
  }
  return ''
}

function isImage(filename) {
  return IMAGE_EXTS.has(path.extname(filename).toLowerCase())
}

function scanImages(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => {
      const fullPath = path.join(dir, f)
      return fs.statSync(fullPath).isFile() && isImage(f)
    })
    .sort()
}

function run() {
  try {
    if (!fs.existsSync(usersDir)) {
      console.log('[auto-config] public/users/ 不存在，跳过')
      return
    }

    const entries = fs.readdirSync(usersDir, { withFileTypes: true })
    let created = 0
    let updated = 0
    let skipped = 0

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const userId = entry.name
      const userDir = path.join(usersDir, userId)
      const nameTxtPath = path.join(userDir, 'name.txt')
      const configPath = path.join(userDir, 'config.json')
      const christmasDir = path.join(userDir, 'christmas')
      const starryDir = path.join(userDir, 'starry')

      // 必须有 name.txt
      if (!fs.existsSync(nameTxtPath)) {
        // 如果已有 config.json 但没有 name.txt，跳过（手动管理的用户）
        if (fs.existsSync(configPath)) {
          skipped++
          continue
        }
        console.warn(`[auto-config] 跳过 "${userId}": 缺少 name.txt`)
        skipped++
        continue
      }

      let displayName
      let birthday = ''
      try {
        const lines = fs.readFileSync(nameTxtPath, 'utf-8').split('\n').map(l => l.trim())
        displayName = lines[0] || ''
        // 第二行为生日（MM-DD 格式）
        if (lines[1] && /^\d{2}-\d{2}$/.test(lines[1])) {
          birthday = lines[1]
        }
      } catch (err) {
        console.error(`[auto-config] 错误 "${userId}": 无法读取 name.txt: ${err.message}`)
        skipped++
        continue
      }

      if (!displayName) {
        console.warn(`[auto-config] 跳过 "${userId}": name.txt 为空`)
        skipped++
        continue
      }

      // 扫描照片
      const christmasPhotos = scanImages(christmasDir).map(f => `christmas/${f}`)
      const starryImages = scanImages(starryDir)
      const starrySilhouette = starryImages.length > 0 ? `starry/${starryImages[0]}` : ''

      // 构建新 config
      const constellation = birthday ? getConstellation(birthday) : ''
      const newConfig = {
        name: displayName,
        identifier: userId,
        christmasPhotos,
        starrySilhouette,
        starryBlessing: DEFAULT_BLESSING,
      }
      // 仅在有星座数据时添加字段
      if (constellation) {
        newConfig.constellation = constellation
      }

      // 检查是否需要写入
      if (fs.existsSync(configPath)) {
        try {
          const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

          // 保留用户手动设置的 starryBlessing（如果不是默认值）
          if (existing.starryBlessing && existing.starryBlessing !== DEFAULT_BLESSING) {
            newConfig.starryBlessing = existing.starryBlessing
          }

          // 比较是否有变化
          const existingStr = JSON.stringify(existing, null, 2)
          const newStr = JSON.stringify(newConfig, null, 2)
          if (existingStr === newStr) {
            skipped++
            continue
          }

          // 有变化，更新
          try {
            fs.writeFileSync(configPath, newStr + '\n')
            console.log(`[auto-config] 更新 "${userId}": 照片列表已同步`)
            updated++
          } catch (err) {
            console.error(`[auto-config] 错误 "${userId}": 无法写入 config.json: ${err.message}`)
            skipped++
          }
        } catch (err) {
          // config.json 损坏，重新生成
          try {
            fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2) + '\n')
            console.log(`[auto-config] 重建 "${userId}": config.json 已损坏`)
            created++
          } catch (writeErr) {
            console.error(`[auto-config] 错误 "${userId}": 无法重建 config.json: ${writeErr.message}`)
            skipped++
          }
        }
      } else {
        // 新用户，创建 config.json
        try {
          fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2) + '\n')
          console.log(`[auto-config] 新建 "${userId}": config.json 已生成`)
          created++
        } catch (err) {
          console.error(`[auto-config] 错误 "${userId}": 无法创建 config.json: ${err.message}`)
          skipped++
        }
      }
    }

    console.log(`[auto-config] 完成: ${created} 新建, ${updated} 更新, ${skipped} 跳过`)
  } catch (err) {
    console.error(`ERROR: ${err.message}`)
    process.exit(1)
  }
}

run()
