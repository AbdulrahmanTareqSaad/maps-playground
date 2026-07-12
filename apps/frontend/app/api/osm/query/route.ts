import { NextRequest, NextResponse } from 'next/server'

const QUERY_TEMPLATES: Record<string, string> = {
  cafe: '[out:json];node["amenity"~"cafe|restaurant|fast_food"]({bbox});out geom;',
  fuel: '[out:json];node["amenity"="fuel"]({bbox});out geom;',
  parking: '[out:json];node["amenity"="parking"]({bbox});out geom;',
  pharmacy: '[out:json];node["amenity"="pharmacy"]({bbox});out geom;',
  school: '[out:json];node["amenity"~"school|kindergarten|university"]({bbox});out geom;',
  hospital: '[out:json];node["amenity"="hospital"]({bbox});out geom;',
  atm: '[out:json];node["amenity"="atm"]({bbox});out geom;',
  bus_stop: '[out:json];node["highway"="bus_stop"]({bbox});out geom;',
  charging: '[out:json];node["amenity"="charging_station"]({bbox});out geom;',
  custom: '{custom_query}',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')
  const radiusKm = parseFloat(searchParams.get('radius_km') || '1')
  const amenity = searchParams.get('amenity') || 'cafe'
  const customQuery = searchParams.get('custom_query') || ''

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 422 })
  }
  if (lat < -90 || lat > 90) {
    return NextResponse.json({ error: 'lat out of range' }, { status: 422 })
  }
  if (lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'lng out of range' }, { status: 422 })
  }
  if (!(amenity in QUERY_TEMPLATES)) {
    return NextResponse.json({ error: 'Unknown amenity type' }, { status: 400 })
  }

  const latDelta = radiusKm / 111.32
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180) + 0.001)
  const bbox = `${lat - latDelta},${lng - lngDelta},${lat + latDelta},${lng + lngDelta}`

  if (amenity === 'custom' && !customQuery) {
    return NextResponse.json({ error: 'custom_query required' }, { status: 400 })
  }

  const query =
    amenity === 'custom'
      ? customQuery.replace('{bbox}', bbox)
      : QUERY_TEMPLATES[amenity].replace('{bbox}', bbox)

  try {
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'MapMaster/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    })

    if (!resp.ok) {
      const body = await resp.text()
      return NextResponse.json(
        { error: `Overpass API error (${resp.status}): ${body.slice(0, 500)}` },
        { status: 502 }
      )
    }

    const data = await resp.json()
    const features = (data.elements || []).map((el: any) => ({
      id: el.id,
      type: el.type,
      lat: el.lat ?? el.center?.lat ?? null,
      lon: el.lon ?? el.center?.lon ?? null,
      tags: el.tags ?? {},
    }))

    return NextResponse.json({ count: features.length, features, bbox })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Overpass API request failed: ${e.message}` },
      { status: 502 }
    )
  }
}
