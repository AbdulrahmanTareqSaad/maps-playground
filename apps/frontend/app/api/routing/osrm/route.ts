/**
 * GET /api/routing/osrm
 * Proxies a directions request to the public OSRM demo server.
 * Query params: start, end (lat,lng). Returns: OSRM route JSON with GeoJSON geometry.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end required (format: lat,lng)' }, { status: 422 })
  }

  try {
    const [sLat, sLng] = start.split(',').map(Number)
    const [eLat, eLng] = end.split(',').map(Number)
    const url = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson&steps=false`
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json(
        { error: `OSRM error (${resp.status}): ${text.slice(0, 500)}` },
        { status: 502 }
      )
    }
    const data = await resp.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: `OSRM request failed: ${e.message}` }, { status: 502 })
  }
}
