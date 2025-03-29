import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { S3_CONFIG, THUMBNAIL_CONFIG } from "./s3-config";
import { DirectoryMetadata } from "./types";

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

const bucketName = S3_CONFIG.bucket;

// 使用缓存来存储目录元数据，避免重复请求
const directoryMetadataCache: Record<string, DirectoryMetadata> = {};

// 获取目录元数据（文件数量和最近更新时间）
export const fetchDirectoryMetadata = async (directoryPath: string): Promise<DirectoryMetadata> => {
  try {
    // 检查缓存
    if (directoryMetadataCache[directoryPath]) {
      return directoryMetadataCache[directoryPath];
    }
    
    let fileCount = 0;
    let lastUpdated: Date | null = null;
    let continuationToken: string | undefined = undefined;
    
    // 准备前缀，确保正确处理根目录和子目录
    const prefix = directoryPath ? 
      (directoryPath.endsWith("/") ? directoryPath : `${directoryPath}/`) : 
      "";
    
    // 使用分页获取所有对象
    do {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: 10000, // 增加到最大值10000
        ContinuationToken: continuationToken
      });

      const response = await s3Client.send(command);
      
      if (response.Contents && response.Contents.length > 0) {
        for (const item of response.Contents) {
          // 跳过目录本身
          if (!item.Key || item.Key === prefix) continue;
          
          // 计算文件数量
          fileCount++;
          
          // 更新最近修改时间
          if (item.LastModified && (!lastUpdated || item.LastModified > lastUpdated)) {
            lastUpdated = item.LastModified;
          }
        }
      }
      
      // 更新令牌以获取下一页
      continuationToken = response.NextContinuationToken as string | undefined;
    } while (continuationToken);

    // 从路径中提取目录名
    const name = directoryPath.split('/').pop() || directoryPath;

    const metadata: DirectoryMetadata = {
      name,
      path: directoryPath,
      fileCount,
      lastUpdated: lastUpdated ? lastUpdated.toISOString().split('T')[0] : '未知'
    };
    
    // 缓存结果
    directoryMetadataCache[directoryPath] = metadata;
    return metadata;
  } catch (error) {
    // 从路径中提取目录名
    const name = directoryPath.split('/').pop() || directoryPath;
    
    return {
      name,
      path: directoryPath,
      fileCount: 0,
      lastUpdated: '未知'
    };
  }
};

// 生成缩略图URL
export const generateThumbnailUrl = (key: string): string => {
  // 检查key是否有效
  if (!key) return '/placeholder.svg';
  
  try {
    // 从S3配置中获取基础URL
    const baseUrl = S3_CONFIG.endpoint || '';
    const bucket = S3_CONFIG.bucket || '';
    
    // 构建完整的URL
    // 注意：这里假设S3服务支持直接访问文件，实际情况可能需要签名URL
    const thumbnailUrl = `${baseUrl}/${bucket}/${key}`;
    
    return thumbnailUrl;
  } catch (error) {
    console.error('Error generating thumbnail URL:', error);
    return '/placeholder.svg';
  }
};

// 生成S3直链URL
export const generateS3DirectUrl = (key: string): string => {
  return `https://${S3_CONFIG.bucket}.${S3_CONFIG.endpoint.replace('https://', '')}/${key}`;
};

// 判断文件是否为视频文件
export const isVideoFile = (fileName: string): boolean => {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
  return videoExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
};