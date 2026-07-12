/**
 * GET /api/routing/ors
 * Proxies a directions request to the OpenRouteService Directions API.
 * Query params: start, end (lat,lng), profile (e.g. "driving-car").
 * Requires ORS_API_KEY env var. Returns: GeoJSON route response.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const profile = searchParams.get('profile') || 'driving-car'

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end required (format: lat,lng)' }, { status: 422 })
  }

  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ORS_API_KEY not configured. Set it in .env or use the OSRM route instead.' }, { status: 502 })
  }

  // ORS expects lng,lat order; frontend sends lat,lng
  const [sLat, sLng] = start.split(',').map(Number)
  const [eLat, eLng] = end.split(',').map(Number)
  if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
    return NextResponse.json({ error: 'Invalid start or end coordinates' }, { status: 422 })
  }

  try {
    const url = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${apiKey}&start=${sLng},${sLat}&end=${eLng},${eLat}`
    const resp = await fetch(url, {
      headers: { Accept: 'application/json, application/geo+json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json(
        { error: `ORS error (${resp.status}): ${text.slice(0, 500)}` },
        { status: 502 }
      )
    }
    const data = await resp.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: `ORS request failed: ${e.message}` }, { status: 502 })
  }
}
