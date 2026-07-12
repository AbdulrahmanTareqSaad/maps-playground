import { NextRequest, NextResponse } from 'next/server'
import { createZone } from '@/lib/geofence-store'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, polygon } = body

    if (!name || !polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return NextResponse.json({ error: 'name and polygon (3+ points) required' }, { status: 422 })
    }

    const zone = createZone(name, polygon)
    return NextResponse.json(zone)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
