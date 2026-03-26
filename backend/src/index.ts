import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import { createHmac, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

type VideoItem = {
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
  companionBeats?: CompanionBeatItem[]
  subtitleContext?: SubtitleSceneContextItem[]
  subtitleTranscript?: SubtitleTranscriptCueItem[]
  subtitleMetadata?: SubtitleAnalysisMetadataItem
  storyContext?: string
  duration: number
  views: number
  likes: number
  uploadedAt: string
  uploadedBy: string
  isFeatured?: boolean
}

type CompanionBeatItem = {
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

type SubtitleChunkItem = {
  id: string
  startSeconds: number
  endSeconds: number
  content: string
}

type SubtitleSceneContextItem = {
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
type SubtitleTranscriptCueItem = {
  startSeconds: number
  endSeconds: number
  text: string
}

type SubtitleAnalysisMetadataItem = {
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

type SubtitleAnalysisItem = {
  videoId: string
  subtitleUrl?: string
  storyContext: string
  scenes: SubtitleSceneContextItem[]
  keyMoments: CompanionBeatItem[]
  transcript: SubtitleTranscriptCueItem[]
  metadata: SubtitleAnalysisMetadataItem
  updatedAt: string
}

type CommentItem = {
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

type UserProfileItem = {
  userId: string
  genreAffinity: Record<string, number>
  recentVideoIds: string[]
  lastWatchedAt: string
}

type UserItem = {
  userId: string
  email: string
  username: string
  name: string
  avatar: string
  role: 'user' | 'admin'
  createdAt: string
  provider: 'password' | 'google'
  passwordHash?: string
  googleId?: string
}

type RecentWatchItem = {
  userId: string
  watchedAt: string
  videoId: string
  title: string
  thumbnail: string
  category: string
  progressSeconds: number
  duration: number
}

type CreateVideoInput = {
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
  subtitleChunks?: SubtitleChunkItem[]
  companionBeats?: CompanionBeatItem[]
  subtitleContext?: SubtitleSceneContextItem[]
  subtitleTranscript?: SubtitleTranscriptCueItem[]
  subtitleMetadata?: SubtitleAnalysisMetadataItem
  storyContext?: string
  duration?: number
  uploadedBy?: string
  isFeatured?: boolean
}

type SubtitleAnalysisInput = {
  title: string
  description: string
  category: string
  subtitleContent: string
  subtitleExtension?: string
}

type ChunkSceneAnalysisItem = {
  startSeconds: number
  endSeconds: number
  summary: string
  emotion: string
  type: string
  importance: 'low' | 'medium' | 'high'
  keyEvent: string
}

type CreateCommentInput = {
  userId?: string
  authorName: string
  message: string
  containsSpoilers: boolean
  timestampSeconds?: number
  aura?: string
}

type UploadUrlInput = {
  fileName: string
  fileType: string
}

type DiscoverSignalInput = {
  userId: string
  videoId: string
  category: string
  completed?: boolean
}

type AuthLoginInput = {
  identifier: string
  password: string
}

type GoogleAuthInput = {
  email: string
  name: string
  avatar?: string
  googleId?: string
}

type RecordRecentWatchInput = {
  videoId: string
  title: string
  thumbnail: string
  category: string
  progressSeconds?: number
  duration?: number
}

type CompanionChatInput = {
  currentTime: number
  userMessage: string
  recentMessages?: Array<{ role: 'user' | 'assistant'; message: string }>
}

type CommentsPage = {
  items: CommentItem[]
  nextCursor: string | null
}

const region = process.env.AWS_REGION || 'ap-south-1'
const tableName = process.env.VIDEOS_TABLE_NAME || 'streamflow-videos'
const commentsTableName = process.env.COMMENTS_TABLE_NAME || 'streamflow-comments'
const userProfilesTableName = process.env.USER_PROFILES_TABLE_NAME || 'streamflow-user-profiles'
const usersTableName = process.env.USERS_TABLE_NAME || 'streamflow-users'
const recentWatchTableName = process.env.RECENT_WATCH_TABLE_NAME || 'streamflow-recent-watch'
const subtitleAnalysesTableName =
  process.env.SUBTITLE_ANALYSES_TABLE_NAME || 'streamflow-subtitle-analyses'
const bucketName = process.env.UPLOAD_BUCKET_NAME || 'streamflow-video-uploads'
const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN?.replace(/\/+$/, '')
const frontendOrigin = process.env.FRONTEND_ORIGIN || '*'
const authTokenSecret = process.env.AUTH_TOKEN_SECRET || 'streamflow-local-auth-secret'
const geminiApiKey = process.env.GEMINI_API_KEY
const geminiModel = process.env.GEMINI_MODEL || 'gemma-3-27b-it'
const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

const s3Client = new S3Client({ region })
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

function response(
  statusCode: number,
  body: unknown
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': frontendOrigin,
      'access-control-allow-headers': 'content-type,authorization',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  }
}

function parseJson<T>(body?: string | null): T {
  if (!body) {
    throw new Error('Request body is required')
  }
  return JSON.parse(body) as T
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function buildPlaybackUrl(objectKey: string) {
  if (cloudFrontDomain) {
    return `${cloudFrontDomain}/${objectKey}`
  }
  return `https://${bucketName}.s3.${region}.amazonaws.com/${objectKey}`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signToken(userId: string) {
  const payload = base64UrlEncode(
    JSON.stringify({
      userId,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
    })
  )
  const signature = createHmac('sha256', authTokenSecret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function verifyToken(token: string) {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) {
    throw new Error('Invalid token')
  }

  const expected = createHmac('sha256', authTokenSecret).update(payload).digest()
  const received = Buffer.from(signature, 'base64url')
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error('Invalid token')
  }

  const parsed = JSON.parse(base64UrlDecode(payload)) as { userId?: string; exp?: number }
  if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) {
    throw new Error('Expired token')
  }

  return parsed.userId
}

function extractBearerToken(event: APIGatewayProxyEventV2) {
  const header = event.headers.authorization || event.headers.Authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7)
}

function buildPasswordHash(password: string) {
  const salt = randomUUID().replace(/-/g, '')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, derived] = passwordHash.split(':')
  if (!salt || !derived) return false
  const candidate = scryptSync(password, salt, 64)
  const target = Buffer.from(derived, 'hex')
  return candidate.length === target.length && timingSafeEqual(candidate, target)
}

function toPublicUser(user: UserItem) {
  return {
    id: user.userId,
    email: user.email,
    username: user.username,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
    createdAt: user.createdAt,
    provider: user.provider,
  }
}

function resolveRole(email: string): 'user' | 'admin' {
  const normalized = email.toLowerCase()
  return adminEmails.includes(normalized) || normalized.includes('admin') ? 'admin' : 'user'
}

function defaultAvatar(seed: string) {
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`
}

function defaultNameFromEmail(email: string) {
  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (value) => value.toUpperCase())
}

async function listVideos(category?: string) {
  const result = await dynamoClient.send(
    new ScanCommand({
      TableName: tableName,
      ...(category
        ? {
            FilterExpression: '#category = :category',
            ExpressionAttributeNames: {
              '#category': 'category',
            },
            ExpressionAttributeValues: {
              ':category': category,
            },
          }
        : {}),
    })
  )

  const items = ((result.Items as VideoItem[] | undefined) ?? []).sort((left, right) =>
    right.uploadedAt.localeCompare(left.uploadedAt)
  )
  const viewCounts = await getViewCountsByVideo()

  return Promise.all(
    items.map(async (video) => {
      const merged = await mergeVideoWithSubtitleAnalysis(video)
      return {
        ...merged,
        views: Math.max(merged.views ?? 0, viewCounts[video.id] ?? 0),
      }
    })
  )
}

async function getVideo(id: string) {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { id },
    })
  )
  const item = (result.Item as VideoItem | undefined) ?? null
  if (!item) return null
  const viewCounts = await getViewCountsByVideo()
  const merged = await mergeVideoWithSubtitleAnalysis(item)
  return {
    ...merged,
    views: Math.max(merged.views ?? 0, viewCounts[id] ?? 0),
  }
}

async function getSubtitleAnalysis(videoId: string) {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: subtitleAnalysesTableName,
      Key: { videoId },
    })
  )
  return (result.Item as SubtitleAnalysisItem | undefined) ?? null
}

async function saveSubtitleAnalysis(item: SubtitleAnalysisItem) {
  await dynamoClient.send(
    new PutCommand({
      TableName: subtitleAnalysesTableName,
      Item: item,
    })
  )
  return item
}

async function resetVideoSubtitles(videoId: string) {
  await dynamoClient.send(
    new DeleteCommand({
      TableName: subtitleAnalysesTableName,
      Key: { videoId },
    })
  )

  const result = await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { id: videoId },
      UpdateExpression:
        'REMOVE subtitleUrl, subtitleLabel, subtitleLanguage, subtitleSource, companionBeats, subtitleContext, subtitleTranscript, subtitleMetadata, storyContext',
      ReturnValues: 'ALL_NEW',
    })
  )

  return (result.Attributes as VideoItem | undefined) ?? null
}

async function mergeVideoWithSubtitleAnalysis(video: VideoItem) {
  const analysis = await getSubtitleAnalysis(video.id)
  if (!analysis) return video

  return {
    ...video,
    storyContext: analysis.storyContext,
    subtitleContext: analysis.scenes,
    companionBeats: analysis.keyMoments,
    subtitleTranscript: analysis.transcript,
    subtitleMetadata: analysis.metadata,
  }
}

async function createVideo(input: CreateVideoInput) {
  const item: VideoItem = {
    id: randomUUID(),
    title: input.title,
    description: input.description,
    category: input.category,
    thumbnail: input.thumbnail,
    videoUrl: input.videoUrl,
    sourceFormat: input.sourceFormat,
    subtitleUrl: input.subtitleUrl,
    subtitleLabel: input.subtitleLabel,
    subtitleLanguage: input.subtitleLanguage,
    subtitleSource: input.subtitleSource,
    companionBeats: input.companionBeats ?? [],
    subtitleContext: input.subtitleContext ?? [],
    subtitleTranscript: input.subtitleTranscript ?? [],
    subtitleMetadata: input.subtitleMetadata,
    storyContext: input.storyContext,
    duration: input.duration ?? 0,
    views: 0,
    likes: 0,
    uploadedAt: new Date().toISOString().slice(0, 10),
    uploadedBy: input.uploadedBy || 'Admin',
    isFeatured: input.isFeatured ?? false,
  }

  await dynamoClient.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    })
  )

  if (
    item.subtitleContext?.length ||
    item.companionBeats?.length ||
    item.storyContext ||
    item.subtitleTranscript?.length
  ) {
    await saveSubtitleAnalysis({
      videoId: item.id,
      subtitleUrl: item.subtitleUrl,
      storyContext: item.storyContext ?? '',
      scenes: item.subtitleContext ?? [],
      keyMoments: item.companionBeats ?? [],
      transcript: item.subtitleTranscript ?? [],
      metadata:
        item.subtitleMetadata ?? {
          totalDuration: item.duration ?? 0,
          dominantEmotions: [],
          genreGuess: item.category,
          themes: [],
          mainCharacters: [],
          highlightReel: [],
        },
      updatedAt: new Date().toISOString(),
    })
  }

  return item
}

async function updateVideo(id: string, patch: Partial<VideoItem>) {
  const entries = Object.entries(patch).filter(([, value]) => typeof value !== 'undefined')
  if (!entries.length) {
    return getVideo(id)
  }

  const names: Record<string, string> = {}
  const values: Record<string, unknown> = {}
  const clauses = entries.map(([key, value], index) => {
    const nameKey = `#field${index}`
    const valueKey = `:value${index}`
    names[nameKey] = key
    values[valueKey] = value
    return `${nameKey} = ${valueKey}`
  })

  const result = await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { id },
      UpdateExpression: `SET ${clauses.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    })
  )
  const updated = (result.Attributes as VideoItem | undefined) ?? null
  if (!updated) return null

  if (
    typeof patch.storyContext !== 'undefined' ||
    typeof patch.subtitleContext !== 'undefined' ||
    typeof patch.subtitleTranscript !== 'undefined' ||
    typeof patch.subtitleMetadata !== 'undefined' ||
    typeof patch.companionBeats !== 'undefined' ||
    typeof patch.subtitleUrl !== 'undefined'
  ) {
    await saveSubtitleAnalysis({
      videoId: updated.id,
      subtitleUrl: updated.subtitleUrl,
      storyContext: updated.storyContext ?? '',
      scenes: updated.subtitleContext ?? [],
      keyMoments: updated.companionBeats ?? [],
      transcript: updated.subtitleTranscript ?? [],
      metadata:
        updated.subtitleMetadata ?? {
          totalDuration: updated.duration ?? 0,
          dominantEmotions: [],
          genreGuess: updated.category,
          themes: [],
          mainCharacters: [],
          highlightReel: [],
        },
      updatedAt: new Date().toISOString(),
    })
  }

  return updated
}

async function deleteVideo(id: string) {
  await dynamoClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { id },
    })
  )
  await dynamoClient.send(
    new DeleteCommand({
      TableName: subtitleAnalysesTableName,
      Key: { videoId: id },
    })
  )
}

async function createUploadUrl(input: UploadUrlInput) {
  const objectKey = `videos/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${sanitizeFileName(
    input.fileName
  )}`

  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: input.fileType,
    }),
    { expiresIn: 900 }
  )

  return {
    uploadUrl,
    fileUrl: buildPlaybackUrl(objectKey),
    objectKey,
  }
}

async function getAdminStats() {
  const videos = await listVideos()
  const [usersCountResult, viewCounts] = await Promise.all([
    dynamoClient.send(
      new ScanCommand({
        TableName: usersTableName,
        Select: 'COUNT',
      })
    ),
    getViewCountsByVideo(),
  ])

  const totalViews =
    Object.values(viewCounts).reduce((sum, count) => sum + count, 0) ||
    videos.reduce((sum, video) => sum + video.views, 0)
  const uploadedThisMonth = videos.filter((video) => {
    const uploadedAt = new Date(video.uploadedAt)
    const now = new Date()
    return (
      uploadedAt.getUTCFullYear() === now.getUTCFullYear() &&
      uploadedAt.getUTCMonth() === now.getUTCMonth()
    )
  }).length

  return {
    totalVideos: videos.length,
    totalViews,
    totalUsers: usersCountResult.Count ?? 0,
    uploadedThisMonth,
  }
}

async function incrementVideoViews(videoId: string) {
  await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { id: videoId },
      UpdateExpression: 'ADD #views :increment',
      ExpressionAttributeNames: {
        '#views': 'views',
      },
      ExpressionAttributeValues: {
        ':increment': 1,
      },
    })
  )
}

async function getViewCountsByVideo() {
  const result = await dynamoClient.send(
    new ScanCommand({
      TableName: recentWatchTableName,
    })
  )

  const items = (result.Items as RecentWatchItem[] | undefined) ?? []
  const uniqueViews = new Set<string>()
  const counts: Record<string, number> = {}

  items.forEach((item) => {
    const key = `${item.userId}:${item.videoId}`
    if (uniqueViews.has(key)) return
    uniqueViews.add(key)
    counts[item.videoId] = (counts[item.videoId] ?? 0) + 1
  })

  return counts
}

async function getUserProfile(userId: string) {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: userProfilesTableName,
      Key: { userId },
    })
  )

  return (result.Item as UserProfileItem | undefined) ?? null
}

async function recordDiscoverSignal(input: DiscoverSignalInput) {
  const current = (await getUserProfile(input.userId)) ?? {
    userId: input.userId,
    genreAffinity: {},
    recentVideoIds: [],
    lastWatchedAt: new Date(0).toISOString(),
  }

  const weight = input.completed ? 3 : 1
  const nextProfile: UserProfileItem = {
    ...current,
    genreAffinity: {
      ...current.genreAffinity,
      [input.category]: (current.genreAffinity[input.category] ?? 0) + weight,
    },
    recentVideoIds: [input.videoId, ...current.recentVideoIds.filter((id) => id !== input.videoId)].slice(0, 6),
    lastWatchedAt: new Date().toISOString(),
  }

  await dynamoClient.send(
    new PutCommand({
      TableName: userProfilesTableName,
      Item: nextProfile,
    })
  )
}

function scoreVideo(video: VideoItem, profile?: UserProfileItem) {
  const affinity = profile?.genreAffinity[video.category] ?? 0
  const recent = profile?.recentVideoIds.includes(video.id) ? 6 : 0
  const featured = video.isFeatured ? 14 : 0
  return affinity * 12 + video.likes / 1500 + video.views / 18000 + recent + featured
}

async function buildAdaptiveDiscover(userId?: string) {
  const [videos, profile] = await Promise.all([
    listVideos(),
    userId ? getUserProfile(userId) : Promise.resolve(null),
  ])

  const topCategory = profile
    ? Object.entries(profile.genreAffinity).sort((left, right) => right[1] - left[1])[0]?.[0]
    : undefined
  const ranked = [...videos].sort(
    (left, right) => scoreVideo(right, profile ?? undefined) - scoreVideo(left, profile ?? undefined)
  )

  const rows = [
    {
      id: 'adaptive-discover',
      title: profile ? 'Tonight For You' : 'Editor Spotlight',
      subtitle: profile
        ? `Shaped by the genre you keep returning to most: ${topCategory ?? 'your latest lane'}.`
        : 'A first look at the titles carrying the strongest pull right now.',
      videos: ranked.slice(0, 6),
    },
    {
      id: 'category-drift',
      title: topCategory ? `${topCategory} After Dark` : 'Late Night Voltage',
      subtitle: topCategory
        ? 'A tighter shelf built around the lane you have been leaning into lately.'
        : 'A sharp mix of standout premieres and catalog favorites.',
      videos: ranked.filter((video) => !topCategory || video.category === topCategory).slice(0, 6),
    },
    {
      id: 'rising-reactions',
      title: 'Rising Reactions',
      subtitle: 'The titles drawing the strongest pull across the catalog right now.',
      videos: [...videos]
        .sort((left, right) => right.likes + right.views / 50 - (left.likes + left.views / 50))
        .slice(0, 6),
    },
  ].filter((row) => row.videos.length > 0)

  return {
    spotlight: ranked[0] ?? null,
    rows,
    profile: {
      userId,
      topCategory,
      recentVideoIds: profile?.recentVideoIds ?? [],
      adaptiveMode: profile ? 'personalized' : 'trending',
    },
  }
}

async function listComments(
  videoId: string,
  options?: { cursor?: string | null; pageSize?: number }
): Promise<CommentsPage> {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: commentsTableName,
      KeyConditionExpression: 'videoId = :videoId',
      ExpressionAttributeValues: {
        ':videoId': videoId,
      },
    })
  )

  const comments = ((result.Items as CommentItem[] | undefined) ?? []).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )
  const start = options?.cursor ? Number(options.cursor) || 0 : 0
  const pageSize = options?.pageSize ?? 4
  const items = comments.slice(start, start + pageSize)
  const nextCursor = start + pageSize < comments.length ? String(start + pageSize) : null

  return {
    items,
    nextCursor,
  }
}

async function createComment(videoId: string, input: CreateCommentInput) {
  const item: CommentItem = {
    videoId,
    commentId: randomUUID(),
    userId: input.userId,
    authorName: input.authorName,
    message: input.message,
    containsSpoilers: input.containsSpoilers,
    timestampSeconds: input.timestampSeconds,
    aura: input.aura,
    createdAt: new Date().toISOString(),
  }

  await dynamoClient.send(
    new PutCommand({
      TableName: commentsTableName,
      Item: item,
    })
  )

  return item
}

async function buildScenePulses(video: VideoItem) {
  const comments = (await listComments(video.id, { pageSize: 500 })).items.filter(
    (comment) => typeof comment.timestampSeconds === 'number'
  )
  const clusterWindow = Math.max(8, Math.round(Math.max(20, Math.round(video.duration / 18)) / 2))
  const emojiMoodLexicon = [
    { pattern: /🔥|💥|⚡|🚀/g, mood: 'Fire', intensity: 'high' as const },
    { pattern: /😱|👀|😨|🫣|😵/g, mood: 'Shock', intensity: 'high' as const },
    { pattern: /🤯|🧠|🌪/g, mood: 'Mindbend', intensity: 'high' as const },
    { pattern: /❤️|💔|🥹|😭/g, mood: 'Heart', intensity: 'medium' as const },
    { pattern: /😂|🤣/g, mood: 'Laugh', intensity: 'medium' as const },
    { pattern: /😮|👏|🙌|👌/g, mood: 'Buzz', intensity: 'medium' as const },
  ]

  const detectCommentMood = (comment: CommentItem) => {
    const aura = (comment.aura ?? '').toLowerCase()

    for (const entry of emojiMoodLexicon) {
      const matches = comment.message.match(entry.pattern)
      if (matches?.length) {
        return { mood: entry.mood, intensity: entry.intensity, weight: matches.length + 1 }
      }
    }

    if (aura.includes('dread') || aura.includes('spoiler')) {
      return { mood: 'Dread', intensity: 'high' as const, weight: 2 }
    }
    if (aura.includes('wonder')) {
      return { mood: 'Wonder', intensity: 'medium' as const, weight: 2 }
    }
    if (aura.includes('afterglow')) {
      return { mood: 'Afterglow', intensity: 'medium' as const, weight: 2 }
    }

    return {
      mood: 'Reaction',
      intensity: comment.message.includes('!') ? ('medium' as const) : ('low' as const),
      weight: 1,
    }
  }

  const sortedComments = [...comments].sort(
    (left, right) => (left.timestampSeconds as number) - (right.timestampSeconds as number)
  )
  const clusters: Array<{
    timestamps: number[]
    comments: CommentItem[]
    moodWeight: Record<string, number>
    intensityWeight: number
  }> = []

  sortedComments.forEach((comment) => {
    const timestamp = comment.timestampSeconds as number
    const mood = detectCommentMood(comment)
    const currentCluster = clusters[clusters.length - 1]

    if (
      currentCluster &&
      Math.abs(timestamp - currentCluster.timestamps[currentCluster.timestamps.length - 1]) <=
        clusterWindow
    ) {
      currentCluster.timestamps.push(timestamp)
      currentCluster.comments.push(comment)
      currentCluster.moodWeight[mood.mood] =
        (currentCluster.moodWeight[mood.mood] ?? 0) + mood.weight
      currentCluster.intensityWeight +=
        mood.intensity === 'high' ? 3 : mood.intensity === 'medium' ? 2 : 1
      return
    }

    clusters.push({
      timestamps: [timestamp],
      comments: [comment],
      moodWeight: { [mood.mood]: mood.weight },
      intensityWeight: mood.intensity === 'high' ? 3 : mood.intensity === 'medium' ? 2 : 1,
    })
  })

  const topBuckets = clusters
    .map((cluster) => ({
      timeInSeconds: Math.round(
        cluster.timestamps.reduce((sum, value) => sum + value, 0) / cluster.timestamps.length
      ),
      count: cluster.comments.length,
      moodWeight: cluster.moodWeight,
      intensityWeight: cluster.intensityWeight,
    }))
    .filter((entry) => entry.count >= 2)
    .sort((left, right) => right.count - left.count || left.timeInSeconds - right.timeInSeconds)
    .slice(0, 4)
    .sort((left, right) => left.timeInSeconds - right.timeInSeconds)

  return topBuckets.map((entry, index) => {
    const mood =
      Object.entries(entry.moodWeight).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'Reaction'
    const peakCount = topBuckets[0]?.count ?? 1
    const ratio = entry.count / peakCount

    return {
      id: `${video.id}-pulse-${entry.timeInSeconds}`,
      label: `${mood} Peak ${index + 1}`,
      description: `${entry.count} timestamped reactions keep circling back to this scene, led by ${mood.toLowerCase()} energy in the comments.`,
      intensity: ratio > 0.8 ? 'high' : ratio > 0.45 ? 'medium' : 'low',
      timeInSeconds: entry.timeInSeconds,
      sampleCount: entry.count,
    }
  })
}

function buildCompanionReply(video: VideoItem, input: CompanionChatInput) {
  const sceneContext = getSceneContextForTime(video, input.currentTime)
  const transcriptWindow = getTranscriptWindowForTime(video, input.currentTime)
  const transcriptRead = buildTranscriptRead(transcriptWindow, input.currentTime)
  const normalizedUserLine = input.userMessage.trim().toLowerCase()

  if (/\b(ready|you there|are you there|are you ready|hello|hi|hey|yo)\b/.test(normalizedUserLine)) {
    return {
      reply: {
        id: `companion-${Date.now()}`,
        role: 'assistant' as const,
        message: "Yeah, I'm here. Start the scene whenever you want and I'll stay with what's happening on screen.",
        createdAt: new Date().toISOString(),
        timestampSeconds: Math.round(input.currentTime),
      },
      activeBeat: null,
    }
  }

  if (/\b(popcorn|snacks?|drink|pause for snacks)\b/.test(normalizedUserLine)) {
    return {
      reply: {
        id: `companion-${Date.now()}`,
        role: 'assistant' as const,
        message: "Perfect. Get settled in and when the scene starts moving, I'll keep up with it.",
        createdAt: new Date().toISOString(),
        timestampSeconds: Math.round(input.currentTime),
      },
      activeBeat: null,
    }
  }

  if (/\b(thanks|thank you|cool|nice|got it)\b/.test(normalizedUserLine)) {
    return {
      reply: {
        id: `companion-${Date.now()}`,
        role: 'assistant' as const,
        message: 'Anytime. Ask about the scene whenever something feels worth unpacking.',
        createdAt: new Date().toISOString(),
        timestampSeconds: Math.round(input.currentTime),
      },
      activeBeat: null,
    }
  }

  const userLine = input.userMessage.trim().toLowerCase()
  const currentSummary = sceneContext.current?.summary ?? ''
  const recentSummary = sceneContext.previous.slice(-2).map((scene) => scene.summary).join(' ')
  let reply =
    "I can answer from what the movie has shown so far. Ask me about this scene and I’ll stay inside the current context."

  if (userLine.includes('next') || userLine.includes('predict') || userLine.includes('spoiler')) {
    reply = "I’m keeping this to what we’ve seen up to this timestamp, so I’m not going past the current scene."
  } else if (
    transcriptRead &&
    (userLine.includes('what happened') ||
      userLine.includes('what just happened') ||
      userLine.includes('what is happening') ||
      userLine.includes("what's happening") ||
      userLine.includes('explain'))
  ) {
    reply = `${transcriptRead} Right now the scene reads as ${currentSummary || 'the movie clarifying what is happening'}.`
  } else if (transcriptRead && userLine.includes('why')) {
    reply = `${transcriptRead} That matters because ${currentSummary || 'the tension in the current scene is changing'}.`
  } else if (
    transcriptRead &&
    (userLine.includes('did ') || userLine.includes('is ') || userLine.includes('are '))
  ) {
    reply = `From what we’ve seen up to this point, yes: ${transcriptRead}`
  } else if (currentSummary) {
    reply = recentSummary
      ? `${currentSummary} This follows from ${recentSummary.toLowerCase()}.`
      : currentSummary
  } else if (transcriptRead) {
    reply = transcriptRead
  }

  return {
    reply: {
      id: `companion-${Date.now()}`,
      role: 'assistant' as const,
      message: reply,
      createdAt: new Date().toISOString(),
      timestampSeconds: Math.round(input.currentTime),
    },
    activeBeat: null,
  }
}

async function buildAiCompanionReply(video: VideoItem, input: CompanionChatInput) {
  if (!geminiApiKey) {
    return buildCompanionReply(video, input)
  }

  const sceneContext = getSceneContextForTime(video, input.currentTime)
  const recentMessages = (input.recentMessages ?? [])
    .slice(-6)
    .map((message) => `${message.role === 'assistant' ? 'Companion' : 'Viewer'}: ${message.message}`)
    .join('\n')
  const currentSceneContext = sceneContext.current
    ? `Current scene (${sceneContext.current.startSeconds}s-${sceneContext.current.endSeconds}s): ${sceneContext.current.summary}\nDialogue excerpt: ${sceneContext.current.excerpt}`
    : 'Current scene context is limited.'
  const previousSceneContext = sceneContext.previous.length
    ? sceneContext.previous
        .map(
          (scene) =>
            `- Earlier scene ${scene.startSeconds}s-${scene.endSeconds}s: ${scene.summary}`
        )
        .join('\n')
    : 'No earlier scene context included.'
  const transcriptWindow = getTranscriptWindowForTime(video, input.currentTime)
  const transcriptContext = transcriptWindow.length
    ? transcriptWindow
        .map(
          (cue) =>
            `- ${cue.startSeconds}s-${cue.endSeconds}s: ${cue.text}`
        )
        .join('\n')
    : 'No subtitle dialogue window available.'
  const transcriptRead = buildTranscriptRead(transcriptWindow, input.currentTime)

  const userPrompt = [
    `You are "Second Seat", an AI movie companion inside Incentra.`,
    `Answer only from subtitle context that has happened up to the current timestamp.`,
    `Do not use future knowledge, whole-movie summaries, or guesses about later scenes.`,
    `If the viewer asks what happens next, say you cannot go beyond the current timestamp.`,
    `Answer direct scene questions plainly from the provided transcript and scene context.`,
    `If the viewer sends casual chat like "are you ready", "hi", "get some popcorn", or "thanks", respond naturally and briefly instead of forcing scene analysis.`,
    `Do not invent off-screen actions, hidden motives, or future twists.`,
    `Keep replies concise and natural.`,
    `Movie title: ${video.title}`,
    `Category: ${video.category}`,
    `Current playback time: ${Math.round(input.currentTime)} seconds`,
    `Use only context from before or at the current timestamp.`,
    transcriptRead
      ? `Plain reading of what is happening right around this moment:\n${transcriptRead}`
      : `Plain reading of what is happening right around this moment:\nNo direct transcript read available.`,
    currentSceneContext,
    `Earlier context:\n${previousSceneContext}`,
    `Subtitle transcript window around this moment:\n${transcriptContext}`,
    `Recent chat:\n${recentMessages || 'No previous chat.'}`,
    `Viewer question: ${input.userMessage}`,
  ].join('\n\n')

  const result = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
    {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: userPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 420,
      },
    }),
  })

  if (!result.ok) {
    const raw = await result.text()
    throw new Error(`Gemini companion request failed: ${raw}`)
  }

  const payload = (await result.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string
        }>
      }
    }>
  }
  const replyText =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim() ||
    buildCompanionReply(video, input).reply.message

  const normalizedReplyText = ensureCompleteCompanionReply(replyText, video, input)

  return {
    reply: {
      id: `companion-${Date.now()}`,
      role: 'assistant' as const,
      message: normalizedReplyText,
      createdAt: new Date().toISOString(),
      timestampSeconds: Math.round(input.currentTime),
    },
    activeBeat: null,
  }
}

async function getUserById(userId: string) {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: usersTableName,
      Key: { userId },
    })
  )
  return (result.Item as UserItem | undefined) ?? null
}

async function getUserByEmail(email: string) {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: usersTableName,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email.toLowerCase(),
      },
      Limit: 1,
    })
  )

  return ((result.Items as UserItem[] | undefined) ?? [])[0] ?? null
}

async function getUserByUsername(username: string) {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: usersTableName,
      IndexName: 'username-index',
      KeyConditionExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':username': username.toLowerCase(),
      },
      Limit: 1,
    })
  )

  return ((result.Items as UserItem[] | undefined) ?? [])[0] ?? null
}

async function ensureUniqueUsername(candidate: string) {
  const base = slugify(candidate || 'viewer').replace(/-/g, '_') || 'viewer'
  let next = base
  let counter = 1

  while (await getUserByUsername(next)) {
    counter += 1
    next = `${base}${counter}`
  }

  return next
}

async function saveUser(user: UserItem) {
  await dynamoClient.send(
    new PutCommand({
      TableName: usersTableName,
      Item: user,
    })
  )
  return user
}

async function createPasswordUser(email: string, password: string) {
  const normalizedEmail = email.toLowerCase()
  const username = await ensureUniqueUsername(normalizedEmail.split('@')[0])
  const user: UserItem = {
    userId: randomUUID(),
    email: normalizedEmail,
    username,
    name: defaultNameFromEmail(normalizedEmail),
    avatar: defaultAvatar(username),
    role: resolveRole(normalizedEmail),
    createdAt: new Date().toISOString(),
    provider: 'password',
    passwordHash: buildPasswordHash(password),
  }

  return saveUser(user)
}

async function loginWithPassword(input: AuthLoginInput) {
  const identifier = input.identifier.trim().toLowerCase()
  const byEmail = identifier.includes('@')
  const user = byEmail ? await getUserByEmail(identifier) : await getUserByUsername(identifier)

  if (!user) {
    if (!byEmail) {
      throw new Error('No account found for that username')
    }

    const created = await createPasswordUser(identifier, input.password)
    return {
      user: toPublicUser(created),
      token: signToken(created.userId),
    }
  }

  if (!user.passwordHash) {
    throw new Error('This account uses Google sign-in')
  }

  if (!verifyPassword(input.password, user.passwordHash)) {
    throw new Error('Incorrect password')
  }

  return {
    user: toPublicUser(user),
    token: signToken(user.userId),
  }
}

async function loginWithGoogle(input: GoogleAuthInput) {
  const normalizedEmail = input.email.toLowerCase()
  const existing = await getUserByEmail(normalizedEmail)

  if (existing) {
    const nextUser: UserItem = {
      ...existing,
      name: input.name || existing.name,
      avatar: input.avatar || existing.avatar,
      googleId: input.googleId || existing.googleId,
      provider: 'google',
    }

    await saveUser(nextUser)

    return {
      user: toPublicUser(nextUser),
      token: signToken(nextUser.userId),
    }
  }

  const baseUsername = input.email.split('@')[0] || slugify(input.name)
  const username = await ensureUniqueUsername(baseUsername)
  const user: UserItem = {
    userId: randomUUID(),
    email: normalizedEmail,
    username,
    name: input.name,
    avatar: input.avatar || defaultAvatar(username),
    role: resolveRole(normalizedEmail),
    createdAt: new Date().toISOString(),
    provider: 'google',
    googleId: input.googleId,
  }

  await saveUser(user)

  return {
    user: toPublicUser(user),
    token: signToken(user.userId),
  }
}

async function getAuthenticatedUser(event: APIGatewayProxyEventV2) {
  const token = extractBearerToken(event)
  if (!token) return null
  const userId = verifyToken(token)
  return getUserById(userId)
}

async function requireAuthenticatedUser(event: APIGatewayProxyEventV2) {
  const user = await getAuthenticatedUser(event)
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

async function listRecentWatch(userId: string) {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: recentWatchTableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false,
      Limit: 20,
    })
  )

  const seen = new Set<string>()
  return ((result.Items as RecentWatchItem[] | undefined) ?? []).filter((item) => {
    if (seen.has(item.videoId)) return false
    seen.add(item.videoId)
    return true
  }).slice(0, 10)
}

async function trimRecentWatch(userId: string) {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: recentWatchTableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false,
      Limit: 40,
    })
  )

  const items = (result.Items as RecentWatchItem[] | undefined) ?? []
  const seen = new Set<string>()
  const deletes: Array<Promise<unknown>> = []

  items.forEach((item, index) => {
    const duplicate = seen.has(item.videoId)
    if (!duplicate) {
      seen.add(item.videoId)
    }

    if (duplicate || index >= 10) {
      deletes.push(
        dynamoClient.send(
          new DeleteCommand({
            TableName: recentWatchTableName,
            Key: {
              userId: item.userId,
              watchedAt: item.watchedAt,
            },
          })
        )
      )
    }
  })

  await Promise.all(deletes)
}

async function recordRecentWatch(userId: string, input: RecordRecentWatchInput) {
  const existingResult = await dynamoClient.send(
    new QueryCommand({
      TableName: recentWatchTableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false,
      Limit: 50,
    })
  )

  const existingItems = (existingResult.Items as RecentWatchItem[] | undefined) ?? []
  const hasSeenVideo = existingItems.some((item) => item.videoId === input.videoId)

  const item: RecentWatchItem = {
    userId,
    watchedAt: new Date().toISOString(),
    videoId: input.videoId,
    title: input.title,
    thumbnail: input.thumbnail,
    category: input.category,
    progressSeconds: Math.max(0, Math.round(input.progressSeconds ?? 0)),
    duration: Math.max(0, Math.round(input.duration ?? 0)),
  }

  await dynamoClient.send(
    new PutCommand({
      TableName: recentWatchTableName,
      Item: item,
    })
  )

  if (!hasSeenVideo) {
    await incrementVideoViews(input.videoId)
  }

  await trimRecentWatch(userId)
}

function ensureCompleteCompanionReply(reply: string, video: VideoItem, input: CompanionChatInput) {
  const cleaned = reply.replace(/\s+/g, ' ').trim()
  if (!cleaned) {
    return buildCompanionReply(video, input).reply.message
  }

  const endsAbruptly =
    /[,;:]\s*$/.test(cleaned) ||
    /\b(and|but|because|so|with|while|when|if|that|which|who|where|do|did|does|is|are|was|were|has|have|had|can|could|should|would|will|won't|don't|doesn't|isn't|aren't)\s*$/i.test(cleaned) ||
    !/[.!?]"?\)?\s*$/.test(cleaned)

  const sentenceCount = (cleaned.match(/[.!?]/g) ?? []).length
  const needsExplanation = /(explain|what is happening|what's happening|what happened)/i.test(
    input.userMessage
  )

  if (!needsExplanation && cleaned.length >= 12) {
    return cleaned
  }

  if (!endsAbruptly && (!needsExplanation || sentenceCount >= 2)) {
    return cleaned
  }

  const fallback = buildCompanionReply(video, input).reply.message
  const sceneContext = getSceneContextForTime(video, input.currentTime)
  if (!needsExplanation) {
    return fallback
  }

  const activeBeat =
    (video.companionBeats ?? []).find((beat) => Math.abs(beat.timestampSeconds - input.currentTime) <= 35) ??
    null

  if (!activeBeat) {
    return `${sceneContext.current?.summary ?? fallback} Right now the scene feels like it's building pressure and trying to make you notice that the tone just shifted.`
  }

  return `Alright, look. ${activeBeat.summary} ${activeBeat.companionLine} This bit matters because it changes the tension and starts nudging the story toward the next turn.`
}

