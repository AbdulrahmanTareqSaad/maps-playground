/**
 * React hook that renders and manages draggable Leaflet map markers.
 * Syncs marker positions with state, supports tooltips, and listens
 * for double-click events to reposition the first point.
 * Exports: useDraggablePoints (default)
 */
'use client'

import { useEffect, useRef } from 'react'
import type { DraggablePoint } from '@/types'
import { createPinIcon } from '@/lib/markerIcons'
import { getMap, getLeaflet } from '@/lib/map'
import { mapDefaults } from '@/lib/theme'

export default function useDraggablePoints(points: DraggablePoint[]) {
  const markersRef = useRef<any[]>([])
  const pointsRef = useRef(points)

  useEffect(() => {
    pointsRef.current = points
  })

  useEffect(() => {
    const L = getLeaflet()
    const map = getMap()
    if (!L || !map) return

    markersRef.current.forEach((m: any) => map.removeLayer(m))
    markersRef.current = []

    const makeIcon = (color: string) => createPinIcon(color, true)

    pointsRef.current.forEach((p) => {
      if (p.lat == null || p.lng == null) return
      const marker = L.marker([p.lat, p.lng], {
        draggable: true,
        icon: makeIcon(p.color),
      }).addTo(map)
      if (p.label)
        marker.bindTooltip(p.label, { permanent: true, direction: 'top' })
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        p.setLat(parseFloat(pos.lat.toFixed(mapDefaults.latLngPrecision)))
        p.setLng(parseFloat(pos.lng.toFixed(mapDefaults.latLngPrecision)))
      })
      markersRef.current.push(marker)
    })

    if (markersRef.current.length >= 2) {
      map.fitBounds(
        L.latLngBounds(markersRef.current.map((m: any) => m.getLatLng())),
        { padding: mapDefaults.fitBoundsPadding, maxZoom: mapDefaults.initialZoom }
      )
    }

    return () => {
      markersRef.current.forEach((m: any) => map.removeLayer(m))
      markersRef.current = []
    }
  }, [])

  useEffect(() => {
    pointsRef.current.forEach((p, i) => {
      markersRef.current[i]?.setLatLng([p.lat, p.lng])
    })
  })

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ lat: number; lng: number }>
      if (pointsRef.current.length === 0) return
      const p = pointsRef.current[0]
      p.setLat(parseFloat(ce.detail.lat.toFixed(mapDefaults.latLngPrecision)))
      p.setLng(parseFloat(ce.detail.lng.toFixed(mapDefaults.latLngPrecision)))
    }
    window.addEventListener('mapdblclick', handler)
    return () => window.removeEventListener('mapdblclick', handler)
  }, [])
}
