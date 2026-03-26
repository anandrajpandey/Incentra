import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3Client } from '@/services/aws-clients'

const bucketName = process.env.UPLOAD_BUCKET_NAME || 'streamflow-video-uploads'
const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN?.replace(/\/$/, '')
const awsRegion = process.env.AWS_REGION || 'ap-south-1'

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
}

export function buildPlaybackUrl(objectKey: string) {
  if (cloudFrontDomain) {
    return `${cloudFrontDomain}/${objectKey}`
  }

  return `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${objectKey}`
}

export async function createPresignedUpload(fileName: string, fileType: string) {
  const safeName = sanitizeFileName(fileName)
  const objectKey = `videos/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`

  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: fileType,
    }),
    { expiresIn: 900 }
  )

  return {
    uploadUrl,
    fileUrl: buildPlaybackUrl(objectKey),
    objectKey,
  }
}
