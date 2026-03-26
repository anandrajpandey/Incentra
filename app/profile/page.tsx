'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CalendarDays, Clock3, Film, LogOut, ShieldCheck, Sparkles } from 'lucide-react'
import { Navbar } from '@/components/shared/navbar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getRecentWatch } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { useVideos } from '@/hooks/useVideos'
import type { RecentWatchItem } from '@/types'

export default function ProfilePage() {
  const router = useRouter()
  const { user, fetchCurrentUser, isLoading, logoutUser } = useAuth()
  const { videos } = useVideos()
  const [recentWatch, setRecentWatch] = useState<RecentWatchItem[]>([])
  const [isRecentWatchLoading, setIsRecentWatchLoading] = useState(true)

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser])

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/login')
      return
    }

    let cancelled = false

    const loadRecentWatch = async () => {
      setIsRecentWatchLoading(true)
      try {
        const items = await getRecentWatch(user.id)
        if (!cancelled) {
          setRecentWatch(items)
        }
      } finally {
        if (!cancelled) {
          setIsRecentWatchLoading(false)
        }
      }
    }

    loadRecentWatch()

    return () => {
      cancelled = true
    }
  }, [isLoading, router, user])

  const uploadedCount = useMemo(() => {
    if (!user || user.role !== 'admin') return 0
    return videos.filter((video) => video.uploadedBy.toLowerCase() === user.name.toLowerCase()).length
  }, [user, videos])

  const featuredCount = useMemo(() => videos.filter((video) => video.isFeatured).length, [videos])

  const handleSignOut = async () => {
    await logoutUser()
    router.push('/login')
  }

  if (!user && isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="w-full px-4 py-10 sm:px-6 lg:px-10 2xl:px-14">
          <div className="space-y-8">
            <Skeleton className="h-52 w-full rounded-[32px] bg-secondary/70" />
            <Skeleton className="h-72 w-full rounded-[32px] bg-secondary/70" />
          </div>
        </main>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="w-full px-4 py-10 sm:px-6 lg:px-10 2xl:px-14">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="overflow-hidden border-b border-white/10 pb-10"
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="flex items-start gap-5">
              <Avatar className="size-24 border border-white/12 shadow-[0_12px_45px_rgba(0,0,0,0.4)]">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-white/6 text-2xl text-white">
                  {user.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>

              <div className="max-w-2xl">
                <p className="text-xs uppercase tracking-[0.34em] text-primary/70">
                  {user.role === 'admin' ? 'Editorial Account' : 'Your Profile'}
                </p>
                <h1 className="mt-3 text-5xl text-foreground" data-display="true">
                  {user.name}
                </h1>
                <p className="mt-4 text-base leading-7 text-foreground/62">
                  {user.role === 'admin'
                    ? 'Keep the desk close, keep the lineup sharp, and jump back into the titles you have been checking most recently.'
                    : 'Your watch history, account details, and the films you have been spending time with live here.'}
                </p>

                <div className="mt-8 flex flex-wrap gap-3 text-sm text-foreground/76">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    {user.role === 'admin' ? 'Admin access' : 'Viewer access'}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Member since {formatProfileDate(user.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5 text-sm text-foreground/72">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-foreground/42">Email</p>
                <p className="mt-2 text-base text-foreground">{user.email}</p>
              </div>
              {user.username && (
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-foreground/42">Username</p>
                  <p className="mt-2 text-base text-foreground">@{user.username}</p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-foreground/42">Sign-in</p>
                <p className="mt-2 text-base text-foreground">
                  {user.provider === 'google' ? 'Google account' : 'Email and password'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/">
                  <Button size="sm" className="rounded-md">
                    Back To Discover
                  </Button>
                </Link>
                {user.role === 'admin' && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="rounded-md">
                      Open Admin
                    </Button>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="rounded-md text-destructive hover:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="grid gap-6 border-b border-white/10 py-10 md:grid-cols-3"
        >
          <ProfileStat
            icon={Clock3}
            label="Recent watches"
            value={String(recentWatch.length)}
            note="The titles you touched most recently."
          />
          <ProfileStat
            icon={Sparkles}
            label="Current lane"
            value={recentWatch[0]?.category ?? 'Open'}
            note="The mood your latest watch session is leaning toward."
          />
          <ProfileStat
            icon={Film}
            label={user.role === 'admin' ? 'Featured titles' : 'Tonight queue'}
            value={String(user.role === 'admin' ? featuredCount : recentWatch.slice(0, 3).length)}
            note={
              user.role === 'admin'
                ? `${uploadedCount} titles currently tied to your desk.`
                : 'A quick count of what is still fresh in your night.'
            }
          />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.14 }}
          className="py-10"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-primary/70">Recent Watch</p>
              <h2 className="mt-3 text-3xl text-foreground" data-display="true">
                Back In Rotation
              </h2>
            </div>
            <Link href="/">
              <Button variant="ghost" size="sm">
                Keep browsing
              </Button>
            </Link>
          </div>

          {isRecentWatchLoading ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-72 rounded-[28px] bg-secondary/70" />
              ))}
            </div>
          ) : recentWatch.length > 0 ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {recentWatch.map((item) => (
                <Link
                  key={`${item.userId}-${item.videoId}`}
                  href={`/watch/${item.videoId}`}
                  className="group overflow-hidden border border-white/8 transition hover:border-white/14"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_15%,rgba(0,0,0,0.2)_55%,rgba(0,0,0,0.88)_100%)]" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <p className="text-xs uppercase tracking-[0.28em] text-primary/80">
                        {item.category}
                      </p>
                      <h3 className="mt-2 text-2xl text-white" data-display="true">
                        {item.title}
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-2 px-5 py-4 text-sm text-foreground/66">
                    <p>Last opened {formatRelativeTime(item.watchedAt)}</p>
                    <p>
                      You reached {Math.max(1, Math.round((item.progressSeconds / item.duration) * 100))}%
                      of this title.
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-8 border border-white/8 px-6 py-10 text-foreground/62">
              The next film you linger on will land here, ready to pick back up.
            </div>
          )}
        </motion.section>
      </main>
    </div>
  )
}

function ProfileStat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Clock3
  label: string
  value: string
  note: string
}) {
  return (
    <div className="space-y-3">
      <Icon className="h-5 w-5 text-primary" />
      <p className="text-xs uppercase tracking-[0.28em] text-foreground/45">{label}</p>
      <p className="text-4xl text-foreground" data-display="true">
        {value}
      </p>
      <p className="max-w-sm text-sm leading-7 text-foreground/58">{note}</p>
    </div>
  )
}

function formatProfileDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

function formatRelativeTime(date: string) {
  const diffMs = Date.now() - new Date(date).getTime()
  const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)))

  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}
