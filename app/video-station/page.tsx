"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import VideoGrid from "@/app/video-station/components/VideoGrid";
import DirectoryTree from "@/app/video-station/components/DirectoryTree";
import VideoPlayer from "@/app/video-station/components/VideoPlayer";
import { fetchDirectories, fetchVideos, clearVideoCache } from "@/app/video-station/lib/s3-client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VideoMetadata } from "@/app/video-station/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Search } from "lucide-react";
import { useVirtualizer } from '@tanstack/react-virtual';
import { Sidebar } from "@/components/ui/sidebar";
import { useSearchParams } from "next/navigation";

export default function VideoStation() {
  const [directories, setDirectories] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [allVideos, setAllVideos] = useState<VideoMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoMetadata | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const ITEMS_PER_PAGE = 12;
  const searchDebounceRef = useRef<NodeJS.Timeout>();
  const searchHistoryRef = useRef<Set<string>>(new Set());
  
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams()

  // 从 URL 恢复目录状态
  useEffect(() => {
    const currentPath = searchParams.get("path") || ""
    if (currentPath) {
      setCurrentPath(currentPath)
    }
  }, [searchParams])

  // 初始化加载
  useEffect(() => {
    const loadDirectories = async () => {
      try {
        const dirs = await fetchDirectories();
        setDirectories(dirs);
      } catch (error) {
        console.error('Failed to load directories:', error);
      }
    };

    loadDirectories();
  }, []);

  // 初始加载所有视频
  useEffect(() => {
    const loadAllVideos = async () => {
      try {
        const videoList = await fetchVideos("XOVideos");
        setAllVideos(videoList);
      } catch (error) {
        console.error('Failed to load all videos:', error);
      }
    };

    loadAllVideos();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadVideos = async () => {
      if (!currentPath) {
        if (isMounted) {
          setVideos(allVideos);
          setIsLoading(false);
        }
        return;
      }
      
      setIsLoading(true);
      setPage(1);
      setHasMore(true);
      
      try {
        const videoList = await fetchVideos(currentPath);
        if (isMounted) {
          setVideos(videoList);
        }
      } catch (error) {
        console.error('Failed to load videos:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadVideos();

    return () => {
      isMounted = false;
    };
  }, [currentPath, allVideos]);

  // 添加防抖函数
  const debouncedSearch = (value: string) => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 300);
  };

  // 计算字符串相似度（用于模糊搜索）
  const levenshteinDistance = (a: string, b: string) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + substitutionCost
        );
      }
    }

    return matrix[b.length][a.length];
  };

  // 判断字符串相似度是否达到阈值
  const isSimilar = (str1: string, str2: string, threshold = 0.7) => {
    const maxLength = Math.max(str1.length, str2.length);
    const distance = levenshteinDistance(str1, str2);
    return (maxLength - distance) / maxLength >= threshold;
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
    setCurrentPath("");
  };

  const handleDirectorySelect = (path: string) => {
    if (path === currentPath) return;
    setSearchQuery(""); // 清空搜索条件
    setVideos([]); // 清空当前视频列表
    clearVideoCache(currentPath); // 清除当前路径的缓存
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
    const query = searchQuery.toLowerCase().trim();
    if (!query) return currentPath ? videos : allVideos;

    const videosToSearch = currentPath ? videos : allVideos;
    const matchedVideoIds = new Set<string>();
    const results: { video: VideoMetadata; score: number }[] = [];

    // 智能搜索函数
    const searchVideo = (video: VideoMetadata) => {
      if (matchedVideoIds.has(video.id)) return;

      const title = video.title.toLowerCase();
      const author = video.author.toLowerCase();
      let score = 0;

      // 1. 完全匹配检查
      if (title === query || author === query) {
        score = 100;
      } else {
        // 2. 后缀匹配检查
        const ext = query.startsWith('.') ? query : `.${query}`;
        if (title.endsWith(ext)) {
          score += 80;
        }

        // 3. 关键词匹配检查
        const words = query.split(/\s+/);
        const matchedWords = words.filter(word => {
          const isInTitle = title.includes(word);
          const isInAuthor = author.includes(word);
          if (isInTitle) score += 60;
          if (isInAuthor) score += 50;
          return isInTitle || isInAuthor;
        });

        // 4. 模糊匹配检查
        words.forEach(word => {
          if (word.length > 2) {  // 只对长度大于2的词进行模糊匹配
            if (isSimilar(title, word, 0.8)) score += 40;
            if (isSimilar(author, word, 0.8)) score += 35;
          }
        });

        // 5. 额外加分项
        // 标题开头匹配加分
        if (title.startsWith(query)) score += 30;
        // 作者名开头匹配加分
        if (author.startsWith(query)) score += 25;
        // 单词边界匹配加分
        if (new RegExp(`\\b${query}\\b`).test(title)) score += 20;
        // 历史搜索相关加分
        if (searchHistoryRef.current.has(author)) score += 15;
      }

      if (score > 0) {
        matchedVideoIds.add(video.id);
        results.push({ video, score });
      }
    };

    // 处理所有视频
    videosToSearch.forEach(video => searchVideo(video));

    // 按分数排序并返回视频列表
    return results
      .sort((a, b) => b.score - a.score)
      .map(item => item.video);
  }, [videos, allVideos, searchQuery, currentPath]);

  // 更新标题显示逻辑
  const titleDisplay = useMemo(() => {
    if (searchQuery) {
      return `搜索: ${searchQuery}`;
    }
    return currentPath ? `浏览: ${currentPath}` : "所有视频";
  }, [searchQuery, currentPath]);

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

  // 记录搜索历史
  useEffect(() => {
    if (selectedVideo) {
      searchHistoryRef.current.add(selectedVideo.author);
    }
  }, [selectedVideo]);

  // 完全依赖ResizableSidebar组件的拖拽和折叠功能

  return (
    <div className="flex h-screen" ref={containerRef}>
      <Sidebar 
        className="p-4 flex flex-col h-screen"
      >
        <h2 className="text-xl font-bold mb-4 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">视频目录</h2>
        
        <ScrollArea className="flex-1">
          <DirectoryTree
            directories={directories}
            onDirectoryClick={handleDirectorySelect}
            currentPath={currentPath}
          />
        </ScrollArea>
      </Sidebar>

      <div className="flex-1 overflow-hidden">
        <div className="p-6">
          <div className="mb-6">
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder="搜索视频或作者（支持多关键词、后缀、模糊匹配）..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="pl-10 py-2 rounded-xl border-gray-200 focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-blue-500 dark:focus:ring-blue-500/30"
                />
              </div>
              <Button 
                onClick={() => setSearchQuery("")}
                className="rounded-xl border-gray-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all duration-200 dark:border-gray-700 dark:hover:bg-blue-900/20 dark:hover:border-blue-700 dark:hover:text-blue-400"
              >
                清除
              </Button>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {titleDisplay}
              <span className="text-sm font-normal ml-2 text-gray-500 dark:text-gray-400">
                {filteredVideos.length > 0 ? `(共 ${filteredVideos.length} 个视频)` : ''}
              </span>
            </h2>
          </div>

          <div 
            ref={scrollAreaRef} 
            className="overflow-auto pr-2 scrollbar-none" 
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
