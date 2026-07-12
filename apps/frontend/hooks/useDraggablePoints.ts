'use client'

import { useEffect, useRef } from 'react'
import type { DraggablePoint } from '@/types'
import { createPinIcon } from '@/lib/markerIcons'

export default function useDraggablePoints(points: DraggablePoint[]) {
  const markersRef = useRef<L.Marker[]>([])
  const pointsRef = useRef(points)

  useEffect(() => {
    pointsRef.current = points
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const L = window.L
    const map = (window as any).__map as L.Map | undefined
    if (!L || !map) return

    markersRef.current.forEach((m) => map.removeLayer(m))
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
        p.setLat(parseFloat(pos.lat.toFixed(6)))
        p.setLng(parseFloat(pos.lng.toFixed(6)))
      })
      markersRef.current.push(marker)
    })

    if (markersRef.current.length >= 2) {
      map.fitBounds(
        L.latLngBounds(markersRef.current.map((m) => m.getLatLng())),
        { padding: [50, 50], maxZoom: 14 }
      )
    }

    return () => {
      markersRef.current.forEach((m) => map.removeLayer(m))
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
      p.setLat(parseFloat(ce.detail.lat.toFixed(6)))
      p.setLng(parseFloat(ce.detail.lng.toFixed(6)))
    }
    window.addEventListener('mapdblclick', handler)
    return () => window.removeEventListener('mapdblclick', handler)
  }, [])
}
