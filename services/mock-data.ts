import type {
  AdaptiveDiscoverResponse,
  AdminStats,
  CommentsPage,
  CreateCommentInput,
  CreateVideoInput,
  DiscoverSignalInput,
  GoogleIdentityProfile,
  RecentWatchItem,
  ScenePulse,
  SocialComment,
  UpdateVideoInput,
  User,
  UserRole,
  Video,
} from '@/types'

const VIDEO_STORAGE_KEY = 'streamflow.mock.videos'
const ROLE_STORAGE_KEY = 'streamflow.mock.role'
const SESSION_STORAGE_KEY = 'streamflow.mock.session'
const DISCOVER_STORAGE_KEY = 'streamflow.mock.discover'
const COMMENTS_STORAGE_KEY = 'streamflow.mock.comments'
const CURRENT_USER_STORAGE_KEY = 'streamflow.mock.current-user'
const RECENT_WATCH_STORAGE_KEY = 'streamflow.mock.recent-watch'

const poster = (slug: string) =>
  `https://images.unsplash.com/${slug}?auto=format&fit=crop&w=1200&q=80`

export const mockVideosSeed: Video[] = [
  {
    id: 'vid_1',
    title: 'Midnight Extraction',
    description:
      'An elite operative has one night to pull a missing scientist out of a city collapsing under mercenary control.',
    category: 'Action',
    thumbnail: poster('photo-1500530855697-b586d89ba3ee'),
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: 6840,
    views: 425480,
    likes: 25821,
    uploadedAt: '2026-03-18',
    uploadedBy: 'Northline Pictures',
    isFeatured: true,
  },
  {
    id: 'vid_2',
    title: 'The Last Broadcast',
    description:
      'A late-night radio host begins receiving calls from listeners who should have been dead for decades.',
    category: 'Horror',
    thumbnail: poster('photo-1509347528160-9a9e33742cdb'),
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 6120,
    views: 286310,
    likes: 14902,
    uploadedAt: '2026-03-16',
    uploadedBy: 'Grain House',
  },
  {
    id: 'vid_3',
    title: 'Velvet Summer',
    description:
      'Two musicians on opposite sides of fame collide during one heat-soaked festival season.',
    category: 'Romance',
    thumbnail: poster('photo-1518568814500-bf0f8d125f46'),
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    duration: 5530,
    views: 370420,
    likes: 20120,
    uploadedAt: '2026-03-14',
    uploadedBy: 'Luna Reels',
  },
  {
    id: 'vid_4',
    title: 'Neon Run',
    description:
      'A courier carrying stolen biotech races across a glowing megacity while every syndicate hunts him down.',
    category: 'Sci-Fi',
    thumbnail: poster('photo-1520034475321-cbe63696469a'),
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    duration: 6480,
    views: 254210,
    likes: 11928,
    uploadedAt: '2026-03-10',
    uploadedBy: 'Circuit Frame',
  },
  {
    id: 'vid_5',
    title: 'Laugh Track Hotel',
    description:
      'A washed-up sitcom actor inherits a failing resort and accidentally turns it into the strangest comedy destination in America.',
    category: 'Comedy',
    thumbnail: poster('photo-1497032205916-ac775f0649ae'),
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    duration: 4980,
    views: 193005,
    likes: 14108,
    uploadedAt: '2026-03-08',
    uploadedBy: 'Brightline Studios',
  },
  {
    id: 'vid_6',
    title: 'Ashes of the Frontier',
    description:
      'A reluctant sheriff, a runaway heir, and a ghost town’s buried gold draw blood across the desert.',
    category: 'Western',
    thumbnail: poster('photo-1506744038136-46273834b3fb'),
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
    duration: 5820,
    views: 148120,
    likes: 7544,
    uploadedAt: '2026-03-04',
    uploadedBy: 'Mesa Gold',
  },
  {
    id: 'vid_7',
    title: 'Silent Harbor',
    description:
      'A detective returns to her coastal hometown after a ferry disaster reveals a decades-old family conspiracy.',
    category: 'Thriller',
    thumbnail: poster('photo-1500375592092-40eb2168fd21'),
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    duration: 6240,
    views: 218990,
    likes: 12844,
    uploadedAt: '2026-03-02',
    uploadedBy: 'Deepwater Films',
  },
  {
    id: 'vid_8',
    title: 'Kingdom of Smoke',
    description:
      'An exiled prince and a street thief battle through prophecy, betrayal, and dragon-fire to reclaim a shattered realm.',
    category: 'Fantasy',
    thumbnail: poster('photo-1511497584788-876760111969'),
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    duration: 7320,
    views: 331405,
    likes: 18766,
    uploadedAt: '2026-03-01',
    uploadedBy: 'Crownforge',
  },
]