async function buildSubtitleAnalysis(input: SubtitleAnalysisInput) {
  const subtitleTranscript = parseSubtitleContentToTranscript(
    input.subtitleContent,
    input.subtitleExtension ?? 'srt'
  )
  const subtitleChunks = buildSubtitleChunksFromTranscript(subtitleTranscript)
  const subtitleContext: SubtitleSceneContextItem[] = buildSeedSceneContextFromTranscript(subtitleChunks).map(
    (scene) => ({
      ...scene,
      companionLine: buildLocalSceneCompanionLine({
        ...scene,
        companionLine: '',
        emotion: 'neutral',
        type: 'dialogue',
        importance: 'medium',
        keyEvent: '',
      }),
      emotion: 'neutral',
      type: 'dialogue',
      importance: 'medium',
      keyEvent: '',
    })
  )

  const fallbackCompanionBeats = rebalanceKeyMoments(
    buildFallbackMomentsFromScenes(subtitleContext).map((beat) =>
      sanitizeGeneratedBeat(beat, subtitleContext)
    ),
    subtitleContext
  )

  let companionBeats: CompanionBeatItem[] = fallbackCompanionBeats
  try {
    const aiCompanionBeats = await buildAiCompanionBeats(input, subtitleContext, subtitleTranscript)
    if (aiCompanionBeats?.length) {
      companionBeats = rebalanceKeyMoments(
        aiCompanionBeats.map((beat) => sanitizeGeneratedBeat(beat, subtitleContext)),
        subtitleContext
      )
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        scope: 'subtitle-analysis-ai-beats-fallback',
        title: input.title,
        error: error instanceof Error ? error.message : String(error),
      })
    )
  }

  const subtitleMetadata: SubtitleAnalysisMetadataItem = {
    totalDuration: subtitleTranscript[subtitleTranscript.length - 1]?.endSeconds ?? 0,
    dominantEmotions: [],
    genreGuess: input.category,
    themes: [],
    mainCharacters: [],
    highlightReel: companionBeats.slice(0, 6).map((moment) => ({
      startSeconds: moment.timestampSeconds,
      endSeconds: moment.endSeconds ?? moment.timestampSeconds + 20,
      label: moment.label,
    })),
  }

  console.log(
    JSON.stringify(
      {
        scope: 'subtitle-analysis-context-only',
        title: input.title,
        category: input.category,
        chunkCount: subtitleChunks.length,
        sceneCount: subtitleContext.length,
        keyMomentCount: companionBeats.length,
        usedAiBeats: companionBeats !== fallbackCompanionBeats,
      },
      null,
      2
    )
  )

  return {
    storyContext: '',
    subtitleContext,
    companionBeats,
    subtitleMetadata,
    subtitleTranscript,
  }
}

