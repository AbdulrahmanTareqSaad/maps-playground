/**
 * Generates SVG pin icons for Leaflet markers with configurable colors,
 * optional pulsing animation, and drop-shadow effects.
 * Exports: createPinIcon
 */
declare const L: any

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount))
  return `rgb(${r},${g},${b})`
}

let iconCounter = 0

export function createPinIcon(color: string = '#5238e1', pulse: boolean = false) {
  const uid = iconCounter++
  const svg = `<svg width="32" height="44" viewBox="0 0 32 44" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="ps${uid}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.35"/>
    </filter>
    <linearGradient id="pg${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${adjustColor(color, -25)}"/>
    </linearGradient>
  </defs>
  <path d="M16 2C7.16 2 0 9.16 0 18C0 29.5 16 42 16 42C16 42 32 29.5 32 18C32 9.16 24.84 2 16 2Z" fill="url(#pg${uid})" filter="url(#ps${uid})"/>
  <circle cx="16" cy="17" r="6" fill="white" opacity="0.95"/>
</svg>`

  return L.divIcon({
    className: '',
    html: `<div class="${pulse ? 'map-pin-pulse' : ''}">${svg}</div>`,
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    tooltipAnchor: [0, -48],
  })
}
