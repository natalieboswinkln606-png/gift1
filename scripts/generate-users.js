const fs = require('fs')
const path = require('path')

const COLOR_SCHEMES = [
  {
    gradient: 'from-pink-500/20 to-purple-500/20',
    hoverBorder: 'hover:border-pink-400/50',
    iconBg: 'bg-pink-400/30',
    iconBgHover: 'group-hover:bg-pink-400/50',
  },
  {
    gradient: 'from-cyan-500/20 to-blue-500/20',
    hoverBorder: 'hover:border-cyan-400/50',
    iconBg: 'bg-cyan-400/30',
    iconBgHover: 'group-hover:bg-cyan-400/50',
  },
  {
    gradient: 'from-green-500/20 to-emerald-500/20',
    hoverBorder: 'hover:border-green-400/50',
    iconBg: 'bg-green-400/30',
    iconBgHover: 'group-hover:bg-green-400/50',
  },
  {
    gradient: 'from-orange-500/20 to-red-500/20',
    hoverBorder: 'hover:border-orange-400/50',
    iconBg: 'bg-orange-400/30',
    iconBgHover: 'group-hover:bg-orange-400/50',
  },
  {
    gradient: 'from-violet-500/20 to-fuchsia-500/20',
    hoverBorder: 'hover:border-violet-400/50',
    iconBg: 'bg-violet-400/30',
    iconBgHover: 'group-hover:bg-violet-400/50',
  },
]

const usersDir = path.join(__dirname, '..', 'public', 'users')
const outputPath = path.join(__dirname, '..', 'public', 'users.json')

if (!fs.existsSync(usersDir)) {
  console.warn('[generate-users] public/users/ directory not found')
  fs.writeFileSync(outputPath, '[]')
  process.exit(0)
}

const entries = fs.readdirSync(usersDir, { withFileTypes: true })
const users = []

for (const entry of entries) {
  if (!entry.isDirectory()) continue

  const userId = entry.name
  const configPath = path.join(usersDir, userId, 'config.json')

  if (!fs.existsSync(configPath)) {
    console.warn(`[generate-users] Skipping "${userId}": no config.json`)
    continue
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

    if (!config.name || !config.identifier) {
      console.warn(`[generate-users] Skipping "${userId}": missing name or identifier`)
      continue
    }

    const scheme = COLOR_SCHEMES[users.length % COLOR_SCHEMES.length]

    users.push({
      id: userId,
      displayName: `${config.name}的礼物`,
      subtitle: '点击进入专属新年祝福',
      emoji: '🎁',
      ...scheme,
    })
  } catch (err) {
    console.error(`[generate-users] Error reading config for "${userId}":`, err.message)
  }
}

// Sort alphabetically for deterministic output
users.sort((a, b) => a.id.localeCompare(b.id))

fs.writeFileSync(outputPath, JSON.stringify(users, null, 2))
console.log(`[generate-users] Generated users.json with ${users.length} user(s)`)
