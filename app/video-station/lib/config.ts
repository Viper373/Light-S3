// S3 配置
export const S3_CONFIG = {
  region: process.env.NEXT_PUBLIC_S3_REGION,
  endpoint: process.env.NEXT_PUBLIC_S3_ENDPOINT,
  accessKeyId: process.env.NEXT_PUBLIC_S3_ACCESS_KEY,
  secretAccessKey: process.env.NEXT_PUBLIC_S3_SECRET_KEY,
  bucket: process.env.NEXT_PUBLIC_S3_BUCKET,
};

// 缩略图配置
export const THUMBNAIL_CONFIG = {
  imgCdn: process.env.NEXT_PUBLIC_IMG_CDN,
  ghOwner: process.env.NEXT_PUBLIC_GH_OWNER,
  ghRepo: process.env.NEXT_PUBLIC_GH_REPO,
};

// MongoDB 配置
export const MONGODB_CONFIG = {
  uri: process.env.MONGODB_URI,
  dbName: process.env.DB_NAME,
  colName: process.env.COL_NAME,
};