export const mockUsers: Record<UserRole, User> = {
  user: {
    id: 'user_demo',
    email: 'user@example.com',
    username: 'casey',
    name: 'Casey Viewer',
    avatar: 'https://api.dicebear.com/7.x/thumbs/svg?seed=viewer',
    role: 'user',
    createdAt: '2026-01-05',
    provider: 'password',
  },
  admin: {
    id: 'admin_demo',
    email: 'admin@example.com',
    username: 'jordan',
    name: 'Jordan Admin',
    avatar: 'https://api.dicebear.com/7.x/thumbs/svg?seed=admin',
    role: 'admin',
    createdAt: '2026-01-01',
    provider: 'password',
  },
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getMockRole(): UserRole {
  if (!canUseStorage()) return 'user'
  const role = window.localStorage.getItem(ROLE_STORAGE_KEY)
  return role === 'admin' ? 'admin' : 'user'
}

export function setMockRole(role: UserRole) {
  if (!canUseStorage()) return
  window.localStorage.setItem(ROLE_STORAGE_KEY, role)
}

export function setMockSession(isSignedIn: boolean) {
  if (!canUseStorage()) return
  if (isSignedIn) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, 'active')
    return
  }
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY)
}

export function hasMockSession() {
  if (!canUseStorage()) return false
  return window.localStorage.getItem(SESSION_STORAGE_KEY) === 'active'
}

export function readMockVideos(): Video[] {
  if (!canUseStorage()) return mockVideosSeed
  const stored = window.localStorage.getItem(VIDEO_STORAGE_KEY)
  if (!stored) {
    window.localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(mockVideosSeed))
    return mockVideosSeed
  }

  try {
    return JSON.parse(stored) as Video[]
  } catch {
    window.localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(mockVideosSeed))
    return mockVideosSeed
  }
}

export function writeMockVideos(videos: Video[]) {
  if (!canUseStorage()) return
  window.localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(videos))
}

export function createMockVideo(input: CreateVideoInput): Video {
  const nextVideo: Video = {
    id: `vid_${Math.random().toString(36).slice(2, 10)}`,
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
    duration: input.duration,
    views: 0,
    likes: 0,
    uploadedAt: new Date().toISOString().slice(0, 10),
    uploadedBy: input.uploadedBy,
    isFeatured: input.isFeatured ?? false,
  }

  const existing = readMockVideos()
  writeMockVideos([nextVideo, ...existing])
  return nextVideo
}

export function updateMockVideo(id: string, input: UpdateVideoInput): Video {
  const existing = readMockVideos()
  const nextVideos = existing.map((video) =>
    video.id === id ? { ...video, ...input } : video
  )
  writeMockVideos(nextVideos)
  const updated = nextVideos.find((video) => video.id === id)
  if (!updated) {
    throw new Error('Video not found')
  }
  return updated
}

export function deleteMockVideo(id: string) {
  const existing = readMockVideos()
  writeMockVideos(existing.filter((video) => video.id !== id))
}

export function buildMockAdminStats(): AdminStats {
  const videos = readMockVideos()
  const currentUser = readMockCurrentUser()
  const users = new Map<string, User>()
  Object.values(mockUsers).forEach((user) => users.set(user.id, user))
  if (currentUser) {
    users.set(currentUser.id, currentUser)
  }
  const recentWatchByUser = readStorageJson<Record<string, RecentWatchItem[]>>(RECENT_WATCH_STORAGE_KEY, {})
  const totalViews = Object.values(recentWatchByUser).reduce(
    (sum, items) => sum + items.length,
    0
  )

  return {
    totalVideos: videos.length,
    totalViews,
    totalUsers: users.size,
    uploadedThisMonth: videos.filter((video) => {
      const uploadedAt = new Date(video.uploadedAt)
      const now = new Date()
      return (
        uploadedAt.getUTCFullYear() === now.getUTCFullYear() &&
        uploadedAt.getUTCMonth() === now.getUTCMonth()
      )
    }).length,
  }
}

type MockDiscoverProfile = {
  userId: string
  genreAffinity: Record<string, number>
  recentVideoIds: string[]
  lastWatchedAt: string
}

type MockCommentsByVideo = Record<string, SocialComment[]>

function readStorageJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback
  const stored = window.localStorage.getItem(key)
  if (!stored) return fallback

  try {
    return JSON.parse(stored) as T
  } catch {
    return fallback
  }
}

