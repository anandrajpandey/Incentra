'use client'

import {
  buildMockAdaptiveDiscover,
  buildMockScenePulses,
  createMockUserProfile,
  createMockComment,
  buildMockAdminStats,
  createMockVideo,
  deleteMockVideo,
  getMockComments,
  getMockCommentsPage,
  getMockRecentWatch,
  getMockRole,
  hasMockSession,
  mockUsers,
  persistMockUser,
  readMockCurrentUser,
  recordMockDiscoverSignal,
  recordMockRecentWatch,
  readMockVideos,
  setMockRole,
  setMockSession,
  updateMockVideo,
} from '@/services/mock-data'
import { apiConfig, buildApiUrl } from '@/services/config'
import {
  buildSubtitleContextFromSubtitles,
  buildSubtitleTranscriptFromSubtitles,
} from '@/services/subtitles'
import type {
  AdaptiveDiscoverResponse,
  AdminStats,
  CompanionBeat,
  CommentsPage,
  CompanionChatRequest,
  CompanionChatResponse,
  CreateCommentInput,
  CreateVideoInput,
  DiscoverSignalInput,
  GoogleIdentityProfile,
  LoginResponse,
  RecentWatchItem,
  ScenePulse,
  SocialComment,
  SubtitleAnalysisRecord,
  SubtitleAnalysisMetadata,
  SubtitleChunk,
  SubtitleSceneContext,
  SubtitleTranscriptCue,
  UpdateVideoInput,
  UploadUrlRequest,
  UploadUrlResponse,
  User,
  UserRole,
  Video,
} from '@/types'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'
const AUTH_TOKEN_STORAGE_KEY = 'streamflow.auth.token'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function getStoredAuthToken() {
  if (!canUseStorage()) return null
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
}

function setStoredAuthToken(token: string) {
  if (!canUseStorage()) return
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
}

function clearStoredAuthToken() {
  if (!canUseStorage()) return
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const raw = await response.text()
    let message = raw || 'Request failed'

    if (raw.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as { message?: string }
        message = parsed.message || message
      } catch {
      }
    }

    throw new Error(message)
  }
  return response.json() as Promise<T>
}

async function request<T>(
  path: string,
  init?: {
    method?: HttpMethod
    body?: unknown
  }
) {
  const response = await fetch(buildApiUrl(path), {
    method: init?.method ?? 'GET',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })

  return parseResponse<T>(response)
}

async function withMockFallback<T>(liveRequest: () => Promise<T>, fallback: () => T | Promise<T>) {
  if (apiConfig.useMocks) {
    return fallback()
  }

  try {
    return await liveRequest()
  } catch {
    return fallback()
  }
}

function mockUserFromRole(role: UserRole = getMockRole()) {
  return mockUsers[role]
}

function resolveRole(email: string): UserRole {
  const normalized = email.trim().toLowerCase()
  if (apiConfig.adminEmails.includes(normalized) || normalized.includes('admin')) {
    return 'admin'
  }
  return 'user'
}

function buildMockLoginResponse(input: {
  email: string
  name?: string
  avatar?: string
  provider?: 'password' | 'google'
}): LoginResponse {
  const role = resolveRole(input.email)
  const user = createMockUserProfile({
    email: input.email,
    name: input.name,
    avatar: input.avatar,
    role,
    provider: input.provider,
  })

  persistMockUser(user)

  return {
    user,
    token: `mock-token-${user.role}`,
  }
}

export async function getVideos(): Promise<Video[]> {
  return withMockFallback(
    async () => {
      const response = await request<Video[] | { items: Video[] }>('/videos')
      return Array.isArray(response) ? response : response.items
    },
    () => readMockVideos()
  )
}

export async function getVideoById(id: string): Promise<Video | null> {
  return withMockFallback(
    () => request<Video>(`/videos/${id}`),
    () => readMockVideos().find((video) => video.id === id) ?? null
  )
}

export async function getVideosByCategory(category: string): Promise<Video[]> {
  const videos = await getVideos()
  return videos.filter((video) => video.category === category)
}

export async function getAllVideosForAdmin(): Promise<Video[]> {
  return getVideos()
}

export async function requestUploadUrl(input: UploadUrlRequest): Promise<UploadUrlResponse> {
  return withMockFallback(
    () => request<UploadUrlResponse>('/upload-url', { method: 'POST', body: input }),
    () => ({
      uploadUrl: 'mock-upload-url',
      fileUrl: 'mock-file-url',
      objectKey: `mock/${Date.now()}-${input.fileName}`,
    })
  )
}

export async function uploadFileToStorage(
  file: File,
  uploadUrl: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  if (uploadUrl === 'mock-upload-url') {
    for (let value = 10; value <= 100; value += 15) {
      await new Promise((resolve) => setTimeout(resolve, 90))
      onProgress?.(Math.min(value, 100))
    }
    return
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
      } else {
        reject(new Error('S3 upload failed'))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(file)
  })
}

