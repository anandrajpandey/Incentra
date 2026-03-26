export type UserRole = 'user' | 'admin'

export interface Video {
  id: string
  title: string
  description: string
  category: string
  thumbnail: string
  videoUrl: string
  sourceFormat?: string
  subtitleUrl?: string
  subtitleLabel?: string
  subtitleLanguage?: string
  subtitleSource?: 'external' | 'embedded'
  companionBeats?: CompanionBeat[]
  subtitleContext?: SubtitleSceneContext[]
  subtitleTranscript?: SubtitleTranscriptCue[]
  subtitleMetadata?: SubtitleAnalysisMetadata
  storyContext?: string
  duration: number
  views: number
  likes: number
  uploadedAt: string
  uploadedBy: string
  isFeatured?: boolean
  playbackId?: string
}

export interface DiscoverRow {
  id: string
  title: string
  subtitle: string
  videos: Video[]
}

export interface AdaptiveDiscoverResponse {
  spotlight: Video | null
  rows: DiscoverRow[]
  profile: {
    userId?: string
    topCategory?: string
    recentVideoIds: string[]
    adaptiveMode: 'personalized' | 'trending'
  }
}

export interface DiscoverSignalInput {
  userId: string
  videoId: string
  category: string
  completed?: boolean
}

export interface ScenePulse {
  id: string
  label: string
  description: string
  timeInSeconds: number
  intensity: 'low' | 'medium' | 'high'
  sampleCount?: number
}

export interface CompanionBeat {
  id: string
  timestampSeconds: number
  endSeconds?: number
  label: string
  summary: string
  companionLine: string
  mood: 'tense' | 'funny' | 'emotional' | 'wild' | 'suspicious' | 'reflective'
  type?: string
  emotion?: string
  importance?: 'low' | 'medium' | 'high'
  keywords: string[]
}

export interface SubtitleChunk {
  id: string
  startSeconds: number
  endSeconds: number
  content: string
}

export interface SubtitleSceneContext {
  id: string
  startSeconds: number
  endSeconds: number
  summary: string
  excerpt: string
  keywords: string[]
  companionLine?: string
  emotion?: string
  type?: string
  importance?: 'low' | 'medium' | 'high'
  keyEvent?: string
}
export interface SubtitleTranscriptCue {
  startSeconds: number
  endSeconds: number
  text: string
}

export interface SubtitleAnalysisMetadata {
  totalDuration: number
  dominantEmotions: string[]
  genreGuess: string
  themes: string[]
  mainCharacters: string[]
  highlightReel: Array<{
    startSeconds: number
    endSeconds: number
    label: string
  }>
}

export interface SubtitleAnalysisRecord {
  videoId: string
  subtitleUrl?: string
  storyContext: string
  scenes: SubtitleSceneContext[]
  keyMoments: CompanionBeat[]
  transcript: SubtitleTranscriptCue[]
  metadata: SubtitleAnalysisMetadata
  updatedAt: string
}

export interface CompanionMessage {
  id: string
  role: 'user' | 'assistant'
  message: string
  createdAt: string
  timestampSeconds?: number
}

export interface SocialComment {
  videoId: string
  commentId: string
  userId?: string
  authorName: string
  message: string
  containsSpoilers: boolean
  timestampSeconds?: number
  aura?: string
  createdAt: string
}

export interface CommentsPage {
  items: SocialComment[]
  nextCursor: string | null
}

export interface CreateCommentInput {
  authorName: string
  userId?: string
  message: string
  containsSpoilers: boolean
  timestampSeconds?: number
  aura?: string
}

export interface VideoListResponse {
  items: Video[]
}

export interface UploadUrlRequest {
  fileName: string
  fileType: string
}

export interface UploadUrlResponse {
  uploadUrl: string
  fileUrl: string
  objectKey: string
}

export interface CreateVideoInput {
  title: string
  description: string
  category: string
  videoUrl: string
  sourceFormat?: string
  thumbnail: string
  subtitleUrl?: string
  subtitleLabel?: string
  subtitleLanguage?: string
  subtitleSource?: 'external' | 'embedded'
  companionBeats?: CompanionBeat[]
  subtitleContext?: SubtitleSceneContext[]
  subtitleTranscript?: SubtitleTranscriptCue[]
  subtitleMetadata?: SubtitleAnalysisMetadata
  storyContext?: string
  duration: number
  uploadedBy: string
  isFeatured?: boolean
}

export interface UpdateVideoInput {
  title?: string
  description?: string
  category?: string
  thumbnail?: string
  isFeatured?: boolean
  likes?: number
  subtitleUrl?: string
  subtitleLabel?: string
  subtitleLanguage?: string
  subtitleSource?: 'external' | 'embedded'
  companionBeats?: CompanionBeat[]
  subtitleContext?: SubtitleSceneContext[]
  subtitleTranscript?: SubtitleTranscriptCue[]
  subtitleMetadata?: SubtitleAnalysisMetadata
  storyContext?: string
}

export interface User {
  id: string
  email: string
  username?: string
  name: string
  avatar: string
  role: UserRole
  createdAt: string
  provider?: 'password' | 'google'
}

export interface LoginResponse {
  user: User
  token: string
}

export interface GoogleIdentityProfile {
  email: string
  name: string
  avatar: string
  googleId?: string
}

export interface RecentWatchItem {
  userId: string
  videoId: string
  title: string
  thumbnail: string
  category: string
  watchedAt: string
  progressSeconds: number
  duration: number
}

export interface CompanionChatRequest {
  currentTime: number
  userMessage: string
  recentMessages?: CompanionMessage[]
}

export interface CompanionChatResponse {
  reply: CompanionMessage
  activeBeat?: CompanionBeat | null
}

export interface AdminStats {
  totalVideos: number
  totalViews: number
  totalUsers: number
  uploadedThisMonth: number
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
}
