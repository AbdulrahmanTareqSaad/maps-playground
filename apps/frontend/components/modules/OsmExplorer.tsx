'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import useDraggablePoints from '@/hooks/useDraggablePoints'
import { createPinIcon } from '@/lib/markerIcons'
import { useTranslation } from '@/lib/i18n'
import { POINT1 } from '@/lib/defaults'

const amenityList: { value: string; labelKey: string }[] = [
  { value: 'cafe', labelKey: 'cafes' },
  { value: 'fuel', labelKey: 'fuel' },
  { value: 'parking', labelKey: 'parking' },
  { value: 'pharmacy', labelKey: 'pharmacies' },
  { value: 'hospital', labelKey: 'hospitals' },
  { value: 'school', labelKey: 'schools' },
  { value: 'atm', labelKey: 'atms' },
  { value: 'bus_stop', labelKey: 'busStops' },
  { value: 'charging', labelKey: 'charging' },
  { value: 'custom', labelKey: 'custom' },
]

export default function OsmExplorer({
  clickedPos,
}: {
  clickedPos?: { lat: string; lng: string } | null
}) {
  const { t } = useTranslation()
  const [lat, setLat] = useState(POINT1.lat)
  const [lng, setLng] = useState(POINT1.lng)
  const [radius, setRadius] = useState(1)
  const [amenity, setAmenity] = useState('cafe')
  const [customQuery, setCustomQuery] = useState(
    '[out:json];node["amenity"="library"]({bbox});out geom;'
  )
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [selectedResult, setSelectedResult] = useState<number | null>(null)
  const [hoveredResult, setHoveredResult] = useState<number | null>(null)
  const resultMarkersRef = useRef<L.Marker[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [geocodeResults, setGeocodeResults] = useState<any[]>([])
  const [geocodeLoading, setGeocodeLoading] = useState(false)
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      const map = (window as any).__map as L.Map | undefined
      if (!map) return
      resultMarkersRef.current.forEach((m) => map.removeLayer(m))
      resultMarkersRef.current = []
    }
  }, [])

  useDraggablePoints([
    { lat, lng, setLat, setLng, color: '#5238e1', label: t('osm.searchCenter') },
  ])

  const colors = useMemo(() => {
    if (!results?.features) return []
    return results.features
      .filter((f: any) => f.lat != null && f.lon != null)
      .map((_: any, i: number) =>
        selectedResult === i ? '#27ae60' : hoveredResult === i ? '#2ecc71' : '#5238e1'
      )
  }, [results, selectedResult, hoveredResult])

  useEffect(() => {
    const L = window.L
    const map = (window as any).__map as L.Map | undefined
    if (!L || !map) return

    const old = resultMarkersRef.current
    resultMarkersRef.current = []

    if (!results?.features) {
      old.forEach((m) => map.removeLayer(m))
      return
    }

    const features = results.features.filter((f: any) => f.lat != null && f.lon != null)
    const newMarkers: L.Marker[] = []

    features.forEach((f: any, i: number) => {
      const existing = old[i]
      if (existing) {
        existing.setLatLng([f.lat, f.lon])
        existing.setIcon(createPinIcon(colors[i]))
        const label = f.tags?.name || f.tags?.amenity || f.tags?.highway || f.type
        existing.unbindTooltip()
        if (label) {
          existing.bindTooltip(label, { direction: 'top', className: 'map-result-tooltip' })
        }
        newMarkers.push(existing)
      } else {
        const marker = L.marker([f.lat, f.lon], {
          icon: createPinIcon(colors[i]),
        }).addTo(map)
        const label = f.tags?.name || f.tags?.amenity || f.tags?.highway || f.type
        if (label) {
          marker.bindTooltip(label, {
            direction: 'top',
            className: 'map-result-tooltip',
          })
        }
        newMarkers.push(marker)
      }
    })

    for (let i = features.length; i < old.length; i++) {
      map.removeLayer(old[i])
    }

    resultMarkersRef.current = newMarkers

    if (newMarkers.length >= 2) {
      map.fitBounds(
        L.latLngBounds(newMarkers.map((m) => m.getLatLng())),
        { padding: [50, 50], maxZoom: 15 },
      )
    } else if (newMarkers.length === 1) {
      map.setView(newMarkers[0].getLatLng(), 15)
    }

    return () => {
      newMarkers.forEach((m) => map.removeLayer(m))
    }
  }, [results])

  useEffect(() => {
    resultMarkersRef.current.forEach((m, i) => {
      if (colors[i]) m.setIcon(createPinIcon(colors[i]))
    })
  }, [colors])

  const handleGeocode = async (q: string) => {
    if (!q || q.trim().length < 2) {
      setGeocodeResults([])
      return
    }
    setGeocodeLoading(true)
    try {
      const resp = await fetch(`/api/osm/geocode?q=${encodeURIComponent(q)}&limit=5`)
      const data = await resp.json()
      setGeocodeResults(data.results || [])
    } catch {
      setGeocodeResults([])
    } finally {
      setGeocodeLoading(false)
    }
  }

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value)
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    geocodeTimerRef.current = setTimeout(() => handleGeocode(value), 400)
  }

  const handleSelectGeocode = (r: any) => {
    setLat(r.lat)
    setLng(r.lon)
    setSearchQuery('')
    setGeocodeResults([])
    const map = (window as any).__map as L.Map | undefined
    if (map) map.flyTo([r.lat, r.lon], 14, { duration: 0.6 })
  }

  useEffect(() => {
    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    }
  }, [])

  const handleSearch = async () => {
    setLoading(true)
    setResults(null)
    try {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), radius_km: String(radius), amenity })
      if (amenity === 'custom') params.set('custom_query', customQuery)
      const resp = await fetch(`/api/osm/query?${params}`)
      const data = await resp.json()
      setResults(data)
    } catch (e: any) {
      setResults({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ color: '#fff', marginBottom: 4, fontSize: 18, fontWeight: 700 }}>{t('osm.title')}</h2>
      <p style={{ color: '#8892a8', marginBottom: 16, fontSize: 12, lineHeight: 1.5 }}>{t('osm.desc')}</p>

      <div style={{ marginBottom: 12, position: 'relative' }}>
        <label style={{ color: '#aaa', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('osm.searchLocation')}
        </label>
        <input type="text" value={searchQuery} placeholder={t('osm.searchPlaceholder')}
          onChange={e => handleSearchQueryChange(e.target.value)}
          style={{ width: '100%', background: '#16213e', border: '1px solid #2d1b8e', color: '#e0e0e0', padding: '8px 10px', fontSize: 12, borderRadius: 6, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }} />
        {geocodeResults.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
            background: '#16213e', border: '1px solid #2d1b8e', borderRadius: 6, marginTop: 4,
            maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}>
            {geocodeResults.map((r: any, i: number) => (
              <div key={i} onClick={() => handleSelectGeocode(r)}
                style={{
                  padding: '8px 10px', cursor: 'pointer', fontSize: 11, color: '#e0e0e0',
                  borderBottom: i < geocodeResults.length - 1 ? '1px solid #2d1b8e' : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,27,142,0.5)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{r.displayName?.split(',')[0]}</div>
                <div style={{ color: '#5a6a8a', fontSize: 10 }}>
                  {r.lat?.toFixed(4)}, {r.lon?.toFixed(4)} — {r.category}{r.type ? ` / ${r.type}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
        {geocodeLoading && (
          <div style={{ color: '#5a6a8a', fontSize: 11, marginTop: 4 }}>{t('osm.searching')}</div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#aaa', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('osm.location')}
          {clickedPos && (
            <span style={{ marginLeft: 8, fontSize: 10, cursor: 'pointer', color: '#5238e1', fontWeight: 400, textTransform: 'none' }}
              onClick={() => { setLat(parseFloat(clickedPos.lat)); setLng(parseFloat(clickedPos.lng)) }}>
              {t('osm.useClicked')}
            </span>
          )}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" value={lat} step="0.0001" onChange={e => setLat(+e.target.value)}
            style={{ flex: 1, minWidth: 0, background: '#16213e', border: '1px solid #2d1b8e', color: '#e0e0e0', padding: '8px 6px', fontSize: 12, borderRadius: 6, outline: 'none', lineHeight: 1, boxSizing: 'border-box', transition: 'border-color 0.2s' }} />
          <input type="number" value={lng} step="0.0001" onChange={e => setLng(+e.target.value)}
            style={{ flex: 1, minWidth: 0, background: '#16213e', border: '1px solid #2d1b8e', color: '#e0e0e0', padding: '8px 6px', fontSize: 12, borderRadius: 6, outline: 'none', lineHeight: 1, boxSizing: 'border-box', transition: 'border-color 0.2s' }} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#aaa', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('osm.radius', { n: radius.toFixed(1) })}
        </label>
        <input type="range" min="0.1" max="5" step="0.1" value={radius} onChange={e => setRadius(+e.target.value)}
          style={{ width: '100%' }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#aaa', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('osm.amenity')}</label>
        <select value={amenity} onChange={e => setAmenity(e.target.value)}
          style={{ width: '100%', background: '#16213e', border: '1px solid #2d1b8e', color: '#e0e0e0', padding: '8px 10px', fontSize: 12, borderRadius: 6, outline: 'none', transition: 'border-color 0.2s' }}>
          {amenityList.map(a => <option key={a.value} value={a.value}>{t('osm.' + a.labelKey)}</option>)}
        </select>
      </div>

      {amenity === 'custom' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#aaa', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('osm.overpassQl')}</label>
          <textarea value={customQuery} onChange={e => setCustomQuery(e.target.value)} rows={3}
            style={{ width: '100%', background: '#16213e', border: '1px solid #2d1b8e', color: '#e0e0e0', padding: '8px 10px', fontSize: 12, borderRadius: 6, outline: 'none', fontFamily: 'monospace', transition: 'border-color 0.2s' }} />
        </div>
      )}

      <button onClick={handleSearch} disabled={loading}
        style={{
          background: loading ? '#1a2a4a' : 'linear-gradient(135deg, #5238e1, #3d29b0)',
          color: '#fff', padding: '9px 20px', fontSize: 12, fontWeight: 600, borderRadius: 6,
          cursor: loading ? 'default' : 'pointer', border: 'none', opacity: loading ? 0.6 : 1,
          width: '100%',
          boxShadow: loading ? 'none' : '0 2px 8px rgba(82,56,225,0.3)',
        }}>
        {loading ? t('osm.searching') : t('osm.search')}
      </button>

      {results && (
        <div style={{ background: '#16213e', padding: 10, marginTop: 8, borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
          <div style={{ color: '#8892a8', fontSize: 11, marginBottom: 6 }}>
            {results.error ? t('osm.error') : t('osm.results', { n: results.features?.length || 0 })}
          </div>
          {results.error && <div style={{ color: '#5238e1', fontSize: 11 }}>{results.error}</div>}
          {results.features?.slice(0, 50).map((el: any, i: number) => (
            <div key={i}
              onClick={() => {
                setSelectedResult(i)
                const map = (window as any).__map as L.Map | undefined
                if (map) map.flyTo([el.lat, el.lon], 17, { duration: 0.6 })
              }}
              onMouseEnter={() => setHoveredResult(i)}
              onMouseLeave={() => setHoveredResult(null)}
              style={{
                padding: '7px 8px', fontSize: 12, cursor: 'pointer',
                background: selectedResult === i ? '#2d1b8e' : hoveredResult === i ? 'rgba(45,27,142,0.5)' : 'transparent',
                borderRadius: 4, marginBottom: 2,
                transition: 'background 0.15s',
              }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                color: selectedResult === i ? '#5238e1' : '#e0e0e0',
                fontWeight: selectedResult === i ? 600 : 400,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: selectedResult === i ? '#27ae60' : hoveredResult === i ? '#2ecc71' : '#5238e1',
                  flexShrink: 0, transition: 'background 0.15s',
                }} />
                {el.tags?.name || el.tags?.amenity || el.type}
              </div>
              <div style={{ color: '#5a6a8a', fontSize: 10, marginTop: 1, marginLeft: 12 }}>
                {el.lat?.toFixed(4)}, {el.lon?.toFixed(4)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
