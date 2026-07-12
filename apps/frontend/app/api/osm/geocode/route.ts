import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: 'q is required' }, { status: 422 })
  }
  const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10), 10)

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=${limit}`
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'MapMaster/1.0',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!resp.ok) {
      const body = await resp.text()
      return NextResponse.json(
        { error: `Nominatim error (${resp.status}): ${body.slice(0, 500)}` },
        { status: 502 }
      )
    }

    const data = await resp.json()
    const results = (data || []).map((r: any) => ({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      displayName: r.display_name,
      type: r.type,
      category: r.category,
    }))

    return NextResponse.json({ results })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Geocode request failed: ${e.message}` },
      { status: 502 }
    )
  }
}
