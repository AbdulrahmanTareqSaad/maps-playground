'use client'

import { useState, useEffect, useRef } from 'react'
import useDraggablePoints from '@/hooks/useDraggablePoints'
import { useTranslation } from '@/lib/i18n'
import { POINT1, POINT2 } from '@/lib/defaults'

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
  const [connState, setConnState] = useState('idle')

  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    return () => {
      const map = (window as any).__map as L.Map | undefined
      if (layerRef.current) { map?.removeLayer(layerRef.current); layerRef.current = null }
    }
  }, [])

  useDraggablePoints([
    { lat: startLat, lng: startLng, setLat: setStartLat, setLng: setStartLng, color: '#27ae60', label: t('tracking.start') },
    { lat: endLat, lng: endLng, setLat: setEndLat, setLng: setEndLng, color: '#3498db', label: t('tracking.destination') },
  ])

  const ensureLayer = () => {
    if (typeof window === 'undefined') return null
    const L = window.L
    const map = (window as any).__map as L.Map | undefined
    if (!L || !map) return null
    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map)
    }
    return layerRef.current
  }

  const clearMarkers = () => {
    if (layerRef.current) {
      ;(window as any).__map?.removeLayer(layerRef.current)
      layerRef.current = null
    }
  }

  const addMoving = (lat: number, lng: number) => {
    const L = window.L
    const layer = ensureLayer()
    if (!layer || !L) return
    let found: any = null
    layer.eachLayer((l: any) => { if (l._mm) found = l })
    if (found) {
      found.setLatLng([lat, lng])
      return
    }
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: '<div style="background:#5238e1;width:24px;height:24px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 18px rgba(82,56,225,0.9)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    })
    ;(marker as any)._mm = true
    marker.addTo(layer)
  }

  const addTrail = (pts: [number, number][]) => {
    const L = window.L
    const layer = ensureLayer()
    if (!layer || !L || pts.length < 2) return
    let found: any = null
    layer.eachLayer((l: any) => { if (l._mmTrail) found = l })
    if (found) { found.setLatLngs(pts); return }
    const pl = L.polyline(pts, { color: '#ff4757', weight: 4, opacity: 0.9, dashArray: '8 5' })
    ;(pl as any)._mmTrail = true
    pl.addTo(layer)
  }

  const addRouteLine = (pts: [number, number][]) => {
    const L = window.L
    const layer = ensureLayer()
    if (!layer || !L || pts.length < 2) return
    let found: any = null
    layer.eachLayer((l: any) => { if (l._mmRoute) found = l })
    if (found) { found.setLatLngs(pts); return }
    const pl = L.polyline(pts, { color: '#00b4d8', weight: 4, opacity: 0.85 })
    ;(pl as any)._mmRoute = true
    pl.addTo(layer)
  }

  const handleStart = async () => {
    setLoading(true)
    try {
      let routePath: number[][] | undefined

      try {
        const routeResp = await fetch(`/api/routing/osrm?start=${startLat},${startLng}&end=${endLat},${endLng}`)
        const routeData = await routeResp.json()
        if (routeData?.routes?.[0]?.geometry?.coordinates) {
          routePath = routeData.routes[0].geometry.coordinates
        }
      } catch {}

      const resp = await fetch('/api/tracking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_lat: startLat, start_lng: startLng,
          end_lat: endLat, end_lng: endLng,
          label, speed,
          route_path: routePath,
        }),
      })
      const data = await resp.json()
      setTrackerId(data.id)
      setApiToken(data.api_token)

      clearMarkers()
      ensureLayer()
      addMoving(startLat, startLng)
      if (routePath && routePath.length >= 2) {
        const pts = routePath.map(c => [c[1], c[0]] as [number, number])
        addRouteLine(pts)
      }
      setConnState('created')
    } catch (e: any) {
      setConnState('error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!trackerId) return
    const path: [number, number][] = []
    const es = new EventSource('/api/tracking/stream/' + trackerId)
    es.addEventListener('position', (e: MessageEvent) => {
      const d = JSON.parse(e.data)
      addMoving(d.lat, d.lng)
    })
    es.addEventListener('history', (e: MessageEvent) => {
      const d = JSON.parse(e.data)
      path.push([d.lat, d.lng] as [number, number])
      addTrail(path)
    })
    es.addEventListener('arrived', (e: MessageEvent) => {
      const d = JSON.parse(e.data)
      addMoving(d.lat, d.lng)
      setConnState('arrived')
      es.close()
    })
    es.addEventListener('tracker_error', (e: MessageEvent) => {
      const d = JSON.parse(e.data)
      setConnState('error: ' + (d.error || 'Unknown error'))
    })
    es.onopen = () => setConnState('connected')
    es.onerror = () => setConnState('error')
    return () => { es.close(); clearMarkers() }
  }, [trackerId])

  return (
    <div>
      <h2 style={{ color: '#1a1a1a', marginBottom: 4, fontSize: 18, fontWeight: 700 }}>{t('tracking.title')}</h2>
      <p style={{ color: '#777', marginBottom: 16, fontSize: 12, lineHeight: 1.5 }}>{t('tracking.desc')}</p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#888', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('tracking.start')}
          {clickedPos && (
            <span style={{ marginLeft: 8, fontSize: 10, cursor: 'pointer', color: '#5238e1', fontWeight: 400, textTransform: 'none' }}
              onClick={() => { setStartLat(parseFloat(clickedPos.lat)); setStartLng(parseFloat(clickedPos.lng)) }}>
              {t('osm.useClicked')}
            </span>
          )}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" value={startLat} step="0.0001" onChange={e => setStartLat(+e.target.value)}
            style={{ flex: 1, minWidth: 0, background: '#f0ebe2', border: '1px solid #d5cfc4', color: '#2d2d2d', padding: '8px 6px', fontSize: 12, borderRadius: 6, outline: 'none', lineHeight: 1, transition: 'border-color 0.2s' }} />
          <input type="number" value={startLng} step="0.0001" onChange={e => setStartLng(+e.target.value)}
            style={{ flex: 1, minWidth: 0, background: '#f0ebe2', border: '1px solid #d5cfc4', color: '#2d2d2d', padding: '8px 6px', fontSize: 12, borderRadius: 6, outline: 'none', lineHeight: 1, transition: 'border-color 0.2s' }} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#888', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('tracking.destination')}
          {clickedPos && (
            <span style={{ marginLeft: 8, fontSize: 10, cursor: 'pointer', color: '#5238e1', fontWeight: 400, textTransform: 'none' }}
              onClick={() => { setEndLat(parseFloat(clickedPos.lat)); setEndLng(parseFloat(clickedPos.lng)) }}>
              {t('osm.useClicked')}
            </span>
          )}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" value={endLat} step="0.0001" onChange={e => setEndLat(+e.target.value)}
            style={{ flex: 1, minWidth: 0, background: '#f0ebe2', border: '1px solid #d5cfc4', color: '#2d2d2d', padding: '8px 6px', fontSize: 12, borderRadius: 6, outline: 'none', lineHeight: 1, transition: 'border-color 0.2s' }} />
          <input type="number" value={endLng} step="0.0001" onChange={e => setEndLng(+e.target.value)}
            style={{ flex: 1, minWidth: 0, background: '#f0ebe2', border: '1px solid #d5cfc4', color: '#2d2d2d', padding: '8px 6px', fontSize: 12, borderRadius: 6, outline: 'none', lineHeight: 1, transition: 'border-color 0.2s' }} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#888', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracking.label')}</label>
        <input type="text" value={label} onChange={e => setLabel(e.target.value)}
          style={{ width: '100%', background: '#f0ebe2', border: '1px solid #d5cfc4', color: '#2d2d2d', padding: '8px 10px', fontSize: 12, borderRadius: 6, outline: 'none', transition: 'border-color 0.2s' }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#888', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('tracking.speed', { n: speed })}
        </label>
        <input type="range" min="0.5" max="10" step="0.5" value={speed} onChange={e => setSpeed(+e.target.value)}
          style={{ width: '100%' }} />
      </div>

      {connState === 'idle' && (
        <button onClick={handleStart} disabled={loading}
          style={{
            background: loading ? '#c9c0b0' : 'linear-gradient(135deg, #5238e1, #3d29b0)',
            color: '#fff', padding: '9px 20px', fontSize: 12, fontWeight: 600, borderRadius: 6,
            cursor: loading ? 'default' : 'pointer', border: 'none', opacity: loading ? 0.6 : 1,
            width: '100%',
            boxShadow: loading ? 'none' : '0 2px 8px rgba(82,56,225,0.3)',
          }}>
          {loading ? t('tracking.creating') : t('tracking.startTracking')}
        </button>
      )}

      {connState === 'created' && (
        <div style={{ background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)', color: '#2e7d32', padding: 10, marginBottom: 8, borderRadius: 8, fontSize: 12, border: '1px solid #a5d6a7' }}>
          <span style={{ fontWeight: 700 }}>{t('tracking.created')}</span>
          <span style={{ color: '#43a047' }}> {t('tracking.startingStream')}</span>
        </div>
      )}

      {connState === 'connected' && (
        <div style={{ background: '#f0ebe2', padding: 10, marginBottom: 8, borderRadius: 8, fontSize: 12, border: '1px solid #c9c0b0' }}>
          <div style={{ color: '#27ae60', fontWeight: 600 }}>{t('tracking.connected')}</div>
        </div>
      )}

      {connState === 'arrived' && (
        <div style={{ background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)', color: '#2e7d32', padding: 10, marginBottom: 8, borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #a5d6a7' }}>
          {t('tracking.arrived')}
        </div>
      )}

      {connState.startsWith('error') && (
        <div style={{ background: '#fce4ec', color: '#5238e1', padding: 10, marginBottom: 8, borderRadius: 8, fontSize: 12, border: '1px solid #ef9a9a' }}>
          {connState === 'error' ? t('tracking.connectionError') : connState.slice(6)}
        </div>
      )}

      {apiToken && connState !== 'idle' && (
        <div style={{ background: '#e8eaf6', border: '1px solid #90caf9', padding: 10, marginTop: 8, borderRadius: 8, fontSize: 12 }}>
          <div style={{ color: '#777', marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('tracking.deviceApiToken')}
          </div>
          <div style={{ color: '#5238e1', fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all', marginBottom: 6 }}>
            {apiToken}
          </div>
          <div style={{ color: '#5a6a8a', fontSize: 10 }}>
            {t('tracking.postTo', { n: '/api/tracking/report' })}
          </div>
          <pre style={{ color: '#666', fontSize: 10, marginTop: 4, whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
            {JSON.stringify({ tracker_id: trackerId, api_token: apiToken, lat: 25.2048, lng: 55.2708 }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
