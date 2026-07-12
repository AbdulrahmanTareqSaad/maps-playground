/**
 * In-memory geofence zone store with CRUD operations and point-in-polygon
 * hit-testing. Manages named polygon zones used by the geofencing feature.
 * Exports: createZone, listZones, deleteZone, checkPoint
 */
import { GeofenceZone, LatLng } from '@/types'
import { nanoid } from 'nanoid'

const zones = new Map<string, GeofenceZone>()

export function createZone(name: string, polygon: LatLng[]): GeofenceZone {
  const zone: GeofenceZone = {
    id: nanoid(8),
    name,
    polygon,
    createdAt: Date.now(),
  }
  zones.set(zone.id, zone)
  return zone
}

export function listZones(): GeofenceZone[] {
  return Array.from(zones.values())
}

export function deleteZone(id: string): boolean {
  return zones.delete(id)
}

function pointInPolygon(p: LatLng, polygon: LatLng[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = polygon[i]
    const pj = polygon[j]
    if (
      pi.lng > p.lng !== pj.lng > p.lng &&
      p.lat < ((pj.lat - pi.lat) * (p.lng - pi.lng)) / (pj.lng - pi.lng) + pi.lat
    ) {
      inside = !inside
    }
  }
  return inside
}

export function checkPoint(
  lat: number,
  lng: number
): { inside: boolean; zone?: string } {
  for (const z of zones.values()) {
    if (pointInPolygon({ lat, lng }, z.polygon)) {
      return { inside: true, zone: z.name }
    }
  }
  return { inside: false }
}
