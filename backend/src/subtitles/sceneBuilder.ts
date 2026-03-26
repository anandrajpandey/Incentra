import { generateGeminiJson } from './aiService'
import type { SceneAnalysis, SubtitleChunk } from './types'

const SCENE_BATCH_SIZE = 8
const SCENE_BATCH_CONCURRENCY = 4

function normalizeImportance(value?: string): 'low' | 'medium' | 'high' {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'low' || normalized === 'high') return normalized
  return 'medium'
}

function summarizeFallback(content: string) {
  const cleaned = content.replace(/\s+/g, ' ').trim()
  const first = cleaned.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean)[0] ?? cleaned
  return first.length > 180 ? `${first.slice(0, 177)}...` : first
}

function buildFallbackScene(chunk: SubtitleChunk): SceneAnalysis {
  return {
    start: chunk.start,
    end: chunk.end,
    summary: summarizeFallback(chunk.content),
    emotion: 'neutral',
    type: 'dialogue',
    importance: 'medium',
    key_event: '',
    confidence: 0.35,
  }
}

function partitionChunks(chunks: SubtitleChunk[], size: number) {
  const groups: SubtitleChunk[][] = []
  for (let index = 0; index < chunks.length; index += size) {
    groups.push(chunks.slice(index, index + size))
  }
  return groups
}

async function runWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TOutput>
) {
  const results = new Array<TOutput>(items.length)
  let cursor = 0

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await worker(items[currentIndex], currentIndex)
    }
  })

  await Promise.all(runners)
  return results
}

async function analyzeChunkBatch({
  apiKey,
  model,
  title,
  category,
  chunks,
}: {
  apiKey: string
  model: string
  title: string
  category: string
  chunks: SubtitleChunk[]
}) {
  try {
    const parsed = await generateGeminiJson<{
      scenes?: Array<{
        index?: number
        summary?: string
        emotion?: string
        type?: string
        importance?: string
        key_event?: string
      }>
    }>({
      apiKey,
      model,
      prompt: [
        `You are analyzing consecutive movie subtitle chunks.`,
        `For EACH chunk, extract:`,
        `1. Scene summary (1-2 lines, grounded in the dialogue)`,
        `2. Emotional tone`,
        `3. Scene type (action, dialogue, reveal, conflict, calm, transition)`,
        `4. Importance (low, medium, high)`,
        `5. Key event (if any)`,
        `Return ONLY valid JSON in this exact shape: {"scenes":[{"index":0,"summary":"...","emotion":"...","type":"...","importance":"medium","key_event":"..."}]}`,
        `Keep the array length equal to the number of chunks provided.`,
        `Movie: ${title}`,
        `Category: ${category}`,
        `Chunks:\n${chunks
          .map(
            (chunk, index) =>
              `Chunk ${index} (${Math.round(chunk.start)}s-${Math.round(chunk.end)}s):\n${chunk.content}`
          )
          .join('\n\n')}`,
      ].join('\n\n'),
      maxOutputTokens: 1600,
    })

    const byIndex = new Map<number, NonNullable<typeof parsed.scenes>[number]>()
    for (const scene of parsed.scenes ?? []) {
      if (typeof scene.index === 'number') {
        byIndex.set(scene.index, scene)
      }
    }

    return chunks.map((chunk, index) => {
      const parsedScene = byIndex.get(index)
      if (!parsedScene) {
        return buildFallbackScene(chunk)
      }

      return {
        start: chunk.start,
        end: chunk.end,
        summary: summarizeFallback(parsedScene.summary || chunk.content),
        emotion: (parsedScene.emotion || 'neutral').trim().toLowerCase(),
        type: (parsedScene.type || 'dialogue').trim().toLowerCase(),
        importance: normalizeImportance(parsedScene.importance),
        key_event: (parsedScene.key_event || '').replace(/\s+/g, ' ').trim(),
        confidence: 0.86,
      }
    })
  } catch {
    return chunks.map((chunk) => buildFallbackScene(chunk))
  }
}

export async function analyzeSceneChunks({
  apiKey,
  model,
  title,
  category,
  chunks,
}: {
  apiKey?: string
  model: string
  title: string
  category: string
  chunks: SubtitleChunk[]
}) {
  if (!chunks.length) {
    return []
  }

  if (!apiKey) {
    return mergeAdjacentScenes(chunks.map((chunk) => buildFallbackScene(chunk)))
  }

  const batches = partitionChunks(chunks, SCENE_BATCH_SIZE)
  const batchResults = await runWithConcurrency(
    batches,
    SCENE_BATCH_CONCURRENCY,
    async (batch) =>
      analyzeChunkBatch({
        apiKey,
        model,
        title,
        category,
        chunks: batch,
      })
  )

  const scenes = batchResults.flat()
  return mergeAdjacentScenes(scenes)
}

function mergeAdjacentScenes(scenes: SceneAnalysis[]) {
  if (!scenes.length) return scenes

  const merged: SceneAnalysis[] = [scenes[0]]

  for (const scene of scenes.slice(1)) {
    const previous = merged[merged.length - 1]
    const sameMood = previous.emotion === scene.emotion && previous.type === scene.type
    const smallGap = scene.start - previous.end <= 3

    if (sameMood && smallGap) {
      previous.end = scene.end
      previous.summary = `${previous.summary} ${scene.summary}`.replace(/\s+/g, ' ').trim()
      previous.key_event = [previous.key_event, scene.key_event].filter(Boolean).join(' / ')
      previous.importance =
        previous.importance === 'high' || scene.importance === 'high'
          ? 'high'
          : previous.importance === 'medium' || scene.importance === 'medium'
            ? 'medium'
            : 'low'
      previous.confidence = Math.max(previous.confidence, scene.confidence)
      continue
    }

    merged.push(scene)
  }

  return merged
}
