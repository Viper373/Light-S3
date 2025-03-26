import type { Metadata } from 'next'
import './globals.css'
import { Inter, Noto_Sans_SC } from 'next/font/google'
import Header from '@/components/Header'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })
const notoSansSC = Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-noto-sans-sc' })

export const metadata: Metadata = {
  title: '🌈 Light-S4·微光小溪',
  description: '基于 Next.js 的 S3 兼容存储服务浏览器，提供直观的用户界面浏览、查看和管理存储在 S3 兼容存储服务中的文件。',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.variable} ${notoSansSC.variable} font-sans`}>
        <Header />
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}
