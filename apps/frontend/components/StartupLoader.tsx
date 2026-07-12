/**
 * StartupLoader – Full-screen splash overlay that guides the user through a
 * GPS permission prompt before handing off to the main app.
 *
 * Props:
 *  - onDone: (loc: { lat: number; lng: number } | null) => void
 *      Called when the splash sequence completes, passing the granted
 *      location or null if denied/skipped.
 *
 * Manages an internal phase machine (entering → gps-prompt → granted/denied → exiting)
 * and renders an animated pin-drop illustration with ripple effects.
 */

'use client'

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { useTranslation } from '@/lib/i18n'
import { colors, gradients, mapDefaults } from '@/lib/theme'

type Phase = 'entering' | 'gps-prompt' | 'gps-granted' | 'gps-denied' | 'exiting'

interface Props {
  onDone: (loc: { lat: number; lng: number } | null) => void
}

export default function StartupLoader({ onDone }: Props) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('entering')

  useEffect(() => {
    const timer = setTimeout(() => setPhase('gps-prompt'), 1200)
    return () => clearTimeout(timer)
  }, [])

  const transition = useCallback(
    (loc: { lat: number; lng: number } | null) => {
      setPhase(loc ? 'gps-granted' : 'gps-denied')
      setTimeout(() => onDone(loc), 900)
    },
    [onDone],
  )

  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) { transition(null); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => transition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => transition(null),
      { enableHighAccuracy: false, timeout: mapDefaults.gpsTimeout, maximumAge: mapDefaults.gpsMaxAge },
    )
  }, [transition])

  const skipGPS = useCallback(() => transition(null), [transition])

  const visible = phase !== 'exiting'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: gradients.bg,
      transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
      opacity: visible ? 1 : 0,
      transform: visible ? 'scale(1)' : 'scale(1.04)',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <div style={styles.pinContainer}>
        <div style={styles.rippleBase}>
          <div style={{ ...styles.ripple, animationName: 'loader-ripple' }} />
          <div style={{ ...styles.ripple, animationName: 'loader-ripple', animationDelay: '0.6s' }} />
          <div style={{ ...styles.ripple, animationName: 'loader-ripple', animationDelay: '1.2s' }} />
        </div>
        <div style={styles.shadow} />
        <div style={styles.pin}>
          <svg width="64" height="88" viewBox="0 0 64 88" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="loader-pin-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.accentLight} />
                <stop offset="50%" stopColor={colors.accent} />
                <stop offset="100%" stopColor={colors.accentDark} />
              </linearGradient>
              <filter id="loader-pin-shadow" x="-30%" y="-10%" width="160%" height="160%">
                <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor={colors.accent} floodOpacity="0.3" />
              </filter>
            </defs>
            <path d="M32 4C14.33 4 0 18.33 0 36C0 59 32 84 32 84C32 84 64 59 64 36C64 18.33 49.67 4 32 4Z" fill="url(#loader-pin-grad)" filter="url(#loader-pin-shadow)" />
            <circle cx="32" cy="34" r="12" fill="white" opacity="0.95" />
            <circle cx="32" cy="34" r="5" fill={colors.accent} opacity="0.85">
              <animate attributeName="r" values="4;5.5;4" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
      </div>

      <div style={{ ...styles.title, opacity: phase === 'entering' ? 0 : 1, transform: phase === 'entering' ? 'translateY(8px)' : 'translateY(0)' }}>
        {t('app.title')}
      </div>
      <div style={{ ...styles.subtitle, opacity: phase === 'entering' ? 0 : 1 }}>
        {t('app.description')}
      </div>

      <div style={{ ...styles.gpsSection, opacity: phase === 'gps-prompt' ? 1 : 0, transform: phase === 'gps-prompt' ? 'translateY(0)' : 'translateY(12px)', pointerEvents: phase === 'gps-prompt' ? 'auto' : 'none' }}>
        <p style={styles.gpsText}>{t('startup.enableGPS')}</p>
        <button onClick={requestGPS} style={styles.gpsButton}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          {t('startup.allowLocation')}
        </button>
        <button onClick={skipGPS} style={styles.skipButton}>{t('startup.skip')}</button>
      </div>

      <div style={{ ...styles.statusText, opacity: phase === 'gps-granted' || phase === 'gps-denied' ? 1 : 0, transform: phase === 'gps-granted' || phase === 'gps-denied' ? 'translateY(0)' : 'translateY(8px)' }}>
        {phase === 'gps-granted'
          ? <span style={{ color: colors.success }}>✓ {t('startup.locationGranted')}</span>
          : <span style={{ color: colors.textMuted }}>{t('startup.locationSkipped')}</span>}
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  pinContainer: { position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  pin: { position: 'relative', zIndex: 2, animation: 'loader-pin-drop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards', filter: `drop-shadow(0 4px 12px ${colors.accentAlpha})` },
  shadow: { position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 40, height: 8, borderRadius: '50%', background: `rgba(82,56,225,0.12)`, animation: 'loader-shadow 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards', zIndex: 1 },
  rippleBase: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0 },
  ripple: { position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: '1.5px solid rgba(82,56,225,0.15)', animation: 'loader-ripple 2.4s ease-out infinite' },
  title: { fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', background: gradients.primaryHover, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 6, transition: 'opacity 0.5s ease, transform 0.5s ease' },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 40, transition: 'opacity 0.5s ease 0.1s' },
  gpsSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, transition: 'opacity 0.4s ease, transform 0.4s ease' },
  gpsText: { fontSize: 15, color: '#555', margin: 0, textAlign: 'center' as const },
  gpsButton: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, color: '#fff', background: gradients.primary, border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: `0 4px 20px ${colors.accentAlpha}`, transition: 'transform 0.15s, box-shadow 0.15s' },
  skipButton: { padding: '8px 20px', fontSize: 13, fontWeight: 500, color: colors.textFaint, background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' },
  statusText: { fontSize: 14, fontWeight: 500, marginTop: 20, transition: 'opacity 0.4s ease, transform 0.4s ease' },
}
