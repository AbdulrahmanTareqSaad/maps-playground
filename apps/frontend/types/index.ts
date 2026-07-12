/**
 * Shared TypeScript interfaces for the MapsPlayground frontend — covers
 * map coordinates, tracker state, geofence zones, draggable pins, and
 * API response shapes for OSM and routing results.
 * Exports: LatLng, Tracker, GeofenceZone, DraggablePoint, OsmResult,
 *          RoutingResult
 */
export interface LatLng {
  lat: number
  lng: number
}

export interface Tracker {
  id: string
  apiToken: string
  label: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  speed: number
  lat: number
  lng: number
  arrived: boolean
  createdAt: number
  path: Array<{ lat: number; lng: number }>
  routeCoords: Array<{ lat: number; lng: number }>
  routeIndex: number
}

export interface GeofenceZone {
  id: string
  name: string
  polygon: LatLng[]
  createdAt: number
}

export interface DraggablePoint {
  lat: number
  lng: number
  setLat: (v: number) => void
  setLng: (v: number) => void
  color: string
  label?: string
}

export interface OsmResult {
  count: number
  features: Array<{
    id: number
    type: string
    lat: number
    lon: number
    tags: Record<string, string>
  }>
  bbox: string
}

export interface RoutingResult {
  ors?: {
    features?: Array<{
      properties: { summary: { distance: number; duration: number } }
      geometry: { coordinates: number[][] }
    }>
  }
  osrm?: {
    routes?: Array<{
      distance: number
      duration: number
      geometry: string
    }>
  }
  isochrone?: {
    features?: Array<{
      geometry: { coordinates: number[][] }
    }>
  }
  error?: string
}