export async function createVideo(input: CreateVideoInput): Promise<Video> {
  return withMockFallback(
    () => request<Video>('/videos', { method: 'POST', body: input }),
    () => createMockVideo(input)
  )
}

export async function updateVideo(id: string, input: UpdateVideoInput): Promise<Video> {
  return withMockFallback(
    () => request<Video>(`/videos/${id}`, { method: 'PATCH', body: input }),
    () => updateMockVideo(id, input)
  )
}

export async function deleteVideo(id: string): Promise<void> {
  return withMockFallback(
    () => request<void>(`/videos/${id}`, { method: 'DELETE' }),
    () => deleteMockVideo(id)
  )
}

export async function login(email: string, _password: string): Promise<LoginResponse> {
  if (apiConfig.useMockAuth) {
    const result = buildMockLoginResponse({ email, provider: 'password' })
    setStoredAuthToken(result.token)
    return result
  }

  try {
    const result = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { identifier: email, password: _password },
    })
    setStoredAuthToken(result.token)
    return result
  } catch (error) {
    clearStoredAuthToken()
    throw error
  }
}

export async function loginWithGoogle(profile: GoogleIdentityProfile): Promise<LoginResponse> {
  if (apiConfig.useMockAuth) {
    const result = buildMockLoginResponse({
      email: profile.email,
      name: profile.name,
      avatar: profile.avatar,
      provider: 'google',
    })
    setStoredAuthToken(result.token)
    return result
  }

  try {
    const result = await request<LoginResponse>('/auth/google', { method: 'POST', body: profile })
    setStoredAuthToken(result.token)
    return result
  } catch (error) {
    clearStoredAuthToken()
    throw error
  }
}

export async function logout(): Promise<void> {
  if (apiConfig.useMockAuth) {
    setMockRole('user')
    setMockSession(false)
    clearStoredAuthToken()
    return
  }

  try {
    await request<void>('/auth/logout', { method: 'POST' })
  } finally {
    clearStoredAuthToken()
    setMockRole('user')
    setMockSession(false)
  }
}

export async function getCurrentUser(): Promise<User | null> {
  if (!apiConfig.useMockAuth && !getStoredAuthToken()) {
    return null
  }

  if (apiConfig.useMockAuth) {
    return hasMockSession() ? readMockCurrentUser() ?? mockUserFromRole() : null
  }

  try {
    return await request<User>('/auth/me')
  } catch {
    clearStoredAuthToken()
    return null
  }
}

export async function getAdminStats(): Promise<AdminStats> {
  return withMockFallback(
    () => request<AdminStats>('/admin/stats'),
    () => buildMockAdminStats()
  )
}

export async function getAdaptiveDiscover(userId?: string): Promise<AdaptiveDiscoverResponse> {
  return withMockFallback(
    () =>
      request<AdaptiveDiscoverResponse>(
        `/discover${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`
      ),
    () => buildMockAdaptiveDiscover(userId)
  )
}

export async function recordDiscoverSignal(input: DiscoverSignalInput): Promise<void> {
  return withMockFallback(
    () => request<void>('/discover/signals', { method: 'POST', body: input }),
    () => recordMockDiscoverSignal(input)
  )
}

export async function getScenePulses(video: Video): Promise<ScenePulse[]> {
  return withMockFallback(
    () => request<ScenePulse[]>(`/videos/${video.id}/pulses`),
    () => buildMockScenePulses(video)
  )
}

export async function getComments(
  videoId: string,
  options?: { cursor?: string | null; pageSize?: number }
): Promise<CommentsPage> {
  const query = new URLSearchParams()
  if (options?.cursor) query.set('cursor', options.cursor)
  if (options?.pageSize) query.set('pageSize', String(options.pageSize))
  const suffix = query.toString() ? `?${query.toString()}` : ''

  return withMockFallback(
    () => request<CommentsPage>(`/videos/${videoId}/comments${suffix}`),
    () => getMockCommentsPage(videoId, options?.cursor, options?.pageSize)
  )
}

export async function createComment(
  videoId: string,
  input: CreateCommentInput
): Promise<SocialComment> {
  return withMockFallback(
    () => request<SocialComment>(`/videos/${videoId}/comments`, { method: 'POST', body: input }),
    () => createMockComment(videoId, input)
  )
}

