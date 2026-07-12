/**
 * MapStyles module — switch between predefined tile layer styles (e.g. OSM, Carto, Stamen)
 * on the shared Leaflet map. Dispatches a "stylechange" custom event with the selected style
 * from TILE_STYLES config for the map container to consume.
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/i18n'
import { TILE_STYLES } from '@/lib/map-config'
import { SectionTitle, Subtitle } from '@/components/ui'

export default function MapStyles() {
  const { t } = useTranslation()
  const [activeStyle, setActiveStyle] = useState('osm')

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('stylechange', {
        detail: TILE_STYLES.find((s) => s.id === activeStyle),
      })
    )
  }, [activeStyle])

  return (
    <div>
      <SectionTitle>{t('styles.title')}</SectionTitle>
      <Subtitle>{t('styles.desc')}</Subtitle>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {TILE_STYLES.map((s) => (
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
          </div>
        ))}
      </div>
    </div>
  )
}
