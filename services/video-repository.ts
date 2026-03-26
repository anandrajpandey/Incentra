import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { dynamoClient } from '@/services/aws-clients'
import type { VideoItem } from '@/lambda/types'

const tableName = process.env.VIDEOS_TABLE_NAME || 'streamflow-videos'

export async function listVideos(category?: string) {
  const result = await dynamoClient.send(
    new ScanCommand({
      TableName: tableName,
      ...(category
        ? {
            FilterExpression: '#category = :category',
            ExpressionAttributeNames: {
              '#category': 'category',
            },
            ExpressionAttributeValues: {
              ':category': category,
            },
          }
        : {}),
    })
  )

  return ((result.Items as VideoItem[] | undefined) ?? []).sort((left, right) =>
    right.uploadedAt.localeCompare(left.uploadedAt)
  )
}

export async function getVideo(id: string) {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { id },
    })
  )

  return (result.Item as VideoItem | undefined) ?? null
}

export async function createVideo(video: VideoItem) {
  await dynamoClient.send(
    new PutCommand({
      TableName: tableName,
      Item: video,
    })
  )

  return video
}

export async function patchVideo(id: string, patch: Partial<VideoItem>) {
  const entries = Object.entries(patch).filter(([, value]) => typeof value !== 'undefined')
  if (!entries.length) {
    return getVideo(id)
  }

  const expressionAttributeNames: Record<string, string> = {}
  const expressionAttributeValues: Record<string, unknown> = {}
  const setClauses = entries.map(([key], index) => {
    const nameKey = `#field${index}`
    const valueKey = `:value${index}`
    expressionAttributeNames[nameKey] = key
    expressionAttributeValues[valueKey] = patch[key as keyof VideoItem]
    return `${nameKey} = ${valueKey}`
  })

  const result = await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { id },
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  )

  return (result.Attributes as VideoItem | undefined) ?? null
}

export async function removeVideo(id: string) {
  await dynamoClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { id },
    })
  )
}
