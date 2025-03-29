"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Clock, User } from "lucide-react";
import Image from "next/image";

interface VideoProps {
  id: string;
  title: string;
  author: string;
  duration: string;
  views: number;
  thumbnailUrl: string;
  videoUrl: string;
}

interface VideoGridProps {
  videos: VideoProps[];
  isLoading: boolean;
  onVideoClick: (video: VideoProps) => void;
}

const VideoCard = ({ video, onClick }: { video: VideoProps; onClick: () => void }) => {
  // 确保视频数据存在
  if (!video) return null;
  return (
    <Card 
      className="overflow-hidden group cursor-pointer rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 dark:border-gray-800 dark:bg-gray-900 transform hover:scale-[1.02]" 
      onClick={onClick}
    >
      <div className="relative aspect-video overflow-hidden rounded-t-xl">
        <Image
          src={video.thumbnailUrl || '/placeholder.svg'}
          alt={video.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105 group-hover:brightness-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          unoptimized={true}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center backdrop-blur-sm">
          <User size={12} className="mr-1 text-blue-400" />
          {video.author || '未知作者'}
        </div>
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center backdrop-blur-sm">
          <Clock size={12} className="mr-1 text-amber-400" />
          {video.duration || '00:00'}
        </div>
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center backdrop-blur-sm">
          <Play size={12} className="mr-1 text-green-400" />
          {formatViews(video.views || 0)}
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full p-3 shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play className="h-6 w-6" />
          </div>
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-medium line-clamp-2 text-sm group-hover:text-blue-600 transition-colors duration-200 dark:group-hover:text-blue-400">{video.title}</h3>
      </CardContent>
    </Card>
  );
};

const VideoSkeleton = () => {
  return (
    <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <Skeleton className="aspect-video w-full rounded-lg" />
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-2/3 rounded-md" />
    </div>
  );
};

const formatViews = (views: number): string => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  } else if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
};

const VideoGrid = ({ videos, isLoading, onVideoClick }: VideoGridProps) => {
  if (isLoading && videos.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <VideoSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-xl border border-gray-200 shadow-sm dark:bg-gray-800/50 dark:border-gray-700">
        <p className="text-gray-500 dark:text-gray-400">没有找到视频</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} onClick={() => onVideoClick(video)} />
      ))}
    </div>
  );
};

export default VideoGrid;
