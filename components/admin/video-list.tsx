'use client'

import { motion } from 'framer-motion'
import { Edit2, Eye, FileText, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { UpdateVideoInput, Video } from '@/types'
import {
  analyzeSubtitleNarrative,
  deleteVideo,
  reanalyzeVideoSubtitles,
  resetVideoSubtitles,
  requestUploadUrl,
  updateVideo,
  uploadFileToStorage,
} from '@/services/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { GENRES } from '@/services/genres'
import { convertSubtitlesToVtt } from '@/services/subtitles'

interface VideoListProps {
  videos: Video[]
  isLoading?: boolean
  onVideoDeleted?: () => void
}

export function VideoList({
  videos,
  isLoading = false,
  onVideoDeleted,
}: VideoListProps) {
  const subtitleInputRef = useRef<HTMLInputElement>(null)
  const [deletingIds, setDeletingIds] = useState<string[]>([])
  const [reanalyzingIds, setReanalyzingIds] = useState<string[]>([])
  const [resettingIds, setResettingIds] = useState<string[]>([])
  const [editingVideo, setEditingVideo] = useState<Video | null>(null)
  const [draft, setDraft] = useState<UpdateVideoInput>({})
  const [isSaving, setIsSaving] = useState(false)
  const [selectedSubtitleFile, setSelectedSubtitleFile] = useState<File | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)

  const sortedVideos = useMemo(
    () => [...videos].sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt)),
    [videos]
  )

  const openEditor = (video: Video) => {
    setEditingVideo(video)
    setSelectedSubtitleFile(null)
    setEditorError(null)
    setDraft({
      title: video.title,
      description: video.description,
      category: video.category,
      thumbnail: video.thumbnail,
      isFeatured: video.isFeatured,
      subtitleUrl: video.subtitleUrl,
      subtitleLabel: video.subtitleLabel,
      subtitleLanguage: video.subtitleLanguage,
      subtitleSource: video.subtitleSource,
      companionBeats: video.companionBeats,
      subtitleContext: video.subtitleContext,
      subtitleTranscript: video.subtitleTranscript,
      storyContext: video.storyContext,
    })
  }

  const handleSubtitleSelect = (file?: File | null) => {
    if (!file) return
    const name = file.name.toLowerCase()
    if (!name.endsWith('.srt') && !name.endsWith('.vtt')) {
      setEditorError('Subtitle file must be .srt or .vtt.')
      return
    }
    setSelectedSubtitleFile(file)
    setEditorError(null)
  }

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => [...prev, id])
    try {
      await deleteVideo(id)
      await onVideoDeleted?.()
    } catch (error) {
      console.error('Failed to delete video:', error)
    } finally {
      setDeletingIds((prev) => prev.filter((videoId) => videoId !== id))
    }
  }

  const handleReanalyze = async (video: Video) => {
    setReanalyzingIds((prev) => [...prev, video.id])
    try {
      await reanalyzeVideoSubtitles(video.id)
      await onVideoDeleted?.()
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Failed to reanalyze subtitles.')
    } finally {
      setReanalyzingIds((prev) => prev.filter((id) => id !== video.id))
    }
  }

  const handleSave = async () => {
    if (!editingVideo) return
    setIsSaving(true)
    try {
      let nextDraft = { ...draft }

      if (selectedSubtitleFile) {
        const subtitleText = await selectedSubtitleFile.text()
        const extension = selectedSubtitleFile.name.split('.').pop()?.toLowerCase() || 'vtt'
        const vttContent = convertSubtitlesToVtt(subtitleText, extension)
        const subtitleAnalysis = await analyzeSubtitleNarrative({
          title: nextDraft.title ?? editingVideo.title,
          description: nextDraft.description ?? editingVideo.description,
          category: nextDraft.category ?? editingVideo.category,
          subtitleContent: subtitleText,
          subtitleExtension: extension,
        })
        const storyContext = subtitleAnalysis.storyContext
        const subtitleContext = subtitleAnalysis.subtitleContext
        const companionBeats = subtitleAnalysis.companionBeats
        const subtitleTranscript = subtitleAnalysis.subtitleTranscript ?? []

        const subtitleBlob = new Blob([vttContent], { type: 'text/vtt' })
        const vttFile = new File(
          [subtitleBlob],
          selectedSubtitleFile.name.replace(/\.(srt|vtt)$/i, '.vtt'),
          { type: 'text/vtt' }
        )

        const subtitleUpload = await requestUploadUrl({
          fileName: vttFile.name,
          fileType: vttFile.type,
        })

        await uploadFileToStorage(vttFile, subtitleUpload.uploadUrl)
        nextDraft = {
          ...nextDraft,
          subtitleUrl: subtitleUpload.fileUrl,
          subtitleLabel: 'English',
          subtitleLanguage: 'en',
          subtitleSource: 'external',
          companionBeats,
          subtitleContext,
          subtitleTranscript,
          subtitleMetadata: subtitleAnalysis.subtitleMetadata,
          storyContext,
        }
      }

      await updateVideo(editingVideo.id, nextDraft)
      setEditingVideo(null)
      setSelectedSubtitleFile(null)
      setEditorError(null)
      await onVideoDeleted?.()
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Failed to update video.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetSubtitles = async (video: Video) => {
    setResettingIds((prev) => [...prev, video.id])
    try {
      await resetVideoSubtitles(video.id)
      if (editingVideo?.id === video.id) {
        setEditingVideo(null)
        setSelectedSubtitleFile(null)
      }
      setEditorError(null)
      await onVideoDeleted?.()
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Failed to reset subtitles.')
    } finally {
      setResettingIds((prev) => prev.filter((id) => id !== video.id))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-[24px] bg-secondary/40" />
        ))}
      </div>
    )
  }

  if (!videos.length) {
    return (
      <div className="border-b border-white/8 p-12 text-center">
        <h3 className="text-lg font-semibold text-foreground/70">No videos uploaded yet</h3>
        <p className="mt-2 text-foreground/50">Your catalog will appear here after the first upload.</p>
      </div>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4"
      >
        {sortedVideos.map((video, index) => (
          <motion.div
            key={video.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <div className="overflow-hidden border-b border-white/8 pb-8">
              <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
                <div className="relative min-h-52">
                  <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-xs text-white">
                    <Eye className="h-3.5 w-3.5" />
                    {video.views.toLocaleString()} views
                  </div>
                </div>

                <div className="flex flex-col justify-between p-5">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-primary">
                        {video.category}
                      </span>
                      {video.isFeatured ? (
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-amber-300">
                          Featured
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-2xl text-foreground" data-display="true">
                      {video.title}
                    </h3>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/65">
                      {video.description}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="grid gap-1 text-sm text-foreground/55">
                      <span>Uploaded by {video.uploadedBy}</span>
                      <span>Published {video.uploadedAt}</span>
                      <span>{Math.floor(video.duration / 60)} min runtime</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a href={`/watch/${video.id}`} className="inline-flex">
                        <Button variant="outline" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </Button>
                      </a>
                      <Button variant="outline" size="sm" onClick={() => openEditor(video)}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReanalyze(video)}
                        disabled={reanalyzingIds.includes(video.id) || !video.subtitleUrl}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {reanalyzingIds.includes(video.id) ? 'Reanalyzing...' : 'Reanalyze subtitles'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetSubtitles(video)}
                        disabled={resettingIds.includes(video.id) || !video.subtitleUrl}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {resettingIds.includes(video.id) ? 'Resetting...' : 'Reset subtitles'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(video.id)}
                        disabled={deletingIds.includes(video.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingIds.includes(video.id) ? 'Removing...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <Dialog open={Boolean(editingVideo)} onOpenChange={(open) => !open && setEditingVideo(null)}>
        <DialogContent className="border-border/60 bg-card text-foreground sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit video metadata</DialogTitle>
            <DialogDescription>
              Refresh the title details or add subtitles now to generate companion beats for this release.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Title</label>
              <Input
                value={draft.title ?? ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Description</label>
              <Textarea
                rows={5}
                value={draft.description ?? ''}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Category</label>
                <Select
                  value={draft.category ?? 'Architecture'}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRES.map((genre) => (
                      <SelectItem key={genre.slug} value={genre.name}>
                        {genre.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Thumbnail URL</label>
                <Input
                  value={draft.thumbnail ?? ''}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, thumbnail: event.target.value }))
                  }
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setDraft((prev) => ({ ...prev, isFeatured: !prev.isFeatured }))
              }
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                draft.isFeatured
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-border/60 bg-background/30'
              }`}
            >
              <p className="font-semibold">Feature on homepage hero</p>
              <p className="text-sm text-foreground/60">
                Toggle whether this video is eligible for the hero banner.
              </p>
            </button>
            <div className="space-y-3 border border-white/8 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Subtitle and companion update</p>
                  <p className="mt-1 text-sm leading-6 text-foreground/60">
                    Add a subtitle file now and the system will rebuild the watch companion moments for this title.
                  </p>
                  <p className="mt-2 text-sm text-foreground/72">
                    {selectedSubtitleFile
                      ? selectedSubtitleFile.name
                      : draft.subtitleUrl
                        ? 'A subtitle track is already attached.'
                        : 'No subtitle file attached yet.'}
                  </p>
                </div>
              </div>
              <input
                ref={subtitleInputRef}
                type="file"
                accept=".srt,.vtt,text/vtt"
                className="hidden"
                onChange={(event) => handleSubtitleSelect(event.target.files?.[0])}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => subtitleInputRef.current?.click()}>
                {selectedSubtitleFile || draft.subtitleUrl ? 'Replace subtitle file' : 'Add subtitle file'}
                </Button>
                {editingVideo?.subtitleUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleResetSubtitles(editingVideo)}
                    disabled={resettingIds.includes(editingVideo.id)}
                  >
                    {resettingIds.includes(editingVideo.id) ? 'Resetting...' : 'Wipe subtitle history'}
                  </Button>
                ) : null}
              </div>
            </div>
            {editorError ? (
              <div className="text-sm text-destructive">{editorError}</div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingVideo(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
