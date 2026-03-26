import { generateGeminiJson } from './aiService'
import type { KeyMoment, SceneAnalysis } from './types'

function fallbackStory(scenes: SceneAnalysis[]) {
  return scenes
    .slice(0, 10)
    .map((scene) => scene.summary)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeMomentType(scene: SceneAnalysis): KeyMoment['type'] {
  const type = scene.type.toLowerCase()
  const emotion = scene.emotion.toLowerCase()

  if (/(action|fight|chase|attack)/.test(type)) return 'action'
  if (/(reveal|twist|discovery)/.test(type)) return 'twist'
  if (/(emotion|sad|grief|joy|anger|fear|suspense)/.test(type) || /(sad|joy|anger|fear|suspense)/.test(emotion)) {
    return 'emotional'
  }
  if (/(dialogue|conflict)/.test(type)) return 'dialogue'
  return 'reveal'
}

export async function buildStoryFromScenes({
  apiKey,
  model,
  title,
  scenes,
}: {
  apiKey?: string
  model: string
  title: string
  scenes: SceneAnalysis[]
}) {
  if (!apiKey) {
    return fallbackStory(scenes)
  }

  try {
    const parsed = await generateGeminiJson<{ story?: string }>({
      apiKey,
      model,
      prompt: [
        `Using the following scene summaries, generate a coherent full movie narrative.`,
        `Requirements:`,
        `- Maintain chronological flow`,
        `- Avoid hallucination`,
        `- Keep it concise but complete`,
        `- Highlight major turning points`,
        `Return ONLY valid JSON in this shape: {"story":"..."}`,
        `Movie: ${title}`,
        `Scene summaries:\n${scenes.map((scene) => `- ${scene.start}s-${scene.end}s: ${scene.summary}`).join('\n')}`,
      ].join('\n\n'),
      maxOutputTokens: 500,
    })

    return (parsed.story || fallbackStory(scenes)).replace(/\s+/g, ' ').trim()
  } catch {
    return fallbackStory(scenes)
  }
}

export function extractKeyMomentsFromScenes(scenes: SceneAnalysis[]) {
  const ranked = scenes
    .map((scene) => {
      let score = 0
      if (scene.importance === 'high') score += 5
      else if (scene.importance === 'medium') score += 3
      else score += 1

      if (/(action|reveal|conflict)/.test(scene.type)) score += 2
      if (/(anger|suspense|fear|joy|sadness|grief|shock)/.test(scene.emotion)) score += 2
      if (scene.key_event) score += 1

      return { scene, score }
    })
    .sort((left, right) => right.score - left.score || left.scene.start - right.scene.start)

  const picked: SceneAnalysis[] = []
  for (const entry of ranked) {
    if (entry.scene.importance === 'low') continue
    const tooClose = picked.some((scene) => Math.abs(scene.start - entry.scene.start) < 180)
    if (tooClose) continue
    picked.push(entry.scene)
    if (picked.length >= 8) break
  }

  return picked
    .sort((left, right) => left.start - right.start)
    .map<KeyMoment>((scene) => ({
      start: scene.start,
      end: scene.end,
      type: normalizeMomentType(scene),
      label: scene.key_event || scene.summary.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean)[0] || 'Key moment',
      description: scene.summary,
      emotion: scene.emotion,
      importance: scene.importance === 'low' ? 'medium' : scene.importance,
    }))
}
