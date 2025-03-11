import AWS from 'aws-sdk'

const s3 = new AWS.S3({
  endpoint: process.env.VUE_APP_S3_ENDPOINT,
  region: process.env.VUE_APP_S3_REGION,
  accessKeyId: process.env.VUE_APP_S3_ACCESS_KEY,
  secretAccessKey: process.env.VUE_APP_S3_SECRET_KEY,
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
})

export const listObjects = async (params = {}) => {
  const validatedParams = {
    Bucket: process.env.VUE_APP_S3_BUCKET,
    Delimiter: '/',
    Prefix: String(params.Prefix || ''),
    MaxKeys: Math.min(Math.max(Number(params.MaxKeys) || 100, 1), 1000),
    ContinuationToken: params.ContinuationToken || undefined
  }

  try {
    const data = await s3.listObjectsV2(validatedParams).promise()
    
    return {
      Contents: (data.Contents || []).map(f => ({
        Key: f.Key,
        Size: f.Size,
        LastModified: f.LastModified,
        IsDirectory: f.Key.endsWith('/')
      })),
      IsTruncated: data.IsTruncated || false,
      NextContinuationToken: data.NextContinuationToken,
      CommonPrefixes: (data.CommonPrefixes || [])
    }
  } catch (error) {
    console.error('S3 Error:', {
      params: validatedParams,
      error: error.message,
      stack: error.stack
    })
    throw new Error(`Failed to load objects from S3: ${error.message}`)
  }
}

export const generatePresignedUrl = (key) => {
  return s3.getSignedUrl('getObject', {
    Bucket: process.env.VUE_APP_S3_BUCKET,
    Key: key,
    Expires: 3600,
    ResponseContentDisposition: 'inline',
    ResponseContentType: 'video/mp4',
    ResponseCacheControl: 'public, max-age=31536000, immutable'
  })
}