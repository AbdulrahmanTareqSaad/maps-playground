/**
 * Thin accessor layer over the globally-attached Leaflet map instance
 * (window.__map / window.L). Provides safe getters and a readiness
 * promise for components that mount before the map is initialized.
 * Exports: getMap, getLeaflet, whenMapReady
 */
declare const L: any

export function getMap(): any | undefined {
  return (window as any)?.__map
}

export function getLeaflet(): any | undefined {
  return (window as any)?.L
}

export function whenMapReady(): Promise<any> {
  return new Promise((resolve) => {
    const existing = getMap()
    if (existing) return resolve(existing)
    const check = setInterval(() => {
      const m = getMap()
      if (m) { clearInterval(check); resolve(m) }
    }, 50)
  })
}
