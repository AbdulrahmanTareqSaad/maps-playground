'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/i18n'

const styles = [
  { id: 'osm', name: 'OpenStreetMap', type: 'Raster', free: true, tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' },
  { id: 'carto_light', name: 'Carto Light', type: 'Raster', free: true, tileUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CARTO' },
  { id: 'carto_dark', name: 'Carto Dark', type: 'Raster', free: true, tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CARTO' },
  { id: 'hydda_full', name: 'Hydda Full', type: 'Raster', free: true, tileUrl: 'https://{s}.tile.openstreetmap.se/hydda/full/{z}/{x}/{y}.png', attribution: '&copy; OSM Sweden' },
  { id: 'mapbox_streets', name: 'Mapbox Streets', type: 'Vector', free: false, style_url: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'mapbox_satellite', name: 'Mapbox Satellite', type: 'Vector', free: false, style_url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'mapbox_light', name: 'Mapbox Light', type: 'Vector', free: false, style_url: 'mapbox://styles/mapbox/light-v11' },
  { id: 'mapbox_dark', name: 'Mapbox Dark', type: 'Vector', free: false, style_url: 'mapbox://styles/mapbox/dark-v11' },
]

export default function MapStyles() {
  const { t } = useTranslation()
  const [activeStyle, setActiveStyle] = useState('osm')

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('stylechange', {
        detail: styles.find((s) => s.id === activeStyle),
      })
    )
  }, [activeStyle])

  return (
    <div>
      <h2 style={{ color: '#1a1a1a', marginBottom: 4, fontSize: 18, fontWeight: 700 }}>{t('styles.title')}</h2>
      <p style={{ color: '#777', marginBottom: 16, fontSize: 12 }}>{t('styles.desc')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {styles.map((s) => (
          <div
            key={s.id}
            onClick={() => setActiveStyle(s.id)}
            style={{
              padding: 10,
              borderRadius: 8,
              cursor: 'pointer',
              textAlign: 'center',
              background: '#f0ebe2',
              border: activeStyle === s.id ? '1px solid #5238e1' : '1px solid #d5cfc4',
            }}
          >
            <div style={{ color: '#2d2d2d', fontSize: 11, fontWeight: 600 }}>{s.name}</div>
            <div style={{ color: '#777', fontSize: 9, marginTop: 2 }}>{s.type}</div>
            <span style={{
              display: 'inline-block',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 8,
              marginTop: 4,
              color: '#fff',
              background: s.free ? '#27ae60' : '#e67e22',
            }}>
              {s.free ? t('styles.free') : t('styles.token')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
