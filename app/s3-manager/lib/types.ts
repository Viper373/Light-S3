export interface FileMetadata {
  id: string;
  name: string;
  path: string;
  size?: number;
  lastModified?: Date;
  type: string;
  thumbnailUrl?: string;
}

export interface DirectoryMetadata {
  name: string;
  path: string;
  fileCount: number;
  lastUpdated: string;
}