async function reanalyzeVideoSubtitles(videoId: string) {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { id: videoId },
    })
  )
  const video = (result.Item as VideoItem | undefined) ?? null

  if (!video) {
    throw new Error('Video not found')
  }

  if (!video.subtitleUrl) {
    throw new Error('No subtitle file attached to this video')
  }

  const response = await fetch(video.subtitleUrl)
  if (!response.ok) {
    throw new Error(`Could not fetch subtitle file: ${response.status}`)
  }

  const subtitleContent = await response.text()
  const subtitleExtension = inferSubtitleExtension(video.subtitleUrl)

  const analysis = await buildSubtitleAnalysis({
    title: video.title,
    description: video.description,
    category: video.category,
    subtitleContent,
    subtitleExtension,
  })

  const saved = await saveSubtitleAnalysis({
    videoId: video.id,
    subtitleUrl: video.subtitleUrl,
    storyContext: analysis.storyContext,
    scenes: analysis.subtitleContext,
    keyMoments: analysis.companionBeats,
    transcript: analysis.subtitleTranscript ?? [],
    metadata: analysis.subtitleMetadata,
    updatedAt: new Date().toISOString(),
  })

  console.log(
    JSON.stringify(
      {
        scope: 'subtitle-reanalyze',
        videoId: video.id,
        title: video.title,
        subtitleUrl: video.subtitleUrl,
        keyMomentCount: saved.keyMoments.length,
        firstKeyMoment: saved.keyMoments[0]?.timestampSeconds ?? null,
      },
      null,
      2
    )
  )

  return saved
}

