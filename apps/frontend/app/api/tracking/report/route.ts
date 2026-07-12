import { NextRequest, NextResponse } from 'next/server'
import { reportPosition } from '@/lib/tracking-store'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tracker_id, api_token, lat, lng } = body

    if (!tracker_id || !api_token || lat == null || lng == null) {
      return NextResponse.json({ error: 'tracker_id, api_token, lat, lng required' }, { status: 422 })
    }

    const tracker = reportPosition(tracker_id, api_token, parseFloat(lat), parseFloat(lng))
    if (!tracker) return NextResponse.json({ error: 'Invalid tracker or token' }, { status: 403 })

    return NextResponse.json({ ok: true, arrived: tracker.arrived })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
