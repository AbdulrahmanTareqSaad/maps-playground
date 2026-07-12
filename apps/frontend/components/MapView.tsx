'use client'

import { useEffect, useRef } from 'react'
import { POINT1 } from '@/lib/defaults'

interface Props {
  onClick?: (latlng: { lat: number; lng: number }) => void
  onDoubleClick?: (latlng: { lat: number; lng: number }) => void
}

const STYLE_CONFIG: Record<
  string,
  { tileUrl: string; attribution: string }
> = {
  osm: {
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  carto_light: {
    tileUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO',
  },
  carto_dark: {
    tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO',
  },
  hydda_full: {
    tileUrl:
      'https://{s}.tile.openstreetmap.se/hydda/full/{z}/{x}/{y}.png',
    attribution: '&copy; OSM Sweden',
  },
}

export default function MapView({ onClick, onDoubleClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const baseLayerRef = useRef<L.TileLayer | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (mapInstance.current || !mapRef.current) return
    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, {
      center: [POINT1.lat, POINT1.lng],
      zoom: 14,
      zoomControl: true,
      doubleClickZoom: false,
    })

    const cfg = STYLE_CONFIG.osm
    const layer = L.tileLayer(cfg.tileUrl, {
      attribution: cfg.attribution,
      maxZoom: 19,
    })
    layer.addTo(map)
    baseLayerRef.current = layer

    map.on('click', (e: L.LeafletMouseEvent) => onClick?.(e.latlng))
    map.on('dblclick', (e: L.LeafletMouseEvent) => onDoubleClick?.(e.latlng))

    mapInstance.current = map
    ;(window as any).__map = map

    const handleStyle = (e: Event) => {
      const style = (e as CustomEvent).detail
      if (baseLayerRef.current) {
        map.removeLayer(baseLayerRef.current)
        baseLayerRef.current = null
      }
      const cfg = STYLE_CONFIG[style.id]
      if (cfg) {
        const layer = L.tileLayer(cfg.tileUrl, {
          attribution: cfg.attribution,
          maxZoom: 19,
        })
        layer.addTo(map)
        baseLayerRef.current = layer
      } else if (style.style_url) {
        console.warn('Mapbox GL styles require leaflet-mapbox-gl plugin')
      }
    }

    window.addEventListener('stylechange', handleStyle)

    return () => {
      map.remove()
      mapInstance.current = null
      ;(window as any).__map = null
      window.removeEventListener('stylechange', handleStyle)
    }
  }, [])

  return (
    <div
      ref={mapRef}
      className="absolute inset-0 h-full w-full"
      id="mapmaster-map"
      dir="ltr"
    />
  )
}