async function analyzeChunksWithGemini(input: any) {
  const chunks = input.subtitleChunks.length
    ? input.subtitleChunks
    : input.subtitleContext.map((scene: any, index: number) => ({
        id: `scene-chunk-${index}`,
        startSeconds: scene.startSeconds,
        endSeconds: scene.endSeconds,
        content: scene.excerpt,
      }))

  const results: ChunkSceneAnalysisItem[] = []

  for (const chunk of chunks.slice(0, 80)) {
    const prompt = [
      `You are analyzing a movie scene.`,
      `Given the dialogue below, extract:`,
      `1. A short scene summary (1-2 lines)`,
      `2. Emotional tone (anger, suspense, joy, sadness, fear, relief, etc.)`,
      `3. Scene type (action, dialogue, reveal, conflict, calm, emotional, transition, etc.)`,
      `4. Importance level (low, medium, high)`,
      `5. Key event (if any)`,
      `Stay grounded in the dialogue. Do not hallucinate off-screen actions or future events.`,
      `Return JSON only in this exact shape: {"summary":"...","emotion":"...","type":"...","importance":"low|medium|high","key_event":"..."}`,
      `Movie: ${input.title}`,
      `Category: ${input.category}`,
      `Chunk window: ${chunk.startSeconds}s-${chunk.endSeconds}s`,
      `Dialogue:\n${chunk.content}`,
    ].join('\n\n')

    const rawText = await generateGeminiText(prompt, 0.25, 220, 'Gemini chunk analysis failed')
    const parsed = parseChunkAnalysisResponse(rawText)
    if (!parsed) continue

    results.push({
      startSeconds: chunk.startSeconds,
      endSeconds: chunk.endSeconds,
      summary: parsed.summary,
      emotion: parsed.emotion,
      type: parsed.type,
      importance: parsed.importance,
      keyEvent: parsed.keyEvent,
    })
  }

  return results
}

