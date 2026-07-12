'use client'

import { useState, useEffect, useRef } from 'react'
import useDraggablePoints from '@/hooks/useDraggablePoints'
import { useTranslation } from '@/lib/i18n'
import { POINT1, POINT2 } from '@/lib/defaults'

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
    { lat: startLat, lng: startLng, setLat: setStartLat, setLng: setStartLng, color: '#27ae60', label: t('routing.start') },
    { lat: endLat, lng: endLng, setLat: setEndLat, setLng: setEndLng, color: '#3498db', label: t('routing.destination') },
    { lat: isoLat, lng: isoLng, setLat: setIsoLat, setLng: setIsoLng, color: '#9b59b6', label: tEn('routing.isoCenter') },
  ])

  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    return () => {
      const map = (window as any).__map as L.Map | undefined
      if (layerRef.current) { map?.removeLayer(layerRef.current); layerRef.current = null }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const L = window.L
    const map = (window as any).__map as L.Map | undefined
    if (!L || !map) return

    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map)
    }

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
      const orsColor = bothExist && orsDist <= osrmDist ? '#27ae60' : '#5238e1'
      L.polyline(coords, { color: orsColor, weight: 4, opacity: 0.8 }).addTo(layer)
    }

    if (osrmRoute?.geometry?.coordinates) {
      const coords = osrmRoute.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number])
      const osrmColor = bothExist && osrmDist <= orsDist ? '#27ae60' : '#5238e1'
      L.polyline(coords, { color: osrmColor, weight: 4, opacity: 0.8, dashArray: '8 4' }).addTo(layer)
    }

    const iso = results.isochrone
    if (iso?.features) {
      iso.features.forEach((f: any) => {
        if (f.geometry?.coordinates) {
          const ring = f.geometry.coordinates[0]?.map((c: number[]) => [c[1], c[0]] as [number, number])
          if (ring) {
            L.polygon(ring, { color: '#9b59b6', weight: 2, fillColor: '#9b59b6', fillOpacity: 0.15 }).addTo(layer)
          }
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
      if (pts.length > 0) map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 15 })
    }

    return () => {
      layer.clearLayers()
    }
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
    } catch (e: any) {
      setResults({ error: e.message })
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
    } catch (e: any) {
      setResults((prev: any) => ({ ...prev, isochrone: { error: e.message } }))
    } finally {
      setIsoLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ color: '#1a1a1a', marginBottom: 4, fontSize: 18, fontWeight: 700 }}>{t('routing.title')}</h2>
      <p style={{ color: '#777', marginBottom: 16, fontSize: 12, lineHeight: 1.5 }}>{t('routing.desc')}</p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#888', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('routing.start')}
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
          {t('routing.destination')}
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
        <label style={{ color: '#888', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('routing.profile')}</label>
        <select value={profile} onChange={e => setProfile(e.target.value)}
          style={{ width: '100%', background: '#f0ebe2', border: '1px solid #d5cfc4', color: '#2d2d2d', padding: '8px 10px', fontSize: 12, borderRadius: 6, outline: 'none', transition: 'border-color 0.2s' }}>
          <option value="driving-car">{t('routing.car')}</option>
          <option value="cycling-regular">{t('routing.bicycle')}</option>
          <option value="foot-walking">{t('routing.walking')}</option>
        </select>
      </div>

      <button onClick={handleCompare} disabled={loading}
        style={{
          background: loading ? '#c9c0b0' : 'linear-gradient(135deg, #5238e1, #3d29b0)',
          color: '#fff', padding: '9px 20px', fontSize: 12, fontWeight: 600, borderRadius: 6,
          cursor: loading ? 'default' : 'pointer', border: 'none', opacity: loading ? 0.6 : 1,
          width: '100%',
          boxShadow: loading ? 'none' : '0 2px 8px rgba(82,56,225,0.3)',
        }}>
        {loading ? t('routing.loading') : t('routing.compare')}
      </button>

      <hr style={{ border: 'none', borderTop: '1px solid #d5cfc4', marginTop: 16, marginBottom: 16 }} />

      <h3 style={{ color: '#1a1a1a', marginBottom: 8, fontSize: 16, fontWeight: 700 }}>{tEn('routing.isochroneTitle')}</h3>
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#888', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {tEn('routing.center')}
          {clickedPos && (
            <span style={{ marginLeft: 8, fontSize: 10, cursor: 'pointer', color: '#5238e1', fontWeight: 400, textTransform: 'none' }}
              onClick={() => { setIsoLat(parseFloat(clickedPos.lat)); setIsoLng(parseFloat(clickedPos.lng)) }}>
              {t('osm.useClicked')}
            </span>
          )}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" value={isoLat} step="0.0001" onChange={e => setIsoLat(+e.target.value)}
            style={{ flex: 1, minWidth: 0, background: '#f0ebe2', border: '1px solid #d5cfc4', color: '#2d2d2d', padding: '8px 6px', fontSize: 12, borderRadius: 6, outline: 'none', lineHeight: 1, transition: 'border-color 0.2s' }} />
          <input type="number" value={isoLng} step="0.0001" onChange={e => setIsoLng(+e.target.value)}
            style={{ flex: 1, minWidth: 0, background: '#f0ebe2', border: '1px solid #d5cfc4', color: '#2d2d2d', padding: '8px 6px', fontSize: 12, borderRadius: 6, outline: 'none', lineHeight: 1, transition: 'border-color 0.2s' }} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#888', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {tEn('routing.time', { n: isoRange })}
        </label>
        <input type="range" min="1" max="30" step="1" value={isoRange} onChange={e => setIsoRange(+e.target.value)}
          style={{ width: '100%' }} />
      </div>

      <button onClick={handleIsochrone} disabled={isoLoading}
        style={{
          background: isoLoading ? '#c9c0b0' : 'linear-gradient(135deg, #9b59b6, #8e44ad)',
          color: '#fff', padding: '9px 20px', fontSize: 12, fontWeight: 600, borderRadius: 6,
          cursor: isoLoading ? 'default' : 'pointer', border: 'none', opacity: isoLoading ? 0.6 : 1,
          width: '100%',
          boxShadow: isoLoading ? 'none' : '0 2px 8px rgba(155,89,182,0.3)',
        }}>
        {isoLoading ? tEn('routing.generating') : tEn('routing.generate')}
      </button>

      {results && !results.error && (
        <div style={{ background: '#f0ebe2', padding: 10, marginTop: 8, borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
          <div style={{ color: '#777', fontSize: 11, marginBottom: 6 }}>{t('routing.results')}</div>
          {results.ors?.features && (
            <div style={{ color: '#2d2d2d', fontSize: 12, paddingTop: 4, paddingBottom: 4 }}>
              {t('routing.ors', { n: ((results.ors.features[0]?.properties?.summary?.distance || 0) / 1000).toFixed(1) })}
            </div>
          )}
          {results.osrm?.routes && (
            <div style={{ color: '#2d2d2d', fontSize: 12, paddingTop: 4, paddingBottom: 4 }}>
              {t('routing.osrm', { n: (results.osrm.routes[0]?.distance / 1000).toFixed(1) })}
            </div>
          )}
          {results.isochrone?.error && (
            <div style={{ color: '#5238e1', fontSize: 12, paddingTop: 4, paddingBottom: 4 }}>{results.isochrone.error}</div>
          )}
        </div>
      )}
      {results?.error && (
        <div style={{ background: '#f3e5f5', color: '#5238e1', padding: 10, marginTop: 8, borderRadius: 8, fontSize: 12, border: '1px solid #d5cfc4' }}>
          {results.error}
        </div>
      )}
    </div>
  )
}
