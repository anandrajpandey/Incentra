'use client'

import { motion } from 'framer-motion'
import {
  AlertCircle,
  Captions,
  FastForward,
  Maximize,
  Pause,
  Play,
  Rewind,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { parseSubtitleFile } from '@/services/subtitles'

interface PlayerProps {
  videoUrl: string
  title: string
  sourceFormat?: string
  subtitleUrl?: string
  subtitleLabel?: string
  subtitleLanguage?: string
  subtitleSource?: 'external' | 'embedded'
  seekTo?: number | null
  nextKeyMomentTime?: number | null
  onJumpToNextMoment?: () => void
  onTimeChange?: (currentTime: number) => void
  onDurationChange?: (duration: number) => void
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function Player({
  videoUrl,
  title,
  sourceFormat,
  subtitleUrl,
  subtitleLabel,
  subtitleLanguage,
  subtitleSource,
  seekTo,
  nextKeyMomentTime,
  onJumpToNextMoment,
  onTimeChange,
  onDurationChange,
}: PlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [interactionTick, setInteractionTick] = useState(0)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [activeCaption, setActiveCaption] = useState('')
  const [subtitleLoadState, setSubtitleLoadState] = useState<'idle' | 'ready' | 'error'>('idle')
  const [subtitleCues, setSubtitleCues] = useState<Array<{ start: number; end: number; text: string }>>([])
  const [captionsEnabled, setCaptionsEnabled] = useState(true)

  const isMkv = (sourceFormat || videoUrl).toLowerCase().includes('mkv')

  useEffect(() => {
    if (!showControls || !isPlaying) return
    const timer = window.setTimeout(() => setShowControls(false), 2200)
    return () => window.clearTimeout(timer)
  }, [interactionTick, isPlaying, showControls])

  useEffect(() => {
    const handleFullscreenActivity = () => {
      if (document.fullscreenElement !== containerRef.current) return
      setShowControls(true)
      setInteractionTick((current) => current + 1)
    }

    document.addEventListener('mousemove', handleFullscreenActivity)
    document.addEventListener('touchstart', handleFullscreenActivity, { passive: true })
    document.addEventListener('keydown', handleFullscreenActivity)

    return () => {
      document.removeEventListener('mousemove', handleFullscreenActivity)
      document.removeEventListener('touchstart', handleFullscreenActivity)
      document.removeEventListener('keydown', handleFullscreenActivity)
    }
  }, [])

  useEffect(() => {
    if (seekTo === null || typeof seekTo === 'undefined') return
    const video = videoRef.current
    if (!video) return
    video.currentTime = seekTo
    setCurrentTime(seekTo)
  }, [seekTo])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const listeners: Array<{ track: TextTrack; handler: () => void }> = []

    const syncCaption = () => {
      const tracks = Array.from(video.textTracks ?? [])
      const activeTrack = tracks.find(
        (track) => track.mode === 'hidden' || track.mode === 'showing'
      )

      if (!activeTrack?.activeCues?.length) {
        setActiveCaption('')
        return
      }

      const cues = Array.from(activeTrack.activeCues)
      const text = cues
        .map((cue) => ('text' in cue ? String(cue.text) : ''))
        .filter(Boolean)
        .join('\n')
        .trim()

      setActiveCaption(text)
    }

    const enableTrack = () => {
      const tracks = Array.from(video.textTracks ?? [])
      if (!tracks.length) return
      const preferred =
        tracks.find((track) => /english|en/i.test(track.label || '') || /english|en/i.test(track.language || '')) ??
        tracks[0]

      tracks.forEach((track) => {
        track.mode = captionsEnabled && track === preferred ? 'hidden' : 'disabled'
        const handler = () => syncCaption()
        track.addEventListener('cuechange', handler)
        listeners.push({ track, handler })
      })

      syncCaption()
    }

    video.addEventListener('loadedmetadata', enableTrack)
    return () => {
      video.removeEventListener('loadedmetadata', enableTrack)
      listeners.forEach(({ track, handler }) => track.removeEventListener('cuechange', handler))
    }
  }, [captionsEnabled, videoUrl, subtitleUrl])

  useEffect(() => {
    let cancelled = false

    const loadSubtitles = async () => {
      if (!subtitleUrl) {
        setSubtitleCues([])
        setSubtitleLoadState('idle')
        return
      }

      try {
        setSubtitleLoadState('idle')
        const response = await fetch(subtitleUrl, { cache: 'force-cache', mode: 'cors' })
        if (!response.ok) {
          throw new Error('Failed to load subtitles')
        }

        const content = await response.text()
        const extension = subtitleUrl.toLowerCase().includes('.srt') ? 'srt' : 'vtt'
        const cues = parseSubtitleFile(content, extension)

        if (!cancelled) {
          setSubtitleCues(cues)
          setSubtitleLoadState('ready')
        }
      } catch {
        if (!cancelled) {
          setSubtitleCues([])
          setSubtitleLoadState('error')
        }
      }
    }

    void loadSubtitles()

    return () => {
      cancelled = true
    }
  }, [subtitleUrl])

  useEffect(() => {
    if (!subtitleCues.length || !captionsEnabled) {
      setActiveCaption('')
      return
    }

    const cue =
      subtitleCues.find((entry) => currentTime >= entry.start && currentTime <= entry.end) ?? null

    if (cue) {
      setActiveCaption(cue.text.replace(/<[^>]+>/g, '').trim())
      return
    }

    setActiveCaption('')
  }, [currentTime, subtitleCues])

  const togglePlay = async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      try {
        await video.play()
        setPlayerError(null)
        setIsPlaying(true)
      } catch {
        setPlayerError(
          isMkv
            ? 'This MKV file is not supported by the current browser. Use MP4/WebM for reliable playback, or remux this title before uploading.'
            : 'This video source is not supported by the current browser.'
        )
        setIsPlaying(false)
      }
      return
    }
    video.pause()
    setIsPlaying(false)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const handleSeek = (value: string) => {
    const nextTime = Number(value)
    const video = videoRef.current
    if (!video) return
    video.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const seekBy = (delta: number) => {
    const video = videoRef.current
    if (!video) return
    const nextTime = Math.max(0, Math.min(video.duration || duration || 0, video.currentTime + delta))
    video.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const requestFullscreen = async () => {
    if (!containerRef.current?.requestFullscreen) return
    await containerRef.current.requestFullscreen()
  }

  const handleSurfaceClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('button, input, a, [data-player-ignore-click="true"]')) {
      return
    }

    await togglePlay()
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl shadow-black/30"
      onMouseMove={() => {
        setShowControls(true)
        setInteractionTick((current) => current + 1)
      }}
      onMouseLeave={() => setShowControls(false)}
      onClick={handleSurfaceClick}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        crossOrigin={subtitleUrl ? 'anonymous' : undefined}
        className="aspect-video w-full bg-black"
        onTimeUpdate={(event) => {
          const nextTime = event.currentTarget.currentTime
          setCurrentTime(nextTime)
          onTimeChange?.(nextTime)
        }}
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration
          setDuration(nextDuration)
          onDurationChange?.(nextDuration)
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={() =>
          setPlayerError(
            isMkv
              ? 'This browser may not support MKV playback directly. MP4/WebM is the reliable path, but embedded subtitle tracks will auto-enable here whenever the browser exposes them.'
              : 'This video could not be played in the current browser.'
          )
        }
        controls={false}
      >
        {subtitleUrl ? (
          <track
            kind="subtitles"
            src={subtitleUrl}
            srcLang={subtitleLanguage || 'en'}
            label={subtitleLabel || 'English'}
            default
          />
        ) : null}
      </video>

      {activeCaption && captionsEnabled ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-6">
          <div className="max-w-4xl bg-black/72 px-4 py-2 text-center text-base leading-7 text-white shadow-[0_10px_40px_rgba(0,0,0,0.5)] md:text-lg">
            {activeCaption.split('\n').map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}

      <motion.div
        animate={{ opacity: showControls ? 1 : 0 }}
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/35"
      >
        <div className="absolute left-0 right-0 top-0 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-white/60">Now playing</p>
          <h2 className="mt-2 text-3xl text-white" data-display="true">
            {title}
          </h2>
        </div>

        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={togglePlay}
              className="rounded-full bg-white/15 p-6 text-white backdrop-blur-md transition hover:bg-primary hover:text-primary-foreground"
            >
              <Play className="h-10 w-10 fill-current" />
            </button>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          {(subtitleUrl || subtitleSource === 'embedded' || isMkv || playerError) && (
            <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-white/72">
              {subtitleUrl ? (
                <span className="inline-flex items-center gap-2 border border-white/12 px-3 py-1.5">
                  <Captions className="h-3.5 w-3.5 text-primary" />
                  {subtitleLabel || 'English'} subtitles {subtitleLoadState === 'error' ? 'unavailable' : 'ready'}
                </span>
              ) : null}
              {subtitleSource === 'embedded' ? (
                <span className="inline-flex items-center gap-2 border border-white/12 px-3 py-1.5">
                  <Captions className="h-3.5 w-3.5 text-primary" />
                  Embedded subtitles: auto-select when available
                </span>
              ) : null}
              {isMkv ? (
                <span className="inline-flex items-center gap-2 border border-white/12 px-3 py-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-primary" />
                  MKV playback depends on browser support
                </span>
              ) : null}
              {subtitleLoadState === 'error' ? (
                <span className="text-red-200/90">
                  Subtitle file is blocked by the CDN right now. Apply the CloudFront CORS update to make captions appear.
                </span>
              ) : null}
              {playerError ? <span className="text-red-200/90">{playerError}</span> : null}
            </div>
          )}
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={(event) => handleSeek(event.target.value)}
            data-player-ignore-click="true"
            className="mb-4 h-1.5 w-full cursor-pointer accent-primary"
          />
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/10">
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => seekBy(-10)} className="text-white hover:bg-white/10">
                <Rewind className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => seekBy(10)} className="text-white hover:bg-white/10">
                <FastForward className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/10">
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <span className="text-sm text-white/75">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(subtitleUrl || subtitleSource === 'embedded') ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCaptionsEnabled((current) => !current)}
                  className={captionsEnabled ? 'text-primary hover:bg-white/10' : 'text-white hover:bg-white/10'}
                  title={captionsEnabled ? 'Turn captions off' : 'Turn captions on'}
                >
                  <Captions className="h-5 w-5" />
                </Button>
              ) : null}
              {typeof nextKeyMomentTime === 'number' && onJumpToNextMoment ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onJumpToNextMoment}
                  className="text-white hover:bg-white/10"
                  title={`Skip to next moment at ${formatTime(nextKeyMomentTime)}`}
                >
                  <SkipForward className="h-5 w-5" />
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                onClick={requestFullscreen}
                className="text-white hover:bg-white/10"
              >
                <Maximize className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
