'use client'

import { useState, useEffect, useRef } from 'react'
import useDraggablePoints from '@/hooks/useDraggablePoints'
import { useTranslation } from '@/lib/i18n'
import { POINT1 } from '@/lib/defaults'

export default function Geofencing({
  clickedPos,
}: {
  clickedPos?: { lat: string; lng: string } | null
}) {
  const { t } = useTranslation()
  const [fenceName, setFenceName] = useState('Delivery Zone A')
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState<Array<{ lat: number; lng: number }>>([])
  const [fences, setFences] = useState<any[]>([])
  const [checkLat, setCheckLat] = useState(POINT1.lat)
  const [checkLng, setCheckLng] = useState(POINT1.lng)
  const [checkResult, setCheckResult] = useState<any>(null)

  const drawLayerRef = useRef<L.LayerGroup | null>(null)
  const fenceLayerRef = useRef<L.LayerGroup | null>(null)
  const checkLayerRef = useRef<L.LayerGroup | null>(null)

  useDraggablePoints([
    { lat: checkLat, lng: checkLng, setLat: setCheckLat, setLng: setCheckLng, color: '#e67e22', label: t('geofence.checkPoint') },
  ])

  useEffect(() => {
    const L = (window as any).L
    const map = (window as any).__map as L.Map | undefined
    if (!L || !map) return
    if (!fenceLayerRef.current) {
      fenceLayerRef.current = L.layerGroup().addTo(map)
    }
    const layer = fenceLayerRef.current
    if (!layer) return
    layer.clearLayers()
    fences.forEach((f: any) => {
      if (!f.polygon || f.polygon.length < 3) return
      const coords = f.polygon.map((p: any) => [p.lat, p.lng] as [number, number])
      L.polygon(coords, { color: '#e67e22', weight: 2, fillColor: '#e67e22', fillOpacity: 0.12 }).addTo(layer)
    })
  }, [fences])

  useEffect(() => {
    const L = (window as any).L
    const map = (window as any).__map as L.Map | undefined
    if (!L || !map) return
    if (!drawLayerRef.current) {
      drawLayerRef.current = L.layerGroup().addTo(map)
    }
    const layer = drawLayerRef.current
    if (!layer) return
    layer.clearLayers()
    if (points.length < 2) {
      if (points.length === 1) {
        L.circleMarker([points[0].lat, points[0].lng], { radius: 5, color: '#5238e1', fillColor: '#5238e1', fillOpacity: 0.8 }).addTo(layer)
      }
      return
    }
    const coords = points.map((p) => [p.lat, p.lng] as [number, number])
    L.polyline(coords, { color: '#5238e1', weight: 2, dashArray: '6 4' }).addTo(layer)
    points.forEach((p) => {
      L.circleMarker([p.lat, p.lng], { radius: 4, color: '#fff', fillColor: '#5238e1', fillOpacity: 0.9, weight: 2 }).addTo(layer)
    })
    if (points.length >= 3) {
      L.polygon(coords, { color: '#5238e1', weight: 1.5, fillColor: '#5238e1', fillOpacity: 0.08 }).addTo(layer)
    }
  }, [points])

  useEffect(() => {
    if (!checkResult) return
    const L = (window as any).L
    const map = (window as any).__map as L.Map | undefined
    if (!L || !map) return
    if (!checkLayerRef.current) {
      checkLayerRef.current = L.layerGroup().addTo(map)
    }
    const layer = checkLayerRef.current
    if (!layer) return
    layer.clearLayers()
    const color = checkResult.inside ? '#27ae60' : '#3d29b0'
    L.circleMarker([checkLat, checkLng], {
      radius: 14, color, fillColor: color, fillOpacity: 0.25, weight: 3,
    }).addTo(layer)
    L.circleMarker([checkLat, checkLng], {
      radius: 6, color: '#fff', fillColor: color, fillOpacity: 1, weight: 2,
    }).addTo(layer)
  }, [checkResult, checkLat, checkLng])

  useEffect(() => {
    return () => {
      const map = (window as any).__map as L.Map | undefined
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
    } catch {}
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
    } catch {}
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
    } catch (e: any) {
      setCheckResult({ error: e.message })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/geofence/${id}`, { method: 'DELETE' })
      await listFences()
    } catch {}
  }

  return (
    <div>
      <h2 style={{ color: '#1a1a1a', marginBottom: 4, fontSize: 18, fontWeight: 700 }}>{t('geofence.title')}</h2>
      <p style={{ color: '#777', marginBottom: 16, fontSize: 12, lineHeight: 1.5 }}>{t('geofence.desc')}</p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#888', marginBottom: 4, display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('geofence.zoneName')}</label>
        <input type="text" value={fenceName} onChange={e => setFenceName(e.target.value)}
          style={{ width: '100%', background: '#f0ebe2', border: '1px solid #d5cfc4', color: '#2d2d2d', padding: '8px 10px', fontSize: 12, borderRadius: 6, outline: 'none', transition: 'border-color 0.2s' }} />
      </div>

      <p style={{
        color: drawing ? '#5238e1' : '#777', fontSize: 11, marginBottom: 8,
        background: drawing ? 'rgba(139,124,240,0.08)' : 'transparent',
        padding: '6px 8px', borderRadius: 6,
      }}>
        {drawing ? t('geofence.drawing') : t('geofence.notDrawing')}
      </p>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button onClick={toggleDraw}
          style={{
            background: drawing
              ? 'linear-gradient(135deg, #3d29b0, #3d29b0)'
              : 'linear-gradient(135deg, #5238e1, #3d29b0)',
            color: '#fff', padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: 'none',
            boxShadow: '0 2px 6px rgba(82,56,225,0.25)',
          }}>
          {drawing ? t('geofence.cancelDraw') : t('geofence.draw')}
        </button>
        {points.length >= 3 && (
          <button onClick={handleSave}
            style={{
              background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
              color: '#fff', padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: 'none',
              boxShadow: '0 2px 6px rgba(39,174,96,0.25)',
            }}>
            {t('geofence.save')}
          </button>
        )}
      </div>

      {fences.length > 0 && (
        <div style={{ background: '#f0ebe2', padding: 10, marginTop: 8, borderRadius: 8, maxHeight: 120, overflowY: 'auto' }}>
          <div style={{ color: '#777', fontSize: 11, marginBottom: 6 }}>{t('geofence.savedZones')}</div>
          {fences.map((f: any) => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #d5cfc4', fontSize: 12, paddingTop: 4, paddingBottom: 4 }}>
              <span style={{ color: '#2d2d2d' }}>{f.name}</span>
              <button onClick={() => handleDelete(f.id)} style={{ color: '#5238e1', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10 }}>
                {t('geofence.delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid #d5cfc4', marginTop: 16, marginBottom: 16 }} />
      <h3 style={{ color: '#1a1a1a', marginBottom: 8, fontSize: 14, fontWeight: 700 }}>{t('geofence.checkPoint')}</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input type="number" value={checkLat} step="0.0001" onChange={e => setCheckLat(+e.target.value)}
          style={{ flex: 1, minWidth: 0, background: '#f0ebe2', border: '1px solid #d5cfc4', color: '#2d2d2d', padding: '8px 6px', fontSize: 12, borderRadius: 6, outline: 'none', lineHeight: 1, transition: 'border-color 0.2s' }} />
        <input type="number" value={checkLng} step="0.0001" onChange={e => setCheckLng(+e.target.value)}
          style={{ flex: 1, minWidth: 0, background: '#f0ebe2', border: '1px solid #d5cfc4', color: '#2d2d2d', padding: '8px 6px', fontSize: 12, borderRadius: 6, outline: 'none', lineHeight: 1, transition: 'border-color 0.2s' }} />
      </div>

      <button onClick={handleCheck}
        style={{
          background: 'linear-gradient(135deg, #e67e22, #d35400)',
          color: '#fff', padding: '9px 20px', fontSize: 12, fontWeight: 600, borderRadius: 6,
          cursor: 'pointer', border: 'none', width: '100%',
          boxShadow: '0 2px 6px rgba(230,126,34,0.25)',
        }}>
        {t('geofence.check')}
      </button>

      {checkResult && (
        <div className="slide-in" style={{
          padding: 10, marginTop: 8, borderRadius: 8, fontSize: 12, fontWeight: 600, textAlign: 'center',
          background: checkResult.inside ? 'linear-gradient(135deg, #e8f5e9, #c8e6c9)' : 'linear-gradient(135deg, #f3e5f5, #ffcdd2)',
          color: checkResult.inside ? '#2e7d32' : '#5238e1',
          border: checkResult.inside ? '1px solid #a5d6a7' : '1px solid #d5cfc4',
        }}>
          {checkResult.inside ? t('geofence.inside', { n: checkResult.zone }) : t('geofence.outside')}
        </div>
      )}
    </div>
  )
}
