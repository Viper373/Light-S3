// S3 配置
export const S3_CONFIG = {
  region: process.env.NEXT_PUBLIC_S3_REGION || "ap-northeast-1", // 更新为正确的区域
  endpoint: process.env.NEXT_PUBLIC_S3_ENDPOINT || "https://s3.bitiful.net",
  accessKeyId: process.env.NEXT_PUBLIC_S3_ACCESS_KEY || "CYVLn8lpmCoSjACGCviO3gOg",
  secretAccessKey: process.env.NEXT_PUBLIC_S3_SECRET_KEY || "gEKcmCVe91aV5jZ14MfBh3GcYXKHMWQ",
  bucket: process.env.NEXT_PUBLIC_S3_BUCKET || "viper3",
};

// 缩略图配置
export const THUMBNAIL_CONFIG = {
  imgCdn: process.env.NEXT_PUBLIC_IMG_CDN || "https://cdn.jsdelivr.net/gh",
  ghOwner: process.env.NEXT_PUBLIC_GH_OWNER || "Viper373",
  ghRepo: process.env.NEXT_PUBLIC_GH_REPO || "picx-images-hosting",
};