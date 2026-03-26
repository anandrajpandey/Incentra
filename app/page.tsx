'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Navbar } from '@/components/shared/navbar'
import { HeroBanner } from '@/components/user/hero-banner'
import { HomeIntro } from '@/components/user/home-intro'
import { VideoRow } from '@/components/user/video-row'
import { Skeleton } from '@/components/ui/skeleton'
import { getAdaptiveDiscover } from '@/services/api'
import type { AdaptiveDiscoverResponse } from '@/types'

export default function Home() {
  const { user, fetchCurrentUser } = useAuth()
  const [introComplete, setIntroComplete] = useState(false)
  const [discover, setDiscover] = useState<AdaptiveDiscoverResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser])

  useEffect(() => {
    let cancelled = false

    const loadDiscover = async () => {
      try {
        setIsLoading(true)
        const nextDiscover = await getAdaptiveDiscover(user?.id)
        if (!cancelled) {
          setDiscover(nextDiscover)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadDiscover()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  return (
    <div className="min-h-screen bg-background">
      <HomeIntro onComplete={() => setIntroComplete(true)} />
      <div className={`${introComplete ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}>
        <Navbar />

        <main className="w-full px-4 pb-8 sm:px-6 lg:px-10 2xl:px-14">
          {isLoading && <HomeLoadingBody />}

          {!isLoading && discover?.spotlight && (
            <HeroBanner
              video={discover.spotlight}
              kicker={discover.profile.adaptiveMode === 'personalized' ? 'Picked For Tonight' : 'What To Watch'}
              meta={[
                discover.profile.adaptiveMode === 'personalized' ? 'Chosen for you' : 'Crowd favorite',
                discover.profile.topCategory ?? 'Something new',
                `${discover.profile.recentVideoIds.length} recent picks`,
              ]}
            />
          )}

          {!isLoading &&
            discover?.rows.map((row) => (
              <VideoRow key={row.id} title={row.title} subtitle={row.subtitle} videos={row.videos} />
            ))}
        </main>
      </div>
    </div>
  )
}

function HomeLoadingBody() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-[520px] rounded-[32px] bg-secondary/70" />
      {[1, 2, 3].map((row) => (
        <div key={row} className="space-y-4">
          <Skeleton className="h-8 w-56 rounded-full bg-secondary/70" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={`${row}-${index}`}
                className="aspect-video rounded-[24px] bg-secondary/70"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
