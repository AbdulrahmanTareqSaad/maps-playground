/**
 * OsmExplorer module — search OpenStreetMap features by amenity type and radius using the
 * Overpass API. Geocodes locations via /api/osm/geocode, queries POIs via /api/osm/query,
 * supports custom Overpass QL, voice search, GPS geolocation, and interactive result markers
 * with fly-to navigation on the Leaflet map.
 */

'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import useDraggablePoints from '@/hooks/useDraggablePoints'
import { createPinIcon } from '@/lib/markerIcons'
import { useTranslation } from '@/lib/i18n'
import { POINT1 } from '@/lib/defaults'
import { getMap, getLeaflet } from '@/lib/map'
import { colors, mapDefaults, fontSizes } from '@/lib/theme'
import type { OsmResult } from '@/types'
import VoiceButton from '@/components/VoiceButton'
import {
  SectionTitle, Subtitle, Label, Input, NumberInput, Button,
  FieldGroup, ResultsBox, CoordInput,
} from '@/components/ui'

const amenityList: { value: string; labelKey: string }[] = [
  { value: 'none', labelKey: 'none' },
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
  initLoc,
}: {
  clickedPos?: { lat: string; lng: string } | null
  initLoc?: { lat: number; lng: number } | null
}) {
  const { t, lang } = useTranslation()
  const [lat, setLat] = useState(initLoc?.lat ?? POINT1.lat)
  const [lng, setLng] = useState(initLoc?.lng ?? POINT1.lng)
  const [radius, setRadius] = useState(1)
  const [amenity, setAmenity] = useState('none')
  const [customQuery, setCustomQuery] = useState('[out:json];node["amenity"="library"]({bbox});out geom;')
  const [results, setResults] = useState<OsmResult & { error?: string; note?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedResult, setSelectedResult] = useState<number | null>(null)
  const [hoveredResult, setHoveredResult] = useState<number | null>(null)
  const resultMarkersRef = useRef<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [geocodeResults, setGeocodeResults] = useState<any[]>([])
  const [geocodeLoading, setGeocodeLoading] = useState(false)
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(initLoc ?? null)
  const gpsPromptedRef = useRef(false)
  const gpsMarkerRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      const map = getMap()
      if (!map) return
      resultMarkersRef.current.forEach((m: any) => map.removeLayer(m))
      resultMarkersRef.current = []
      if (gpsMarkerRef.current) { map.removeLayer(gpsMarkerRef.current); gpsMarkerRef.current = null }
    }
  }, [])

  useEffect(() => {
    if (gpsPromptedRef.current) return
    gpsPromptedRef.current = true

    if (initLoc) {
      const L = getLeaflet()
      const map = getMap()
      if (L && map) {
        gpsMarkerRef.current = L.circleMarker([initLoc.lat, initLoc.lng], {
          radius: 8, color: colors.success, fillColor: colors.success, fillOpacity: 0.8, weight: 2,
        }).addTo(map)
        map.flyTo([initLoc.lat, initLoc.lng], mapDefaults.flyZoom, { duration: mapDefaults.flyDuration })
      }
      return
    }

    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLoc(loc)
        setLat(loc.lat)
        setLng(loc.lng)
        const L = getLeaflet()
        const map = getMap()
        if (!L || !map) return
        if (gpsMarkerRef.current) gpsMarkerRef.current.setLatLng([loc.lat, loc.lng])
        else gpsMarkerRef.current = L.circleMarker([loc.lat, loc.lng], { radius: 8, color: colors.success, fillColor: colors.success, fillOpacity: 0.8, weight: 2 }).addTo(map)
        map.flyTo([loc.lat, loc.lng], mapDefaults.flyZoom, { duration: mapDefaults.flyDuration })
      },
      () => {},
      { enableHighAccuracy: false, timeout: mapDefaults.gpsTimeout, maximumAge: mapDefaults.gpsMaxAge }
    )
  }, [initLoc])

  useDraggablePoints([{ lat, lng, setLat, setLng, color: colors.accent }])

  const colors_ = useMemo(() => {
    if (!results?.features) return []
    return results.features
      .filter((f) => f.lat != null && f.lon != null)
      .map((_: any, i: number) =>
        selectedResult === i ? colors.warning : hoveredResult === i ? '#f39c12' : '#e74c3c'
      )
  }, [results, selectedResult, hoveredResult])

  useEffect(() => {
    const L = getLeaflet()
    const map = getMap()
    if (!L || !map) return
    const old = resultMarkersRef.current
    resultMarkersRef.current = []
    if (!results?.features) { old.forEach((m: any) => map.removeLayer(m)); return }

    const features = results.features.filter((f) => f.lat != null && f.lon != null)
    const newMarkers: any[] = []

    features.forEach((f, i) => {
      const existing = old[i]
      if (existing) {
        existing.setLatLng([f.lat, f.lon])
        existing.setIcon(createPinIcon(colors_[i]))
        existing.unbindTooltip()
        const label = f.tags?.name || f.tags?.amenity || f.tags?.highway || f.type
        if (label) existing.bindTooltip(label, { direction: 'top', className: 'map-result-tooltip' })
        if (!map.hasLayer(existing)) existing.addTo(map)
        newMarkers.push(existing)
      } else {
        const marker = L.marker([f.lat, f.lon], { icon: createPinIcon(colors_[i]) }).addTo(map)
        const label = f.tags?.name || f.tags?.amenity || f.tags?.highway || f.type
        if (label) marker.bindTooltip(label, { direction: 'top', className: 'map-result-tooltip' })
        newMarkers.push(marker)
      }
    })

    for (let i = features.length; i < old.length; i++) map.removeLayer(old[i])
    resultMarkersRef.current = newMarkers

    if (newMarkers.length >= 2) map.fitBounds(L.latLngBounds(newMarkers.map((m: any) => m.getLatLng())), { padding: mapDefaults.fitBoundsPadding, maxZoom: mapDefaults.fitBoundsMaxZoom })
    else if (newMarkers.length === 1) map.setView(newMarkers[0].getLatLng(), mapDefaults.fitBoundsMaxZoom)

    return () => { newMarkers.forEach((m: any) => map.removeLayer(m)) }
  }, [results])

  useEffect(() => {
    resultMarkersRef.current.forEach((m: any, i: number) => { if (colors_[i]) m.setIcon(createPinIcon(colors_[i])) })
  }, [colors_])

  const buildGeoParams = (q: string, limit: string, overrideLang?: string) => {
    const params = new URLSearchParams({ q, limit, lang: overrideLang || lang })
    if (userLoc) { params.set('lat', String(userLoc.lat)); params.set('lng', String(userLoc.lng)) }
    return params
  }

  const handleGeocode = async (q: string) => {
    if (!q || q.trim().length < 2) { setGeocodeResults([]); return }
    setGeocodeLoading(true)
    try {
      const resp = await fetch(`/api/osm/geocode?${buildGeoParams(q, '5')}`)
      const data = await resp.json()
      setGeocodeResults(data.results || [])
    } catch { setGeocodeResults([]) }
    finally { setGeocodeLoading(false) }
  }

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value)
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    geocodeTimerRef.current = setTimeout(() => handleGeocode(value), mapDefaults.searchDebounceMs)
  }

  const handleVoiceSearch = async (text: string, detectedLang?: string) => {
    setSearchQuery(text)
    setGeocodeLoading(true)
    try {
      const resp = await fetch(`/api/osm/geocode?${buildGeoParams(text, '5', detectedLang)}`)
      const data = await resp.json()
      const res = data.results || []
      setGeocodeResults(res)
      if (res.length > 0) {
        setLat(res[0].lat); setLng(res[0].lon)
        getMap()?.flyTo([res[0].lat, res[0].lon], 14, { duration: mapDefaults.flyDuration })
        if (amenity === 'none') { setResults({ count: 0, features: [], bbox: '', note: 'Location found' }); return }
        setLoading(true); setResults(null)
        try {
          const params = new URLSearchParams({ lat: String(res[0].lat), lng: String(res[0].lon), radius_km: String(radius), amenity })
          if (amenity === 'custom') params.set('custom_query', customQuery)
          setResults(await (await fetch(`/api/osm/query?${params}`)).json())
        } catch (e: unknown) { setResults({ error: e instanceof Error ? e.message : 'Failed', count: 0, features: [], bbox: '' }) }
        finally { setLoading(false) }
      }
    } catch { setGeocodeResults([]) }
    finally { setGeocodeLoading(false) }
  }

  const handleSelectGeocode = async (r: any) => {
    setLat(r.lat); setLng(r.lon); setSearchQuery(''); setGeocodeResults([])
    getMap()?.flyTo([r.lat, r.lon], 14, { duration: mapDefaults.flyDuration })
    if (amenity !== 'none') {
      setResults(null)
      try {
        const params = new URLSearchParams({ lat: String(r.lat), lng: String(r.lon), radius_km: String(radius), amenity })
        if (amenity === 'custom') params.set('custom_query', customQuery)
        setResults(await (await fetch(`/api/osm/query?${params}`)).json())
      } catch (e: unknown) { setResults({ error: e instanceof Error ? e.message : 'Failed', count: 0, features: [], bbox: '' }) }
    }
  }

  useEffect(() => { return () => { if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current) } }, [])

  const handleSearch = async () => {
    setLoading(true); setResults(null)
    let searchLat = lat, searchLng = lng
    try {
      if (searchQuery.trim().length >= 2) {
        const resp = await fetch(`/api/osm/geocode?${buildGeoParams(searchQuery, '1')}`)
        const data = await resp.json()

        console.log('Geocode response:', data)
        const geoRes = data.results || []
        if (geoRes.length > 0) {
          searchLat = geoRes[0].lat; searchLng = geoRes[0].lon
          setLat(searchLat); setLng(searchLng)
          getMap()?.flyTo([searchLat, searchLng], 14, { duration: mapDefaults.flyDuration })
        }
        setGeocodeResults(geoRes)
      }
      if (amenity === 'none') { setResults({ count: 0, features: [], bbox: '', note: 'Location found' }); return }
      const params = new URLSearchParams({ lat: String(searchLat), lng: String(searchLng), radius_km: String(radius), amenity })
      if (amenity === 'custom') params.set('custom_query', customQuery)
      setResults(await (await fetch(`/api/osm/query?${params}`)).json())
    } catch (e: unknown) { setResults({ error: e instanceof Error ? e.message : 'Failed', count: 0, features: [], bbox: '' }) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <SectionTitle>{t('osm.title')}</SectionTitle>
      <Subtitle>{t('osm.desc')}</Subtitle>

      <FieldGroup label={t('osm.searchLocation')}>
        <div style={{ position: 'relative' }}>
          <Input
            type="text" value={searchQuery} placeholder={t('osm.searchPlaceholder')}
            onChange={e => handleSearchQueryChange(e.target.value)}
            full
            style={{ padding: lang === 'ar' ? '8px 10px 8px 90px' : '8px 90px 8px 10px' }}
          />
          <VoiceButton
            onTranscript={(text) => handleVoiceSearch(text)}
            onError={(err) => console.error('Voice error:', err)}
          />
          {geocodeResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
              background: colors.bgSecondary, border: `1px solid ${colors.border}`, borderRadius: 6, marginTop: 4,
              maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>
              {geocodeResults.map((r: any, i: number) => (
                <div key={i} onClick={() => handleSelectGeocode(r)}
                  style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 11, color: colors.textPrimary, borderBottom: i < geocodeResults.length - 1 ? `1px solid ${colors.border}` : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = colors.accentHoverAlpha}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{r.displayName?.split(',')[0]}</div>
                  <div style={{ color: colors.textFaint, fontSize: 10 }}>
                    {r.lat?.toFixed(4)}, {r.lon?.toFixed(4)} — {r.category}{r.type ? ` / ${r.type}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {geocodeLoading && <div style={{ color: colors.textFaint, fontSize: 11, marginTop: 4 }}>{t('osm.searching')}</div>}
      </FieldGroup>

      <FieldGroup label={t('osm.location')} hint={clickedPos ? t('osm.useClicked') : undefined}>
        <CoordInput lat={lat} lng={lng} onLatChange={setLat} onLngChange={setLng} />
      </FieldGroup>

      <FieldGroup label={t('osm.radius', { n: radius.toFixed(1) })}>
        <input type="range" min="0.1" max="5" step="0.1" value={radius} onChange={e => setRadius(+e.target.value)}
          style={{ width: '100%' }} />
      </FieldGroup>

      <FieldGroup label={t('osm.amenity')}>
        <select value={amenity} onChange={e => setAmenity(e.target.value)}
          style={{ width: '100%', background: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.textPrimary, padding: '8px 10px', fontSize: 12, borderRadius: 6, outline: 'none', transition: 'border-color 0.2s' }}>
          {amenityList.map(a => <option key={a.value} value={a.value}>{t('osm.' + a.labelKey)}</option>)}
        </select>
      </FieldGroup>

      {amenity === 'custom' && (
        <FieldGroup label={t('osm.overpassQl')}>
          <textarea value={customQuery} onChange={e => setCustomQuery(e.target.value)} rows={3}
            style={{ width: '100%', background: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.textPrimary, padding: '8px 10px', fontSize: 12, borderRadius: 6, outline: 'none', fontFamily: 'monospace', transition: 'border-color 0.2s' }} />
        </FieldGroup>
      )}

      <Button fullWidth loading={loading} disabled={!searchQuery.trim() && amenity === 'none'} onClick={handleSearch}>
        {loading ? t('osm.searching') : t('osm.search')}
      </Button>

      {results && (
        <ResultsBox title={results.error ? t('osm.error') : t('osm.results', { n: results.features?.length || 0 })}>
          {results.error && <div style={{ color: colors.accent, fontSize: 12 }}>{results.error}</div>}
          {results.features?.slice(0, mapDefaults.maxDisplayResults).map((el, i) => (
            <div key={i}
              onClick={() => { setSelectedResult(i); getMap()?.flyTo([el.lat, el.lon], 17, { duration: mapDefaults.flyDuration }) }}
              onMouseEnter={() => setHoveredResult(i)}
              onMouseLeave={() => setHoveredResult(null)}
              style={{ padding: '7px 8px', fontSize: 12, cursor: 'pointer', background: selectedResult === i ? colors.border : hoveredResult === i ? colors.accentHoverAlpha : 'transparent', borderRadius: 4, marginBottom: 2, transition: 'background 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: selectedResult === i ? colors.accent : colors.textPrimary, fontWeight: selectedResult === i ? 600 : 400 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedResult === i ? colors.success : hoveredResult === i ? colors.successLight : colors.accent, flexShrink: 0, transition: 'background 0.15s' }} />
                {el.tags?.name || el.tags?.amenity || el.type}
              </div>
              <div style={{ color: colors.textFaint, fontSize: 10, marginTop: 1, marginLeft: 12 }}>
                {el.lat?.toFixed(4)}, {el.lon?.toFixed(4)}
              </div>
            </div>
          ))}
        </ResultsBox>
      )}
    </div>
  )
}
