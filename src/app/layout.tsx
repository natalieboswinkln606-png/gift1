import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const notoSerif = localFont({
  src: [
    { path: '../../public/fonts/NotoSerifSC-300.woff2', weight: '300', style: 'normal' },
    { path: '../../public/fonts/NotoSerifSC-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-noto-serif',
  display: 'swap',
})

const playfair = localFont({
  src: [
    { path: '../../public/fonts/PlayfairDisplay-700-latin.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '新年礼物',
  description: '数字化新年贺礼交互系统',
  robots: { index: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className={`${notoSerif.variable} ${playfair.variable}`}>
      <head />
      <body className="font-serif">{children}</body>
    </html>
  )
}
