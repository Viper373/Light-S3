import type { Metadata } from 'next'
import './globals.css'
import { Inter, Noto_Sans_SC } from 'next/font/google'
import Header from '@/components/Header'
import { cn } from '@/lib/utils'
import ClientThemeProvider from '@/components/client-theme-provider'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })
const notoSansSC = Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-noto-sans-sc' })

export const metadata: Metadata = {
  title: '🌈 Light-S4·微光小溪',
  description: '基于 Next.js 的 S3 兼容存储服务浏览器，提供直观的用户界面浏览、查看和管理存储在 S3 兼容存储服务中的文件。',
  manifest: '/manifest.json',
  themeColor: '#3b82f6',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Light-S4'
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    apple: '/icons/icon-192x192.png',
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Light-S4" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={cn(inter.variable, notoSansSC.variable, "font-sans scrollbar-none")} suppressHydrationWarning>
        <ClientThemeProvider>
          <ServiceWorkerRegistration />
          <Header />
          <main>
            {children}
          </main>
        </ClientThemeProvider>
      </body>
    </html>
  )
}
