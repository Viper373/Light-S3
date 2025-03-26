"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import VideoGrid from "@/app/video-station/components/VideoGrid";
import DirectoryTree from "@/app/video-station/components/DirectoryTree";
import VideoPlayer from "@/app/video-station/components/VideoPlayer";
import { fetchDirectories, fetchVideos } from "@/app/video-station/lib/s3-client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VideoMetadata } from "@/app/video-station/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Search } from "lucide-react";
import { useVirtualizer } from '@tanstack/react-virtual';

export default function VideoStation() {
  const [directories, setDirectories] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoMetadata | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(30); // 默认宽度为30%
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const ITEMS_PER_PAGE = 12;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef<boolean>(false);
  const lastWidthRef = useRef<number>(30);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDirectories = async () => {
      try {
        const dirs = await fetchDirectories();
        setDirectories(dirs);
      } catch (error) {
        // 错误处理
      }
    };

    loadDirectories();
  }, []);

  useEffect(() => {
    const loadVideos = async () => {
      setIsLoading(true);
      setPage(1); // 重置页码
      setHasMore(true); // 重置加载状态
      try {
        const videoList = await fetchVideos(currentPath);
        setVideos(videoList);
      } catch (error) {
        // 错误处理
      } finally {
        setIsLoading(false);
      }
    };

    loadVideos();
  }, [currentPath]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleDirectoryClick = (path: string) => {
    setCurrentPath(path);
  };

  const handleVideoClick = (video: VideoMetadata) => {
    setSelectedVideo(video);
    setIsPlayerOpen(true);
  };

  const handleClosePlayer = () => {
    setIsPlayerOpen(false);
  };

  const filteredVideos = useMemo(() => {
    return videos.filter((video) =>
      video.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [videos, searchQuery]);

  // 计算当前页面显示的视频
  const paginatedVideos = useMemo(() => {
    return filteredVideos.slice(0, page * ITEMS_PER_PAGE);
  }, [filteredVideos, page]);

  // 检测滚动加载更多
  const handleScroll = () => {
    if (scrollAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
      // 当滚动到底部附近时加载更多
      if (scrollHeight - scrollTop - clientHeight < 200 && !isLoading && hasMore) {
        if (page * ITEMS_PER_PAGE < filteredVideos.length) {
          setPage(prev => prev + 1);
        } else {
          setHasMore(false);
        }
      }
    }
  };

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      scrollArea.addEventListener('scroll', handleScroll);
      return () => {
        scrollArea.removeEventListener('scroll', handleScroll);
      };
    }
  }, [page, isLoading, hasMore, filteredVideos.length]);

  useEffect(() => {
    const container = containerRef.current;
    const sidebar = sidebarRef.current;
    if (!container || !sidebar) return;

    let startX = 0;
    let startWidth = 0;
    let animationFrameId: number | null = null;
    
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('resize-handle')) return;
      
      e.preventDefault();
      isResizingRef.current = true;
      startX = e.clientX;
      startWidth = sidebar.offsetWidth;
      
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      sidebar.style.transition = 'none';
    };
    
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        if (!container || !sidebar) return;
        
        const containerWidth = container.offsetWidth;
        const delta = e.clientX - startX;
        const newWidthPx = Math.max(containerWidth * 0.15, Math.min(containerWidth * 0.5, startWidth + delta));
        const newWidthPercent = (newWidthPx / containerWidth) * 100;
        
        sidebar.style.width = `${newWidthPercent}%`;
        lastWidthRef.current = newWidthPercent;
      });
    };
    
    const onMouseUp = () => {
      if (!isResizingRef.current) return;
      
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      sidebar.style.transition = '';
      
      setSidebarWidth(lastWidthRef.current);
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };
    
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  const toggleSidebar = (expand: boolean) => {
    setSidebarWidth(expand ? 30 : 0);
    lastWidthRef.current = expand ? 30 : 0;
    
    if (sidebarRef.current) {
      sidebarRef.current.style.width = `${expand ? 30 : 0}%`;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950" ref={containerRef}>
      <div 
        ref={sidebarRef}
        className={`bg-white dark:bg-gray-800 p-4 shadow-lg relative transition-all duration-300 rounded-r-xl ${sidebarWidth === 0 ? 'hidden' : ''}`}
        style={{ width: `${sidebarWidth}%` }}
        data-component-name="VideoStation"
      >
        <h2 className="text-xl font-bold mb-4 mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">视频目录</h2>
        
        <div className="absolute top-4 right-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors duration-200" 
            onClick={() => toggleSidebar(false)}
            title="收起侧边栏"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <DirectoryTree
            directories={directories}
            onDirectoryClick={handleDirectoryClick}
            currentPath={currentPath}
          />
        </ScrollArea>
        
        <div 
          className="absolute top-0 right-0 w-4 h-full cursor-col-resize bg-transparent hover:bg-gradient-to-r from-transparent to-gray-300 dark:hover:to-gray-600 hover:bg-opacity-70 transition-colors resize-handle"
        />
      </div>

      <div className="flex-1 p-6 overflow-hidden">
        {sidebarWidth === 0 && (
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8 mb-4 rounded-full shadow-sm hover:shadow-md transition-all duration-200 border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600" 
            onClick={() => toggleSidebar(true)}
            title="展开侧边栏"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        
        <div className="mb-6 flex">
          <div className="relative w-full mr-2">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <Input
              type="text"
              placeholder="搜索视频..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-10 py-2 rounded-xl border-gray-200 focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-blue-500 dark:focus:ring-blue-500/30"
            />
          </div>
          <Button 
            onClick={() => setSearchQuery("")}
            className="rounded-xl border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800"
          >
            清除
          </Button>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {currentPath ? `浏览: ${currentPath}` : "所有视频"}
            <span className="text-sm font-normal ml-2 text-gray-500 dark:text-gray-400">
              {filteredVideos.length > 0 ? `(共 ${filteredVideos.length} 个视频)` : ''}
            </span>
          </h2>
        </div>

        <div 
          ref={scrollAreaRef} 
          className="overflow-auto pr-2" 
          style={{ height: 'calc(100vh - 200px)' }}
        >
          <VideoGrid
            videos={paginatedVideos}
            isLoading={isLoading}
            onVideoClick={handleVideoClick}
          />
          
          {isLoading && page > 1 && (
            <div className="flex justify-center my-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
          )}
          
          {!isLoading && !hasMore && filteredVideos.length > ITEMS_PER_PAGE && (
            <div className="text-center my-6 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 py-3 rounded-xl shadow-sm">
              已加载全部视频
            </div>
          )}
        </div>
      </div>

      {isPlayerOpen && selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-4/5 h-4/5 bg-black rounded-xl overflow-hidden relative shadow-2xl">
            <Button
              className="absolute top-3 right-3 z-10 rounded-full hover:bg-red-600 transition-colors duration-200"
              variant="destructive"
              onClick={handleClosePlayer}
            >
              关闭
            </Button>
            <VideoPlayer video={selectedVideo} />
          </div>
        </div>
      )}
    </div>
  );
}
