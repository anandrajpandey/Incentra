'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Video } from '@/types'
import {
  getVideos,
  getVideoById,
  getVideosByCategory,
  getAllVideosForAdmin,
} from '@/services/api'

interface UseVideosOptions {
  category?: string
  isAdmin?: boolean
}

export function useVideos(options?: UseVideosOptions) {
  const [videos, setVideos] = useState<Video[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVideos = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      let data

      if (options?.isAdmin) {
        data = await getAllVideosForAdmin()
      } else if (options?.category) {
        data = await getVideosByCategory(options.category)
      } else {
        data = await getVideos()
      }

      setVideos(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch videos')
    } finally {
      setIsLoading(false)
    }
  }, [options?.category, options?.isAdmin])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  return { videos, isLoading, error, refreshVideos: fetchVideos }
}

export function useVideo(id: string) {
  const [video, setVideo] = useState<Video | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await getVideoById(id)
        setVideo(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch video')
      } finally {
        setIsLoading(false)
      }
    }

    fetchVideo()
  }, [id])

  return { video, isLoading, error }
}
