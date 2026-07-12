'use client'

import { useEffect, useRef } from 'react'
import { createPinIcon } from '@/lib/markerIcons'

export interface MapMarkerData {
  id: string | number
  lat: number
  lng: number
  label?: string
  color?: string
}

export default function useMapMarkers(markers: MapMarkerData[]) {
  const markersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const L = window.L
    const map = (window as any).__map as L.Map | undefined
    if (!L || !map) return

    markersRef.current.forEach((m) => map.removeLayer(m))
    markersRef.current = []

    if (markers.length === 0) return

    markers.forEach((m) => {
      if (m.lat == null || m.lng == null) return
      const marker = L.marker([m.lat, m.lng], {
        icon: createPinIcon(m.color ?? '#4361ee'),
      }).addTo(map)
      if (m.label) {
        marker.bindTooltip(m.label, {
          direction: 'top',
          className: 'map-result-tooltip',
        })
      }
      markersRef.current.push(marker)
    })

    if (markersRef.current.length >= 2) {
      map.fitBounds(
        L.latLngBounds(markersRef.current.map((m) => m.getLatLng())),
        { padding: [50, 50], maxZoom: 15 },
      )
    } else if (markersRef.current.length === 1) {
      map.setView(markersRef.current[0].getLatLng(), 15)
    }

    return () => {
      markersRef.current.forEach((m) => map.removeLayer(m))
      markersRef.current = []
    }
  }, [markers])
}
