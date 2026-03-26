import type {
  CompanionBeat,
  SubtitleChunk,
  SubtitleSceneContext,
  SubtitleTranscriptCue,
} from '@/types'

type SubtitleCue = {
  start: number
  end: number
  text: string
}

function parseTimestamp(value: string) {
  const [time] = value.split(',')
  const normalized = value.replace(',', '.')
  const parts = normalized.split(':').map(Number)
  if (parts.some((part) => Number.isNaN(part))) return 0
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return Number(normalized) || 0
}

export function parseSubtitleFile(content: string, extension: string) {
  const normalizedExt = extension.toLowerCase()
  if (normalizedExt === 'vtt') {
    return parseVtt(content)
  }
  return parseSrt(content)
}

export function buildSubtitleTranscriptFromSubtitles(
  content: string,
  extension: string
): SubtitleTranscriptCue[] {
  return parseSubtitleFile(content, extension).map((cue) => ({
    startSeconds: Math.round(cue.start),
    endSeconds: Math.round(cue.end),
    text: cue.text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
  }))
}

export function buildSubtitleChunksFromSubtitles(
  content: string,
  extension: string
): SubtitleChunk[] {
  const cues = parseSubtitleFile(content, extension)
  const chunks = buildConversationChunks(cues)

  return chunks.map((chunk, index) => ({
    id: `chunk-${Math.round(chunk.start)}-${index}`,
    startSeconds: Math.round(chunk.start),
    endSeconds: Math.round(chunk.end),
    content: chunk.content,
  }))
}

function parseSrt(content: string): SubtitleCue[] {
  return content
    .replace(/\r/g, '')
    .trim()
    .split('\n\n')
    .map((block) => block.split('\n').filter(Boolean))
    .flatMap((lines) => {
      const timeLine = lines.find((line) => line.includes('-->'))
      if (!timeLine) return []
      const [rawStart, rawEnd] = timeLine.split('-->').map((line) => line.trim())
      const text = lines.slice(lines.indexOf(timeLine) + 1).join(' ').trim()
      if (!text) return []
      return [
        {
          start: parseTimestamp(rawStart),
          end: parseTimestamp(rawEnd),
          text,
        },
      ]
    })
}

function parseVtt(content: string): SubtitleCue[] {
  return content
    .replace(/\r/g, '')
    .replace(/^WEBVTT\s*/i, '')
    .trim()
    .split('\n\n')
    .map((block) => block.split('\n').filter(Boolean))
    .flatMap((lines) => {
      const timeLine = lines.find((line) => line.includes('-->'))
      if (!timeLine) return []
      const [rawStart, rawEnd] = timeLine.split('-->').map((line) => line.trim())
      const text = lines.slice(lines.indexOf(timeLine) + 1).join(' ').trim()
      if (!text) return []
      return [
        {
          start: parseTimestamp(rawStart),
          end: parseTimestamp(rawEnd),
          text,
        },
      ]
    })
}

export function convertSubtitlesToVtt(content: string, extension: string) {
  if (extension.toLowerCase() === 'vtt') {
    return content.startsWith('WEBVTT') ? content : `WEBVTT\n\n${content}`
  }

  const cues = parseSrt(content)
  const body = cues
    .map((cue) => `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${cue.text}`)
    .join('\n\n')

  return `WEBVTT\n\n${body}\n`
}

