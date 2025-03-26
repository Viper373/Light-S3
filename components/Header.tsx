"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MoonIcon, SunIcon, UserIcon, GithubIcon, BookOpenIcon } from "lucide-react"
import { useState, useEffect } from "react"

export default function Header() {
  const pathname = usePathname()
  const [isDarkMode, setIsDarkMode] = useState(false)

  // 检测并设置暗色模式
  useEffect(() => {
    // 检查系统偏好
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    // 检查本地存储
    const storedTheme = localStorage.getItem("theme")

    const initialDarkMode = storedTheme === "dark" || (!storedTheme && prefersDark)
    setIsDarkMode(initialDarkMode)

    if (initialDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [])

  // 切换暗色模式
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)

    if (newDarkMode) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
      <div className="container max-w-screen-2xl mx-auto px-4 flex h-16 items-center">
        <div className="flex-shrink-0 w-1/4 -ml-20">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold emoji">🌈</span>
            <span className="text-2xl font-bold gradient-text">Light-S4·微光小溪</span>
          </Link>
        </div>

        <nav
          className="hidden md:flex items-center justify-center gap-8 text-center flex-1"
        >
          <Link
            href="/"
            className={`text-lg font-medium transition-colors ${pathname === "/"
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
              }`}
          >
            首页
          </Link>
          <Link
            href="/video-station"
            className={`text-lg font-medium transition-colors ${pathname.startsWith("/video-station")
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
              }`}
          >
            在线视频站
          </Link>
        </nav>

        <div className="flex items-center gap-4 justify-end flex-shrink-0 w-1/6">
          <a
            href="https://github.com/Viper373/LightS4"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="GitHub 仓库"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </a>
          <a
            href="https://blog.viper3.top"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="博客"
          >
            <BookOpenIcon className="h-5 w-5" />
          </a>
          <button
            onClick={toggleDarkMode}
            className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label={isDarkMode ? "切换到亮色模式" : "切换到暗色模式"}
          >
            {isDarkMode ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </button>
          <button
            className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="用户登录"
          >
            <UserIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
