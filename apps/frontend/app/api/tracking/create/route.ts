import { NextRequest, NextResponse } from 'next/server'
import { createTracker } from '@/lib/tracking-store'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { start_lat, start_lng, end_lat, end_lng, label, speed, route_path } = body

    if (start_lat == null || start_lng == null || end_lat == null || end_lng == null) {
      return NextResponse.json({ error: 'start_lat, start_lng, end_lat, end_lng required' }, { status: 422 })
    }

    const routeCoords: Array<{ lat: number; lng: number }> | undefined =
      Array.isArray(route_path) && route_path.length >= 2
        ? route_path.map((c: any) => ({ lat: parseFloat(c[1]), lng: parseFloat(c[0]) }))
        : undefined

    const tracker = createTracker({
      startLat: parseFloat(start_lat),
      startLng: parseFloat(start_lng),
      endLat: parseFloat(end_lat),
      endLng: parseFloat(end_lng),
      label: label || 'Unnamed',
      speed: parseFloat(speed || '1'),
      routeCoords,
    })

    return NextResponse.json(tracker)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
