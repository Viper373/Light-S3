"use client";

import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchDirectoryMetadata } from "@/app/s3-manager/lib/s3-client";
import { DirectoryMetadata } from "@/app/s3-manager/lib/types";

interface DirectoryTreeProps {
  directories: string[];
  onDirectoryClick: (path: string) => void;
  currentPath: string;
}

interface DirectoryNode {
  name: string;
  path: string;
  children: DirectoryNode[];
  metadata?: DirectoryMetadata;
  isLoading?: boolean;
}

const DirectoryTree: React.FC<DirectoryTreeProps> = ({
  directories,
  onDirectoryClick,
  currentPath,
}) => {
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [directoryMetadata, setDirectoryMetadata] = useState<Record<string, DirectoryMetadata>>({});
  const [directoryTree, setDirectoryTree] = useState<DirectoryNode[]>([]);

  // 构建目录树结构
  const buildDirectoryTree = (dirs: string[]): DirectoryNode[] => {
    const root: DirectoryNode[] = [];
    const map: Record<string, DirectoryNode> = {};

    // 按照路径排序，确保父目录先被处理
    const sortedDirs = [...dirs].sort((a, b) => a.localeCompare(b));

    sortedDirs.forEach((dir) => {
      const parts = dir.split("/").filter(Boolean);
      let currentPath = "";
      let currentLevel = root;

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!map[currentPath]) {
          const newNode: DirectoryNode = {
            name: part,
            path: currentPath,
            children: [],
            isLoading: true
          };
          
          map[currentPath] = newNode;
          currentLevel.push(newNode);
          
          loadDirectoryMetadata(currentPath);
        }
        
        currentLevel = map[currentPath].children;
      });
    });

    return root;
  };

  // 根据路径查找节点
  const findNodeByPath = (nodes: DirectoryNode[], path: string): DirectoryNode | null => {
    for (const node of nodes) {
      if (node.path === path) {
        return node;
      }
      if (node.children.length > 0) {
        const found = findNodeByPath(node.children, path);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  // 加载目录元数据
  const loadDirectoryMetadata = async (path: string) => {
    try {
      const metadata = await fetchDirectoryMetadata(path);
      
      setDirectoryMetadata(prev => {
        const newState = { ...prev, [path]: metadata };
        return newState;
      });
    } catch (error) {
    }
  };

  // 初始化目录树
  useEffect(() => {
    if (directories.length > 0) {
      setDirectoryTree(buildDirectoryTree(directories));
    }
  }, [directories]);
  
  // 当目录展开时，加载其子目录的元数据
  useEffect(() => {
    Object.entries(expandedDirs).forEach(([path, isExpanded]) => {
      if (isExpanded) {
        const node = findNodeByPath(directoryTree, path);
        if (node) {
          node.children.forEach(child => {
            if (!directoryMetadata[child.path]) {
              loadDirectoryMetadata(child.path);
            } 
          });
        }
      }
    });
  }, [expandedDirs, directoryTree, directoryMetadata]);

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const renderDirectoryNode = (node: DirectoryNode, level = 0) => {
    const isExpanded = expandedDirs[node.path];
    const isActive = currentPath === node.path;
    const metadata = directoryMetadata[node.path];
    
    return (
      <div key={node.path} className="select-none">
        <div
          className={cn(
            "flex flex-col py-2 px-3 rounded-lg transition-all duration-200",
            isActive 
              ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 dark:from-blue-900/20 dark:to-indigo-900/20 dark:text-blue-400 shadow-sm" 
              : "hover:bg-gray-50 dark:hover:bg-gray-800/50",
            "my-1 cursor-pointer"
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => {
            // 先展开/折叠目录，然后再触发目录点击事件
            if (node.children.length > 0) {
              toggleDir(node.path);
            }
            // 确保目录点击事件被正确触发
            onDirectoryClick(node.path);
          }}
        >
          <div className="flex items-center w-full">
            {node.children.length > 0 ? (
              <span 
                className={cn(
                  "mr-1.5 flex items-center justify-center rounded-full transition-colors duration-200",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                )} 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDir(node.path);
                }}
              >
                {isExpanded ? 
                  <ChevronDown size={16} className="transition-transform duration-200" /> : 
                  <ChevronRight size={16} className="transition-transform duration-200" />
                }
              </span>
            ) : (
              <span className="w-4 mr-1.5"></span>
            )}
            <Folder 
              size={16} 
              className={cn(
                "mr-2 transition-colors duration-200",
                isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
              )} 
            />
            <span className="truncate font-medium text-sm">{node.name}</span>
            {metadata ? (
              <span className={cn(
                "ml-auto text-xs px-2 py-0.5 rounded-full",
                isActive 
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              )}>
                {metadata.fileCount}
              </span>
            ) : node.isLoading ? (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 animate-pulse">
                加载中...
              </span>
            ) : (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                0
              </span>
            )}
          </div>
          
          {metadata && metadata.lastUpdated !== '未知' && metadata.fileCount > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 ml-8 mt-1.5 flex items-center">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 opacity-70"></span>
              最近更新: {metadata.lastUpdated}
            </div>
          )}
        </div>
        
        {isExpanded && node.children.length > 0 && (
          <div className="ml-2 border-l-2 border-gray-100 dark:border-gray-800 pl-2">
            {node.children.map((child) => renderDirectoryNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-2">
      {directoryTree.map((node) => renderDirectoryNode(node))}
    </div>
  );
};

export default DirectoryTree;