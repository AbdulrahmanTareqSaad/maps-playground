import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { lat, lng, range, profile } = body

  if (lat == null || lng == null) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 422 })
  }

  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ORS_API_KEY not configured. Set it in .env.local to use isochrone analysis.' }, { status: 502 })
  }

  try {
    const p = profile || 'driving-car'
    const r = parseFloat(range) || 10
    const url = `https://api.openrouteservice.org/v2/isochrones/${p}`

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json',
      },
      body: JSON.stringify({
        locations: [[lng, lat]],
        range: [r * 60],
        range_type: 'time',
        units: 'km',
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json(
        { error: `Isochrone error (${resp.status}): ${text.slice(0, 500)}` },
        { status: 502 },
      )
    }

    const data = await resp.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: `Isochrone request failed: ${e.message}` }, { status: 502 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST instead' }, { status: 405 })
}