function mergeAnalyzedChunks(
  chunks: ChunkSceneAnalysisItem[],
  input: any
) {
  return chunks.map((chunk, index) => {
    const matchingTranscript = input.subtitleTranscript.filter(
      (cue: any) => cue.endSeconds >= chunk.startSeconds && cue.startSeconds <= chunk.endSeconds
    )
    const excerpt = matchingTranscript
      .map((cue: any) => cue.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    const baseScene =
      input.subtitleContext.find(
        (scene: any) =>
          Math.abs(scene.startSeconds - chunk.startSeconds) <= 8 &&
          Math.abs(scene.endSeconds - chunk.endSeconds) <= 12
      ) ?? null

    const scene: SubtitleSceneContextItem = {
      id: baseScene?.id ?? `scene-${Math.round(chunk.startSeconds)}-${index}`,
      startSeconds: chunk.startSeconds,
      endSeconds: chunk.endSeconds,
      summary: chunk.summary,
      excerpt: excerpt || baseScene?.excerpt || chunk.summary,
      keywords: extractKeywordsFromTexts([chunk.summary, chunk.keyEvent, excerpt]),
      companionLine: buildCompanionLineFromChunk(chunk),
      emotion: chunk.emotion,
      type: chunk.type,
      importance: chunk.importance,
      keyEvent: chunk.keyEvent,
    }

    return scene
  })
}

async function buildAggregateSubtitleAnalysis(
  input: SubtitleAnalysisInput,
  analyzedScenes: SubtitleSceneContextItem[],
  transcriptDigest: string
) {
  const sceneDigest = analyzedScenes
    .map(
      (scene) =>
        `- ${scene.startSeconds}s-${scene.endSeconds}s | summary=${scene.summary} | emotion=${scene.emotion ?? 'unknown'} | type=${scene.type ?? 'scene'} | importance=${scene.importance ?? 'medium'} | keyEvent=${scene.keyEvent ?? 'none'}`
    )
    .join('\n')

  const prompt = [
    `You are building a structured subtitle analysis for a movie.`,
    `You are given analyzed subtitle scenes plus a transcript digest.`,
    `Return strict JSON only in this shape:`,
    `{"story":"...","themes":["..."],"main_characters":["..."],"key_moments":[{"start":120,"end":150,"type":"emotional","label":"Betrayal Reveal","description":"Hero realizes friend betrayed him","emotion":"anger","importance":"high","keywords":["betrayal","trust"]}],"metadata":{"dominant_emotions":["anger","suspense"],"genre_guess":"thriller"}}`,
    `Rules:`,
    `- Keep the story concise, coherent, and human-readable.`,
    `- Build key moments only from scenes that are emotionally strong, plot-relevant, funny, revealing, or action-heavy.`,
    `- Key moments should be sparse and meaningful, often minutes apart.`,
    `- Use the analyzed scenes, not raw dialogue fragments, for labels and descriptions.`,
    `- Do not copy dialogue lines as the key moment description.`,
    `- Spread key moments across early, middle, and late sections where possible.`,
    `- Avoid hallucinating events not supported by the subtitles.`,
    `Movie: ${input.title}`,
    `Category: ${input.category}`,
    `Description: ${input.description}`,
    `Analyzed scenes:\n${sceneDigest}`,
    `Transcript digest:\n${transcriptDigest}`,
  ].join('\n\n')

  const rawText = await generateGeminiText(prompt, 0.3, 700, 'Gemini aggregate subtitle analysis failed')
  const parsed = parseAggregateAnalysisResponse(rawText)

  if (!parsed) {
    return {
      storyContext:
        input.description ||
        `${input.title} builds through ${input.category.toLowerCase()} tension across its subtitle scenes.`,
      themes: [],
      mainCharacters: [],
      genreGuess: input.category,
      dominantEmotions: [],
      keyMoments: buildFallbackMomentsFromScenes(analyzedScenes),
    }
  }

  if (!parsed.keyMoments.length) {
    return {
      ...parsed,
      keyMoments: buildFallbackMomentsFromScenes(analyzedScenes),
    }
  }

  return parsed
}

async function generateGeminiText(
  prompt: string,
  temperature: number,
  maxOutputTokens: number,
  errorPrefix: string
) {
  const result = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey!)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      }),
    }
  )

  if (!result.ok) {
    const raw = await result.text()
    throw new Error(`${errorPrefix}: ${raw}`)
  }

  const payload = (await result.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>
      }
    }>
  }

  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() || ''
}

function parseChunkAnalysisResponse(rawText: string) {
  const parsed = parseJsonFromModel(rawText) as
    | {
        summary?: string
        emotion?: string
        type?: string
        importance?: string
        key_event?: string
      }
    | null

  if (!parsed?.summary || !parsed.emotion || !parsed.type) return null

  return {
    summary: parsed.summary.replace(/\s+/g, ' ').trim(),
    emotion: parsed.emotion.replace(/\s+/g, ' ').trim().toLowerCase(),
    type: parsed.type.replace(/\s+/g, ' ').trim().toLowerCase(),
    importance: normalizeImportance(parsed.importance),
    keyEvent: (parsed.key_event || '').replace(/\s+/g, ' ').trim(),
  }
}

function parseAggregateAnalysisResponse(rawText: string) {
  const parsed = parseJsonFromModel(rawText) as
    | {
        story?: string
        themes?: string[]
        main_characters?: string[]
        key_moments?: Array<{
          start?: number
          end?: number
          type?: string
          label?: string
          description?: string
          emotion?: string
          importance?: string
          keywords?: string[]
        }>
        metadata?: {
          dominant_emotions?: string[]
          genre_guess?: string
        }
      }
    | null

  if (!parsed?.story) return null

  return {
    storyContext: parsed.story.replace(/\s+/g, ' ').trim(),
    themes: (parsed.themes ?? []).map((item) => item.trim()).filter(Boolean),
    mainCharacters: (parsed.main_characters ?? []).map((item) => item.trim()).filter(Boolean),
    genreGuess: parsed.metadata?.genre_guess?.trim() || 'Drama',
    dominantEmotions: (parsed.metadata?.dominant_emotions ?? [])
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
    keyMoments: (parsed.key_moments ?? [])
      .filter((moment) => Number.isFinite(moment.start))
      .map((moment, index) => ({
        id: `companion-${Math.round(moment.start ?? 0)}-${index}`,
        timestampSeconds: Math.max(0, Math.round(moment.start ?? 0)),
        endSeconds: Math.max(
          Math.round(moment.start ?? 0),
          Math.round(moment.end ?? moment.start ?? 0)
        ),
        type: moment.type?.trim().toLowerCase() || 'story',
        label: moment.label?.trim() || `Key moment ${index + 1}`,
        summary: moment.description?.trim() || moment.label?.trim() || 'Story turn',
        companionLine: '',
        emotion: moment.emotion?.trim().toLowerCase() || 'tense',
        importance: normalizeImportance(moment.importance),
        mood: mapEmotionToMood(moment.emotion),
        keywords: (moment.keywords ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean),
      })),
  }
}

function buildFallbackMomentsFromScenes(scenes: SubtitleSceneContextItem[]) {
  if (!scenes.length) return []

  const scoreScene = (scene: SubtitleSceneContextItem) => {
    let score = 0

    if (scene.importance === 'high') score += 5
    else if (scene.importance === 'medium') score += 3
    else score += 1

    const emotion = scene.emotion?.toLowerCase() ?? ''
    const type = scene.type?.toLowerCase() ?? ''
    const summarySource = `${scene.summary} ${scene.keyEvent ?? ''} ${scene.excerpt}`.toLowerCase()

    if (/(suspense|fear|anger|rage|grief|joy|shock|paranoia|sad)/.test(emotion)) score += 2
    if (/(action|reveal|conflict|turn|chase|fight|dialogue)/.test(type)) score += 2
    if (/\b(kill|fight|truth|secret|betray|gun|blast|blood|love|goodbye|identity|who|why)\b/.test(summarySource)) score += 2

    return score
  }

  const ranked = scenes
    .map((scene) => ({ scene, score: scoreScene(scene) }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return left.scene.startSeconds - right.scene.startSeconds
    })

  const selected: SubtitleSceneContextItem[] = []
  for (const entry of ranked) {
    const tooClose = selected.some((scene) => Math.abs(scene.startSeconds - entry.scene.startSeconds) < 300)
    if (tooClose) continue
    selected.push(entry.scene)
    if (selected.length >= 8) break
  }

  const sortedScenes = scenes.slice().sort((left, right) => left.startSeconds - right.startSeconds)
  const totalDuration = sortedScenes[sortedScenes.length - 1]?.endSeconds ?? 0
  const earlyCut = totalDuration * 0.33
  const lateCut = totalDuration * 0.66

  const ensureBucket = (predicate: (scene: SubtitleSceneContextItem) => boolean) => {
    if (selected.some(predicate)) return
    const fallback = ranked.find((entry) => predicate(entry.scene))?.scene
    if (!fallback) return
    if (selected.some((scene) => Math.abs(scene.startSeconds - fallback.startSeconds) < 180)) return
    selected.push(fallback)
  }

  ensureBucket((scene) => scene.startSeconds <= earlyCut)
  ensureBucket((scene) => scene.startSeconds > earlyCut && scene.startSeconds <= lateCut)
  ensureBucket((scene) => scene.startSeconds > lateCut)

  return selected
    .sort((left, right) => left.startSeconds - right.startSeconds)
    .slice(0, 8)
    .map((scene, index) => ({
      id: `fallback-${scene.id}-${index}`,
      timestampSeconds: scene.startSeconds,
      endSeconds: scene.endSeconds,
      type: scene.type?.trim().toLowerCase() || 'scene',
      label: scene.keyEvent?.trim() || scene.summary.split(/[.!?]+/)[0]?.trim() || `Story beat ${index + 1}`,
      summary: scene.summary,
      companionLine: buildStructuredBeatLine(
        {
          label: scene.keyEvent?.trim() || scene.summary,
          summary: scene.summary,
          emotion: scene.emotion,
          type: scene.type,
          importance: scene.importance,
          mood: mapEmotionToMood(scene.emotion),
        },
        scene
      ),
      emotion: scene.emotion?.trim().toLowerCase() || 'tense',
      importance: scene.importance ?? 'medium',
      mood: mapEmotionToMood(scene.emotion),
      keywords: scene.keywords.slice(0, 5),
    }))
}

function parseJsonFromModel(rawText: string) {
  if (!rawText) return null

  const normalized = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  try {
    return JSON.parse(normalized) as unknown
  } catch {
    return null
  }
}

function normalizeImportance(value?: string): 'low' | 'medium' | 'high' {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'low' || normalized === 'high') return normalized
  return 'medium'
}

function mapEmotionToMood(value?: string): CompanionBeatItem['mood'] {
  const normalized = value?.trim().toLowerCase() ?? ''
  if (/(joy|funny|laugh|comedic)/.test(normalized)) return 'funny'
  if (/(sad|grief|love|emotional|heart)/.test(normalized)) return 'emotional'
  if (/(suspense|mystery|suspicious|paranoia)/.test(normalized)) return 'suspicious'
  if (/(anger|chaos|intense|action|rage)/.test(normalized)) return 'wild'
  if (/(thoughtful|quiet|reflective|calm)/.test(normalized)) return 'reflective'
  return 'tense'
}

