export type ParsedSubtitleCue = {
  start: number
  end: number
  text: string
}

export type SubtitleChunk = {
  start: number
  end: number
  content: string
}

export type SceneAnalysis = {
  start: number
  end: number
  summary: string
  emotion: string
  type: string
  importance: 'low' | 'medium' | 'high'
  key_event: string
  confidence: number
}

export type KeyMoment = {
  start: number
  end: number
  type: 'emotional' | 'action' | 'twist' | 'reveal' | 'dialogue'
  label: string
  description: string
  emotion: string
  importance: 'low' | 'medium' | 'high'
}

export type SubtitleAnalysisResult = {
  story: string
  scenes: SceneAnalysis[]
  key_moments: KeyMoment[]
  metadata: {
    total_duration: number
    dominant_emotions: string[]
    scene_count: number
    genre_guess: string
  }
}
