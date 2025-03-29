"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MoonIcon, SunIcon, UserIcon, GithubIcon, BookOpenIcon, BellIcon, CheckIcon } from "lucide-react"
import { useState, useEffect } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Notification {
  id: string;
  title: string;
  content: string;
  time: string;
  read: boolean;
}

export default function Header() {
  const pathname = usePathname()
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [hasNotifications, setHasNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

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

    // 模拟通知数据
    const mockNotifications: Notification[] = [
      {
        id: '1',
        title: '系统通知',
        content: '欢迎使用 Light-S4·微光小溪',
        time: '刚刚',
        read: false
      },
      {
        id: '2',
        title: '更新提醒',
        content: '系统已更新到最新版本',
        time: '10分钟前',
        read: false
      },
      {
        id: '3',
        title: '文件上传完成',
        content: '您的文件已成功上传到云端',
        time: '30分钟前',
        read: false
      }
    ]
    setNotifications(mockNotifications)
    setHasNotifications(true)
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

  // 标记所有通知为已读
  const markAllAsRead = () => {
    setNotifications(notifications.map(notification => ({
      ...notification,
      read: true
    })))
    setHasNotifications(false)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-background dark:bg-gray-950/80 backdrop-blur-sm">
      <div className="container max-w-screen-2xl mx-auto px-4 flex h-16 items-center">
        <div className="flex-shrink-0 w-auto pl-0">
          <Link href="/" className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-2xl font-bold emoji inline-block">🌈</span>
            <span className="text-2xl font-bold gradient-text leading-normal whitespace-nowrap">Light-S4·微光小溪</span>
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
          <Link
            href="/s3-manager"
            className={`text-lg font-medium transition-colors ${pathname.startsWith("/s3-manager")
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
              }`}
          >
            文件管理
          </Link>
        </nav>

        <div className="flex items-center gap-3 justify-end flex-shrink-0 ml-auto">
          <TooltipProvider>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  aria-label="通知"
                >
                  <BellIcon className="h-5 w-5" />
                  {hasNotifications && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-80 p-0 border dark:border-gray-700 dark:bg-gray-900">
                <div className="max-h-[300px] overflow-auto scrollbar-none">
                  <div className="p-4 border-b dark:border-gray-700">
                    <h3 className="font-medium">通知</h3>
                  </div>
                  
                  <div className="divide-y dark:divide-gray-700">
                    {notifications.map((notification, index) => (
                      <div 
                        key={index} 
                        className={`p-4 hover:bg-accent ${notification.read ? 'opacity-60' : ''}`}
                      >
                        <div className="font-medium mb-1">{notification.title}</div>
                        <p className="text-sm text-muted-foreground">{notification.content}</p>
                        <div className="text-xs text-gray-500 mt-2">{notification.time}</div>
                      </div>
                    ))}
                    
                    {notifications.length === 0 && (
                      <div className="p-4 text-center text-muted-foreground">
                        暂无通知
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-2 border-t dark:border-gray-700 flex justify-end">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-blue-500"
                    onClick={markAllAsRead}
                  >
                    <CheckIcon className="h-4 w-4 mr-1" />
                    全部已读
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="https://github.com/Viper373/LightS4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  aria-label="GitHub 仓库"
                >
                  <GithubIcon className="h-5 w-5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>GitHub 仓库</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="https://blog.viper3.top"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  aria-label="博客"
                >
                  <BookOpenIcon className="h-5 w-5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>博客</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>
                {isDarkMode ? "切换到亮色模式" : "切换到暗色模式"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  aria-label="用户登录"
                >
                  <UserIcon className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>用户登录</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </header>
  )
}