function buildWatcherReaction({
  mood,
  type,
  emotion,
  keywords,
  maxLength,
}: {
  mood?: CompanionBeatItem['mood']
  type?: string
  emotion?: string
  keywords?: string[]
  maxLength: number
}) {
  const normalizedType = type?.toLowerCase() ?? ''
  const normalizedEmotion = emotion?.toLowerCase() ?? ''
  const keywordSet = new Set((keywords ?? []).map((word) => word.toLowerCase()))

  let line = `Something just shifted here.`

  if (keywordSet.has('tyler') || keywordSet.has('durden')) {
    line = `The movie is clearly circling Tyler hard now.`
  } else if (keywordSet.has('marla')) {
    line = `Marla showing up always throws the room off balance.`
  } else if (keywordSet.has('bob')) {
    line = `Bob changes the temperature of the scene right away.`
  } else if (
    keywordSet.has('support') ||
    keywordSet.has('group') ||
    keywordSet.has('insomnia')
  ) {
    line = `This is the movie laying out the damage under the surface.`
  } else if (normalizedType.includes('reveal')) {
    line = `There it is, the scene just tilted in a bigger way.`
  } else if (normalizedType.includes('action') || normalizedType.includes('fight')) {
    line = `The movie just kicked into a louder gear.`
  } else if (normalizedType.includes('conflict')) {
    line = `Yep, this is where the friction stops hiding.`
  } else if (normalizedType.includes('dialogue')) {
    line = `This sounds casual, but the scene is doing real setup.`
  } else if (normalizedEmotion.includes('fear') || normalizedEmotion.includes('paranoia')) {
    line = `Something feels off here in a way the movie wants you to sit with.`
  } else if (normalizedEmotion.includes('anger') || normalizedEmotion.includes('rage')) {
    line = `You can feel the scene starting to bite now.`
  } else if (normalizedEmotion.includes('sad') || normalizedEmotion.includes('grief')) {
    line = `That lands harder than the movie is saying out loud.`
  } else if (mood === 'suspicious') {
    line = `This is where the scene starts feeling a little untrustworthy.`
  } else if (mood === 'wild') {
    line = `Yeah, the movie is absolutely winding itself up here.`
  } else if (mood === 'emotional') {
    line = `There is more hurt in this moment than it first lets on.`
  } else if (mood === 'reflective') {
    line = `The movie is asking you to actually sit with this one.`
  } else if (mood === 'funny') {
    line = `It knows exactly how weirdly funny this beat is.`
  }

  return finalizeCompanionLine(line, maxLength)
}

function buildCompanionLineFromChunk(chunk: ChunkSceneAnalysisItem) {
  const summaryLead = extractCompanionSeed(chunk.summary, 'This scene matters.')
  const keyEvent = chunk.keyEvent?.replace(/\s+/g, ' ').trim() ?? ''

  if (keyEvent) {
    return finalizeCompanionLine(`${summaryLead}. ${keyEvent}`, 105)
  }

  if (chunk.importance === 'high') {
    return finalizeCompanionLine(
      `${summaryLead}. This is one of the scenes that genuinely shifts things.`,
      105
    )
  }

  return finalizeCompanionLine(summaryLead, 105)
}

function extractKeywordsFromTexts(texts: string[]) {
  const counts = texts
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .reduce<Record<string, number>>((acc, word) => {
      acc[word] = (acc[word] ?? 0) + 1
      return acc
    }, {})

  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([word]) => word)
}

function buildSubtitleMetadata(
  input: any,
  scenes: SubtitleSceneContextItem[],
  keyMoments: CompanionBeatItem[],
  aggregate: {
    themes: string[]
    mainCharacters: string[]
    genreGuess: string
    dominantEmotions: string[]
  }
): SubtitleAnalysisMetadataItem {
  const totalDuration =
    input.subtitleTranscript[input.subtitleTranscript.length - 1]?.endSeconds ??
    scenes[scenes.length - 1]?.endSeconds ??
    0

  return {
    totalDuration,
    dominantEmotions:
      aggregate.dominantEmotions.length
        ? aggregate.dominantEmotions
        : Array.from(new Set(scenes.map((scene) => scene.emotion).filter(Boolean) as string[])).slice(0, 5),
    genreGuess: aggregate.genreGuess || input.category,
    themes: aggregate.themes,
    mainCharacters: aggregate.mainCharacters,
    highlightReel: keyMoments.slice(0, 6).map((moment) => ({
      startSeconds: moment.timestampSeconds,
      endSeconds: moment.endSeconds ?? moment.timestampSeconds + 20,
      label: moment.label,
    })),
  }
}

function buildFallbackSubtitleMetadata(
  input: any,
  scenes: SubtitleSceneContextItem[],
  keyMoments: CompanionBeatItem[]
): SubtitleAnalysisMetadataItem {
  return buildSubtitleMetadata(
    input,
    scenes,
    keyMoments,
    {
      themes: [],
      mainCharacters: [],
      genreGuess: input.category,
      dominantEmotions: [],
    }
  )
}

function inferSubtitleExtension(value: string) {
  return value.toLowerCase().includes('.srt') ? 'srt' : 'vtt'
}

function parseSubtitleContentToTranscript(content: string, extension: string) {
  const blocks = content
    .replace(/\r/g, '')
    .replace(/^WEBVTT\s*/i, '')
    .trim()
    .split('\n\n')

  return blocks
    .map((block) => block.split('\n').filter(Boolean))
    .flatMap((lines) => {
      const timeLine = lines.find((line) => line.includes('-->'))
      if (!timeLine) return []
      const [rawStart, rawEnd] = timeLine.split('-->').map((line) => line.trim().split(' ')[0])
      const text = lines.slice(lines.indexOf(timeLine) + 1).join(' ').replace(/\s+/g, ' ').trim()
      if (!text) return []
      return [
        {
          startSeconds: Math.round(parseSubtitleTimestamp(rawStart, extension)),
          endSeconds: Math.round(parseSubtitleTimestamp(rawEnd, extension)),
          text,
        },
      ]
    })
}

function parseSubtitleTimestamp(value: string, extension: string) {
  const normalized = extension === 'srt' ? value.replace(',', '.') : value
  const parts = normalized.split(':').map(Number)
  if (parts.some((part) => Number.isNaN(part))) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return Number(normalized) || 0
}

function buildSubtitleChunksFromTranscript(cues: SubtitleTranscriptCueItem[]) {
  const chunks: SubtitleChunkItem[] = []
  let bucket: SubtitleTranscriptCueItem[] = []

  const flush = () => {
    if (!bucket.length) return
    const content = bucket.map((cue) => cue.text).join(' ').replace(/\s+/g, ' ').trim()
    if (content.length >= 24) {
      chunks.push({
        id: `chunk-${bucket[0].startSeconds}-${chunks.length}`,
        startSeconds: bucket[0].startSeconds,
        endSeconds: bucket[bucket.length - 1].endSeconds,
        content,
      })
    }
    bucket = []
  }

  for (const cue of cues) {
    const previous = bucket[bucket.length - 1]
    const gap = previous ? cue.startSeconds - previous.endSeconds : 0
    const duration = previous ? cue.endSeconds - bucket[0].startSeconds : 0
    if (bucket.length && (gap > 10 || duration > 55)) {
      flush()
    }
    bucket.push(cue)
  }

  flush()
  return chunks
}

function buildSeedSceneContextFromTranscript(chunks: SubtitleChunkItem[]) {
  return chunks.map((chunk, index) => ({
    id: `scene-${chunk.startSeconds}-${index}`,
    startSeconds: chunk.startSeconds,
    endSeconds: chunk.endSeconds,
    summary: summarizeTextForScene(chunk.content),
    excerpt: chunk.content.length > 240 ? `${chunk.content.slice(0, 237)}...` : chunk.content,
    keywords: extractKeywordsFromTexts([chunk.content]),
  }))
}

function summarizeTextForScene(text: string) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const keywords = extractKeywordsFromTexts([cleaned]).filter(
    (word) => !/^(yeah|okay|look|just|that|this|have|with|from|they|them|what|your)$/.test(word)
  )

  if (keywords.length >= 3) {
    return `The scene focuses on ${keywords.slice(0, 3).join(', ')}.`
  }

  if (keywords.length === 2) {
    return `The moment centers on ${keywords[0]} and ${keywords[1]}.`
  }

  if (keywords.length === 1) {
    return `The conversation turns around ${keywords[0]}.`
  }

  return 'A conversation unfolds and pushes the current scene forward.'
}

function getSceneContextForTime(video: VideoItem, currentTime: number) {
  const contexts = [...(video.subtitleContext ?? [])].sort(
    (left, right) => left.startSeconds - right.startSeconds
  )

  const current =
    contexts.find(
      (scene) => currentTime >= scene.startSeconds && currentTime <= scene.endSeconds + 1
    ) ??
    contexts.filter((scene) => scene.startSeconds <= currentTime).slice(-1)[0] ??
    null

  const previous = current
    ? contexts.filter((scene) => scene.endSeconds < current.startSeconds).slice(-2)
    : contexts.filter((scene) => scene.startSeconds <= currentTime).slice(-2)

  return { current, previous }
}

function getTranscriptWindowForTime(video: VideoItem, currentTime: number) {
  const cues = video.subtitleTranscript ?? []
  const windowStart = Math.max(0, Math.round(currentTime) - 120)
  const windowEnd = Math.round(currentTime)

  return cues
    .filter((cue) => cue.endSeconds >= windowStart && cue.startSeconds <= windowEnd)
    .slice(-18)
}

function buildTranscriptRead(
  transcriptWindow: Array<{ startSeconds: number; endSeconds: number; text: string }>,
  currentTime: number
) {
  if (!transcriptWindow.length) return null

  const aroundNow = transcriptWindow.filter(
    (cue) => cue.endSeconds >= currentTime - 18 && cue.startSeconds <= currentTime
  )
  const chosen = (aroundNow.length ? aroundNow : transcriptWindow.slice(-4))
    .map((cue) => cue.text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 4)

  if (!chosen.length) return null

  const merged = chosen.join(' ').replace(/\s+/g, ' ').trim()
  return merged.length > 260 ? `${merged.slice(0, 257)}...` : merged
}

function buildTranscriptLead(
  transcriptWindow: Array<{ startSeconds: number; endSeconds: number; text: string }>
) {
  const bestCue =
    [...transcriptWindow]
      .reverse()
      .find((cue) => cue.text && cue.text.trim().length > 18) ?? null

  if (!bestCue) return null

  const cleaned = bestCue.text.replace(/\s+/g, ' ').trim()
  return cleaned.length > 180 ? `${cleaned.slice(0, 177)}...` : cleaned
}

function buildTranscriptStoryDigest(
  cues: Array<{ startSeconds: number; endSeconds: number; text: string }>
) {
  if (!cues.length) return 'No transcript digest available.'

  const desiredSamples = Math.min(14, cues.length)
  const step = Math.max(1, Math.floor(cues.length / desiredSamples))
  const picked: typeof cues = []

  for (let index = 0; index < cues.length && picked.length < desiredSamples; index += step) {
    const cue = cues[index]
    if (!cue?.text?.trim()) continue
    picked.push(cue)
  }

  const tailCue = cues[cues.length - 1]
  if (tailCue && !picked.some((cue) => cue.startSeconds === tailCue.startSeconds)) {
    picked.push(tailCue)
  }

  return picked
    .map((cue) => {
      const text = cue.text.replace(/\s+/g, ' ').trim()
      const clipped = text.length > 150 ? `${text.slice(0, 147)}...` : text
      return `- ${cue.startSeconds}s-${cue.endSeconds}s: ${clipped}`
    })
    .join('\n')
}

function buildLocalSceneCompanionLine(scene: SubtitleSceneContextItem) {
  return buildWatcherReaction({
    mood: mapEmotionToMood(scene.emotion),
    type: scene.type,
    emotion: scene.emotion,
    keywords: scene.keywords,
    maxLength: 105,
  })
}

function extractCompanionSeed(text: string, fallback = '') {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const firstSentence =
    cleaned
      .split(/[.!?]+/)
      .map((part) => part.trim())
      .filter(Boolean)[0] ?? fallback
  const stripped = firstSentence
    .replace(/^(look|alright|all right|okay|ok|hey|well|so|now)\s*,?\s*/i, '')
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!stripped) {
    return fallback
  }

  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

