"use client"

import { useState, useEffect } from "react"
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePathname, useRouter, useSearchParams, ReadonlyURLSearchParams } from "next/navigation"

interface DirectoryTreeProps {
  directories: string[]
  onDirectoryClick: (path: string) => void
  currentPath: string
  initialSearchParams?: ReadonlyURLSearchParams | null
}

export default function DirectoryTree({ 
  directories, 
  onDirectoryClick, 
  currentPath,
  initialSearchParams 
}: DirectoryTreeProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = initialSearchParams || searchParams

  // 从 URL 恢复目录状态
  useEffect(() => {
    const path = params ? params.get("path") || "" : ""
    if (path) {
      // 展开所有父目录
      const pathParts = path.split("/")
      const expandedPaths = new Set<string>()
      let currentPathBuilder = ""
      pathParts.forEach((part) => {
        if (part) {
          currentPathBuilder += (currentPathBuilder ? "/" : "") + part
          expandedPaths.add(currentPathBuilder)
        }
      })
      setExpandedDirs(expandedPaths)
    }
  }, [params])

  const toggleDirectory = (path: string) => {
    const newExpandedDirs = new Set(expandedDirs)
    if (newExpandedDirs.has(path)) {
      newExpandedDirs.delete(path)
    } else {
      newExpandedDirs.add(path)
    }
    setExpandedDirs(newExpandedDirs)
  }

  const handleDirectoryClick = (path: string) => {
    onDirectoryClick(path)
    // 更新 URL
    if (params) {
      const newParams = new URLSearchParams(params.toString())
      newParams.set("path", path)
      router.push(`${pathname}?${newParams.toString()}`)
    }
  }

  const renderDirectory = (path: string, level: number = 0) => {
    const parts = path.split("/")
    const name = parts[parts.length - 1]
    const isExpanded = expandedDirs.has(path)
    const isSelected = currentPath === path
    const hasChildren = directories.some(dir => dir.startsWith(path + "/"))

    return (
      <div key={path}>
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer hover:bg-accent",
            isSelected && "bg-accent",
            level > 0 && "ml-4"
          )}
          onClick={() => handleDirectoryClick(path)}
        >
          {hasChildren && (
            <button
              className="p-1 hover:bg-accent rounded-sm"
              onClick={(e) => {
                e.stopPropagation()
                toggleDirectory(path)
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-6" />}
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 text-blue-500" />
          ) : (
            <Folder className="h-4 w-4 text-blue-500" />
          )}
          <span className="text-sm">{name}</span>
        </div>
        {isExpanded && (
          <div>
            {directories
              .filter(dir => dir.startsWith(path + "/"))
              .map(dir => renderDirectory(dir, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {directories
        .filter(dir => !dir.includes("/"))
        .map(dir => renderDirectory(dir))}
    </div>
  )
} 