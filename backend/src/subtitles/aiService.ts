const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const GEMINI_REQUEST_TIMEOUT_MS = 12000

function stripJsonFence(value: string) {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()
}

export function parseModelJson<T>(rawText: string) {
  try {
    return JSON.parse(stripJsonFence(rawText)) as T
  } catch {
    return null
  }
}

export async function generateGeminiJson<T>({
  apiKey,
  model,
  prompt,
  temperature = 0.2,
  maxOutputTokens = 512,
  retries = 3,
}: {
  apiKey: string
  model: string
  prompt: string
  temperature?: number
  maxOutputTokens?: number
  retries?: number
}) {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS)
      const result = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              maxOutputTokens,
              responseMimeType: 'application/json',
            },
          }),
        }
      )
      clearTimeout(timeout)

      if (!result.ok) {
        throw new Error(await result.text())
      }

      const payload = (await result.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>
          }
        }>
      }

      const rawText =
        payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? ''

      const parsed = parseModelJson<T>(rawText)
      if (!parsed) {
        throw new Error(`Invalid JSON response: ${rawText}`)
      }

      return parsed
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.name === 'AbortError'
            ? new Error(`Gemini request timed out after ${GEMINI_REQUEST_TIMEOUT_MS}ms`)
            : error
          : new Error('Gemini request failed')
      if (attempt < retries - 1) {
        await wait(400 * (attempt + 1))
      }
    }
  }

  throw lastError ?? new Error('Gemini request failed')
}
