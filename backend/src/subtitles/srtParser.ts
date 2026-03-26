import type { ParsedSubtitleCue } from './types'

function parseTimestamp(value: string) {
  const normalized = value.trim().replace(',', '.')
  const match = normalized.match(/(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?/)
  if (!match) return 0

  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  const milliseconds = Number((match[4] ?? '0').padEnd(3, '0'))

  if ([hours, minutes, seconds, milliseconds].some((part) => Number.isNaN(part))) {
    return 0
  }

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
}

function cleanText(text: string) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\\[^}]+\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseSrt(content: string) {
  const blocks = content
    .replace(/\r/g, '')
    .replace(/^WEBVTT\s*/i, '')
    .trim()
    .split(/\n\s*\n/g)
  const cues: ParsedSubtitleCue[] = []

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (!lines.length) continue

    const timeIndex = lines.findIndex((line) => line.includes('-->'))
    if (timeIndex === -1) continue

    const [rawStart, rawEnd] = lines[timeIndex]
      .split('-->')
      .map((part) => part.trim().split(/\s+/)[0] ?? '')

    const start = parseTimestamp(rawStart)
    const end = parseTimestamp(rawEnd)
    const text = cleanText(lines.slice(timeIndex + 1).join(' '))

    if (!text || end <= start) continue

    cues.push({
      start,
      end,
      text,
    })
  }

  return cues.sort((left, right) => left.start - right.start)
}