function finalizeCompanionLine(line: string, maxLength: number) {
  const cleaned = line
    .replace(/\s+/g, ' ')
    .replace(/^(look|alright|all right|okay|ok|hey|well|so|now)\s*,?\s*/i, '')
    .trim()
  const punctuated = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`
  return punctuated.length > maxLength ? `${punctuated.slice(0, maxLength - 3)}...` : punctuated
}

function formatCompanionLine({
  summary,
  type,
  emotion,
  fallback,
  maxLength,
}: {
  summary: string
  type?: string
  emotion?: string
  fallback: string
  maxLength: number
}) {
  const seed = extractCompanionSeed(summary, fallback)
  const normalizedType = type?.toLowerCase() ?? ''
  const normalizedEmotion = emotion?.toLowerCase() ?? ''

  let line = `${seed}.`

  if (normalizedType.includes('action')) {
    line = `${seed}. The energy spikes here.`
  } else if (normalizedType.includes('reveal')) {
    line = `${seed}. This changes how the moment reads.`
  } else if (normalizedType.includes('conflict')) {
    line = `${seed}. The tension is fully out in the open now.`
  } else if (normalizedType.includes('dialogue')) {
    line = `${seed}. The conversation carries more weight than it first seems.`
  } else if (
    normalizedEmotion.includes('sad') ||
    normalizedEmotion.includes('grief') ||
    normalizedEmotion.includes('love')
  ) {
    line = `${seed}. It lands quietly, but it hits hard.`
  } else if (normalizedEmotion.includes('anger') || normalizedEmotion.includes('rage')) {
    line = `${seed}. You can feel the anger building.`
  } else if (
    normalizedEmotion.includes('suspense') ||
    normalizedEmotion.includes('fear') ||
    normalizedEmotion.includes('paranoia')
  ) {
    line = `${seed}. This is where the scene stops feeling safe.`
  } else if (
    normalizedEmotion.includes('joy') ||
    normalizedEmotion.includes('funny') ||
    normalizedEmotion.includes('laugh')
  ) {
    line = `${seed}. The movie is clearly leaning into the humor here.`
  }

  return finalizeCompanionLine(line, maxLength)
}

function sanitizeSceneCompanionLine(
  line: string | undefined,
  scene: SubtitleSceneContextItem
) {
  const cleaned = line?.replace(/\s+/g, ' ').trim() ?? ''
  if (!cleaned) {
    return buildLocalSceneCompanionLine(scene)
  }

  const normalized = cleaned.toLowerCase()
  const excerpt = scene.excerpt.replace(/\s+/g, ' ').trim().toLowerCase()
  const summary = scene.summary.replace(/\s+/g, ' ').trim().toLowerCase()

  const looksQuoted =
    cleaned.length < 28 ||
    /^[a-z0-9 ,.'"-]+$/i.test(cleaned) && !/[.!?]$/.test(cleaned) ||
    excerpt.includes(normalized) ||
    summary.includes(normalized) ||
    normalized.startsWith('look, ') ||
    normalized === 'look' ||
    normalized.startsWith('people are always asking') ||
    normalized.startsWith('with ') ||
    normalized.startsWith('men is ') ||
    normalized.split(/\s+/).length < 5

  if (looksQuoted) {
    return buildLocalSceneCompanionLine(scene)
  }

  return finalizeCompanionLine(cleaned, 105)
}

function findNearestScene(
  scenes: SubtitleSceneContextItem[],
  timestampSeconds: number
) {
  return (
    scenes.find(
      (scene) =>
        timestampSeconds >= scene.startSeconds && timestampSeconds <= scene.endSeconds + 1
    ) ??
    scenes
      .slice()
      .sort(
        (left, right) =>
          Math.abs(left.startSeconds - timestampSeconds) -
          Math.abs(right.startSeconds - timestampSeconds)
      )[0] ??
    null
  )
}

function sanitizeGeneratedBeat(
  beat: CompanionBeatItem,
  scenes: SubtitleSceneContextItem[]
) {
  const nearestScene = findNearestScene(scenes, beat.timestampSeconds)
  const rawLine = beat.companionLine.replace(/\s+/g, ' ').trim()
  const cleanedSummary = beat.summary.replace(/\s+/g, ' ').trim()
  const summary =
    !cleanedSummary ||
    cleanedSummary.length < 12 ||
    nearestScene?.excerpt.toLowerCase().includes(cleanedSummary.toLowerCase())
      ? nearestScene?.summary ?? cleanedSummary
      : cleanedSummary
  const fallbackLine = nearestScene
    ? buildStructuredBeatLine(
        {
          label: beat.label,
          summary,
          emotion: beat.emotion,
          type: beat.type,
          importance: beat.importance,
          mood: beat.mood,
        },
        nearestScene
      )
    : buildWatcherReaction({
        mood: beat.mood,
        type: beat.type,
        emotion: beat.emotion,
        keywords: beat.keywords,
        maxLength: 110,
      })

  const transcriptLike =
    !rawLine ||
    isTooThinCompanionLine(rawLine) ||
    rawLine.toLowerCase().startsWith('look, ') ||
    rawLine.toLowerCase().startsWith('people are always asking') ||
    Boolean(
      nearestScene &&
        (
          nearestScene.excerpt.replace(/\s+/g, ' ').trim().toLowerCase().includes(rawLine.toLowerCase()) ||
          nearestScene.summary.replace(/\s+/g, ' ').trim().toLowerCase().includes(rawLine.toLowerCase())
        )
    )

  const companionLine =
    transcriptLike || isGenericCompanionLine(rawLine)
      ? fallbackLine
      : finalizeCompanionLine(rawLine, 110)

  return {
    ...beat,
    label: beat.label.replace(/\s+/g, ' ').trim() || 'Key moment',
    summary: summary.length > 150 ? `${summary.slice(0, 147)}...` : summary,
    companionLine,
    keywords: beat.keywords
      .map((word) => word.trim().toLowerCase())
      .filter((word) => /^[a-z][a-z0-9-]{2,}$/i.test(word))
      .slice(0, 5),
  }
}

function rebalanceKeyMoments(
  beats: CompanionBeatItem[],
  scenes: SubtitleSceneContextItem[]
) {
  if (!beats.length) return beats

  const sortedScenes = scenes
    .slice()
    .sort((left, right) => left.startSeconds - right.startSeconds)
  const lastSceneEnd =
    sortedScenes[sortedScenes.length - 1]?.endSeconds ??
    beats[beats.length - 1]?.timestampSeconds ??
    0

  if (lastSceneEnd <= 0) {
    return beats
  }

  const earlyCut = lastSceneEnd * 0.33
  const lateCut = lastSceneEnd * 0.66

  const buckets = {
    early: beats.filter((beat) => beat.timestampSeconds <= earlyCut),
    middle: beats.filter(
      (beat) => beat.timestampSeconds > earlyCut && beat.timestampSeconds <= lateCut
    ),
    late: beats.filter((beat) => beat.timestampSeconds > lateCut),
  }

  const chosen: CompanionBeatItem[] = []
  const pushUnique = (beat: CompanionBeatItem | null | undefined) => {
    if (!beat) return
    if (chosen.some((entry) => entry.id === beat.id)) return
    chosen.push(beat)
  }

  pushUnique(buckets.early[0])
  pushUnique(buckets.middle[0])
  pushUnique(buckets.late[0])

  const remainder = [
    ...buckets.early.slice(1),
    ...buckets.middle.slice(1),
    ...buckets.late.slice(1),
  ].sort((left, right) => left.timestampSeconds - right.timestampSeconds)

  for (const beat of remainder) {
    pushUnique(beat)
    if (chosen.length >= Math.min(10, beats.length)) break
  }

  if (!chosen.some((beat) => beat.timestampSeconds <= earlyCut) && sortedScenes.length) {
    const earlyScene =
      sortedScenes.find((scene) => scene.startSeconds <= earlyCut) ?? sortedScenes[0]
    pushUnique(buildFallbackBeatFromScene(earlyScene, chosen.length + 1))
  }

  if (
    !chosen.some(
      (beat) => beat.timestampSeconds > earlyCut && beat.timestampSeconds <= lateCut
    ) &&
    sortedScenes.length
  ) {
    const middleScene =
      sortedScenes.find(
        (scene) => scene.startSeconds > earlyCut && scene.startSeconds <= lateCut
      ) ?? sortedScenes[Math.floor(sortedScenes.length / 2)]
    pushUnique(buildFallbackBeatFromScene(middleScene, chosen.length + 1))
  }

  if (!chosen.some((beat) => beat.timestampSeconds > lateCut) && sortedScenes.length) {
    const lateScene =
      [...sortedScenes].reverse().find((scene) => scene.startSeconds > lateCut) ??
      sortedScenes[sortedScenes.length - 1]
    pushUnique(buildFallbackBeatFromScene(lateScene, chosen.length + 1))
  }

  return chosen
    .sort((left, right) => left.timestampSeconds - right.timestampSeconds)
    .slice(0, Math.min(10, Math.max(6, chosen.length)))
}

function buildFallbackBeatFromScene(scene: SubtitleSceneContextItem, index: number): CompanionBeatItem {
  return {
    id: `fallback-${scene.id}-${index}`,
    timestampSeconds: scene.startSeconds,
    label: `Story Turn ${index}`,
    summary: scene.summary,
    companionLine: buildSpecificBeatLine(scene.summary, scene),
    mood: 'reflective',
    keywords: scene.keywords.slice(0, 4),
  }
}

function isGenericCompanionLine(line: string) {
  const normalized = line.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!normalized) return true
  if (normalized.length < 24) return true

  return [
    'damn',
    'bro, this bit is chaos',
    'bro, the movie got real for a second there',
    'yeah nah, this is where it starts going off the rails',
    'bro, that line is shady as hell',
    'yeah, this is one of those moments where you stop trusting the room',
    'yeah, something just shifted here',
  ].some((pattern) => normalized === pattern || normalized.startsWith(pattern))
}

function isTooThinCompanionLine(line: string) {
  const cleaned = line.replace(/\s+/g, ' ').trim()
  if (!cleaned) return true

  const withoutMarkdown = cleaned.replace(/[*_`~]/g, '').trim()
  const words = withoutMarkdown
    .split(/\s+/)
    .map((word) => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
    .filter(Boolean)

  if (withoutMarkdown.length < 4) return true
  if (words.length === 0) return true
  if (words.length === 1 && words[0].length < 4) return true
  if (words.length <= 2 && withoutMarkdown.length < 8) return true
  if (words.every((word) => word.length <= 2)) return true

  return false
}

function buildSpecificBeatLine(summary: string, scene: SubtitleSceneContextItem) {
  return buildWatcherReaction({
    mood: mapEmotionToMood(scene.emotion),
    type: scene.type,
    emotion: scene.emotion,
    keywords: extractKeywordsFromTexts([summary, scene.summary, scene.keyEvent ?? '']),
    maxLength: 105,
  })
}

function buildStructuredBeatLine(
  beat: {
    label: string
    summary: string
    emotion?: string
    type?: string
    importance?: 'low' | 'medium' | 'high'
    mood: CompanionBeatItem['mood']
  },
  scene: SubtitleSceneContextItem
) {
  return buildWatcherReaction({
    mood: beat.mood,
    type: beat.type ?? scene.type,
    emotion: beat.emotion ?? scene.emotion,
    keywords: extractKeywordsFromTexts([
      beat.label,
      beat.summary,
      scene.summary,
      scene.keyEvent ?? '',
      ...scene.keywords,
    ]),
    maxLength: 110,
  })
}

