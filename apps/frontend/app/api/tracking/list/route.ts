/**
 * GET /api/tracking/list
 * Lists all active trackers from the in-memory tracking store.
 * Returns: { trackers: Tracker[] }
 */
import { NextResponse } from 'next/server'
import { listTrackers } from '@/lib/tracking-store'

export async function GET() {
  return NextResponse.json({ trackers: listTrackers() })
}
