'use client'

import { useState, useCallback, lazy, Suspense, useEffect } from 'react'
import dynamic from 'next/dynamic'
import ClickedPosition from '@/components/ClickedPosition'
import StartupLoader from '@/components/StartupLoader'
import { useTranslation } from '@/lib/i18n'
import { colors, gradients, spacing, mapDefaults } from '@/lib/theme'

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })
const OsmExplorer = lazy(() => import('@/components/modules/OsmExplorer'))
const RoutingPlayground = lazy(() => import('@/components/modules/RoutingPlayground'))
const LiveTracking = lazy(() => import('@/components/modules/LiveTracking'))
const Geofencing = lazy(() => import('@/components/modules/Geofencing'))
const MapStyles = lazy(() => import('@/components/modules/MapStyles'))

function Fallback({ t }: { t: (k: string) => string }) {
  return (
    <div style={{ color: colors.textMuted, fontSize: 12, padding: 16 }}>
      {t('app.loading')}
    </div>
  )
}

type ModuleProps = {
  clickedPos: { lat: string; lng: string } | null
  initLoc?: { lat: number; lng: number } | null
}

function Inner() {
  const { t, toggleLang, dir } = useTranslation()
  const [appReady, setAppReady] = useState(false)
  const [initLoc, setInitLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [activeModule, setActiveModule] = useState('osm')
  const [clickedPos, setClickedPos] = useState<{ lat: string; lng: string } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${spacing.mobileBreakpoint}px)`)
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
      setSidebarOpen(!e.matches)
    }
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const modules = [
    { id: 'osm', label: t('nav.osm'), Comp: OsmExplorer },
    { id: 'routing', label: t('nav.routing'), Comp: RoutingPlayground },
    { id: 'tracking', label: t('nav.tracking'), Comp: LiveTracking },
    { id: 'geofence', label: t('nav.geofence'), Comp: Geofencing },
    { id: 'styles', label: t('nav.styles'), Comp: MapStyles },
  ] as const

  const handleMapClick = useCallback(
    (latlng: { lat: number; lng: number }) => {
      setClickedPos({ lat: latlng.lat.toFixed(mapDefaults.latLngPrecision), lng: latlng.lng.toFixed(mapDefaults.latLngPrecision) })
      window.dispatchEvent(new CustomEvent('mapclick', { detail: latlng }))
    },
    []
  )

  const handleDblClick = useCallback(
    (latlng: { lat: number; lng: number }) => {
      setClickedPos({ lat: latlng.lat.toFixed(mapDefaults.latLngPrecision), lng: latlng.lng.toFixed(mapDefaults.latLngPrecision) })
      window.dispatchEvent(new CustomEvent('mapdblclick', { detail: latlng }))
    },
    []
  )

  const ActiveComp = modules.find((m) => m.id === activeModule)!.Comp as React.ComponentType<ModuleProps>

  const sidebarContent = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4"
        style={{ color: colors.textPrimary, wordBreak: 'break-word' }}>
        <Suspense fallback={<Fallback t={t} />}>
          <ActiveComp clickedPos={clickedPos} initLoc={initLoc} />
        </Suspense>
      </div>
      <div style={{ height: 3, background: gradients.accentBar }} />
      <div className="shrink-0 px-4 pb-4" style={{ background: '#ebe5d8' }}>
        <ClickedPosition pos={clickedPos} />
      </div>
    </>
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden" dir={dir}>
      {!appReady && <StartupLoader onDone={(loc) => { setInitLoc(loc); setAppReady(true) }} />}

      <nav className="flex h-[52px] items-center justify-between border-b px-5"
        style={{ background: gradients.navBg, borderColor: colors.border }}>
        <div className="flex items-center gap-3 shrink-0">
          {isMobile && (
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: 'transparent', border: 'none', color: colors.textPrimary, cursor: 'pointer', fontSize: 20, padding: '4px 6px', lineHeight: 1 }}>
              {sidebarOpen ? '✕' : '☰'}
            </button>
          )}
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: gradients.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
          }}>M</div>
          <span className="hidden sm:inline text-lg font-bold" style={{
            background: gradients.primaryHover, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}>
            {t('app.title')}
          </span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {isMobile ? (
            <select value={activeModule} onChange={(e) => setActiveModule(e.target.value)}
              className="cursor-pointer rounded-md border px-3 py-1.5 text-[13px] shrink-0"
              style={{ borderColor: colors.accent, background: gradients.primary, color: '#fff', fontWeight: 600, fontSize: 13, padding: '6px 10px', borderRadius: 6, outline: 'none', appearance: 'auto' }}>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          ) : modules.map((m) => (
            <button key={m.id} onClick={() => setActiveModule(m.id)}
              className="cursor-pointer rounded-md border px-3 py-1.5 text-[13px] shrink-0"
              style={{
                borderColor: activeModule === m.id ? colors.accent : colors.border,
                background: activeModule === m.id ? gradients.primary : 'transparent',
                color: activeModule === m.id ? '#fff' : colors.textSecondary,
                boxShadow: activeModule === m.id ? `0 2px 8px ${colors.accentAlpha}` : 'none',
              }}
              onMouseEnter={(e) => { if (activeModule !== m.id) { e.currentTarget.style.background = colors.accentHoverAlpha; e.currentTarget.style.color = colors.textPrimary } }}
              onMouseLeave={(e) => { if (activeModule !== m.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = colors.textSecondary } }}
            >
              {m.label}
            </button>
          ))}
          <button onClick={toggleLang}
            className="cursor-pointer rounded-md border px-2.5 py-1.5 text-[12px] shrink-0 ml-2"
            style={{ borderColor: colors.border, color: colors.textSecondary, background: 'transparent', transition: 'all 0.2s' }}
            title={t('nav.lang')}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.accentHoverAlpha; e.currentTarget.style.color = colors.textPrimary }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = colors.textSecondary }}
          >
            🇺🇸 🇸🇦
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {isMobile ? (
          <>
            {sidebarOpen && (
              <div onClick={() => setSidebarOpen(false)}
                style={{ position: 'fixed', inset: 0, top: spacing.navHeight, zIndex: 1000, background: 'rgba(0,0,0,0.5)' }} />
            )}
            <aside style={((): React.CSSProperties => {
              const base: React.CSSProperties = {
                position: 'fixed', top: spacing.navHeight, bottom: 0, zIndex: 1001,
                width: '85vw', maxWidth: 360, display: 'flex', flexDirection: 'column',
                overflow: 'hidden', background: gradients.sidebarBg,
                transition: 'transform 0.3s ease-in-out', pointerEvents: sidebarOpen ? 'auto' : 'none',
              }
              if (dir === 'rtl') { base.right = 0; base.borderLeft = `1px solid ${colors.border}`; base.transform = sidebarOpen ? 'translateX(0)' : 'translateX(100%)' }
              else { base.left = 0; base.borderRight = `1px solid ${colors.border}`; base.transform = sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }
              return base
            })()}>
              {sidebarContent}
            </aside>
          </>
        ) : (
          <aside className="flex w-[380px] min-w-[380px] flex-col overflow-hidden"
            style={{
              borderRight: dir === 'ltr' ? `1px solid ${colors.border}` : 'none',
              borderLeft: dir === 'rtl' ? `1px solid ${colors.border}` : 'none',
              background: gradients.sidebarBg,
            }}>
            {sidebarContent}
          </aside>
        )}

        <main className="relative flex-1">
          <MapView onClick={handleMapClick} onDoubleClick={handleDblClick} />
        </main>
      </div>
    </div>
  )
}

export default function Home() {
  return <Inner />
}
