import type { ParsedSubtitleCue, SubtitleChunk } from './types'

export function chunkSubtitleCues(cues: ParsedSubtitleCue[]) {
  const chunks: SubtitleChunk[] = []
  let bucket: ParsedSubtitleCue[] = []

  const flush = () => {
    if (!bucket.length) return
    const content = bucket.map((cue) => cue.text).join(' ').replace(/\s+/g, ' ').trim()
    if (content.length >= 20) {
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
    const duration = previous ? cue.end - bucket[0].start : 0

    if (bucket.length && (gap > 3 || duration >= 55)) {
      flush()
    }

    bucket.push(cue)

    const nextDuration = cue.end - bucket[0].start
    if (nextDuration >= 45) {
      flush()
    }
  }

  flush()
  return chunks
}
