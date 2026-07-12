/**
 * RoutingPlayground module — compare routing results between OpenRouteService (/api/routing/ors)
 * and OSRM (/api/routing/osrm) with support for driving, cycling, and walking profiles. Also
 * generates isochrone polygons via /api/routing/isochrone. Renders route polylines and isochrone
 * layers on the Leaflet map with automatic bounds fitting.
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import useDraggablePoints from '@/hooks/useDraggablePoints'
import { useTranslation } from '@/lib/i18n'
import { POINT1, POINT2 } from '@/lib/defaults'
import { getMap, getLeaflet } from '@/lib/map'
import { colors, gradients, mapDefaults } from '@/lib/theme'
import {
  SectionTitle, Subtitle, Label, Input, Button, Divider,
  CoordInput, FieldGroup, StatusBanner, ErrorBanner, ResultsBox,
} from '@/components/ui'

export default function RoutingPlayground({
  clickedPos,
}: {
  clickedPos?: { lat: string; lng: string } | null
}) {
  const { t, tEn } = useTranslation()
  const [startLat, setStartLat] = useState(POINT1.lat)
  const [startLng, setStartLng] = useState(POINT1.lng)
  const [endLat, setEndLat] = useState(POINT2.lat)
  const [endLng, setEndLng] = useState(POINT2.lng)
  const [profile, setProfile] = useState('driving-car')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isoLat, setIsoLat] = useState(POINT1.lat)
  const [isoLng, setIsoLng] = useState(POINT1.lng)
  const [isoRange, setIsoRange] = useState(10)
  const [isoLoading, setIsoLoading] = useState(false)

  useDraggablePoints([
    { lat: startLat, lng: startLng, setLat: setStartLat, setLng: setStartLng, color: colors.success, label: t('routing.start') },
    { lat: endLat, lng: endLng, setLat: setEndLat, setLng: setEndLng, color: colors.blue, label: t('routing.destination') },
    { lat: isoLat, lng: isoLng, setLat: setIsoLat, setLng: setIsoLng, color: colors.purple, label: tEn('routing.isoCenter') },
  ])

  const layerRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      const map = getMap()
      if (layerRef.current) { map?.removeLayer(layerRef.current); layerRef.current = null }
    }
  }, [])

  useEffect(() => {
    const L = getLeaflet()
    const map = getMap()
    if (!L || !map) return

    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map)
    const layer = layerRef.current
    layer.clearLayers()
    if (!results) return

    const orsRoute = results.ors?.features?.[0]
    const osrmRoute = results.osrm?.routes?.[0]

    const orsDist = orsRoute?.properties?.summary?.distance ?? Infinity
    const osrmDist = osrmRoute?.distance ?? Infinity
    const bothExist = orsDist < Infinity && osrmDist < Infinity

    if (orsRoute?.geometry?.coordinates) {
      const coords = orsRoute.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number])
      L.polyline(coords, { color: bothExist && orsDist <= osrmDist ? colors.success : colors.accent, weight: 4, opacity: 0.8 }).addTo(layer)
    }

    if (osrmRoute?.geometry?.coordinates) {
      const coords = osrmRoute.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number])
      L.polyline(coords, { color: bothExist && osrmDist <= orsDist ? colors.success : colors.accent, weight: 4, opacity: 0.8, dashArray: '8 4' }).addTo(layer)
    }

    const iso = results.isochrone
    if (iso?.features) {
      iso.features.forEach((f: any) => {
        if (f.geometry?.coordinates) {
          const ring = f.geometry.coordinates[0]?.map((c: number[]) => [c[1], c[0]] as [number, number])
          if (ring) L.polygon(ring, { color: colors.purple, weight: 2, fillColor: colors.purple, fillOpacity: 0.15 }).addTo(layer)
        }
      })
    }

    if (layer.getLayers().length > 0) {
      const pts: [number, number][] = []
      layer.getLayers().forEach((l: any) => {
        const raw = l.getLatLngs?.()
        if (Array.isArray(raw)) {
          const flat = (arr: any[]) => arr.forEach((v) => {
            if (Array.isArray(v)) flat(v)
            else if (v != null && !isNaN(v.lat) && !isNaN(v.lng)) pts.push([v.lat, v.lng])
          })
          flat(raw)
        }
      })
      if (pts.length > 0) map.fitBounds(L.latLngBounds(pts), { padding: mapDefaults.fitBoundsPadding, maxZoom: mapDefaults.fitBoundsMaxZoom })
    }

    return () => { layer.clearLayers() }
  }, [results])

  const handleCompare = async () => {
    setLoading(true)
    setResults(null)
    try {
      const [ors, osrm] = await Promise.all([
        fetch(`/api/routing/ors?start=${startLat},${startLng}&end=${endLat},${endLng}&profile=${profile}`).then(r => r.json()),
        fetch(`/api/routing/osrm?start=${startLat},${startLng}&end=${endLat},${endLng}`).then(r => r.json()),
      ])
      setResults({ ors, osrm })
    } catch (e: unknown) {
      setResults({ error: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleIsochrone = async () => {
    setIsoLoading(true)
    try {
      const resp = await fetch('/api/routing/isochrone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: isoLat, lng: isoLng, range: isoRange, profile }),
      })
      const data = await resp.json()
      setResults((prev: any) => ({ ...prev, isochrone: data }))
    } catch (e: unknown) {
      setResults((prev: any) => ({ ...prev, isochrone: { error: e instanceof Error ? e.message : 'Request failed' } }))
    } finally {
      setIsoLoading(false)
    }
  }

  return (
    <div>
      <SectionTitle>{t('routing.title')}</SectionTitle>
      <Subtitle>{t('routing.desc')}</Subtitle>

      <FieldGroup label={t('routing.start')} hint={clickedPos ? t('osm.useClicked') : undefined}>
        <CoordInput lat={startLat} lng={startLng} onLatChange={setStartLat} onLngChange={setStartLng} />
      </FieldGroup>

      <FieldGroup label={t('routing.destination')} hint={clickedPos ? t('osm.useClicked') : undefined}>
        <CoordInput lat={endLat} lng={endLng} onLatChange={setEndLat} onLngChange={setEndLng} />
      </FieldGroup>

      <FieldGroup label={t('routing.profile')}>
        <select value={profile} onChange={e => setProfile(e.target.value)}
          style={{ width: '100%', background: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.textPrimary, padding: '8px 10px', fontSize: 12, borderRadius: 6, outline: 'none', transition: 'border-color 0.2s' }}>
          <option value="driving-car">{t('routing.car')}</option>
          <option value="cycling-regular">{t('routing.bicycle')}</option>
          <option value="foot-walking">{t('routing.walking')}</option>
        </select>
      </FieldGroup>

      <Button fullWidth loading={loading} onClick={handleCompare}>
        {loading ? t('routing.loading') : t('routing.compare')}
      </Button>

      {results && !results.error && (results.ors?.features || results.osrm?.routes) && (
        <ResultsBox title={t('routing.results')}>
          {results.ors?.features && (
            <div style={{ color: colors.textPrimary, fontSize: 12, paddingTop: 4, paddingBottom: 4 }}>
              {t('routing.ors', { n: ((results.ors.features[0]?.properties?.summary?.distance || 0) / 1000).toFixed(1) })}
            </div>
          )}
          {results.osrm?.routes && (
            <div style={{ color: colors.textPrimary, fontSize: 12, paddingTop: 4, paddingBottom: 4 }}>
              {t('routing.osrm', { n: (results.osrm.routes[0]?.distance / 1000).toFixed(1) })}
            </div>
          )}
        </ResultsBox>
      )}
      {results?.error && <ErrorBanner>{results.error}</ErrorBanner>}

      <Divider />
      <h3 style={{ color: '#1a1a1a', marginBottom: 8, fontSize: 16, fontWeight: 700 }}>{tEn('routing.isochroneTitle')}</h3>

      <FieldGroup label={tEn('routing.center')} hint={clickedPos ? t('osm.useClicked') : undefined}>
        <CoordInput lat={isoLat} lng={isoLng} onLatChange={setIsoLat} onLngChange={setIsoLng} />
      </FieldGroup>

      <FieldGroup label={tEn('routing.time', { n: isoRange })}>
        <input type="range" min="1" max="30" step="1" value={isoRange} onChange={e => setIsoRange(+e.target.value)}
          style={{ width: '100%' }} />
      </FieldGroup>

      <Button variant="purple" fullWidth loading={isoLoading} onClick={handleIsochrone}>
        {isoLoading ? tEn('routing.generating') : tEn('routing.generate')}
      </Button>

      {results?.isochrone?.error && <ErrorBanner>{results.isochrone.error}</ErrorBanner>}
    </div>
  )
}
