export interface ApiEvent {
  body: string | null
  pathParameters?: Record<string, string | undefined> | null
  queryStringParameters?: Record<string, string | undefined> | null
  headers?: Record<string, string | undefined> | null
  requestContext?: {
    http?: {
      method?: string
    }
  }
}

export interface ApiResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export interface VideoItem {
  id: string
  title: string
  description: string
  category: string
  thumbnail: string
  videoUrl: string
  duration: number
  views: number
  likes: number
  uploadedAt: string
  uploadedBy: string
  isFeatured?: boolean
}