function writeStorageJson(key: string, value: unknown) {
  if (!canUseStorage()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function fallbackUserForRole(role: UserRole) {
  return mockUsers[role]
}

export function createMockUserProfile(input: {
  email: string
  name?: string
  avatar?: string
  role: UserRole
  provider?: 'password' | 'google'
}): User {
  const fallback = fallbackUserForRole(input.role)
  const existing = readMockCurrentUser()

  return {
    id:
      existing?.email.toLowerCase() === input.email.toLowerCase()
        ? existing.id
        : `user_${input.email.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    email: input.email,
    username:
      existing?.username ||
      input.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]+/g, ''),
    name: input.name?.trim() || existing?.name || fallback.name,
    avatar: input.avatar || existing?.avatar || fallback.avatar,
    role: input.role,
    createdAt: existing?.createdAt || fallback.createdAt,
    provider: input.provider ?? existing?.provider ?? 'password',
  }
}

export function persistMockUser(user: User) {
  if (!canUseStorage()) return
  window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user))
  setMockRole(user.role)
  setMockSession(true)
}

export function readMockCurrentUser(): User | null {
  if (!canUseStorage()) return null
  const stored = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY)
  if (!stored) return null

  try {
    return JSON.parse(stored) as User
  } catch {
    return null
  }
}

export function getMockRecentWatch(userId: string): RecentWatchItem[] {
  const recentByUser = readStorageJson<Record<string, RecentWatchItem[]>>(RECENT_WATCH_STORAGE_KEY, {})
  return [...(recentByUser[userId] ?? [])].sort(
    (left, right) => right.watchedAt.localeCompare(left.watchedAt)
  )
}

export function recordMockRecentWatch(userId: string, video: Video, progressSeconds = 0) {
  const recentByUser = readStorageJson<Record<string, RecentWatchItem[]>>(RECENT_WATCH_STORAGE_KEY, {})
  const existing = recentByUser[userId] ?? []
  const hasSeenVideo = existing.some((item) => item.videoId === video.id)

  const nextEntry: RecentWatchItem = {
    userId,
    videoId: video.id,
    title: video.title,
    thumbnail: video.thumbnail,
    category: video.category,
    watchedAt: new Date().toISOString(),
    progressSeconds: Math.min(Math.max(progressSeconds, 0), video.duration),
    duration: video.duration,
  }

  const nextRecent = [nextEntry, ...existing.filter((item) => item.videoId !== video.id)].slice(0, 10)

  writeStorageJson(RECENT_WATCH_STORAGE_KEY, {
    ...recentByUser,
    [userId]: nextRecent,
  })

  if (!hasSeenVideo) {
    const videos = readMockVideos()
    const nextVideos = videos.map((item) =>
      item.id === video.id ? { ...item, views: item.views + 1 } : item
    )
    writeMockVideos(nextVideos)
  }
}

export function recordMockDiscoverSignal(input: DiscoverSignalInput) {
  const profiles = readStorageJson<Record<string, MockDiscoverProfile>>(DISCOVER_STORAGE_KEY, {})
  const current = profiles[input.userId] ?? {
    userId: input.userId,
    genreAffinity: {},
    recentVideoIds: [],
    lastWatchedAt: new Date(0).toISOString(),
  }

  const weight = input.completed ? 3 : 1
  const nextRecent = [input.videoId, ...current.recentVideoIds.filter((id) => id !== input.videoId)].slice(0, 6)
  const nextProfile: MockDiscoverProfile = {
    ...current,
    genreAffinity: {
      ...current.genreAffinity,
      [input.category]: (current.genreAffinity[input.category] ?? 0) + weight,
    },
    recentVideoIds: nextRecent,
    lastWatchedAt: new Date().toISOString(),
  }

  writeStorageJson(DISCOVER_STORAGE_KEY, {
    ...profiles,
    [input.userId]: nextProfile,
  })
}

function scoreVideo(video: Video, profile?: MockDiscoverProfile) {
  const genreScore = profile?.genreAffinity[video.category] ?? 0
  const recencyBonus = profile?.recentVideoIds.includes(video.id) ? 8 : 0
  const featuredBonus = video.isFeatured ? 14 : 0
  return genreScore * 12 + video.likes / 1400 + video.views / 18000 + recencyBonus + featuredBonus
}

export function buildMockAdaptiveDiscover(userId?: string): AdaptiveDiscoverResponse {
  const videos = readMockVideos()
  const profiles = readStorageJson<Record<string, MockDiscoverProfile>>(DISCOVER_STORAGE_KEY, {})
  const profile = userId ? profiles[userId] : undefined
  const ranked = [...videos].sort((left, right) => scoreVideo(right, profile) - scoreVideo(left, profile))
  const topCategory = profile
    ? Object.entries(profile.genreAffinity).sort((left, right) => right[1] - left[1])[0]?.[0]
    : undefined

  const rows = [
    {
      id: 'because-you-finished',
      title: profile ? 'Adaptive Discover' : 'Editor Spotlight',
      subtitle: profile
        ? `Weighted toward ${topCategory ?? 'your recent'} viewing patterns and your latest watch streaks.`
        : 'A cold-start row tuned for first-time viewers and launch-week momentum.',
      videos: ranked.slice(0, 6),
    },
    {
      id: 'continue-the-vibe',
      title: topCategory ? `${topCategory} After Dark` : 'Late Night Voltage',
      subtitle: topCategory
        ? `A tighter shelf built from the genre you return to most often.`
        : 'High-tension titles and glossy catalog standouts for the first session.',
      videos: ranked.filter((video) => !topCategory || video.category === topCategory).slice(0, 6),
    },
    {
      id: 'rising-reactions',
      title: 'Rising Reactions',
      subtitle: 'The catalog currently earning the sharpest blend of views and likes.',
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

function getCommentBucketSize(duration: number) {
  return Math.max(20, Math.round(duration / 18))
}

const emojiMoodLexicon = [
  { pattern: /🔥|💥|⚡|🚀/g, mood: 'Fire', intensity: 'high' as const },
  { pattern: /😱|👀|😨|🫣|😵/g, mood: 'Shock', intensity: 'high' as const },
  { pattern: /🤯|🧠|🌀/g, mood: 'Mindbend', intensity: 'high' as const },
  { pattern: /❤️|💔|🥹|😭/g, mood: 'Heart', intensity: 'medium' as const },
  { pattern: /😂|🤣|😭/g, mood: 'Laugh', intensity: 'medium' as const },
  { pattern: /😮|👏|🙌|👌/g, mood: 'Buzz', intensity: 'medium' as const },
]

function detectCommentMood(comment: SocialComment) {
  const message = comment.message
  const aura = (comment.aura ?? '').toLowerCase()

  for (const entry of emojiMoodLexicon) {
    const matches = message.match(entry.pattern)
    if (matches?.length) {
      return {
        mood: entry.mood,
        intensity: entry.intensity,
        weight: matches.length + 1,
      }
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
    intensity: message.includes('!') ? ('medium' as const) : ('low' as const),
    weight: 1,
  }
}

export function buildMockScenePulses(video: Video): ScenePulse[] {
  const comments = getMockComments(video.id).filter(
    (comment) => typeof comment.timestampSeconds === 'number'
  )
  const clusterWindow = Math.max(8, Math.round(getCommentBucketSize(video.duration) / 2))
  const sortedComments = [...comments].sort(
    (left, right) => (left.timestampSeconds as number) - (right.timestampSeconds as number)
  )
  const clusters: Array<{
    timestamps: number[]
    comments: SocialComment[]
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

export function getMockComments(videoId: string): SocialComment[] {
  const fallback: MockCommentsByVideo = {
    vid_1: [
      {
        videoId: 'vid_1',
        commentId: 'comment-1',
        authorName: 'Nadia V',
        message: 'The route switch halfway through turns the whole movie into a chase dream.',
        containsSpoilers: false,
        aura: 'Adrenaline',
        createdAt: '2026-03-23T20:14:00.000Z',
        timestampSeconds: 1840,
      },
      {
        videoId: 'vid_1',
        commentId: 'comment-2',
        authorName: 'Karan',
        message: 'That final extraction choice totally reframes who the real target was.',
        containsSpoilers: true,
        aura: 'Spoiler',
        createdAt: '2026-03-24T08:11:00.000Z',
        timestampSeconds: 5210,
      },
    ],
  }

  const commentsByVideo = readStorageJson<MockCommentsByVideo>(COMMENTS_STORAGE_KEY, fallback)
  return [...(commentsByVideo[videoId] ?? [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function getMockCommentsPage(
  videoId: string,
  cursor?: string | null,
  pageSize = 4
): CommentsPage {
  const comments = getMockComments(videoId)
  const start = cursor ? Number(cursor) || 0 : 0
  const items = comments.slice(start, start + pageSize)
  const nextCursor = start + pageSize < comments.length ? String(start + pageSize) : null

  return {
    items,
    nextCursor,
  }
}

export function createMockComment(videoId: string, input: CreateCommentInput): SocialComment {
  const commentsByVideo = readStorageJson<MockCommentsByVideo>(COMMENTS_STORAGE_KEY, {})
  const nextComment: SocialComment = {
    videoId,
    commentId: `comment_${Math.random().toString(36).slice(2, 10)}`,
    authorName: input.authorName,
    userId: input.userId,
    message: input.message,
    containsSpoilers: input.containsSpoilers,
    timestampSeconds: input.timestampSeconds,
    aura: input.aura,
    createdAt: new Date().toISOString(),
  }

  writeStorageJson(COMMENTS_STORAGE_KEY, {
    ...commentsByVideo,
    [videoId]: [nextComment, ...(commentsByVideo[videoId] ?? [])],
  })

  return nextComment
}
