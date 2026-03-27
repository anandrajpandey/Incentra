'use client'

import { motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileText, FileVideo, Upload, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { analyzeSubtitleNarrative, createVideo, requestUploadUrl, uploadFileToStorage } from '@/services/api'
import { GENRES } from '@/services/genres'
import { convertSubtitlesToVtt } from '@/services/subtitles'

const categoryArtwork = Object.fromEntries(
  GENRES.map((genre) => [genre.name, genre.thumbnail])
) as Record<string, string>

async function getVideoDuration(file: File) {
  return new Promise<number>((resolve) => {
    const video = document.createElement('video')
    const objectUrl = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve(Math.round(video.duration || 0))
      URL.revokeObjectURL(objectUrl)
    }
    video.onerror = () => {
      resolve(0)
      URL.revokeObjectURL(objectUrl)
    }
    video.src = objectUrl
  })
}

export function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const subtitleInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedSubtitleFile, setSelectedSubtitleFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Action',
    streamUrl: '',
    thumbnail: '',
    uploadedBy: 'Jordan Admin',
    isFeatured: false,
  })

  const thumbnailPreview = useMemo(() => {
    return formData.thumbnail || categoryArtwork[formData.category]
  }, [formData.category, formData.thumbnail])

  const handleFileSelect = (file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file.')
      return
    }
    setSelectedFile(file)
    setError(null)
    if (!formData.title) {
      setFormData((prev) => ({
        ...prev,
        title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      }))
    }
  }

  const handleSubtitleSelect = (file?: File | null) => {
    if (!file) return
    const name = file.name.toLowerCase()
    if (!name.endsWith('.srt') && !name.endsWith('.vtt')) {
      setError('Subtitle file must be .srt or .vtt.')
      return
    }
    setSelectedSubtitleFile(file)
    setError(null)
  }

  const resetForm = () => {
    setSelectedFile(null)
    setSelectedSubtitleFile(null)
    setUploadProgress(0)
    setFormData({
      title: '',
      description: '',
      category: 'Action',
      streamUrl: '',
      thumbnail: '',
      uploadedBy: 'Jordan Admin',
      isFeatured: false,
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const normalizedStreamUrl = formData.streamUrl.trim()

    if (!selectedFile && !normalizedStreamUrl) {
      setError('Choose a video file or provide an HLS manifest URL before uploading.')
      return
    }

    if (!formData.title || !formData.description || !formData.uploadedBy) {
      setError('Fill in the title, description, and uploader fields.')
      return
    }

    if (normalizedStreamUrl && !/\.m3u8($|[?#])/i.test(normalizedStreamUrl)) {
      setError('Protected stream manifest URLs should point to a .m3u8 file.')
      return
    }

    setIsLoading(true)
    setStatus('uploading')
    setError(null)

    try {
      const duration = selectedFile ? await getVideoDuration(selectedFile) : 0
      const playbackType = normalizedStreamUrl ? 'hls' : 'file'
      const isExternalStreamUrl = /^https?:\/\//i.test(normalizedStreamUrl)
      let playbackUrl: string | undefined
      let videoObjectKey: string | undefined

      if (!normalizedStreamUrl && selectedFile) {
        const { uploadUrl, fileUrl, objectKey } = await requestUploadUrl({
          fileName: selectedFile.name,
          fileType: selectedFile.type,
        })

        await uploadFileToStorage(selectedFile, uploadUrl, setUploadProgress)
        playbackUrl =
          uploadUrl === 'mock-upload-url' ? URL.createObjectURL(selectedFile) : fileUrl
        videoObjectKey = objectKey
      }

      let subtitleUrl: string | undefined
      let subtitleLabel: string | undefined
      let subtitleLanguage: string | undefined
      let companionBeats: Awaited<ReturnType<typeof analyzeSubtitleNarrative>>['companionBeats'] | undefined = undefined
      let subtitleContext = undefined
      let subtitleTranscript = undefined
      let subtitleMetadata = undefined
      let storyContext = undefined

      if (selectedSubtitleFile) {
        const subtitleText = await selectedSubtitleFile.text()
        const extension = selectedSubtitleFile.name.split('.').pop()?.toLowerCase() || 'vtt'
        const vttContent = convertSubtitlesToVtt(subtitleText, extension)
        const subtitleAnalysis = await analyzeSubtitleNarrative({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          subtitleContent: subtitleText,
          subtitleExtension: extension,
        })
        storyContext = subtitleAnalysis.storyContext
        subtitleContext = subtitleAnalysis.subtitleContext
        companionBeats = subtitleAnalysis.companionBeats
        subtitleTranscript = subtitleAnalysis.subtitleTranscript
        subtitleMetadata = subtitleAnalysis.subtitleMetadata

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
        subtitleUrl = subtitleUpload.fileUrl
        subtitleLabel = 'English'
        subtitleLanguage = 'en'
      }

      await createVideo({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        thumbnail: thumbnailPreview,
        videoUrl: playbackUrl,
        videoObjectKey,
        streamUrl: normalizedStreamUrl && isExternalStreamUrl ? normalizedStreamUrl : undefined,
        hlsManifestKey:
          normalizedStreamUrl && !isExternalStreamUrl ? normalizedStreamUrl : undefined,
        playbackType,
        sourceFormat: normalizedStreamUrl
          ? 'hls'
          : selectedFile?.name.split('.').pop()?.toLowerCase() || selectedFile?.type,
        subtitleUrl,
        subtitleLabel,
        subtitleLanguage,
        subtitleSource: subtitleUrl
          ? 'external'
          : selectedFile?.name.toLowerCase().endsWith('.mkv')
            ? 'embedded'
            : undefined,
        companionBeats,
        subtitleContext,
        subtitleTranscript,
        subtitleMetadata,
        storyContext,
        duration,
        uploadedBy: formData.uploadedBy,
        isFeatured: formData.isFeatured,
      })

      setStatus('success')
      resetForm()
      setTimeout(() => setStatus('idle'), 2600)
    } catch (uploadError) {
      setStatus('error')
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-white/8 pb-8 lg:border-b-0 lg:border-r lg:pr-8">
            <p className="text-xs uppercase tracking-[0.35em] text-primary/70">
              New Release
            </p>
            <h2 className="mt-2 text-4xl text-foreground" data-display="true">
              Add A Title
            </h2>
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                handleFileSelect(event.dataTransfer.files?.[0])
              }}
              onClick={() => inputRef.current?.click()}
              className={`mt-6 cursor-pointer rounded-[24px] border border-dashed p-8 transition ${
                isDragging
                  ? 'border-primary bg-primary/6'
                  : 'border-white/12 bg-transparent hover:border-primary/40'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => handleFileSelect(event.target.files?.[0])}
              />
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 rounded-2xl bg-primary/15 p-4 text-primary">
                  <Upload className="h-7 w-7" />
                </div>
                <p className="font-semibold text-foreground">
                  {selectedFile ? selectedFile.name : 'Drop a video here or browse'}
                </p>
                <p className="mt-2 max-w-sm text-sm text-foreground/60">
                  Choose the file you want to feature next and start shaping its release details.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-white/8 pt-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Subtitle file</p>
                  <p className="text-sm text-foreground/60">
                    {selectedSubtitleFile ? selectedSubtitleFile.name : 'Optional .srt or .vtt for companion mode'}
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
              <button
                type="button"
                onClick={() => subtitleInputRef.current?.click()}
                className="w-full border border-white/10 px-4 py-3 text-left text-sm text-foreground/70 transition hover:border-primary/30 hover:text-foreground"
              >
                {selectedSubtitleFile ? 'Replace subtitle file' : 'Add subtitle file for companion analysis'}
              </button>
            </div>

            <div className="mt-6 border-t border-white/8 pt-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-2xl bg-secondary/40 p-3">
                  <FileVideo className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Selected media</p>
                  <p className="text-sm text-foreground/60">
                    {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : 'No file yet'}
                  </p>
                </div>
              </div>
              <div className="aspect-video overflow-hidden rounded-[22px] border border-white/10">
                <img src={thumbnailPreview} alt="Thumbnail preview" className="h-full w-full object-cover" />
              </div>
            </div>
          </div>

          <div className="lg:pl-2">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">Title</label>
                  <Input
                    value={formData.title}
                    onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Midnight Run"
                    disabled={isLoading}
                    className="bg-secondary/40"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">Description</label>
                  <Textarea
                    rows={5}
                    value={formData.description}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Write the line that sells the mood, stakes, and reason to press play."
                    disabled={isLoading}
                    className="bg-secondary/40"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    HLS manifest URL (recommended)
                  </label>
                  <Input
                    value={formData.streamUrl}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, streamUrl: event.target.value }))
                    }
                    placeholder="https://cdn.example.com/title/master.m3u8"
                    disabled={isLoading}
                    className="bg-secondary/40"
                  />
                  <p className="mt-2 text-xs leading-6 text-foreground/55">
                    Paste either a public `.m3u8` URL or a private manifest object key from your Incentra upload bucket.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Category</label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="bg-secondary/40">
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
                  <label className="mb-2 block text-sm font-medium text-foreground">Uploader</label>
                  <Input
                    value={formData.uploadedBy}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, uploadedBy: event.target.value }))
                    }
                    placeholder="Jordan Admin"
                    disabled={isLoading}
                    className="bg-secondary/40"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Thumbnail URL (optional)
                  </label>
                  <Input
                    value={formData.thumbnail}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, thumbnail: event.target.value }))
                    }
                    placeholder="https://images.unsplash.com/..."
                    disabled={isLoading}
                    className="bg-secondary/40"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, isFeatured: !prev.isFeatured }))
                }
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                  formData.isFeatured
                    ? 'border-primary/40 bg-primary/8'
                    : 'border-white/10 bg-transparent'
                }`}
              >
                <div>
                  <p className="font-semibold text-foreground">Feature on homepage hero</p>
                  <p className="text-sm text-foreground/60">
                    Let this title take the spotlight the moment viewers arrive.
                  </p>
                </div>
                <WandSparkles className="h-5 w-5 text-primary" />
              </button>

              {status === 'uploading' && (
                <div className="space-y-2 rounded-2xl border border-border/60 bg-background/35 p-4">
                  <div className="flex items-center justify-between text-sm text-foreground/70">
                    <span>Uploading media and building companion beats</span>
                    <span className="font-semibold text-primary">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              {status === 'success' && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                  The title is live and ready for the library.
                </div>
              )}

              {error && (
                <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? 'Uploading...' : 'Upload video'}
              </Button>
            </form>
          </div>
      </div>
    </motion.div>
  )
}
