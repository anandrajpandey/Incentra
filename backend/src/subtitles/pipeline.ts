import { chunkSubtitleCues } from './chunker'
import { analyzeSceneChunks } from './sceneBuilder'
import { buildStoryFromScenes, extractKeyMomentsFromScenes } from './storyBuilder'
import { parseSrt } from './srtParser'
import type { SubtitleAnalysisResult } from './types'

export async function buildSubtitlePipeline({
  title,
  category,
  subtitleContent,
  apiKey,
  model,
}: {
  title: string
  category: string
  subtitleContent: string
  apiKey?: string
  model: string
}): Promise<SubtitleAnalysisResult> {
  const cues = parseSrt(subtitleContent)
  const chunks = chunkSubtitleCues(cues)
  const scenes = await analyzeSceneChunks({
    apiKey,
    model,
    title,
    category,
    chunks,
  })
  const story = await buildStoryFromScenes({
    apiKey,
    model,
    title,
    scenes,
  })
  const keyMoments = extractKeyMomentsFromScenes(scenes)

  return {
    story,
    scenes,
    key_moments: keyMoments,
    metadata: {
      total_duration: cues[cues.length - 1]?.end ?? 0,
      dominant_emotions: Array.from(new Set(scenes.map((scene) => scene.emotion).filter(Boolean))).slice(0, 5),
      scene_count: scenes.length,
      genre_guess: category,
    },
  }
}