async function buildAiCompanionBeats(
  input: SubtitleAnalysisInput,
  scenes: SubtitleSceneContextItem[],
  transcript: SubtitleTranscriptCueItem[]
) {
  if (!geminiApiKey || !scenes.length) return null

  const candidateMoments = buildFallbackMomentsFromScenes(scenes)
  if (!candidateMoments.length) return null

  const digest = candidateMoments
    .map(
      (moment) => {
        const contextWindow = transcript
          .filter(
            (cue) =>
              cue.startSeconds >= Math.max(0, moment.timestampSeconds - 60) &&
              cue.startSeconds <= moment.timestampSeconds
          )
          .map((cue) => cue.text.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .slice(-8)
          .join(' ')

        return `- timestampSeconds=${moment.timestampSeconds} | endSeconds=${moment.endSeconds ?? moment.timestampSeconds} | summary=${moment.summary} | emotion=${moment.emotion ?? 'neutral'} | type=${moment.type ?? 'scene'} | keywords=${moment.keywords.join(', ')} | leadInContext=${contextWindow || 'none'}`
      }
    )
    .join('\n')

  const prompt = [
    `You write timed auto-injected messages for "Second Seat", an AI companion watching a movie beside the viewer.`,
    `Return strict JSON only in this shape: {"keyMoments":[{"timestampSeconds":125,"endSeconds":150,"label":"Short label","summary":"Narrative summary","companionLine":"Short watcher reaction","mood":"tense","keywords":["word","word"]}]}`,
    `Rules:`,
    `- Use only the timestamps provided in the candidate moments.`,
    `- Keep each companionLine between 3 and 16 words.`,
    `- Companion lines must sound like a person reacting live, not reciting the plot.`,
    `- Do not copy dialogue. Do not quote the subtitles. Do not start with "Look,".`,
    `- Avoid raw recap lines like "Bob developed..." or "People are always asking..."`,
    `- Use the leadInContext to understand what just happened in the previous minute before each beat.`,
    `- If a beat feels ambiguous, write a natural reaction to the shift in tone, tension, suspicion, humor, or emotion.`,
    `- Keep summaries narrative and concise.`,
    `- Pick 6 to 8 moments spread across the movie.`,
    `Movie: ${input.title}`,
    `Category: ${input.category}`,
    `Description: ${input.description}`,
    `Candidate moments:\n${digest}`,
  ].join('\n\n')

  const rawText = await generateGeminiText(
    prompt,
    0.55,
    650,
    'Gemini companion beat generation failed'
  )
  const parsed = parseSubtitleAnalysisResponse(rawText)
  if (!parsed?.keyMoments?.length) return null

  const validTimestamps = new Set(candidateMoments.map((moment) => moment.timestampSeconds))
  return parsed.keyMoments
    .filter((moment) => validTimestamps.has(moment.timestampSeconds))
    .map((moment) =>
      sanitizeGeneratedBeat(
        {
          ...moment,
          endSeconds:
            candidateMoments.find((entry) => entry.timestampSeconds === moment.timestampSeconds)
              ?.endSeconds ?? moment.endSeconds,
        },
        scenes
      )
    )
}

function parseSubtitleAnalysisResponse(rawText: string) {
  if (!rawText) return null

  const normalized = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(normalized) as {
      storyContext?: string
      keyMoments?: Array<{
        timestampSeconds?: number
        label?: string
        summary?: string
        companionLine?: string
        mood?: CompanionBeatItem['mood']
        keywords?: string[]
      }>
    }

    return {
      storyContext: parsed.storyContext?.trim() || '',
      keyMoments: (parsed.keyMoments ?? [])
        .filter(
          (
            entry
          ): entry is {
            timestampSeconds: number
            endSeconds?: number
            label: string
            summary: string
            companionLine: string
            mood: CompanionBeatItem['mood']
            keywords: string[]
          } =>
            Number.isFinite(entry?.timestampSeconds) &&
            Boolean(entry?.label && entry?.summary && entry?.companionLine && entry?.mood)
        )
        .map((entry) => ({
          id: `companion-${Math.round(entry.timestampSeconds)}-${slugify(entry.label) || 'moment'}`,
          timestampSeconds: Math.max(0, Math.round(entry.timestampSeconds)),
          endSeconds: Number.isFinite(entry.endSeconds)
            ? Math.max(Math.round(entry.timestampSeconds), Math.round(entry.endSeconds ?? entry.timestampSeconds))
            : undefined,
          label: entry.label.replace(/\s+/g, ' ').trim(),
          summary: entry.summary.replace(/\s+/g, ' ').trim(),
          companionLine: entry.companionLine.replace(/\s+/g, ' ').trim(),
          mood: entry.mood,
          keywords: (entry.keywords ?? []).map((word) => word.trim()),
        })),
    }
  } catch {
    return null
  }
}

function getPathParts(path: string) {
  return path.split('/').filter(Boolean)
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext.http.method
  const path = event.rawPath
  const parts = getPathParts(path)

  if (method === 'OPTIONS') {
    return response(200, { ok: true })
  }

  try {
    if (method === 'GET' && path === '/health') {
      return response(200, {
        ok: true,
        region,
        tableName,
        bucketName,
        usersTableName,
        recentWatchTableName,
      })
    }

    if (method === 'POST' && path === '/auth/login') {
      const input = parseJson<AuthLoginInput>(event.body)
      if (!input.identifier || !input.password) {
        return response(400, { message: 'identifier and password are required' })
      }
      return response(200, await loginWithPassword(input))
    }

    if (method === 'POST' && path === '/auth/google') {
      const input = parseJson<GoogleAuthInput>(event.body)
      if (!input.email || !input.name) {
        return response(400, { message: 'email and name are required' })
      }
      return response(200, await loginWithGoogle(input))
    }

    if (method === 'GET' && path === '/auth/me') {
      const user = await requireAuthenticatedUser(event)
      return response(200, toPublicUser(user))
    }

    if (method === 'POST' && path === '/auth/logout') {
      return response(200, { success: true })
    }

    if (method === 'GET' && path === '/videos') {
      return response(200, await listVideos(event.queryStringParameters?.category))
    }

    if (method === 'GET' && path === '/discover') {
      return response(200, await buildAdaptiveDiscover(event.queryStringParameters?.userId))
    }

    if (method === 'POST' && path === '/discover/signals') {
      const input = parseJson<DiscoverSignalInput>(event.body)
      if (!input.userId || !input.videoId || !input.category) {
        return response(400, { message: 'userId, videoId, and category are required' })
      }
      await recordDiscoverSignal(input)
      return response(200, { success: true })
    }

    if (method === 'GET' && parts[0] === 'users' && parts[2] === 'recent-watch') {
      const authUser = await requireAuthenticatedUser(event)
      if (authUser.userId !== parts[1]) {
        return response(403, { message: 'Forbidden' })
      }
      return response(200, await listRecentWatch(parts[1]))
    }

    if (method === 'POST' && parts[0] === 'users' && parts[2] === 'recent-watch') {
      const authUser = await requireAuthenticatedUser(event)
      if (authUser.userId !== parts[1]) {
        return response(403, { message: 'Forbidden' })
      }
      const input = parseJson<RecordRecentWatchInput>(event.body)
      if (!input.videoId || !input.title || !input.thumbnail || !input.category) {
        return response(400, { message: 'videoId, title, thumbnail, and category are required' })
      }
      await recordRecentWatch(parts[1], input)
      return response(200, { success: true })
    }

    if (method === 'GET' && parts[0] === 'videos' && parts.length >= 2) {
      const id = parts[1]
      if (parts[2] === 'analysis') {
        const analysis = await getSubtitleAnalysis(id)
        return analysis
          ? response(200, analysis)
          : response(404, { message: 'Subtitle analysis not found' })
      }
      if (parts[2] === 'pulses') {
        const video = await getVideo(id)
        return video ? response(200, await buildScenePulses(video)) : response(404, { message: 'Video not found' })
      }
      if (parts[2] === 'comments') {
        return response(
          200,
          await listComments(id, {
            cursor: event.queryStringParameters?.cursor ?? null,
            pageSize: event.queryStringParameters?.pageSize
              ? Number(event.queryStringParameters.pageSize)
              : undefined,
          })
        )
      }
      const video = await getVideo(id)
      return video ? response(200, video) : response(404, { message: 'Video not found' })
    }

    if (method === 'POST' && path === '/upload-url') {
      const input = parseJson<UploadUrlInput>(event.body)
      if (!input.fileName || !input.fileType) {
        return response(400, { message: 'fileName and fileType are required' })
      }
      return response(200, await createUploadUrl(input))
    }

    if (method === 'POST' && path === '/subtitle-analysis') {
      const input = parseJson<SubtitleAnalysisInput>(event.body)
      if (!input.title || !input.category || !input.subtitleContent) {
        return response(400, { message: 'title, category, and subtitleContent are required' })
      }
      return response(200, await buildSubtitleAnalysis(input))
    }

    if (method === 'POST' && path === '/videos') {
      const input = parseJson<CreateVideoInput>(event.body)
      if (!input.title || !input.description || !input.category || !input.videoUrl) {
        return response(400, {
          message: 'title, description, category, and videoUrl are required',
        })
      }
      return response(201, await createVideo(input))
    }

    if (method === 'POST' && parts[0] === 'videos' && parts[2] === 'companion' && parts[3] === 'chat') {
      const id = parts[1]
      const video = await getVideo(id)
      if (!video) {
        return response(404, { message: 'Video not found' })
      }
      const input = parseJson<CompanionChatInput>(event.body)
      if (!input.userMessage) {
        return response(400, { message: 'userMessage is required' })
      }
      return response(200, await buildAiCompanionReply(video, input))
    }

    if (method === 'POST' && parts[0] === 'videos' && parts[2] === 'reanalyze-subtitles') {
      const id = parts[1]
      return response(200, await reanalyzeVideoSubtitles(id))
    }

    if (method === 'POST' && parts[0] === 'videos' && parts[2] === 'reset-subtitles') {
      const id = parts[1]
      const reset = await resetVideoSubtitles(id)
      return reset ? response(200, reset) : response(404, { message: 'Video not found' })
    }

    if (method === 'POST' && parts[0] === 'videos' && parts[2] === 'comments') {
      const id = parts[1]
      const input = parseJson<CreateCommentInput>(event.body)
      if (!input.authorName || !input.message) {
        return response(400, { message: 'authorName and message are required' })
      }
      return response(201, await createComment(id, input))
    }

    if (method === 'PATCH' && parts[0] === 'videos' && parts.length === 2) {
      const id = parts[1]
      const patch = parseJson<Partial<VideoItem>>(event.body)
      const updated = await updateVideo(id, patch)
      return updated ? response(200, updated) : response(404, { message: 'Video not found' })
    }

    if (method === 'DELETE' && parts[0] === 'videos' && parts.length === 2) {
      const id = parts[1]
      await deleteVideo(id)
      return response(200, { success: true })
    }

    if (method === 'GET' && path === '/admin/stats') {
      return response(200, await getAdminStats())
    }

    return response(404, { message: 'Route not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const statusCode =
      message === 'Unauthorized' || message === 'Invalid token' || message === 'Expired token'
        ? 401
        : message === 'Incorrect password' || message === 'This account uses Google sign-in'
          ? 401
          : message === 'No account found for that username'
            ? 404
        : message === 'Forbidden'
          ? 403
          : 500

    return response(statusCode, { message })
  }
}
