/**
 * VoiceButton – Push-to-talk microphone button with automatic silence detection.
 * Records audio via MediaRecorder, converts webm→wav when using the Cohere
 * engine, and POSTs the blob to an STT worker for transcription.
 *
 * Props:
 *  - onTranscript: (text: string) => void – Receives the transcribed text.
 *  - onError?: (error: string) => void    – Called on any failure.
 *  - size?: number                         – Button diameter in px (default 28).
 *
 * Lets the user toggle between Whisper and Cohere engines. Automatically
 * stops recording after a configurable silence timeout.
 */

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from '@/lib/i18n'

type Engine = 'whisper' | 'cohere'

interface VoiceButtonProps {
  onTranscript: (text: string) => void
  onError?: (error: string) => void
  size?: number
}

type Status = 'idle' | 'recording' | 'transcribing'

const SILENCE_THRESHOLD = 0.015
const SILENCE_TIMEOUT_MS = 1500

async function webmToWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext()
  const arrayBuffer = await blob.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()

  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length
  const bytesPerSample = 2
  const dataSize = length * numChannels * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch))
  }

  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export default function VoiceButton({ onTranscript, onError, size = 28 }: VoiceButtonProps) {
  const { t, lang } = useTranslation()
  const [status, setStatus] = useState<Status>('idle')
  const [engine, setEngine] = useState<Engine>('whisper')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animFrameRef = useRef<number>(0)

  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = 0
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    analyserRef.current = null
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const stopRecording = useCallback(() => {
    cleanup()
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
  }, [cleanup])

  const startSilenceDetection = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    audioCtxRef.current = ctx
    analyserRef.current = analyser

    const data = new Uint8Array(analyser.fftSize)

    const check = () => {
      if (!analyserRef.current) return
      analyser.getByteTimeDomainData(data)

      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)

      if (rms < SILENCE_THRESHOLD) {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            stopRecording()
          }, SILENCE_TIMEOUT_MS)
        }
      } else {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = null
        }
      }

      animFrameRef.current = requestAnimationFrame(check)
    }

    animFrameRef.current = requestAnimationFrame(check)
  }, [stopRecording])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })

      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        cleanup()
        setStatus('transcribing')

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })

        if (blob.size < 500) {
          setStatus('idle')
          return
        }

        const audioBlob = engine === 'cohere' ? await webmToWav(blob) : blob

        const form = new FormData()
        form.append('audio', audioBlob, engine === 'cohere' ? 'recording.wav' : 'recording.webm')
        form.append('engine', engine)
        form.append('enhance', 'true')
        form.append('language', lang)

        try {
          const sttUrl = process.env.NEXT_PUBLIC_STT_WORKER_URL
          if (!sttUrl) {
            throw new Error('STT worker URL not configured')
          }

          const resp = await fetch(`${sttUrl}/transcribe-form`, {
            method: 'POST',
            body: form,
          })

          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: 'Transcription failed' }))
            throw new Error(err.error || `HTTP ${resp.status}`)
          }

          const data = await resp.json()
          if (data.text) {
            onTranscript(data.text.trim())
          } else {
            throw new Error('No text in response')
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Transcription failed'
          onError?.(msg)
        } finally {
          setStatus('idle')
        }
      }

      recorder.start(250)
      mediaRecorderRef.current = recorder
      setStatus('recording')
      startSilenceDetection(stream)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied'
      onError?.(msg)
    }
  }, [onTranscript, onError, cleanup, startSilenceDetection, engine, lang])

  const handleClick = () => {
    if (status === 'recording') {
      stopRecording()
    } else if (status === 'idle') {
      startRecording()
    }
  }

  const isRecording = status === 'recording'
  const isTranscribing = status === 'transcribing'
  const disabled = isTranscribing || isRecording

  return (
    <div style={{
      position: 'absolute',
      ...(lang === 'ar' ? { left: 4 } : { right: 4 }),
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      zIndex: 1,
      direction: lang === 'ar' ? 'rtl' : 'ltr',
    }}>
      {(['whisper', 'cohere'] as Engine[]).map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => !disabled && setEngine(e)}
          disabled={disabled}
          style={{
            fontSize: 8,
            fontWeight: engine === e ? 700 : 400,
            padding: '2px 4px',
            borderRadius: 4,
            border: engine === e ? '1px solid #5238e1' : '1px solid #d5cfc4',
            background: engine === e ? 'rgba(82,56,225,0.12)' : 'transparent',
            color: engine === e ? '#5238e1' : '#999',
            cursor: disabled ? 'not-allowed' : 'pointer',
            lineHeight: 1,
            transition: 'all 0.15s',
            flexShrink: 0,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {t(`voice.${e}`)}
        </button>
      ))}
      <button
        type="button"
        onClick={handleClick}
        disabled={isTranscribing}
        title={isRecording ? t('voice.stop') : t('voice.start')}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: 'none',
          cursor: isTranscribing ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          background: isRecording ? '#e53e3e' : isTranscribing ? '#d5cfc4' : 'transparent',
          color: isRecording ? '#fff' : isTranscribing ? '#888' : '#5238e1',
          transition: 'all 0.2s',
          opacity: isTranscribing ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        {isTranscribing ? (
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <g>
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
            </g>
          </svg>
        ) : (
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>
    </div>
  )
}
