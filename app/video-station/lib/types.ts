export interface VideoMetadata {
  id: string;
  title: string;
  author: string;
  duration: string;
  views: number;
  thumbnailUrl: string;
  videoUrl: string;
  lastModified?: Date;
  size?: number;
}

export interface DirectoryMetadata {
  name: string;
  path: string;
  videoCount: number;
  lastUpdated: string;
}
