/**
 * POST /api/geofence/check
 * Checks whether a given point falls inside any stored geofence zones.
 * Body params: lat, lng (required). Returns: containment result with matching zone info.
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkPoint } from '@/lib/geofence-store'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lat, lng } = body

    if (lat == null || lng == null) {
      return NextResponse.json({ error: 'lat and lng required' }, { status: 422 })
    }

    return NextResponse.json(checkPoint(parseFloat(lat), parseFloat(lng)))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
