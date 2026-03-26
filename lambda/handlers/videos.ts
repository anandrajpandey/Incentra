import { errorResponse, jsonResponse, parseJsonBody } from '@/services/http'
import {
  createVideo,
  getVideo,
  listVideos,
  patchVideo,
  removeVideo,
} from '@/services/video-repository'
import { createPresignedUpload } from '@/services/upload-service'
import type { ApiEvent, VideoItem } from '@/lambda/types'

interface UploadUrlInput {
  fileName: string
  fileType: string
}

interface CreateVideoInput {
  title: string
  description: string
  category: string
  thumbnail: string
  videoUrl: string
  duration: number
  uploadedBy: string
  isFeatured?: boolean
}

export async function listVideosHandler(event: ApiEvent) {
  try {
    const items = await listVideos(event.queryStringParameters?.category)
    return jsonResponse(200, items)
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to list videos')
  }
}

export async function getVideoHandler(event: ApiEvent) {
  try {
    const id = event.pathParameters?.id
    if (!id) return errorResponse(400, 'Video id is required')

    const video = await getVideo(id)
    if (!video) return errorResponse(404, 'Video not found')

    return jsonResponse(200, video)
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to fetch video')
  }
}

export async function createUploadUrlHandler(event: ApiEvent) {
  try {
    const body = parseJsonBody<UploadUrlInput>(event.body)
    if (!body.fileName || !body.fileType) {
      return errorResponse(400, 'fileName and fileType are required')
    }

    return jsonResponse(200, await createPresignedUpload(body.fileName, body.fileType))
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to create upload URL')
  }
}

export async function createVideoHandler(event: ApiEvent) {
  try {
    const body = parseJsonBody<CreateVideoInput>(event.body)
    if (!body.title || !body.description || !body.videoUrl || !body.category) {
      return errorResponse(400, 'title, description, category, and videoUrl are required')
    }

    const newVideo: VideoItem = {
      id: crypto.randomUUID(),
      title: body.title,
      description: body.description,
      category: body.category,
      thumbnail: body.thumbnail,
      videoUrl: body.videoUrl,
      duration: body.duration || 0,
      views: 0,
      likes: 0,
      uploadedAt: new Date().toISOString().slice(0, 10),
      uploadedBy: body.uploadedBy || 'Admin',
      isFeatured: body.isFeatured ?? false,
    }

    return jsonResponse(201, await createVideo(newVideo))
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to create video')
  }
}

export async function updateVideoHandler(event: ApiEvent) {
  try {
    const id = event.pathParameters?.id
    if (!id) return errorResponse(400, 'Video id is required')

    const body = parseJsonBody<Partial<CreateVideoInput>>(event.body)
    const updated = await patchVideo(id, body)
    if (!updated) return errorResponse(404, 'Video not found')

    return jsonResponse(200, updated)
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to update video')
  }
}

export async function deleteVideoHandler(event: ApiEvent) {
  try {
    const id = event.pathParameters?.id
    if (!id) return errorResponse(400, 'Video id is required')

    await removeVideo(id)
    return jsonResponse(200, { success: true })
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to delete video')
  }
}

export async function adminStatsHandler() {
  try {
    const items = await listVideos()
    const totalViews = items.reduce((sum, item) => sum + item.views, 0)
    const uploadedThisMonth = items.filter((item) => {
      const uploadedAt = new Date(item.uploadedAt)
      const now = new Date()
      return (
        uploadedAt.getUTCFullYear() === now.getUTCFullYear() &&
        uploadedAt.getUTCMonth() === now.getUTCMonth()
      )
    }).length

    return jsonResponse(200, {
      totalVideos: items.length,
      totalViews,
      totalUsers: 2841,
      uploadedThisMonth,
    })
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Failed to build stats')
  }
}
