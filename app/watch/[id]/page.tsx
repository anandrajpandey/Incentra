'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useVideo } from '@/hooks/useVideos'
import { useAuth } from '@/hooks/useAuth'
import { Navbar } from '@/components/shared/navbar'
import { Player } from '@/components/user/player'
import { VideoCard } from '@/components/user/video-card'
import { useVideos } from '@/hooks/useVideos'
import { ThumbsUp, Share2, Clock3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScenePulse } from '@/components/user/scene-pulse'
import { SpoilerSafeSocial } from '@/components/user/spoiler-safe-social'
import { WatchCompanion, WatchCompanionUnavailable } from '@/components/user/watch-companion'
import {
  createComment,
  getComments,
  recordRecentWatch,
  getScenePulses,
  recordDiscoverSignal,
  sendCompanionChat,
  updateVideo,
} from '@/services/api'
import type { CompanionMessage, ScenePulse as ScenePulseItem, SocialComment } from '@/types'

const WATCH_LIKES_STORAGE_KEY = 'streamflow.watch.likes'

function compactMomentLine(value?: string) {
  if (!value) return ''
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''

  const firstSentence = cleaned.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean)[0] ?? cleaned
  const withoutMarkdown = firstSentence.replace(/[*_`~]/g, '').trim()
  const words = withoutMarkdown
    .split(/\s+/)
    .map((word) => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
    .filter(Boolean)

  if (!withoutMarkdown) {
    return ''
  }

  if (withoutMarkdown.length < 4 || words.length === 0) {
    return ''
  }

  return withoutMarkdown.length > 120 ? `${withoutMarkdown.slice(0, 117)}...` : withoutMarkdown
}

export default function WatchPage() {
  const params = useParams()
  const router = useRouter()
  const videoId = params.id as string
  const { fetchCurrentUser, user, isLoading: isAuthLoading } = useAuth()
  const { video, isLoading } = useVideo(videoId)
  const { videos } = useVideos()
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [seekTo, setSeekTo] = useState<number | null>(null)
  const [pulses, setPulses] = useState<ScenePulseItem[]>([])
  const [comments, setComments] = useState<SocialComment[]>([])
  const [nextCommentsCursor, setNextCommentsCursor] = useState<string | null>(null)
  const [isSocialLoading, setIsSocialLoading] = useState(true)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false)
  const [completionTracked, setCompletionTracked] = useState(false)
  const [displayLikes, setDisplayLikes] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [isUpdatingLike, setIsUpdatingLike] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle')
  const [recentWatchTracked, setRecentWatchTracked] = useState(false)
  const [companionMessages, setCompanionMessages] = useState<CompanionMessage[]>([])
  const [isCompanionThinking, setIsCompanionThinking] = useState(false)
  const [authResolved, setAuthResolved] = useState(false)
  const playerSectionRef = useRef<HTMLDivElement>(null)
  const surfacedBeatIdsRef = useRef<Set<string>>(new Set())
  const companionReadyRef = useRef(false)
  const previousTimeRef = useRef(0)

  const readLikedMap = (currentUserId?: string) => {
    if (typeof window === 'undefined') return {}
    const stored = window.localStorage.getItem(WATCH_LIKES_STORAGE_KEY)
    const allLikes = stored
      ? (JSON.parse(stored) as Record<string, Record<string, boolean>>)
      : {}

    if (!currentUserId) return {}
    return allLikes[currentUserId] ?? {}
  }

  const writeLikedMap = (currentUserId: string, nextLikes: Record<string, boolean>) => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(WATCH_LIKES_STORAGE_KEY)
    const allLikes = stored
      ? (JSON.parse(stored) as Record<string, Record<string, boolean>>)
      : {}

    window.localStorage.setItem(
      WATCH_LIKES_STORAGE_KEY,
      JSON.stringify({
        ...allLikes,
        [currentUserId]: nextLikes,
      })
    )
  }

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
    if (user) return
    router.replace(`/login?redirect=${encodeURIComponent(`/watch/${videoId}`)}`)
  }, [authResolved, isAuthLoading, router, user, videoId])

  useEffect(() => {
    if (!video) return

    let cancelled = false

    const loadExperience = async () => {
      setIsSocialLoading(true)
      const [nextPulses, nextCommentsPage] = await Promise.all([
        getScenePulses(video),
        getComments(video.id, { pageSize: 4 }),
      ])

      if (!cancelled) {
        setPulses(nextPulses)
        setComments(nextCommentsPage.items)
        setNextCommentsCursor(nextCommentsPage.nextCursor)
        setIsSocialLoading(false)
      }
    }

    loadExperience()

    if (user?.id) {
      void recordDiscoverSignal({
        userId: user.id,
        videoId: video.id,
        category: video.category,
      })
    }

      setCompletionTracked(false)
      setRecentWatchTracked(false)
      setDisplayLikes(video.likes)
      setCompanionMessages([])
      surfacedBeatIdsRef.current = new Set()
      companionReadyRef.current = false
      previousTimeRef.current = 0

    if (typeof window !== 'undefined') {
      const likedMap = readLikedMap(user?.id)
      setIsLiked(Boolean(likedMap[video.id]))
    }

    return () => {
      cancelled = true
    }
  }, [video, user?.id])

  useEffect(() => {
    if (!video || !user?.id || recentWatchTracked) return
    if (currentTime < 5 && currentTime < Math.max(3, video.duration * 0.03)) return

    void recordRecentWatch(user.id, video, currentTime)
    setRecentWatchTracked(true)
  }, [currentTime, recentWatchTracked, user?.id, video])

  useEffect(() => {
    if (shareState === 'idle') return
    const timer = window.setTimeout(() => setShareState('idle'), 2200)
    return () => window.clearTimeout(timer)
  }, [shareState])

  useEffect(() => {
    if (!video || !user?.id || completionTracked || duration <= 0) return
    if (currentTime >= duration * 0.8) {
      void recordDiscoverSignal({
        userId: user.id,
        videoId: video.id,
        category: video.category,
        completed: true,
      })
      setCompletionTracked(true)
    }
  }, [completionTracked, currentTime, duration, user?.id, video])

  const autoCompanionMoments = useMemo(() => {
    if (!video?.subtitleUrl && video?.subtitleSource !== 'embedded') {
      return []
    }

    return (
      video?.companionBeats?.map((beat) => ({
        id: beat.id,
        timestampSeconds: beat.timestampSeconds,
        message: compactMomentLine(beat.companionLine),
      })) ?? []
    )
      .filter((moment) => moment.message)
      .sort((left, right) => left.timestampSeconds - right.timestampSeconds)
      .filter((moment, index, moments) => {
        const previous = moments[index - 1]
        return !previous || Math.abs(previous.timestampSeconds - moment.timestampSeconds) > 45
      })
  }, [video?.companionBeats, video?.subtitleContext, video?.subtitleSource, video?.subtitleUrl])

  const hasCompanionAccess = Boolean(video?.subtitleUrl || video?.subtitleSource === 'embedded')

  useEffect(() => {
    if (!video || !hasCompanionAccess || companionReadyRef.current) return

    companionReadyRef.current = true
    setCompanionMessages([
      {
        id: `companion-ready-${video.id}`,
        role: 'assistant',
        message: "I'm in. Let it play and I'll cut in when the movie actually does something worth talking about.",
        createdAt: new Date().toISOString(),
      },
    ])
  }, [hasCompanionAccess, video])

  useEffect(() => {
    if (!autoCompanionMoments.length) return

    const previousTime = previousTimeRef.current
    previousTimeRef.current = currentTime

    const nextBeat = autoCompanionMoments.find(
      (beat) =>
        !surfacedBeatIdsRef.current.has(beat.id) &&
        (
          (previousTime < beat.timestampSeconds &&
            currentTime >= beat.timestampSeconds) ||
          (currentTime >= beat.timestampSeconds &&
            currentTime <= beat.timestampSeconds + 45)
        )
    )

    if (!nextBeat) return

    surfacedBeatIdsRef.current.add(nextBeat.id)
    setCompanionMessages((current) => {
      const lastAssistant = [...current].reverse().find((message) => message.role === 'assistant')
      if (
        lastAssistant &&
        lastAssistant.message.trim().toLowerCase() === nextBeat.message.trim().toLowerCase()
      ) {
        return current
      }

      return [
        ...current,
        {
          id: `beat-${nextBeat.id}`,
          role: 'assistant',
          message: nextBeat.message,
          createdAt: new Date().toISOString(),
          timestampSeconds: nextBeat.timestampSeconds,
        },
      ]
    })
  }, [autoCompanionMoments, currentTime])

  const relatedVideos = useMemo(
    () => videos.filter((v) => v.id !== videoId && v.category === video?.category).slice(0, 4),
    [video?.category, videoId, videos]
  )

  const nextKeyMomentTime = useMemo(() => {
    const beats = video?.companionBeats ?? []
    return beats.find((beat) => beat.timestampSeconds > currentTime + 4)?.timestampSeconds ?? null
  }, [currentTime, video?.companionBeats, video?.subtitleContext])

  const handleCreateComment = async (input: Parameters<typeof createComment>[1]) => {
    if (!video) return
    setIsSubmittingComment(true)
    try {
      const nextComment = await createComment(video.id, {
        ...input,
        userId: user?.id,
      })
      setComments((current) => [nextComment, ...current])
      setNextCommentsCursor((current) => current)
      const nextPulses = await getScenePulses(video)
      setPulses(nextPulses)
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleLoadMoreComments = async () => {
    if (!video || !nextCommentsCursor) return
    setIsLoadingMoreComments(true)
    try {
      const nextPage = await getComments(video.id, {
        cursor: nextCommentsCursor,
        pageSize: 4,
      })
      setComments((current) => [...current, ...nextPage.items])
      setNextCommentsCursor(nextPage.nextCursor)
    } finally {
      setIsLoadingMoreComments(false)
    }
  }

  const handleToggleLike = async () => {
    if (!video || isUpdatingLike) return

    const nextLiked = !isLiked
    const nextLikes = Math.max(0, displayLikes + (nextLiked ? 1 : -1))

    setIsUpdatingLike(true)
    setIsLiked(nextLiked)
    setDisplayLikes(nextLikes)

    try {
      await updateVideo(video.id, { likes: nextLikes })
    } catch {
      setIsLiked(!nextLiked)
      setDisplayLikes(displayLikes)
      setIsUpdatingLike(false)
      return
    }

    if (user?.id) {
      const likedMap = readLikedMap(user.id)
      likedMap[video.id] = nextLiked
      writeLikedMap(user.id, likedMap)
    }

    setIsUpdatingLike(false)
  }

  const handleShare = async () => {
    if (!video) return

    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/watch/${video.id}`
        : `/watch/${video.id}`

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: video.title,
          text: `Watch ${video.title} on Incentra`,
          url: shareUrl,
        })
        setShareState('shared')
        return
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl)
        setShareState('copied')
      }
    } catch {
      setShareState('idle')
    }
  }

  const jumpToTimestamp = (seconds: number) => {
    setSeekTo(seconds)
    playerSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const handleCompanionSend = async (message: string) => {
    if (!video || !hasCompanionAccess) return

    const userMessage: CompanionMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      message,
      createdAt: new Date().toISOString(),
      timestampSeconds: Math.round(currentTime),
    }

    setCompanionMessages((current) => [...current, userMessage])
    setIsCompanionThinking(true)

    try {
      const response = await sendCompanionChat(video.id, {
        currentTime,
        userMessage: message,
        recentMessages: companionMessages.slice(-6),
      })

      setCompanionMessages((current) => [...current, response.reply])
    } catch (error) {
      const nextMessage =
        error instanceof Error
          ? error.message
          : 'Second Seat is offline right now. Try again in a moment.'

      setCompanionMessages((current) => [
        ...current,
        {
          id: `companion-error-${Date.now()}`,
          role: 'assistant',
          message: nextMessage,
          createdAt: new Date().toISOString(),
          timestampSeconds: Math.round(currentTime),
        },
      ])
    } finally {
      setIsCompanionThinking(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="w-full px-4 py-8 sm:px-6 lg:px-10 2xl:px-14">
        {!authResolved || isAuthLoading || !user ? (
          <div className="space-y-6">
            <Skeleton className="aspect-video rounded-[32px] bg-secondary/70" />
            <Skeleton className="h-10 w-1/2 rounded-full bg-secondary/70" />
            <Skeleton className="h-5 w-3/4 rounded-full bg-secondary/70" />
          </div>
        ) : isLoading ? (
          <div className="space-y-6">
            <Skeleton className="aspect-video rounded-[32px] bg-secondary/70" />
            <Skeleton className="h-10 w-1/2 rounded-full bg-secondary/70" />
            <Skeleton className="h-5 w-3/4 rounded-full bg-secondary/70" />
          </div>
        ) : video ? (
          <>
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div>
                <motion.div
                  ref={playerSectionRef}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <Player
                    videoUrl={video.videoUrl}
                    title={video.title}
                    sourceFormat={video.sourceFormat}
                    subtitleUrl={video.subtitleUrl}
                    subtitleLabel={video.subtitleLabel}
                    subtitleLanguage={video.subtitleLanguage}
                    subtitleSource={video.subtitleSource}
                    seekTo={seekTo}
                    nextKeyMomentTime={nextKeyMomentTime}
                    onJumpToNextMoment={() => {
                      if (typeof nextKeyMomentTime === 'number') {
                        jumpToTimestamp(nextKeyMomentTime)
                      }
                    }}
                    onTimeChange={(time) => setCurrentTime(time)}
                    onDurationChange={(nextDuration) => setDuration(nextDuration)}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.12 }}
                  className="mt-8 border-b border-white/10 pb-8"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-primary/70">
                        Now Streaming
                      </p>
                      <h1 className="mt-2 text-5xl text-foreground" data-display="true">
                        {video.title}
                      </h1>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleLike}
                        disabled={isUpdatingLike}
                        className={isLiked ? 'border-red-300/30 bg-red-500/10 text-white' : ''}
                      >
                        <ThumbsUp className={`mr-2 h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                        {isLiked ? 'Liked' : 'Like'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleShare}>
                        <Share2 className="mr-2 h-4 w-4" />
                        {shareState === 'copied'
                          ? 'Copied'
                          : shareState === 'shared'
                            ? 'Shared'
                            : 'Share'}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-x-6 gap-y-4 text-sm text-foreground/65 md:grid-cols-3">
                    <div>
                      <ThumbsUp className="mb-2 h-4 w-4 text-primary" />
                      {displayLikes.toLocaleString()} likes
                    </div>
                    <div>
                      <Clock3 className="mb-2 h-4 w-4 text-primary" />
                      {Math.ceil(video.duration / 60)} min runtime
                    </div>
                    <div>
                      <Share2 className="mb-2 h-4 w-4 text-primary" />
                      Published {video.uploadedAt}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-border/50 pt-6">
                    <p className="font-semibold text-foreground">{video.uploadedBy}</p>
                    <p className="mt-3 max-w-3xl text-base leading-7 text-foreground/68">
                      {video.description}
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.18 }}
                  className="mt-8"
                >
                  <ScenePulse
                    pulses={pulses}
                    duration={duration || video.duration}
                    currentTime={currentTime}
                    onJump={jumpToTimestamp}
                  />
                </motion.div>

                {relatedVideos.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.24 }}
                    className="mt-10"
                  >
                    <h3 className="mb-6 text-3xl text-foreground" data-display="true">
                      More To Explore
                    </h3>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {relatedVideos.map((v, i) => (
                        <VideoCard key={v.id} video={v} index={i} />
                      ))}
                    </div>
                  </motion.div>
                )}

              </div>

              <aside className="space-y-8">
                {hasCompanionAccess ? (
                  <WatchCompanion
                    messages={companionMessages}
                    isThinking={isCompanionThinking}
                    onSend={handleCompanionSend}
                    onJump={jumpToTimestamp}
                  />
                ) : (
                  <WatchCompanionUnavailable />
                )}
                <div className="border-b border-white/10 pb-6 text-white">
                  <p className="text-xs uppercase tracking-[0.35em] text-red-200/60">
                    Reactions
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/62">
                    See where people reacted the hardest, jump back to standout moments, and add your own take to the scene.
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-[0.22em] text-white/40">
                    {isSocialLoading ? 'Loading reactions...' : `${comments.length} reactions on screen`}
                  </p>
                </div>
                <SpoilerSafeSocial
                  comments={comments}
                  isSubmitting={isSubmittingComment}
                  isLoadingMore={isLoadingMoreComments}
                  hasMore={Boolean(nextCommentsCursor)}
                  defaultAuthorName={user?.name ?? 'Guest Viewer'}
                  currentTime={currentTime}
                  onSubmit={handleCreateComment}
                  onJumpToTimestamp={jumpToTimestamp}
                  onLoadMore={handleLoadMoreComments}
                />
              </aside>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Video not found
            </h2>
            <p className="text-foreground/70">
              The video you're looking for doesn't exist.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
