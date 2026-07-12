import { Hono } from 'hono'

type Bindings = {
  AI: Ai
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.post('/transcribe', async (c) => {
  const contentType = c.req.header('content-type') || ''

  if (!contentType.includes('audio/')) {
    return c.json({ error: 'Content-Type must be an audio type' }, 400)
  }

  const audioBuffer = await c.req.arrayBuffer()

  if (!audioBuffer || audioBuffer.byteLength === 0) {
    return c.json({ error: 'No audio data provided' }, 400)
  }

  const audioArray = Array.from(new Uint8Array(audioBuffer))

  const input = {
    audio: audioArray,
  }

  try {
    const response = await c.env.AI.run('@cf/openai/whisper', input)
    return c.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return c.json({ error: message }, 500)
  }
})

app.post('/transcribe-form', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('audio')

  if (!file || typeof file === 'string' || !('arrayBuffer' in file)) {
    return c.json({ error: 'No audio file provided in form-data field "audio"' }, 400)
  }

  const audioBuffer = await (file as File).arrayBuffer()
  const audioArray = Array.from(new Uint8Array(audioBuffer))

  const input = {
    audio: audioArray,
  }

  try {
    const response = await c.env.AI.run('@cf/openai/whisper', input)
    return c.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return c.json({ error: message }, 500)
  }
})

export default app
