import GiftClient from './GiftClient'
import fs from 'fs'
import path from 'path'

export function generateStaticParams() {
  // Scan public/users/ for directories with config.json
  const usersDir = path.join(process.cwd(), 'public', 'users')
  if (!fs.existsSync(usersDir)) return []

  return fs.readdirSync(usersDir, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isDirectory()) return false
      const configPath = path.join(usersDir, entry.name, 'config.json')
      return fs.existsSync(configPath)
    })
    .map((entry) => ({ userId: entry.name }))
}

export default function GiftPage({ params }: { params: { userId: string } }) {
  return <GiftClient userId={params.userId} />
}