function formatVttTime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.round((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds
    .toString()
    .padStart(3, '0')}`
}

export function buildCompanionBeatsFromSubtitles(content: string, extension: string): CompanionBeat[] {
  void content
  void extension
  return []
}

export function buildSubtitleContextFromSubtitles(content: string, extension: string): SubtitleSceneContext[] {
  const cues = parseSubtitleFile(content, extension)
  const scenes = buildSceneChunks(cues)

  return scenes.slice(0, 36).map((scene, index) => ({
    id: `scene-${Math.round(scene.start)}-${index}`,
    startSeconds: Math.round(scene.start),
    endSeconds: Math.round(scene.end),
    summary: summarizeScene(scene.text),
    excerpt: buildExcerpt(scene.text),
    keywords: extractSceneKeywords(scene.text),
  }))
}

function buildHighMomentChunks(cues: SubtitleCue[]) {
  const scored = cues
    .map((cue, index) => {
      const neighbors = cues.slice(Math.max(0, index - 1), Math.min(cues.length, index + 2))
      const text = neighbors.map((entry) => entry.text).join(' ').trim()

      return {
        start: neighbors[0]?.start ?? cue.start,
        end: neighbors[neighbors.length - 1]?.end ?? cue.end,
        text,
        score: scoreCue(text),
      }
    })
    .filter((chunk) => chunk.text.length > 24 && chunk.score >= 4)
    .sort((left, right) => right.score - left.score)

  const selected: Array<{ start: number; end: number; text: string; score: number }> = []

  for (const chunk of scored) {
    const nearExisting = selected.some((entry) => Math.abs(entry.start - chunk.start) < 75)
    if (nearExisting) continue
    selected.push(chunk)
    if (selected.length >= 8) break
  }

  return selected.sort((left, right) => left.start - right.start)
}

function buildSceneChunks(cues: SubtitleCue[]) {
  const scenes: Array<{ start: number; end: number; text: string }> = []
  let bucket: SubtitleCue[] = []

  const flush = () => {
    if (!bucket.length) return
    const text = bucket.map((cue) => cue.text).join(' ').replace(/\s+/g, ' ').trim()
    if (text.length >= 20) {
      scenes.push({
        start: bucket[0].start,
        end: bucket[bucket.length - 1].end,
        text,
      })
    }
    bucket = []
  }

  for (const cue of cues) {
    const previous = bucket[bucket.length - 1]
    const gap = previous ? cue.start - previous.end : 0
    const bucketDuration = previous ? cue.end - bucket[0].start : 0

    if (bucket.length && (gap > 12 || bucketDuration > 42)) {
      flush()
    }

    bucket.push(cue)
  }

  flush()
  return scenes
}

function buildConversationChunks(cues: SubtitleCue[]) {
  const chunks: Array<{ start: number; end: number; content: string }> = []
  let bucket: SubtitleCue[] = []

  const flush = () => {
    if (!bucket.length) return
    const content = bucket.map((cue) => cue.text).join(' ').replace(/\s+/g, ' ').trim()
    if (content.length >= 24) {
      chunks.push({
        start: bucket[0].start,
        end: bucket[bucket.length - 1].end,
        content,
      })
    }
    bucket = []
  }

  for (const cue of cues) {
    const previous = bucket[bucket.length - 1]
    const gap = previous ? cue.start - previous.end : 0
    const bucketDuration = previous ? cue.end - bucket[0].start : 0

    if (bucket.length && (gap > 10 || bucketDuration > 55)) {
      flush()
    }

    bucket.push(cue)
  }

  flush()
  return chunks
}

function scoreCue(text: string) {
  const cleaned = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const lower = cleaned.toLowerCase()
  const words = lower.split(/\s+/).filter(Boolean)
  const capitalWords = cleaned.match(/\b[A-Z]{3,}\b/g)?.length ?? 0
  const exclamations = (cleaned.match(/!/g)?.length ?? 0) * 2
  const questions = cleaned.includes('?') ? 1 : 0
  const profanity = (lower.match(/\b(fuck|shit|damn|hell|bastard|asshole)\b/g)?.length ?? 0) * 2
  const urgency = (lower.match(/\b(run|go|move|look|stop|wait|now|hurry|help)\b/g)?.length ?? 0) * 1.4
  const violence = (lower.match(/\b(kill|dead|blood|gun|fight|shoot|stab|burn|attack)\b/g)?.length ?? 0) * 1.8
  const reveal = (lower.match(/\b(secret|truth|real|lying|trust|who|why|remember|listen)\b/g)?.length ?? 0) * 1.3
  const emotion = (lower.match(/\b(love|sorry|please|goodbye|family|hurt|stay|miss)\b/g)?.length ?? 0) * 1.2
  const shortSharpBonus = words.length <= 10 ? 1 : 0

  return capitalWords + exclamations + questions + profanity + urgency + violence + reveal + emotion + shortSharpBonus
}

function summarizeChunk(text: string) {
  const cleaned = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const shortened = cleaned.split(/[.!?]/).find(Boolean) || cleaned
  return shortened.length > 120 ? `${shortened.slice(0, 117)}...` : shortened
}

function summarizeScene(text: string) {
  const cleaned = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const sentences = cleaned.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean)
  const summary = sentences.slice(0, 2).join('. ')
  const normalized = summary || cleaned
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized
}

function buildExcerpt(text: string) {
  const cleaned = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return cleaned.length > 240 ? `${cleaned.slice(0, 237)}...` : cleaned
}

function extractSceneKeywords(text: string) {
  const stopWords = new Set([
    'the', 'and', 'that', 'with', 'this', 'from', 'they', 'have', 'what', 'your',
    'into', 'just', 'when', 'then', 'them', 'were', 'been', 'about', 'there', 'would',
    'could', 'should', 'their', 'while', 'where', 'which', 'because', 'like',
    'here', 'thank', 'thanks', 'yeah', 'nah', 'look', 'right', 'really', 'gonna',
    'wanna', 'couldn', 'wouldn', 'shouldn', 'didn', 'doesn', 'isn', 'aren', 'wasn',
    'weren', 'don', 'cant', 'won', 've', 'll', 're', 'just', 'okay', 'alright', 'shit',
    'damn', 'fuck'
  ])

  const counts = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word))
    .reduce<Record<string, number>>((acc, word) => {
      acc[word] = (acc[word] ?? 0) + 1
      return acc
    }, {})

  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([word]) => word)
}
