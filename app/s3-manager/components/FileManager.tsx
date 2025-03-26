"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { Bell, Grid, LayoutGrid, Plus, Search, Upload, FolderPlus, Play } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useState, useEffect } from "react"
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { S3_CONFIG } from "../lib/s3-config"

interface NavItemProps {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
  active?: boolean
}

function NavItem({ href, icon, children, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-lg", active && "bg-gray-100")}
    >
      {icon}
      <span>{children}</span>
    </Link>
  )
}

function FolderItem({ path, name, onClick }: { path: string; name: string; onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>
      <span>{name}</span>
    </div>
  )
}

interface FileCardProps {
  title: string
  metadata: string
  thumbnail: string
  onClick?: () => void
}

function FileCard({ title, metadata, thumbnail, onClick }: FileCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-white cursor-pointer" onClick={onClick}>
      <div className="aspect-[4/3] overflow-hidden">
        <Image
          src={thumbnail || "/placeholder.svg"}
          alt={title}
          width={400}
          height={300}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{metadata}</p>
      </div>
    </div>
  )
}

interface S3Object {
  Key: string
  LastModified?: Date
  Size?: number
  IsDirectory?: boolean
}

export function FileManager() {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<S3Object | null>(null);
  
  // S3 客户端配置
  const s3Client = new S3Client({
    region: S3_CONFIG.region,
    endpoint: S3_CONFIG.endpoint,
    credentials: {
      accessKeyId: S3_CONFIG.accessKeyId,
      secretAccessKey: S3_CONFIG.secretAccessKey,
    },
    forcePathStyle: true, // 对于某些S3兼容服务，需要使用路径样式URL
  });

  // 获取文件和目录列表
  const fetchObjects = async (path: string) => {
    setIsLoading(true);
    try {
      const prefix = path ? `${path}/` : "";
      
      const command = new ListObjectsV2Command({
        Bucket: S3_CONFIG.bucket,
        Prefix: prefix,
        Delimiter: "/"
      });
      
      const response = await s3Client.send(command);
      
      // 处理目录
      const dirs: string[] = [];
      if (response.CommonPrefixes) {
        response.CommonPrefixes.forEach(prefix => {
          if (prefix.Prefix) {
            // 移除末尾的斜杠并获取目录名
            const dirPath = prefix.Prefix.replace(/\/$/, "");
            const dirName = dirPath.split('/').pop() || dirPath;
            dirs.push(dirPath);
          }
        });
      }
      setDirectories(dirs);
      
      // 处理文件
      const files: S3Object[] = [];
      if (response.Contents) {
        response.Contents.forEach(item => {
          if (item.Key && item.Key !== prefix) {
            files.push({
              Key: item.Key || '',
              LastModified: item.LastModified,
              Size: item.Size,
              IsDirectory: false
            });
          }
        });
      }
      setObjects(files);
    } catch (error) {
      console.error("Error fetching objects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理目录点击
  const handleDirectoryClick = (dirPath: string) => {
    setCurrentPath(dirPath);
  };

  // 处理返回上级目录
  const handleGoBack = () => {
    if (currentPath) {
      const pathParts = currentPath.split('/');
      pathParts.pop(); // 移除最后一个部分
      const newPath = pathParts.join('/');
      setCurrentPath(newPath);
    }
  };

  // 处理文件点击
  const handleFileClick = (file: S3Object) => {
    setSelectedFile(file);
  };

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const key = currentPath ? `${currentPath}/${file.name}` : file.name;
        
        const fileBuffer = await file.arrayBuffer();
        
        const command = new PutObjectCommand({
          Bucket: S3_CONFIG.bucket,
          Key: key,
          Body: new Uint8Array(fileBuffer),
          ContentType: file.type
        });
        
        await s3Client.send(command);
      }
      
      // 刷新文件列表
      fetchObjects(currentPath);
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  // 处理创建文件夹
  const handleCreateFolder = async () => {
    const folderName = prompt("请输入文件夹名称:");
    if (!folderName) return;
    
    try {
      const key = currentPath ? `${currentPath}/${folderName}/` : `${folderName}/`;
      
      const command = new PutObjectCommand({
        Bucket: S3_CONFIG.bucket,
        Key: key,
        Body: new Uint8Array(0) // 空内容，仅创建目录标记
      });
      
      await s3Client.send(command);
      
      // 刷新文件列表
      fetchObjects(currentPath);
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  // 处理删除文件
  const handleDeleteFile = async (key: string) => {
    if (!confirm(`确定要删除 ${key.split('/').pop()} 吗?`)) return;
    
    try {
      const command = new DeleteObjectCommand({
        Bucket: S3_CONFIG.bucket,
        Key: key
      });
      
      await s3Client.send(command);
      
      // 刷新文件列表
      fetchObjects(currentPath);
      
      // 如果删除的是当前选中的文件，清除选择
      if (selectedFile && selectedFile.Key === key) {
        setSelectedFile(null);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined) return "未知";
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // 格式化日期
  const formatDate = (date?: Date): string => {
    if (!date) return "未知";
    return date.toLocaleString();
  };

  // 获取文件扩展名
  const getFileExtension = (filename: string): string => {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
  };

  // 获取文件图标或缩略图
  const getFileThumbnail = (key: string): string => {
    const ext = getFileExtension(key).toLowerCase();
    const filename = key.split('/').pop() || "";
    
    // 图片文件显示缩略图
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      // 这里可以返回实际的S3图片URL，但需要处理签名
      return "/placeholder-logo.svg";
    }
    
    // 视频文件
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
      return "/placeholder.svg";
    }
    
    // 其他文件类型
    return "/placeholder.svg";
  };

  // 初始加载和路径变化时获取对象
  useEffect(() => {
    fetchObjects(currentPath);
  }, [currentPath]);

  // 过滤搜索结果
  const filteredObjects = objects.filter(obj => {
    const filename = obj.Key?.split('/').pop() || "";
    return filename.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex h-screen bg-white">
      {/* 侧边栏 */}
      <div className="w-64 border-r bg-white">
        <div className="p-4">
          <h1 className="text-xl font-bold">S3 文件管理</h1>
        </div>
        <nav className="space-y-1 px-2">
          <NavItem href="#" icon={<LayoutGrid className="h-4 w-4" />} active>
            所有文件
          </NavItem>
          <NavItem
            href="#"
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M15 3v18M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            }
          >
            文档
          </NavItem>
          <NavItem
            href="#"
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6m-3 4v6m-3-3h6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          >
            图片
          </NavItem>
          <div className="py-3">
            <div className="px-3 text-xs font-medium uppercase text-gray-500">目录</div>
            <div className="mt-2">
              {directories.map((dir) => {
                const dirName = dir.split('/').pop() || dir;
                return (
                  <FolderItem 
                    key={dir} 
                    path={dir} 
                    name={dirName} 
                    onClick={() => handleDirectoryClick(dir)} 
                  />
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      {/* 主内容区 */}
      <div className="flex-1">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div className="w-96">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input 
                type="search" 
                placeholder="搜索文件..." 
                className="pl-9" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Grid className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="h-8 w-8 overflow-hidden rounded-full">
              <Image
                src="/placeholder-user.jpg"
                alt="Avatar"
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </header>

        <div className="p-6">
          <div className="mb-6 flex items-center gap-4">
            {currentPath && (
              <Button variant="outline" className="gap-2" onClick={handleGoBack}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M19 12H5M12 19l-7-7 7-7"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                返回上级
              </Button>
            )}
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              创建
            </Button>
            <Button variant="outline" className="gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Upload className="h-4 w-4" />
                上传
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  multiple 
                />
              </label>
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleCreateFolder}>
              <FolderPlus className="h-4 w-4" />
              创建文件夹
            </Button>
          </div>

          <div className="mb-6">
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">全部</TabsTrigger>
                <TabsTrigger value="images">图片</TabsTrigger>
                <TabsTrigger value="videos">视频</TabsTrigger>
                <TabsTrigger value="documents">文档</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <p>加载中...</p>
            </div>
          ) : filteredObjects.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <p>当前目录为空</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredObjects.map((obj) => {
                if (!obj.Key) return null;
                
                const filename = obj.Key.split('/').pop() || "";
                const metadata = `${formatFileSize(obj.Size)} • ${formatDate(obj.LastModified)}`;
                const thumbnail = getFileThumbnail(obj.Key);
                
                return (
                  <FileCard
                    key={obj.Key}
                    title={filename}
                    metadata={metadata}
                    thumbnail={thumbnail}
                    onClick={() => handleFileClick(obj)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 文件预览侧边栏 */}
      {selectedFile && (
        <div className="w-80 border-l bg-white p-6">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-lg font-semibold">文件详情</h2>
            <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M18 6L6 18M6 6l12 12"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
          </div>
          
          <div className="mb-6">
            <div className="aspect-[4/3] overflow-hidden rounded-lg border">
              <Image
                src={getFileThumbnail(selectedFile.Key)}
                alt={selectedFile.Key.split('/').pop() || ""}
                width={400}
                height={300}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">文件名</h3>
              <p className="mt-1 text-sm">{selectedFile.Key.split('/').pop()}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">大小</h3>
              <p className="mt-1 text-sm">{formatFileSize(selectedFile.Size)}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">修改日期</h3>
              <p className="mt-1 text-sm">{formatDate(selectedFile.LastModified)}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">路径</h3>
              <p className="mt-1 text-sm">{selectedFile.Key}</p>
            </div>
          </div>
          
          <div className="mt-6 space-y-2">
            <Button className="w-full gap-2">
              <Play className="h-4 w-4" />
              预览
            </Button>
            
            <Button variant="outline" className="w-full gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              下载
            </Button>
            
            <Button variant="outline" className="w-full gap-2 text-red-500" onClick={() => handleDeleteFile(selectedFile.Key)}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              删除
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}