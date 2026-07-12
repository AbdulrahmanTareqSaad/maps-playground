/**
 * LiveTracking module — simulate and stream real-time device position updates on a Leaflet map.
 * Creates trackers via /api/tracking/create, streams positions over SSE (/api/tracking/stream/:id),
 * and optionally fetches OSRM route paths via /api/routing/osrm. Displays moving markers, trails,
 * route lines, and connection status banners.
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import useDraggablePoints from '@/hooks/useDraggablePoints'
import { useTranslation } from '@/lib/i18n'
import { POINT1, POINT2 } from '@/lib/defaults'
import { getMap, getLeaflet } from '@/lib/map'
import { colors, gradients, mapDefaults } from '@/lib/theme'
import {
  SectionTitle, Subtitle, Label, Input, Button,
  CoordInput, FieldGroup, StatusBanner, ErrorBanner,
} from '@/components/ui'

export default function LiveTracking({
  clickedPos,
}: {
  clickedPos?: { lat: string; lng: string } | null
}) {
  const { t } = useTranslation()
  const [startLat, setStartLat] = useState(POINT1.lat)
  const [startLng, setStartLng] = useState(POINT1.lng)
  const [endLat, setEndLat] = useState(POINT2.lat)
  const [endLng, setEndLng] = useState(POINT2.lng)
  const [label, setLabel] = useState('Delivery Bike #1')
  const [speed, setSpeed] = useState(2)
  const [loading, setLoading] = useState(false)
  const [trackerId, setTrackerId] = useState<string | null>(null)
  const [apiToken, setApiToken] = useState<string | null>(null)
  const [connState, setConnState] = useState<string>('idle')

  const layerRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      const map = getMap()
      if (layerRef.current) { map?.removeLayer(layerRef.current); layerRef.current = null }
    }
  }, [])

  useDraggablePoints([
    { lat: startLat, lng: startLng, setLat: setStartLat, setLng: setStartLng, color: colors.success, label: t('tracking.start') },
    { lat: endLat, lng: endLng, setLat: setEndLat, setLng: setEndLng, color: colors.blue, label: t('tracking.destination') },
  ])

  const ensureLayer = () => {
    const L = getLeaflet()
    const map = getMap()
    if (!L || !map) return null
    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map)
    return layerRef.current
  }

  const clearMarkers = () => {
    if (layerRef.current) {
      getMap()?.removeLayer(layerRef.current)
      layerRef.current = null
    }
  }

  const addMoving = (lat: number, lng: number) => {
    const L = getLeaflet()
    const layer = ensureLayer()
    if (!layer || !L) return
    let found: any = null
    layer.eachLayer((l: any) => { if (l._mm) found = l })
    if (found) { found.setLatLng([lat, lng]); return }
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="background:${colors.accent};width:24px;height:24px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 18px ${colors.accentAlpha}"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    })
    marker._mm = true
    marker.addTo(layer)
  }

  const addTrail = (pts: [number, number][]) => {
    const L = getLeaflet()
    const layer = ensureLayer()
    if (!layer || !L || pts.length < 2) return
    let found: any = null
    layer.eachLayer((l: any) => { if (l._mmTrail) found = l })
    if (found) { found.setLatLngs(pts); return }
    const pl = L.polyline(pts, { color: colors.red, weight: 4, opacity: 0.9, dashArray: '8 5' })
    pl._mmTrail = true
    pl.addTo(layer)
  }

  const addRouteLine = (pts: [number, number][]) => {
    const L = getLeaflet()
    const layer = ensureLayer()
    if (!layer || !L || pts.length < 2) return
    let found: any = null
    layer.eachLayer((l: any) => { if (l._mmRoute) found = l })
    if (found) { found.setLatLngs(pts); return }
    const pl = L.polyline(pts, { color: colors.cyan, weight: 4, opacity: 0.85 })
    pl._mmRoute = true
    pl.addTo(layer)
  }

  const handleStart = async () => {
    setLoading(true)
    try {
      let routePath: number[][] | undefined
      try {
        const routeResp = await fetch(`/api/routing/osrm?start=${startLat},${startLng}&end=${endLat},${endLng}`)
        const routeData = await routeResp.json()
        if (routeData?.routes?.[0]?.geometry?.coordinates) routePath = routeData.routes[0].geometry.coordinates
      } catch { /* OSRM route is optional */ }

      const resp = await fetch('/api/tracking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_lat: startLat, start_lng: startLng, end_lat: endLat, end_lng: endLng, label, speed, route_path: routePath }),
      })
      const data = await resp.json()
      setTrackerId(data.id)
      setApiToken(data.api_token)

      clearMarkers()
      ensureLayer()
      addMoving(startLat, startLng)
      if (routePath && routePath.length >= 2) addRouteLine(routePath.map(c => [c[1], c[0]] as [number, number]))
      setConnState('created')
    } catch (e: unknown) {
      setConnState('error: ' + (e instanceof Error ? e.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!trackerId) return
    const path: [number, number][] = []
    const es = new EventSource(`/api/tracking/stream/${trackerId}`)
    es.addEventListener('position', (e: MessageEvent) => { const d = JSON.parse(e.data); addMoving(d.lat, d.lng) })
    es.addEventListener('history', (e: MessageEvent) => { const d = JSON.parse(e.data); path.push([d.lat, d.lng]); addTrail(path) })
    es.addEventListener('arrived', (e: MessageEvent) => { const d = JSON.parse(e.data); addMoving(d.lat, d.lng); setConnState('arrived'); es.close() })
    es.addEventListener('tracker_error', (e: MessageEvent) => { const d = JSON.parse(e.data); setConnState(`error: ${d.error || 'Unknown error'}`) })
    es.onopen = () => setConnState('connected')
    es.onerror = () => setConnState('error')
    return () => { es.close(); clearMarkers() }
  }, [trackerId])

  return (
    <div>
      <SectionTitle>{t('tracking.title')}</SectionTitle>
      <Subtitle>{t('tracking.desc')}</Subtitle>

      <FieldGroup label={t('tracking.start')} hint={clickedPos ? t('osm.useClicked') : undefined}>
        <CoordInput lat={startLat} lng={startLng} onLatChange={setStartLat} onLngChange={setStartLng} />
      </FieldGroup>

      <FieldGroup label={t('tracking.destination')} hint={clickedPos ? t('osm.useClicked') : undefined}>
        <CoordInput lat={endLat} lng={endLng} onLatChange={setEndLat} onLngChange={setEndLng} />
      </FieldGroup>

      <FieldGroup label={t('tracking.label')}>
        <Input type="text" value={label} onChange={e => setLabel(e.target.value)} full />
      </FieldGroup>

      <FieldGroup label={t('tracking.speed', { n: speed })}>
        <input type="range" min="0.5" max="10" step="0.5" value={speed} onChange={e => setSpeed(+e.target.value)}
          style={{ width: '100%' }} />
      </FieldGroup>

      {connState === 'idle' && (
        <Button fullWidth loading={loading} onClick={handleStart}>
          {loading ? t('tracking.creating') : t('tracking.startTracking')}
        </Button>
      )}

      {connState === 'created' && (
        <StatusBanner variant="success">
          <span style={{ fontWeight: 700 }}>{t('tracking.created')}</span>
          <span style={{ color: '#43a047' }}> {t('tracking.startingStream')}</span>
        </StatusBanner>
      )}

      {connState === 'connected' && (
        <StatusBanner variant="warning">
          <div style={{ color: colors.success, fontWeight: 600 }}>{t('tracking.connected')}</div>
        </StatusBanner>
      )}

      {connState === 'arrived' && (
        <StatusBanner variant="success">
          <span style={{ fontWeight: 600 }}>{t('tracking.arrived')}</span>
        </StatusBanner>
      )}

      {connState.startsWith('error') && (
        <StatusBanner variant="error">
          {connState === 'error' ? t('tracking.connectionError') : connState.slice(6)}
        </StatusBanner>
      )}

      {apiToken && connState !== 'idle' && (
        <div style={{ background: colors.infoBg, border: `1px solid ${colors.infoBorder}`, padding: 10, marginTop: 8, borderRadius: 8, fontSize: 12 }}>
          <div style={{ color: colors.textSecondary, marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('tracking.deviceApiToken')}
          </div>
          <div style={{ color: colors.accent, fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all', marginBottom: 6 }}>
            {apiToken}
          </div>
          <div style={{ color: '#5a6a8a', fontSize: 10 }}>
            {t('tracking.postTo', { n: '/api/tracking/report' })}
          </div>
          <pre style={{ color: '#666', fontSize: 10, marginTop: 4, whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
            {JSON.stringify({ tracker_id: trackerId, api_token: apiToken, lat: POINT1.lat, lng: POINT1.lng }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
