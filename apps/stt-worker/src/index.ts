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

async function cohereTranscribe(c: any, audioBuffer: ArrayBuffer, language: string): Promise<string> {
  const apiKey = c.env.COHERE_API_KEY
  if (!apiKey) throw new Error('Cohere API key not configured')

  const file = new File([audioBuffer], 'audio.wav', { type: 'audio/wav' })

  const form = new FormData()
  form.append('model', 'cohere-transcribe-03-2026')
  form.append('language', language === 'ar' ? 'ar' : 'en')
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
   console.log(`Cohere API Response: ${JSON.stringify(data)}`)
  return data.text || ''
}

async function enhanceWithLLM(c: any, text: string, language: string): Promise<string> {
  const langHint = language === 'ar' ? 'Arabic' : 'English'
  const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
    messages: [
      {
        role: 'system',
        content: `You are a speech-to-text correction assistant. The user is speaking ${langHint}. Fix the following raw transcription. Correct misspellings, fix accent-related misrecognitions, normalize punctuation and casing, remove filler words. Preserve the original language — do NOT translate or refuse. Return ONLY the corrected text with no explanation or quotes.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    max_tokens: 256,
    temperature: 0.1,
  })

  const corrected = response?.response?.trim() || text
  return corrected.replace(/^["']|["']$/g, '').trim()
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
    if (engine === 'cohere') {
      raw = await cohereTranscribe(c, audioBuffer, language)
    } else {
      const audioArray = Array.from(new Uint8Array(audioBuffer))
      raw = await whisperTranscribe(c, audioArray, language)
    }

    let text = cleanTranscript(raw)
    if (enhance && text.length > 0) {
      text = cleanTranscript(await enhanceWithLLM(c, text, language))
    }

    return c.json({ text })
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
    if (engine === 'cohere') {
      raw = await cohereTranscribe(c, audioBuffer, language)
    } else {
      const audioArray = Array.from(new Uint8Array(audioBuffer))
      raw = await whisperTranscribe(c, audioArray, language)
    }

    let text = cleanTranscript(raw)
    if (enhance && text.length > 0) {
      text = cleanTranscript(await enhanceWithLLM(c, text, language))
    }

    return c.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return c.json({ error: message }, 500)
  }
})

export default app
