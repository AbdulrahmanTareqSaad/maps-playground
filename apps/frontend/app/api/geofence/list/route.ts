/**
 * GET /api/geofence/list
 * Lists all geofence zones from the in-memory store.
 * Returns: { zones: Zone[] }
 */
import { NextResponse } from 'next/server'
import { listZones } from '@/lib/geofence-store'

export async function GET() {
  return NextResponse.json({ zones: listZones() })
}
