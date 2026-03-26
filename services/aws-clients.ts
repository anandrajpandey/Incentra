import { CloudFrontClient } from '@aws-sdk/client-cloudfront'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'

const region = process.env.AWS_REGION || 'ap-south-1'

export const s3Client = new S3Client({ region })
export const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region }),
  {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  }
)
export const cloudFrontClient = new CloudFrontClient({ region })
