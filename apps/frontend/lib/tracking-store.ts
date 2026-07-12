import { Tracker } from '@/types'
import { nanoid } from 'nanoid'

const g = globalThis as any
if (!g.__trackers) g.__trackers = new Map<string, Tracker>()
const trackers: Map<string, Tracker> = g.__trackers

export function createTracker(data: {
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  label: string
  speed: number
  routeCoords?: Array<{ lat: number; lng: number }>
}): Tracker {
  const id = 'tracker_' + nanoid(8)
  const coords = data.routeCoords && data.routeCoords.length >= 2
    ? data.routeCoords
    : [
        { lat: data.startLat, lng: data.startLng },
        { lat: data.endLat, lng: data.endLng },
      ]
  const tracker: Tracker = {
    id,
    apiToken: nanoid(60),
    label: data.label,
    startLat: data.startLat,
    startLng: data.startLng,
    endLat: data.endLat,
    endLng: data.endLng,
    speed: data.speed,
    lat: data.startLat,
    lng: data.startLng,
    arrived: false,
    createdAt: Date.now(),
    path: [{ lat: data.startLat, lng: data.startLng }],
    routeCoords: coords,
    routeIndex: 0,
  }
  trackers.set(id, tracker)
  return tracker
}

export function getTracker(id: string): Tracker | undefined {
  return trackers.get(id)
}

export function listTrackers(): Tracker[] {
  return Array.from(trackers.values())
}

export function reportPosition(
  id: string,
  token: string,
  lat: number,
  lng: number
): Tracker | null {
  const t = trackers.get(id)
  if (!t || t.apiToken !== token) return null
  t.lat = lat
  t.lng = lng
  t.path.push({ lat, lng })
  const dist = Math.sqrt(
    (lat - t.endLat) ** 2 + (lng - t.endLng) ** 2
  )
  if (dist < 0.001) t.arrived = true
  return t
}

export function removeTracker(id: string): boolean {
  return trackers.delete(id)
}

const EARTH_M = 111320

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const aVal =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng * sinDLng
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal))
}

export function simulateStep(id: string): Tracker | null {
  const t = trackers.get(id)
  if (!t || t.arrived) return null
  if (!t.routeCoords || t.routeCoords.length < 2) {
    const dx = t.endLng - t.startLng
    const dy = t.endLat - t.startLat
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.0001) return t
    const step = (t.speed * 0.0003) / dist
    const lat = t.lat + dy * step
    const lng = t.lng + dx * step
    return reportPosition(id, t.apiToken, lat, lng)
  }

  const stepMeters = t.speed * 5
  let remaining = stepMeters
  let idx = t.routeIndex
  let curLat = t.lat
  let curLng = t.lng

  while (remaining > 0 && idx < t.routeCoords.length - 1) {
    const next = t.routeCoords[idx + 1]
    const segDist = haversine({ lat: curLat, lng: curLng }, next)
    if (segDist <= remaining) {
      remaining -= segDist
      idx++
      curLat = next.lat
      curLng = next.lng
    } else {
      const frac = remaining / segDist
      curLat += (next.lat - curLat) * frac
      curLng += (next.lng - curLng) * frac
      remaining = 0
    }
  }

  t.routeIndex = idx
  if (idx >= t.routeCoords.length - 1 && remaining >= 0) {
    t.lat = t.endLat
    t.lng = t.endLng
    t.path.push({ lat: t.endLat, lng: t.endLng })
    t.arrived = true
    return t
  }

  return reportPosition(id, t.apiToken, curLat, curLng)
}
