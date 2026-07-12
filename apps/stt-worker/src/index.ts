/**
 * Hono-based Cloudflare Worker that exposes speech-to-text transcription endpoints.
 * Supports two engines — Cloudflare Workers AI Whisper and Cohere's transcription API —
 * with optional LLM-powered transcript cleanup via Llama 3.1.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  AI: Ai
  COHERE_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

app.get('/health', (c) => c.json({ status: 'ok' }))

function detectLanguage(text: string): string {
  const chars = [...text]
  if (chars.length === 0) return 'en'
  const counts: Record<string, number> = { ar: 0, he: 0, ja: 0, ko: 0, zh: 0, ru: 0, th: 0, hi: 0, en: 0 }
  for (const ch of chars) {
    const code = ch.codePointAt(0) || 0
    if (code >= 0x0600 && code <= 0x06FF) counts.ar++
    else if (code >= 0x0590 && code <= 0x05FF) counts.he++
    else if (code >= 0x3040 && code <= 0x309F) counts.ja++
    else if (code >= 0xAC00 && code <= 0xD7AF) counts.ko++
    else if ((code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF)) counts.zh++
    else if (code >= 0x0400 && code <= 0x04FF) counts.ru++
    else if (code >= 0x0E00 && code <= 0x0E7F) counts.th++
    else if (code >= 0x0900 && code <= 0x097F) counts.hi++
    else if ((code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)) counts.en++
  }
  let best = 'en', bestCount = 0
  for (const [lang, count] of Object.entries(counts)) {
    if (count > bestCount) { best = lang; bestCount = count }
  }
  return best
}

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic', he: 'Hebrew', ja: 'Japanese', ko: 'Korean',
  zh: 'Chinese', ru: 'Russian', th: 'Thai', hi: 'Hindi', en: 'English',
}

function cleanTranscript(raw: string): string {
  return raw
    .replace(/[""]/g, '')
    .replace(/[""]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s,;:!？!]+/, '')
    .replace(/[.\s,;:!？!]+$/, '')
    .trim()
}

async function whisperTranscribe(c: any, audioArray: number[], language: string): Promise<string> {
  const response = await c.env.AI.run('@cf/openai/whisper', { audio: audioArray, language })
  return response.text || ''
}

async function detectLanguageFromAudio(c: any, audioArray: number[]): Promise<string> {
  try {
    const response = await c.env.AI.run('@cf/openai/whisper', { audio: audioArray, language: '' })
    const raw = response.text || ''
    return detectLanguage(raw)
  } catch {
    return 'en'
  }
}

async function cohereTranscribe(c: any, audioBuffer: ArrayBuffer, language: string): Promise<string> {
  const apiKey = c.env.COHERE_API_KEY
  if (!apiKey) throw new Error('Cohere API key not configured')

  const file = new File([audioBuffer], 'audio.wav', { type: 'audio/wav' })

  const form = new FormData()
  form.append('model', 'cohere-transcribe-03-2026')
  form.append('language', language)
  form.append('file', file)

  const resp = await fetch('https://api.cohere.com/v2/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Cohere API error (${resp.status}): ${body.slice(0, 500)}`)
  }

  const data = await resp.json() as { text: string }
  return data.text || ''
}

function isRefusal(response: string): boolean {
  const lower = response.toLowerCase()
  return (
    lower.includes("i'm happy to help") ||
    lower.includes("i need to clarify") ||
    lower.includes("i'd be happy to") ||
    lower.includes("i can't") ||
    lower.includes("i cannot") ||
    lower.includes("it appears that") ||
    lower.includes("the text you provided") ||
    lower.includes("if you'd like to") ||
    lower.includes("please provide") ||
    lower.includes("i'm not able to")
  )
}

async function enhanceWithLLM(c: any, text: string, detectedLang: string): Promise<string> {
  const langHint = LANG_NAMES[detectedLang] || 'English'
  const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
    messages: [
      {
        role: 'system',
        content: `You are a speech-to-text correction assistant. The user is speaking ${langHint}. Fix the raw transcription below. Correct misspellings, fix accent-related misrecognitions, normalize punctuation and casing, remove filler words. CRITICAL RULES: Return ONLY the corrected text in ${langHint}. NEVER refuse, NEVER explain, NEVER add commentary, NEVER translate. If the text is already correct, return it unchanged. No quotes, no prefixes, no preamble.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    max_tokens: 256,
    temperature: 0.1,
  })

  const corrected = (response?.response?.trim() || '').replace(/^["']|["']$/g, '').trim()
  if (!corrected || isRefusal(corrected)) return text
  return corrected
}

app.post('/transcribe', async (c) => {
  const contentType = c.req.header('content-type') || ''
  if (!contentType.includes('audio/')) {
    return c.json({ error: 'Content-Type must be an audio type' }, 400)
  }

  const engine = c.req.query('engine') || 'whisper'
  const language = c.req.query('language') || 'en'
  const enhance = c.req.query('enhance') === 'true'
  const audioBuffer = await c.req.arrayBuffer()

  if (!audioBuffer || audioBuffer.byteLength === 0) {
    return c.json({ error: 'No audio data provided' }, 400)
  }

  try {
    let raw: string
    let detectedLang: string
    if (engine === 'cohere') {
      const audioArray = Array.from(new Uint8Array(audioBuffer))
      detectedLang = await detectLanguageFromAudio(c, audioArray)
      raw = await cohereTranscribe(c, audioBuffer, detectedLang)
    } else {
      const audioArray = Array.from(new Uint8Array(audioBuffer))
      raw = await whisperTranscribe(c, audioArray, language)
    }

    let text = cleanTranscript(raw)
    if (!detectedLang!) detectedLang = detectLanguage(text)
    if (enhance && text.length > 0) {
      text = cleanTranscript(await enhanceWithLLM(c, text, detectedLang))
    }

    return c.json({ text, detectedLang })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return c.json({ error: message }, 500)
  }
})

app.post('/transcribe-form', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('audio')
  const engine = (formData.get('engine') as string) || 'whisper'
  const language = (formData.get('language') as string) || 'en'
  const enhance = formData.get('enhance') === 'true'

  if (!file || typeof file === 'string' || !('arrayBuffer' in file)) {
    return c.json({ error: 'No audio file provided in form-data field "audio"' }, 400)
  }

  const audioBuffer = await (file as File).arrayBuffer()

  try {
    let raw: string
    let detectedLang: string
    if (engine === 'cohere') {
      const audioArray = Array.from(new Uint8Array(audioBuffer))
      detectedLang = await detectLanguageFromAudio(c, audioArray)
      raw = await cohereTranscribe(c, audioBuffer, detectedLang)
    } else {
      const audioArray = Array.from(new Uint8Array(audioBuffer))
      raw = await whisperTranscribe(c, audioArray, language)
    }

    let text = cleanTranscript(raw)
    if (!detectedLang!) detectedLang = detectLanguage(text)
    if (enhance && text.length > 0) {
      text = cleanTranscript(await enhanceWithLLM(c, text, detectedLang))
    }

    return c.json({ text, detectedLang })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return c.json({ error: message }, 500)
  }
})

export default app
