import { NextResponse } from 'next/server'
import { listZones } from '@/lib/geofence-store'

export async function GET() {
  return NextResponse.json({ zones: listZones() })
}
