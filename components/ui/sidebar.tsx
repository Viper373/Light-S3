// sidebar.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// 侧边栏相关常量
const SIDEBAR_COOKIE_NAME = "sidebar:state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30天
const SIDEBAR_WIDTH_COOKIE_NAME = "sidebar:width";
const DEFAULT_SIDEBAR_WIDTH = 400; // 默认宽度，单位为像素
const MIN_SIDEBAR_WIDTH = 200; // 最小宽度
const MAX_SIDEBAR_WIDTH = 800; // 最大宽度
const COLLAPSED_WIDTH = 60; // 收起状态的宽度

// Sidebar 组件
interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  defaultWidth?: number;
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ defaultOpen = true, defaultWidth = DEFAULT_SIDEBAR_WIDTH, className, children, ...props }, ref) => {
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = React.useState(defaultOpen);
    const [sidebarWidth, setSidebarWidth] = React.useState(defaultWidth);
    const [isDragging, setIsDragging] = React.useState(false);
    const sidebarRef = React.useRef<HTMLDivElement>(null);
    const startXRef = React.useRef(0);
    const startWidthRef = React.useRef(0);

    // 从cookie中获取侧边栏状态和宽度
    React.useEffect(() => {
      const cookies = document.cookie.split("; ");
      const stateCookie = cookies.find((cookie) => cookie.startsWith(`${SIDEBAR_COOKIE_NAME}=`));
      const widthCookie = cookies.find((cookie) => cookie.startsWith(`${SIDEBAR_WIDTH_COOKIE_NAME}=`));

      if (stateCookie) {
        const state = stateCookie.split("=")[1];
        setIsOpen(state === "true");
      }

      if (widthCookie) {
        const width = parseInt(widthCookie.split("=")[1], 10);
        if (!isNaN(width) && width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
          setSidebarWidth(width);
        }
      }
    }, []);

    // 保存侧边栏状态和宽度到cookie
    React.useEffect(() => {
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${isOpen}; max-age=${SIDEBAR_COOKIE_MAX_AGE}; path=/`;
    }, [isOpen]);

    React.useEffect(() => {
      document.cookie = `${SIDEBAR_WIDTH_COOKIE_NAME}=${sidebarWidth}; max-age=${SIDEBAR_COOKIE_MAX_AGE}; path=/`;
    }, [sidebarWidth]);

    // 切换侧边栏状态
    const toggleSidebar = React.useCallback(() => {
      setIsOpen((prev) => !prev);
    }, []);

    // 开始拖动
    const startDragging = React.useCallback((e: React.MouseEvent) => {
      if (isMobile || !isOpen) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      startXRef.current = e.clientX;
      startWidthRef.current = sidebarWidth;
      setIsDragging(true);
      
      // 添加全局样式
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      // 添加事件监听
      const handleDrag = (e: MouseEvent) => {
        e.preventDefault();
        const delta = e.clientX - startXRef.current;
        const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidthRef.current + delta));
        
        setSidebarWidth(newWidth);
        if (sidebarRef.current) {
          sidebarRef.current.style.width = `${newWidth}px`;
        }
      };
      
      const handleDragEnd = () => {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
      };
      
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleDragEnd);
    }, [isMobile, isOpen, sidebarWidth]);

    return (
      <div className="relative flex h-full">
        {/* 主侧边栏容器 */}
        <div
          ref={sidebarRef}
          className={cn(
            "flex flex-col bg-background overflow-x-hidden relative",
            isOpen ? "border-r border-r-slate-200 dark:border-r-slate-700" : "",
            className
          )}
          style={{
            width: isOpen ? `${sidebarWidth}px` : `${COLLAPSED_WIDTH}px`,
            minWidth: isOpen ? `${MIN_SIDEBAR_WIDTH}px` : `${COLLAPSED_WIDTH}px`,
            maxWidth: isOpen ? `${MAX_SIDEBAR_WIDTH}px` : `${COLLAPSED_WIDTH}px`,
            transition: isDragging ? 'none' : 'width 0.2s ease-out',
          }}
          {...props}
        >
          {/* 侧边栏内容 */}
          <div className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden scrollbar-none",
            !isOpen && "opacity-0"
          )}>
            {children}
          </div>
          
          {/* 侧边栏展开/收起按钮 */}
          <div className={cn(
            "absolute top-6",
            isOpen ? "right-2" : "-right-[0.02rem]"
          )}>
            <button
              onClick={toggleSidebar}
              className={cn(
                "group flex items-center gap-1.5",
                "bg-blue-500/10 dark:bg-blue-500/20",
                "hover:bg-blue-500/20 dark:hover:bg-blue-500/30",
                "rounded-full",
                "transition-all duration-200",
                "px-2.5 py-1.5",
                "w-[4.5rem]",
                "justify-start",
                "relative"
              )}
              aria-label={isOpen ? "收起侧边栏" : "展开侧边栏"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "text-blue-600 dark:text-blue-400",
                  "transition-transform duration-200",
                  isOpen ? "rotate-180" : "rotate-0",
                  "flex-shrink-0"
                )}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              <span className={cn(
                "text-xs font-medium text-blue-600 dark:text-blue-400",
                "transition-all duration-200",
                "whitespace-nowrap",
                "flex-1"
              )}>
                {isOpen ? "收起" : "展开"}
              </span>
            </button>
          </div>
        </div>
        
        {/* 拖动手柄 - 只在展开状态显示 */}
        {isOpen && (
          <div 
            className={cn(
              "absolute top-0 bottom-0 h-full w-1 cursor-col-resize",
              "right-0",
              "hover:bg-blue-300/30 dark:hover:bg-blue-700/30",
              "transition-colors duration-200",
              isDragging && "bg-blue-300/50 dark:bg-blue-700/50"
            )}
            style={{
              left: `${sidebarWidth - 1}px`,
              zIndex: 40
            }}
            onMouseDown={startDragging}
          />
        )}
      </div>
    );
  }
);

Sidebar.displayName = "Sidebar";

export { Sidebar };