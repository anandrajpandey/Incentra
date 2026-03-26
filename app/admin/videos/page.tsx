'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Navbar } from '@/components/shared/navbar'
import { AdminSidebar } from '@/components/shared/sidebar'
import { VideoList } from '@/components/admin/video-list'
import { getAllVideosForAdmin } from '@/services/api'
import type { Video } from '@/types'

export default function ManageVideosPage() {
  const router = useRouter()
  const { fetchCurrentUser, user, isLoading: isAuthLoading } = useAuth()
  const [videos, setVideos] = useState<Video[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [authResolved, setAuthResolved] = useState(false)

  useEffect(() => {
    let cancelled = false

    const resolveAuth = async () => {
      await fetchCurrentUser()
      if (!cancelled) {
        setAuthResolved(true)
      }
    }

    void resolveAuth()

    return () => {
      cancelled = true
    }
  }, [fetchCurrentUser])

  useEffect(() => {
    if (!authResolved || isAuthLoading) return
    if (user?.role === 'admin') return
    router.replace('/login?redirect=%2Fadmin%2Fvideos')
  }, [authResolved, isAuthLoading, router, user?.role])

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const data = await getAllVideosForAdmin()
        setVideos(data)
      } catch (error) {
        console.error('Failed to fetch videos:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchVideos()
  }, [])

  const handleVideoDeleted = async () => {
    try {
      const data = await getAllVideosForAdmin()
      setVideos(data)
    } catch (error) {
      console.error('Failed to refresh videos:', error)
    }
  }

  if (!authResolved || (isAuthLoading && !user)) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
      </div>
    )
  }
  if (user?.role !== 'admin') return null

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="flex">
        <AdminSidebar />

        <main className="flex-1 overflow-auto">
          <div className="p-6 lg:p-8 xl:p-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-10 border-b border-white/8 pb-8">
                <p className="text-xs uppercase tracking-[0.35em] text-primary/70">
                  Catalog Manager
                </p>
                <h1 className="mt-2 text-5xl text-foreground" data-display="true">
                  Manage Videos
                </h1>
                <p className="mt-3 max-w-2xl text-foreground/65">
                  Review the lineup, refresh artwork and copy, or remove anything that no longer belongs on the shelf.
                </p>
              </div>

              <VideoList
                videos={videos}
                isLoading={isLoading}
                onVideoDeleted={handleVideoDeleted}
              />
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}
