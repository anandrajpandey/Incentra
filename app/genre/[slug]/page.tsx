'use client'

import { useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Navbar } from '@/components/shared/navbar'
import { VideoCard } from '@/components/user/video-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useVideos } from '@/hooks/useVideos'
import { getGenreBySlug } from '@/services/genres'

export default function GenrePage() {
  const params = useParams()
  const slug = params.slug as string
  const { fetchCurrentUser } = useAuth()
  const { videos, isLoading } = useVideos()

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser])

  const genre = getGenreBySlug(slug)
  const filteredVideos = useMemo(() => {
    if (!genre) return []
    return videos.filter((video) => video.category === genre.name)
  }, [genre, videos])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="w-full px-4 py-8 sm:px-6 lg:px-10 2xl:px-14">
        {isLoading && <GenreLoadingBody />}

        {!isLoading && !genre && (
          <div className="rounded-[28px] border border-border/60 bg-card/70 p-8 text-center glass-panel">
            <p className="text-xs uppercase tracking-[0.35em] text-primary/70">Not Found</p>
            <h1 className="mt-3 text-5xl text-foreground" data-display="true">
              Unknown Genre
            </h1>
            <p className="mt-3 text-foreground/65">
              That genre route does not exist in the current catalog.
            </p>
          </div>
        )}

        {!isLoading && genre && (
          <>
            <section className="mb-10 overflow-hidden rounded-[32px] border border-border/60 bg-card/70 glass-panel">
              <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="p-8 lg:p-10">
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/70">
                    Genre Page
                  </p>
                  <h1 className="mt-3 text-6xl text-foreground" data-display="true">
                    {genre.name}
                  </h1>
                  <p className="mt-4 max-w-xl text-base leading-7 text-foreground/65">
                    {genre.description}
                  </p>
                  <p className="mt-5 text-sm text-foreground/55">
                    A focused shelf of {genre.name.toLowerCase()} picks.
                  </p>
                </div>
                <div className="min-h-[260px] lg:min-h-full">
                  <img
                    src={genre.thumbnail}
                    alt={genre.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {filteredVideos.map((video, index) => (
                <VideoCard key={video.id} video={video} index={index} />
              ))}
            </div>

            {!filteredVideos.length && (
              <div className="rounded-[28px] border border-border/60 bg-card/70 p-8 text-center glass-panel">
                <p className="text-foreground/65">
                  No {genre.name.toLowerCase()} titles are showing right now.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function GenreLoadingBody() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-[320px] rounded-[32px] bg-secondary/70" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton
            key={index}
            className="aspect-[4/5] rounded-[28px] bg-secondary/70"
          />
        ))}
      </div>
    </div>
  )
}
