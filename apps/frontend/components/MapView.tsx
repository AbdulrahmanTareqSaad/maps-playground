/**
 * MapView – Core Leaflet map canvas. Initialises the map with a default
 * tile layer and exposes click/double-click callbacks.
 *
 * Props:
 *  - onClick?: (latlng) => void   – Called on single map click.
 *  - onDoubleClick?: (latlng) => void – Called on double-click.
 *
 * Listens for a custom `stylechange` event to swap tile providers at runtime.
 * The map instance is stored on `window.__map` for external access.
 */

'use client'

import { useEffect, useRef } from 'react'
import { POINT1 } from '@/lib/defaults'
import { TILE_MAP } from '@/lib/map-config'
import { mapDefaults } from '@/lib/theme'

interface Props {
  onClick?: (latlng: { lat: number; lng: number }) => void
  onDoubleClick?: (latlng: { lat: number; lng: number }) => void
}

export default function MapView({ onClick, onDoubleClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const baseLayerRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (mapInstance.current || !mapRef.current) return
    const L = (window as any).L
    if (!L) return

    const map = L.map(mapRef.current, {
      center: [POINT1.lat, POINT1.lng],
      zoom: mapDefaults.initialZoom,
      zoomControl: true,
      doubleClickZoom: false,
    })

    const cfg = TILE_MAP.osm
    const layer = L.tileLayer(cfg.tileUrl, {
      attribution: cfg.attribution,
      maxZoom: mapDefaults.maxZoom,
    })
    layer.addTo(map)
    baseLayerRef.current = layer

    map.on('click', (e: any) => onClick?.(e.latlng))
    map.on('dblclick', (e: any) => onDoubleClick?.(e.latlng))

    mapInstance.current = map
    ;(window as any).__map = map

    const handleStyle = (e: Event) => {
      const style = (e as CustomEvent).detail
      if (baseLayerRef.current) {
        map.removeLayer(baseLayerRef.current)
        baseLayerRef.current = null
      }
      const cfg = TILE_MAP[style.id]
      if (cfg) {
        const layer = L.tileLayer(cfg.tileUrl, {
          attribution: cfg.attribution,
          maxZoom: mapDefaults.maxZoom,
        })
        layer.addTo(map)
        baseLayerRef.current = layer
      }
    }

    window.addEventListener('stylechange', handleStyle)

    return () => {
      map.remove()
      mapInstance.current = null
      ;(window as any).__map = null
      window.removeEventListener('stylechange', handleStyle)
    }
  }, [onClick, onDoubleClick])

  return (
    <div
      ref={mapRef}
      className="absolute inset-0 h-full w-full"
      id="mapmaster-map"
      dir="ltr"
    />
  )
}
