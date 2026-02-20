/**
 * generate-music-list.js
 *
 * 扫描 public/music/ 目录下所有音频文件，生成 public/music.json
 * 格式：[{ name: "显示名称", url: "/music/文件名.mp3" }, ...]
 * 显示名称 = 文件名去掉扩展名
 */

const fs = require('fs')
const path = require('path')

const musicDir = path.join(__dirname, '..', 'public', 'music')
const outputPath = path.join(__dirname, '..', 'public', 'music.json')
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma'])

function run() {
  if (!fs.existsSync(musicDir)) {
    console.log('[music-list] public/music/ 不存在，生成空列表')
    fs.writeFileSync(outputPath, '[]')
    return
  }

  const files = fs.readdirSync(musicDir)
    .filter(f => {
      const ext = path.extname(f).toLowerCase()
      return AUDIO_EXTS.has(ext) && fs.statSync(path.join(musicDir, f)).isFile()
    })
    .sort()

  const playlist = files.map(f => ({
    name: path.basename(f, path.extname(f)),
    url: `/music/${f}`,
  }))

  fs.writeFileSync(outputPath, JSON.stringify(playlist, null, 2) + '\n')
  console.log(`[music-list] 生成 music.json: ${playlist.length} 首曲目`)
  playlist.forEach(item => console.log(`  - ${item.name}`))
}

run()
