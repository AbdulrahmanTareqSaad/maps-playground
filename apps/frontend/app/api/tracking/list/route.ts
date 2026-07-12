import { NextResponse } from 'next/server'
import { listTrackers } from '@/lib/tracking-store'

export async function GET() {
  return NextResponse.json({ trackers: listTrackers() })
}