export async function analyzeSubtitleNarrative(input: {
  title: string
  description: string
  category: string
  subtitleContent: string
  subtitleExtension?: string
}): Promise<{
  storyContext: string
  subtitleContext: SubtitleSceneContext[]
  companionBeats: CompanionBeat[]
  subtitleMetadata: SubtitleAnalysisMetadata
  subtitleTranscript?: SubtitleTranscriptCue[]
}> {
  if (apiConfig.useMocks) {
    const transcript = buildSubtitleTranscriptFromSubtitles(
      input.subtitleContent,
      input.subtitleExtension ?? 'srt'
    )
    const scenes = buildSubtitleContextFromSubtitles(
      input.subtitleContent,
      input.subtitleExtension ?? 'srt'
    ).map((scene) => ({
      ...scene,
      companionLine:
        scene.summary.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean)[0]
          ? `Look, ${scene.summary.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean)[0]?.toLowerCase()}.`
          : 'Look, this scene matters.',
    }))

    const companionBeats = scenes
      .filter((scene, index) => index % 3 === 0)
      .slice(0, 8)
      .map((scene, index) => ({
        id: `mock-beat-${scene.id}-${index}`,
        timestampSeconds: scene.startSeconds,
        endSeconds: scene.endSeconds,
        label: scene.keyEvent || scene.summary.split(/[.!?]+/).filter(Boolean)[0] || `Moment ${index + 1}`,
        summary: scene.summary,
        companionLine: scene.companionLine || 'Look, this scene matters.',
        mood: 'reflective' as const,
        type: scene.type,
        emotion: scene.emotion,
        importance: scene.importance,
        keywords: scene.keywords.slice(0, 5),
      }))

    return {
      storyContext: [
        `${input.title} moves through ${input.category.toLowerCase()} tension with ${scenes
          .slice(0, 4)
          .map((scene) => scene.summary)
          .join(' ')}`.trim(),
        input.description,
      ]
        .filter(Boolean)
        .join(' '),
      subtitleContext: scenes,
      companionBeats,
      subtitleTranscript: transcript,
      subtitleMetadata: {
        totalDuration: transcript[transcript.length - 1]?.endSeconds ?? 0,
        dominantEmotions: scenes.map((scene) => scene.emotion).filter(Boolean).slice(0, 5) as string[],
        genreGuess: input.category,
        themes: [],
        mainCharacters: [],
        highlightReel: companionBeats.slice(0, 5).map((beat) => ({
          startSeconds: beat.timestampSeconds,
          endSeconds: beat.endSeconds ?? beat.timestampSeconds + 20,
          label: beat.label,
        })),
      },
    }
  }

  return request<{
    storyContext: string
    subtitleContext: SubtitleSceneContext[]
    companionBeats: CompanionBeat[]
    subtitleMetadata: SubtitleAnalysisMetadata
    subtitleTranscript?: SubtitleTranscriptCue[]
  }>('/subtitle-analysis', {
    method: 'POST',
    body: input,
  })
}

export async function getSubtitleAnalysis(videoId: string): Promise<SubtitleAnalysisRecord | null> {
  return withMockFallback(
    () => request<SubtitleAnalysisRecord>(`/videos/${videoId}/analysis`),
    async () => {
      const video = await getVideoById(videoId)
      if (!video?.subtitleMetadata) return null
      return {
        videoId,
        subtitleUrl: video.subtitleUrl,
        storyContext: video.storyContext ?? '',
        scenes: video.subtitleContext ?? [],
        keyMoments: video.companionBeats ?? [],
        transcript: video.subtitleTranscript ?? [],
        metadata: video.subtitleMetadata,
        updatedAt: video.uploadedAt,
      }
    }
  )
}

export async function reanalyzeVideoSubtitles(videoId: string): Promise<SubtitleAnalysisRecord> {
  return request<SubtitleAnalysisRecord>(`/videos/${videoId}/reanalyze-subtitles`, {
    method: 'POST',
  })
}

export async function resetVideoSubtitles(videoId: string): Promise<Video> {
  return request<Video>(`/videos/${videoId}/reset-subtitles`, {
    method: 'POST',
  })
}

export async function sendCompanionChat(
  videoId: string,
  input: CompanionChatRequest
): Promise<CompanionChatResponse> {
  if (apiConfig.useMocks) {
    return {
      reply: {
        id: `companion-${Date.now()}`,
        role: 'assistant',
        message: "Yeah, I caught that too. That moment is sketchy as hell.",
        createdAt: new Date().toISOString(),
        timestampSeconds: input.currentTime,
      },
      activeBeat: null,
    }
  }

  return request<CompanionChatResponse>(`/videos/${videoId}/companion/chat`, {
    method: 'POST',
    body: input,
  })
}

export async function getRecentWatch(userId: string): Promise<RecentWatchItem[]> {
  if (apiConfig.useMockAuth) {
    return getMockRecentWatch(userId)
  }

  return request<RecentWatchItem[]>(`/users/${userId}/recent-watch`)
}

export async function recordRecentWatch(
  userId: string,
  video: Video,
  progressSeconds = 0
): Promise<void> {
  if (apiConfig.useMockAuth) {
    recordMockRecentWatch(userId, video, progressSeconds)
    return
  }

  return request<void>(`/users/${userId}/recent-watch`, {
    method: 'POST',
    body: {
      videoId: video.id,
      title: video.title,
      thumbnail: video.thumbnail,
      category: video.category,
      progressSeconds,
      duration: video.duration,
    },
  })
}
