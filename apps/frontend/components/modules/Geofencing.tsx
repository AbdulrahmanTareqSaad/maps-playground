/**
 * Geofencing module — create, save, list, and delete geofence polygon zones on a Leaflet map.
 * Provides point-in-polygon checking via /api/geofence/* endpoints (create, list, check, delete).
 * Supports interactive polygon drawing via map clicks, draggable check-points, and zone visualization.
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import useDraggablePoints from '@/hooks/useDraggablePoints'
import { useTranslation } from '@/lib/i18n'
import { POINT1 } from '@/lib/defaults'
import { getMap, getLeaflet } from '@/lib/map'
import { colors, gradients, mapDefaults } from '@/lib/theme'
import { GeofenceZone } from '@/types'
import {
  SectionTitle, Subtitle, Label, Input, Button, Divider,
  CoordInput, FieldGroup, StatusBanner, ResultsBox,
} from '@/components/ui'

export default function Geofencing({
  clickedPos,
}: {
  clickedPos?: { lat: string; lng: string } | null
}) {
  const { t } = useTranslation()
  const [fenceName, setFenceName] = useState('Delivery Zone A')
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState<Array<{ lat: number; lng: number }>>([])
  const [fences, setFences] = useState<GeofenceZone[]>([])
  const [checkLat, setCheckLat] = useState(POINT1.lat)
  const [checkLng, setCheckLng] = useState(POINT1.lng)
  const [checkResult, setCheckResult] = useState<{ inside: boolean; zone?: string } | null>(null)

  const drawLayerRef = useRef<any>(null)
  const fenceLayerRef = useRef<any>(null)
  const checkLayerRef = useRef<any>(null)

  useDraggablePoints([
    { lat: checkLat, lng: checkLng, setLat: setCheckLat, setLng: setCheckLng, color: colors.warning, label: t('geofence.checkPoint') },
  ])

  useEffect(() => {
    const L = getLeaflet()
    const map = getMap()
    if (!L || !map) return
    if (!fenceLayerRef.current) fenceLayerRef.current = L.layerGroup().addTo(map)
    const layer = fenceLayerRef.current
    layer.clearLayers()
    fences.forEach((f) => {
      if (!f.polygon || f.polygon.length < 3) return
      const coords = f.polygon.map((p) => [p.lat, p.lng] as [number, number])
      L.polygon(coords, { color: colors.warning, weight: 2, fillColor: colors.warning, fillOpacity: 0.12 }).addTo(layer)
    })
  }, [fences])

  useEffect(() => {
    const L = getLeaflet()
    const map = getMap()
    if (!L || !map) return
    if (!drawLayerRef.current) drawLayerRef.current = L.layerGroup().addTo(map)
    const layer = drawLayerRef.current
    layer.clearLayers()
    if (points.length < 2) {
      if (points.length === 1) {
        L.circleMarker([points[0].lat, points[0].lng], { radius: 5, color: colors.accent, fillColor: colors.accent, fillOpacity: 0.8 }).addTo(layer)
      }
      return
    }
    const coords = points.map((p) => [p.lat, p.lng] as [number, number])
    L.polyline(coords, { color: colors.accent, weight: 2, dashArray: '6 4' }).addTo(layer)
    points.forEach((p) => {
      L.circleMarker([p.lat, p.lng], { radius: 4, color: '#fff', fillColor: colors.accent, fillOpacity: 0.9, weight: 2 }).addTo(layer)
    })
    if (points.length >= 3) {
      L.polygon(coords, { color: colors.accent, weight: 1.5, fillColor: colors.accent, fillOpacity: 0.08 }).addTo(layer)
    }
  }, [points])

  useEffect(() => {
    if (!checkResult) return
    const L = getLeaflet()
    const map = getMap()
    if (!L || !map) return
    if (!checkLayerRef.current) checkLayerRef.current = L.layerGroup().addTo(map)
    const layer = checkLayerRef.current
    layer.clearLayers()
    const color = checkResult.inside ? colors.success : colors.accentDark
    L.circleMarker([checkLat, checkLng], { radius: 14, color, fillColor: color, fillOpacity: 0.25, weight: 3 }).addTo(layer)
    L.circleMarker([checkLat, checkLng], { radius: 6, color: '#fff', fillColor: color, fillOpacity: 1, weight: 2 }).addTo(layer)
  }, [checkResult, checkLat, checkLng])

  useEffect(() => {
    return () => {
      const map = getMap()
      if (drawLayerRef.current) { map?.removeLayer(drawLayerRef.current); drawLayerRef.current = null }
      if (fenceLayerRef.current) { map?.removeLayer(fenceLayerRef.current); fenceLayerRef.current = null }
      if (checkLayerRef.current) { map?.removeLayer(checkLayerRef.current); checkLayerRef.current = null }
    }
  }, [])

  const listFences = async () => {
    try {
      const resp = await fetch('/api/geofence/list')
      const data = await resp.json()
      setFences(data.zones || [])
    } catch (e) {
      console.error('Failed to list geofences:', e)
    }
  }

  useEffect(() => {
    fetch('/api/geofence/list')
      .then((r) => r.json())
      .then((data) => setFences(data.zones || []))
      .catch(() => {})
    const handler = (e: Event) => {
      if (!drawing) return
      const ce = e as CustomEvent<{ lat: number; lng: number }>
      setPoints((prev) => [...prev, { lat: ce.detail.lat, lng: ce.detail.lng }])
    }
    window.addEventListener('mapclick', handler)
    return () => window.removeEventListener('mapclick', handler)
  }, [drawing])

  const toggleDraw = () => {
    setDrawing((d) => !d)
    if (drawing) setPoints([])
  }

  const handleSave = async () => {
    if (points.length < 3) return
    try {
      await fetch('/api/geofence/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fenceName, polygon: points }),
      })
      setPoints([])
      await listFences()
    } catch (e) {
      console.error('Failed to save geofence:', e)
    }
  }

  const handleCheck = async () => {
    try {
      const resp = await fetch('/api/geofence/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: checkLat, lng: checkLng }),
      })
      const data = await resp.json()
      setCheckResult(data.inside ? { inside: true, zone: data.zone } : { inside: false })
    } catch (e: unknown) {
      setCheckResult({ inside: false })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/geofence/${id}`, { method: 'DELETE' })
      await listFences()
    } catch (e) {
      console.error('Failed to delete geofence:', e)
    }
  }

  return (
    <div>
      <SectionTitle>{t('geofence.title')}</SectionTitle>
      <Subtitle>{t('geofence.desc')}</Subtitle>

      <FieldGroup label={t('geofence.zoneName')}>
        <Input type="text" value={fenceName} onChange={e => setFenceName(e.target.value)} full />
      </FieldGroup>

      <p style={{
        color: drawing ? colors.accent : colors.textSecondary, fontSize: 11, marginBottom: 8,
        background: drawing ? colors.accentLightAlpha : 'transparent',
        padding: '6px 8px', borderRadius: 6,
      }}>
        {drawing ? t('geofence.drawing') : t('geofence.notDrawing')}
      </p>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <Button onClick={toggleDraw} style={drawing ? { background: colors.accentDark } : undefined}>
          {drawing ? t('geofence.cancelDraw') : t('geofence.draw')}
        </Button>
        {points.length >= 3 && (
          <Button variant="success" onClick={handleSave}>
            {t('geofence.save')}
          </Button>
        )}
      </div>

      {fences.length > 0 && (
        <ResultsBox title={t('geofence.savedZones')} maxHeight={120}>
          {fences.map((f) => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${colors.border}`, fontSize: 12, paddingTop: 4, paddingBottom: 4 }}>
              <span style={{ color: colors.textPrimary }}>{f.name}</span>
              <button onClick={() => handleDelete(f.id)} style={{ color: colors.accent, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10 }}>
                {t('geofence.delete')}
              </button>
            </div>
          ))}
        </ResultsBox>
      )}

      <Divider />
      <h3 style={{ color: '#1a1a1a', marginBottom: 8, fontSize: 14, fontWeight: 700 }}>{t('geofence.checkPoint')}</h3>
      <div style={{ marginBottom: 8 }}>
        <CoordInput lat={checkLat} lng={checkLng} onLatChange={setCheckLat} onLngChange={setCheckLng} />
      </div>

      <Button variant="warning" fullWidth onClick={handleCheck}>
        {t('geofence.check')}
      </Button>

      {checkResult && (
        <div className="slide-in" style={{
          padding: 10, marginTop: 8, borderRadius: 8, fontSize: 12, fontWeight: 600, textAlign: 'center',
          background: checkResult.inside ? gradients.success : gradients.danger,
          color: checkResult.inside ? colors.successText : colors.accent,
          border: checkResult.inside ? `1px solid ${colors.successBorder}` : `1px solid ${colors.border}`,
        }}>
          {checkResult.inside ? t('geofence.inside', { n: checkResult.zone ?? '' }) : t('geofence.outside')}
        </div>
      )}
    </div>
  )
}
