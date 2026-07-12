'use client'

import { useState, useCallback, lazy, Suspense, useEffect, type ComponentType } from 'react'
import dynamic from 'next/dynamic'
import ClickedPosition from '@/components/ClickedPosition'
import { useTranslation } from '@/lib/i18n'

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })
const OsmExplorer = lazy(() => import('@/components/modules/OsmExplorer'))
const RoutingPlayground = lazy(() => import('@/components/modules/RoutingPlayground'))
const LiveTracking = lazy(() => import('@/components/modules/LiveTracking'))
const Geofencing = lazy(() => import('@/components/modules/Geofencing'))
const MapStyles = lazy(() => import('@/components/modules/MapStyles'))

function Fallback({ t }: { t: (k: string) => string }) {
  return (
    <div style={{ color: '#888', fontSize: 12, padding: 16 }}>
      {t('app.loading')}
    </div>
  )
}

type ModuleProps = {
  clickedPos: { lat: string; lng: string } | null
}

function Inner() {
  const { t, toggleLang, dir } = useTranslation()
  const [activeModule, setActiveModule] = useState('osm')
  const [clickedPos, setClickedPos] = useState<{
    lat: string
    lng: string
  } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
      if (e.matches) setSidebarOpen(false)
      else setSidebarOpen(true)
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
      const pos = {
        lat: latlng.lat.toFixed(6),
        lng: latlng.lng.toFixed(6),
      }
      setClickedPos(pos)
      window.dispatchEvent(
        new CustomEvent('mapclick', { detail: latlng })
      )
    },
    []
  )

  const handleDblClick = useCallback(
    (latlng: { lat: number; lng: number }) => {
      const pos = {
        lat: latlng.lat.toFixed(6),
        lng: latlng.lng.toFixed(6),
      }
      setClickedPos(pos)
      window.dispatchEvent(
        new CustomEvent('mapdblclick', { detail: latlng })
      )
    },
    []
  )

  const ActiveComp = modules.find((m) => m.id === activeModule)!.Comp as React.ComponentType<ModuleProps>

  const sidebarContent = (
    <>
      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4"
        style={{ color: '#2d2d2d', wordBreak: 'break-word' }}
      >
        <Suspense fallback={<Fallback t={t} />}>
          <ActiveComp clickedPos={clickedPos} />
        </Suspense>
      </div>
      <div style={{ height: 3, background: 'linear-gradient(90deg, #5238e1, #3d29b0)' }} />
      <div className="shrink-0 px-4 pb-4" style={{ background: '#ebe5d8' }}>
        <ClickedPosition pos={clickedPos} />
      </div>
    </>
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden" dir={dir}>
      <nav className="flex h-[52px] items-center justify-between border-b px-5"
        style={{
          background: 'linear-gradient(135deg, #f5f0e8, #f0ebe2)',
          borderColor: '#d5cfc4',
        }}
      >
        <div className="flex items-center gap-3 shrink-0">
          {isMobile && (
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2d2d2d',
                cursor: 'pointer',
                fontSize: 20,
                padding: '4px 6px',
                lineHeight: 1,
              }}
            >
              {sidebarOpen ? '✕' : '☰'}
            </button>
          )}
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #5238e1, #3d29b0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
          }}>M</div>
          <span className="text-lg font-bold" style={{
            background: 'linear-gradient(135deg, #5238e1, #7c6af0)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}>
            {t('app.title')}
          </span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveModule(m.id)}
              className="cursor-pointer rounded-md border px-3 py-1.5 text-[13px] shrink-0"
              style={{
                borderColor: activeModule === m.id ? '#5238e1' : '#d5cfc4',
                background:
                  activeModule === m.id
                    ? 'linear-gradient(135deg, #5238e1, #3d29b0)'
                    : 'transparent',
                color:
                  activeModule === m.id ? '#fff' : '#777',
                boxShadow: activeModule === m.id ? '0 2px 8px rgba(82,56,225,0.3)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (activeModule !== m.id) {
                  e.currentTarget.style.background = 'rgba(82,56,225,0.08)'
                  e.currentTarget.style.color = '#2d2d2d'
                }
              }}
              onMouseLeave={(e) => {
                if (activeModule !== m.id) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#777'
                }
              }}
            >
              {m.label}
            </button>
          ))}
          <button
            onClick={toggleLang}
            className="cursor-pointer rounded-md border px-2.5 py-1.5 text-[12px] shrink-0 ml-2"
            style={{
              borderColor: '#d5cfc4', color: '#777', background: 'transparent',
              transition: 'all 0.2s',
            }}
            title={t('nav.lang')}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(82,56,225,0.08)'; e.currentTarget.style.color = '#2d2d2d' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#777' }}
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
                style={{
                  position: 'fixed',
                  inset: 0,
                  top: 52,
                  zIndex: 49,
                  background: 'rgba(0,0,0,0.5)',
                }}
              />
            )}
            <aside
              style={((): React.CSSProperties => {
                const base: React.CSSProperties = {
                  position: 'fixed',
                  top: 52,
                  bottom: 0,
                  zIndex: 50,
                  width: '85vw',
                  maxWidth: 360,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  background: 'linear-gradient(180deg, #f5f0e8 0%, #ede8dc 100%)',
                  transition: 'transform 0.3s ease-in-out',
                  pointerEvents: sidebarOpen ? 'auto' : 'none',
                }
                if (dir === 'rtl') {
                  base.right = 0
                  base.borderLeft = '1px solid #d5cfc4'
                  base.transform = sidebarOpen ? 'translateX(0)' : 'translateX(100%)'
                } else {
                  base.left = 0
                  base.borderRight = '1px solid #d5cfc4'
                  base.transform = sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'
                }
                return base
              })()}
            >
              {sidebarContent}
            </aside>
          </>
        ) : (
          <aside
            className="flex w-[380px] min-w-[380px] flex-col overflow-hidden"
            style={{
              borderRight: dir === 'ltr' ? '1px solid #d5cfc4' : 'none',
              borderLeft: dir === 'rtl' ? '1px solid #d5cfc4' : 'none',
              background: 'linear-gradient(180deg, #f5f0e8 0%, #ede8dc 100%)',
            }}
          >
            {sidebarContent}
          </aside>
        )}

          <main className="relative flex-1">
            <MapView
              onClick={handleMapClick}
              onDoubleClick={handleDblClick}
            />
          </main>
      </div>
    </div>
  )
}

export default function Home() {
  return <Inner />
}
