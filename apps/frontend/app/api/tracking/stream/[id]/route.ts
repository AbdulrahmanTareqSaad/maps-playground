import { NextRequest } from 'next/server'
import { getTracker, simulateStep } from '@/lib/tracking-store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const encoder = new TextEncoder()
  let closed = false
  let intervalId: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      try {
        const tracker = getTracker(id)
        if (!tracker) {
          controller.enqueue(
            encoder.encode(`event: tracker_error\ndata: ${JSON.stringify({ error: 'Tracker not found' })}\n\n`),
          )
          controller.close()
          return
        }

        controller.enqueue(
          encoder.encode(`event: position\ndata: ${JSON.stringify({ lat: tracker.lat, lng: tracker.lng })}\n\n`),
        )

        const speed = tracker.speed || 2
        const interval = Math.max(200, 1000 / speed)

        intervalId = setInterval(() => {
          if (closed) return
          const t = getTracker(id)
          if (!t || t.arrived) {
            if (t?.arrived) {
              try {
                controller.enqueue(
                  encoder.encode(`event: arrived\ndata: ${JSON.stringify({ lat: t.lat, lng: t.lng })}\n\n`),
                )
              } catch {}
            }
            if (intervalId) clearInterval(intervalId)
            try { controller.close() } catch {}
            return
          }

          const updated = simulateStep(id)
          if (updated) {
            try {
              controller.enqueue(
                encoder.encode(`event: position\ndata: ${JSON.stringify({ lat: updated.lat, lng: updated.lng })}\n\n`),
              )
              if (updated.path.length > 1) {
                const last = updated.path[updated.path.length - 1]
                controller.enqueue(
                  encoder.encode(`event: history\ndata: ${JSON.stringify({ lat: last.lat, lng: last.lng })}\n\n`),
                )
              }
              if (updated.arrived) {
                controller.enqueue(
                  encoder.encode(`event: arrived\ndata: ${JSON.stringify({ lat: updated.lat, lng: updated.lng })}\n\n`),
                )
                if (intervalId) clearInterval(intervalId)
                try { controller.close() } catch {}
              }
            } catch {}
          }
        }, interval)
      } catch (e: any) {
        try {
          controller.enqueue(
            encoder.encode(`event: tracker_error\ndata: ${JSON.stringify({ error: e.message })}\n\n`),
          )
        } catch {}
        try { controller.close() } catch {}
      }
    },
    cancel() {
      closed = true
      if (intervalId) clearInterval(intervalId)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
