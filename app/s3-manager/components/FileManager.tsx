"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { LayoutGrid, Plus, Search, Upload, FolderPlus, Play, Trash2 } from "lucide-react"
import Image from "next/image"
import { useState, useEffect} from "react"
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3"
import { S3_CONFIG } from "../lib/s3-config"
import DirectoryTree from "./DirectoryTree"
import { Sidebar } from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { isVideoFile, generateThumbnailUrl } from "../lib/s3-client"

interface NavItemProps {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
}

function NavItem({icon, children, active, onClick }: NavItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn("flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-lg cursor-pointer", 
        active ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 dark:from-blue-900/20 dark:to-indigo-900/20 dark:text-blue-400" : "hover:bg-gray-50")}
    >
      {icon}
      <span>{children}</span>
    </div>
  )
}

interface FileCardProps {
  title: string
  metadata: string
  thumbnail: string
  onClick?: () => void
}

interface S3Object {
  Key: string
  LastModified?: Date
  Size?: number
  IsDirectory?: boolean
  OriginalKey?: string // 用于回收站功能，记录原始路径
}

const FileManager = () => {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<S3Object | null>(null);
  const [deletedFiles, setDeletedFiles] = useState<S3Object[]>([]);
  const [showTrash, setShowTrash] = useState<boolean>(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<string | null>(null);
  
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
      console.log("Fetching objects for path:", path); // 添加日志，帮助调试
      const prefix = path ? `${path}/` : "";
      
      // 获取当前目录的文件和子目录
      const command = new ListObjectsV2Command({
        Bucket: S3_CONFIG.bucket,
        Prefix: prefix,
        Delimiter: "/"
      });
      
      const response = await s3Client.send(command);
      console.log("Response received:", response); // 添加日志，帮助调试
      
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
      
      // 同时获取所有目录，以保持目录树的完整性
      const allDirsCommand = new ListObjectsV2Command({
        Bucket: S3_CONFIG.bucket,
        Delimiter: "/"
      });
      
      const allDirsResponse = await s3Client.send(allDirsCommand);
      const allDirs: string[] = [];
      
      // 处理根目录
      if (allDirsResponse.CommonPrefixes) {
        for (const prefix of allDirsResponse.CommonPrefixes) {
          if (prefix.Prefix) {
            const dirPath = prefix.Prefix.replace(/\/$/, "");
            allDirs.push(dirPath);
            
            // 递归获取子目录
            await fetchSubDirectories(dirPath, allDirs);
          }
        }
      }
      
      // 合并当前目录和所有目录，并过滤掉trash目录
      const uniqueDirs = [...new Set([...dirs, ...allDirs])].filter(dir => !dir.startsWith('trash'));
      setDirectories(uniqueDirs);
      
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
      console.log("Files found:", files.length); // 添加日志，帮助调试
      setObjects(files);
    } catch (error) {
      console.error("Error fetching objects:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 递归获取子目录
  const fetchSubDirectories = async (parentPath: string, allDirs: string[]): Promise<void> => {
    try {
      const command = new ListObjectsV2Command({
        Bucket: S3_CONFIG.bucket,
        Prefix: `${parentPath}/`,
        Delimiter: "/"
      });
      
      const response = await s3Client.send(command);
      
      // 处理子目录
      if (response.CommonPrefixes) {
        for (const prefix of response.CommonPrefixes) {
          if (prefix.Prefix) {
            const dirPath = prefix.Prefix.replace(/\/$/, "");
            // 避免重复添加
            if (!allDirs.includes(dirPath)) {
              allDirs.push(dirPath);
              
              // 递归获取更深层次的子目录
              await fetchSubDirectories(dirPath, allDirs);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching subdirectories:", error);
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
      // 查找要删除的文件对象
      const fileToDelete = objects.find(obj => obj.Key === key);
      
      if (fileToDelete) {
        // 将文件移动到回收站目录
        const trashKey = `trash/${key}`;
        
        // 先复制到回收站
        const copyCommand = new CopyObjectCommand({
          Bucket: S3_CONFIG.bucket,
          CopySource: `${S3_CONFIG.bucket}/${key}`,
          Key: trashKey
        });
        
        await s3Client.send(copyCommand);
        
        // 然后删除原文件
        const deleteCommand = new DeleteObjectCommand({
          Bucket: S3_CONFIG.bucket,
          Key: key
        });
        
        await s3Client.send(deleteCommand);
        
        // 添加到已删除文件列表
        const deletedFile = {
          ...fileToDelete,
          Key: trashKey,
          OriginalKey: key
        };
        
        setDeletedFiles(prev => [...prev, deletedFile]);
        
        // 刷新文件列表
        fetchObjects(currentPath);
        
        // 如果删除的是当前选中的文件，清除选择
        if (selectedFile && selectedFile.Key === key) {
          setSelectedFile(null);
        }
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };
  
  // 恢复已删除的文件
  const handleRestoreFile = async (trashKey: string, originalKey: string) => {
    try {
      // 复制回原位置
      const copyCommand = new CopyObjectCommand({
        Bucket: S3_CONFIG.bucket,
        CopySource: `${S3_CONFIG.bucket}/${trashKey}`,
        Key: originalKey
      });
      
      await s3Client.send(copyCommand);
      
      // 删除回收站中的文件
      const deleteCommand = new DeleteObjectCommand({
        Bucket: S3_CONFIG.bucket,
        Key: trashKey
      });
      
      await s3Client.send(deleteCommand);
      
      // 从已删除文件列表中移除
      setDeletedFiles(prev => prev.filter(file => file.Key !== trashKey));
      
      // 刷新文件列表
      fetchObjects(currentPath);
    } catch (error) {
      console.error("Error restoring file:", error);
    }
  };
  
  // 清空回收站
  const handleEmptyTrash = async () => {
    if (!confirm("确定要清空回收站吗？此操作不可恢复！")) return;
    
    try {
      // 删除所有回收站中的文件
      for (const file of deletedFiles) {
        if (file.Key) {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: S3_CONFIG.bucket,
            Key: file.Key
          });
          
          await s3Client.send(deleteCommand);
        }
      }
      
      // 清空已删除文件列表
      setDeletedFiles([]);
    } catch (error) {
      console.error("Error emptying trash:", error);
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
    
    // 加载回收站内容
    const loadTrashItems = async () => {
      try {
        const command = new ListObjectsV2Command({
          Bucket: S3_CONFIG.bucket,
          Prefix: "trash/"
        });
        
        const response = await s3Client.send(command);
        
        if (response.Contents) {
          const trashItems = response.Contents.map(item => ({
            Key: item.Key || '',
            LastModified: item.LastModified,
            Size: item.Size,
            IsDirectory: false,
            OriginalKey: item.Key?.replace('trash/', '') || ''
          }));
          
          setDeletedFiles(trashItems);
        }
      } catch (error) {
        console.error("Error loading trash items:", error);
      }
    };
    
    loadTrashItems();
  }, [currentPath]);

  // 判断文件类型
  const getFileType = (filename: string): string => {
    const ext = getFileExtension(filename).toLowerCase();
    
    // 图片文件类型
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
      return 'image';
    }
    
    // 文档文件类型
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx', 'md'].includes(ext)) {
      return 'document';
    }
    
    // 视频文件类型
    if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
      return 'video';
    }
    
    return 'other';
  };
  
  // 过滤搜索结果
  const filteredObjects = objects.filter(obj => {
    const filename = obj.Key?.split('/').pop() || "";
    // 先过滤搜索查询
    const matchesSearch = filename.toLowerCase().includes(searchQuery.toLowerCase());
    
    // 如果有文件类型过滤器，再过滤文件类型
    if (fileTypeFilter && matchesSearch) {
      return getFileType(filename) === fileTypeFilter;
    }
    
    return matchesSearch;
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* 可拖拽侧边栏 - 使用与video-station相同的样式 */}
      <Sidebar 
        className="p-4 border-r border-gray-100 dark:border-gray-800"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">S3 文件管理器</h2>
          </div>
          
          <div className="space-y-1">
            <NavItem href="#" icon={<LayoutGrid className="h-4 w-4" />} active={!showTrash} onClick={() => setShowTrash(false)}>
              所有文件
            </NavItem>
            <NavItem href="#" icon={<Trash2 className="h-4 w-4" />} active={showTrash} onClick={() => setShowTrash(true)}>
              回收站
            </NavItem>
          </div>
          
          {!showTrash && (
            <div className="pt-4">
              <h3 className="text-sm font-medium mb-2">目录</h3>
              <ScrollArea className="h-[calc(100vh-18rem)]">
                <DirectoryTree
                  directories={directories}
                  onDirectoryClick={handleDirectoryClick}
                  currentPath={currentPath}
                />
              </ScrollArea>
            </div>
          )}
        </div>
      </Sidebar>
      {/* 主内容区 - 使用与video-station相同的样式 */}
      <div className="flex-1 p-6 overflow-hidden"> {/* 移除固定宽度和marginLeft样式，使其与video-station保持一致 */}
        <div className="mb-6 flex">
          <div className="relative w-full mr-2">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <Input
              type="text"
              placeholder="搜索文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

        <div className="p-6">
          {!showTrash ? (
            <>
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
                    const isVideo = isVideoFile(filename);
                    // 使用不同的缩略图生成逻辑
                    let thumbnail;
                    if (isVideo) {
                      // 视频使用缩略图URL
                      thumbnail = generateThumbnailUrl(obj.Key);
                      // 确保缩略图URL有效
                      if (!thumbnail || thumbnail === '') {
                        thumbnail = '/placeholder.svg';
                      }
                    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(getFileExtension(filename).toLowerCase())) {
                      // 图片文件直接使用S3直链
                      thumbnail = `https://${S3_CONFIG.bucket}.${S3_CONFIG.endpoint.replace('https://', '')}/${obj.Key}`;
                    } else {
                      // 其他文件使用默认图标
                      thumbnail = getFileThumbnail(obj.Key);
                    }
                    
                    return (
                      <div key={obj.Key} className="overflow-hidden group cursor-pointer rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 dark:border-gray-800 dark:bg-gray-900 transform hover:scale-[1.02]">
                        <div className="relative aspect-video overflow-hidden rounded-t-xl">
                          <Image
                            src={thumbnail || "/placeholder.svg"}
                            alt={filename}
                            width={400}
                            height={300}
                            className="object-cover transition-transform duration-500 group-hover:scale-105 group-hover:brightness-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          {/* 左下角显示文件大小 */}
                          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center backdrop-blur-sm">
                            <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <polyline points="7 10 12 15 17 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <line x1="12" y1="15" x2="12" y2="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {formatFileSize(obj.Size)}
                          </div>
                          {/* 右下角显示修改日期 */}
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center backdrop-blur-sm">
                            <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <polyline points="12 6 12 12 16 14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {obj.LastModified ? obj.LastModified.toLocaleDateString() : '未知'}
                          </div>
                          <div 
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              // 直接预览文件
                              if (isVideo) {
                                // 实现视频预览逻辑
                                window.open(`https://bitiful.viper3.top/${obj.Key}`, '_blank');
                              } else {
                                // 其他文件类型的预览逻辑
                                handleFileClick(obj);
                              }
                            }}
                          >
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full p-3 shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                              <Play className="h-6 w-6" />
                            </div>
                          </div>
                        </div>
                        <div 
                          className="p-4"
                          onClick={() => handleFileClick(obj)}
                        >
                          <h3 className="font-medium line-clamp-2 text-sm group-hover:text-blue-600 transition-colors duration-200 dark:group-hover:text-blue-400">{filename}</h3>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            // 回收站内容
            <>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">回收站</h2>
                <Button 
                  variant="destructive" 
                  className="gap-2" 
                  onClick={handleEmptyTrash}
                  disabled={deletedFiles.length === 0}
                >
                  <Trash2 className="h-4 w-4" />
                  清空回收站
                </Button>
              </div>
              
              {deletedFiles.length === 0 ? (
                <div className="flex justify-center items-center h-64 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-gray-500">回收站为空</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {deletedFiles.map((obj) => {
                    if (!obj.Key) return null;
                    
                    const filename = obj.Key.split('/').pop() || "";
                    const metadata = `${formatFileSize(obj.Size)} • ${formatDate(obj.LastModified)}`;
                    const isVideo = isVideoFile(filename);
                    // 使用不同的缩略图生成逻辑
                    let thumbnail;
                    if (isVideo) {
                      // 视频使用缩略图URL
                      thumbnail = generateThumbnailUrl(obj.Key);
                      // 确保缩略图URL有效
                      if (!thumbnail || thumbnail === '') {
                        thumbnail = '/placeholder.svg';
                      }
                    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(getFileExtension(filename).toLowerCase())) {
                      // 图片文件直接使用S3直链
                      thumbnail = `https://${S3_CONFIG.bucket}.${S3_CONFIG.endpoint.replace('https://', '')}/${obj.Key}`;
                    } else {
                      // 其他文件使用默认图标
                      thumbnail = getFileThumbnail(obj.Key);
                    }
                    
                    return (
                      <div key={obj.Key} className="overflow-hidden group cursor-pointer rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 dark:border-gray-800 dark:bg-gray-900 transform hover:scale-[1.02]">
                        <div className="relative aspect-video overflow-hidden rounded-t-xl">
                          <Image
                            src={thumbnail || "/placeholder.svg"}
                            alt={filename}
                            width={400}
                            height={300}
                            className="object-cover transition-transform duration-500 group-hover:scale-105 group-hover:brightness-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          {/* 左下角显示文件大小 */}
                          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center backdrop-blur-sm">
                            <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <polyline points="7 10 12 15 17 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <line x1="12" y1="15" x2="12" y2="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {formatFileSize(obj.Size)}
                          </div>
                          {/* 右下角显示修改日期 */}
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center backdrop-blur-sm">
                            <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <polyline points="12 6 12 12 16 14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {obj.LastModified ? obj.LastModified.toLocaleDateString() : '未知'}
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-medium line-clamp-2 text-sm group-hover:text-blue-600 transition-colors duration-200 dark:group-hover:text-blue-400">{filename}</h3>
                          <div className="mt-2 flex justify-end">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs" 
                              onClick={() => handleRestoreFile(obj.Key, obj.OriginalKey || '')}
                            >
                              恢复文件
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 文件预览侧边栏 */}
      {selectedFile && (
        <div className="w-80 border-l bg-white dark:bg-gray-800 p-6 shadow-lg">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">文件详情</h2>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setSelectedFile(null)}>
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
            <div className="aspect-video overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
              {isVideoFile(selectedFile.Key) ? (
                <Image
                  src={generateThumbnailUrl(selectedFile.Key)}
                  alt={selectedFile.Key.split('/').pop() || ""}
                  width={400}
                  height={300}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={getFileThumbnail(selectedFile.Key)}
                  alt={selectedFile.Key.split('/').pop() || ""}
                  width={400}
                  height={300}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">文件名</h3>
              <p className="mt-1 text-sm font-medium">{selectedFile.Key.split('/').pop()}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">大小</h3>
              <p className="mt-1 text-sm font-medium">{formatFileSize(selectedFile.Size)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">修改日期</h3>
              <p className="mt-1 text-sm font-medium">{formatDate(selectedFile.LastModified)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">路径</h3>
              <p className="mt-1 text-sm font-medium truncate">{selectedFile.Key}</p>
            </div>
          </div>
          
          <div className="mt-6 space-y-2">
            <Button 
              className="w-full gap-2"
              onClick={() => {
                if (isVideoFile(selectedFile.Key)) {
                  // 视频使用特定域名
                  window.open(`https://bitiful.viper3.top/${selectedFile.Key}`, '_blank');
                } else {
                  // 其他文件类型使用S3直链
                  window.open(`https://${S3_CONFIG.bucket}.${S3_CONFIG.endpoint.replace('https://', '')}/${selectedFile.Key}`, '_blank');
                }
              }}
            >
              <Play className="h-4 w-4" />
              预览
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => {
                // 创建下载链接
                const downloadUrl = `https://${S3_CONFIG.bucket}.${S3_CONFIG.endpoint.replace('https://', '')}/${selectedFile.Key}`;
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = selectedFile.Key.split('/').pop() || 'download';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
            >
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
            
            <Button 
              variant="outline" 
              className="w-full gap-2 text-red-500 rounded-xl bg-gradient-to-r from-red-500/10 to-pink-500/10 hover:from-red-600/20 hover:to-pink-600/20 transition-all duration-300" 
              onClick={() => handleDeleteFile(selectedFile.Key)}
            >
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

export default FileManager;
