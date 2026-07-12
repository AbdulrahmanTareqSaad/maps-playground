/**
 * ui – Shared presentational primitives used throughout the sidebar and
 * settings panels. Provides themed Input, NumberInput, Label, Button,
 * StatusBanner, ResultsBox, CoordInput, and layout helpers (SectionTitle,
 * Subtitle, H3, Divider, FieldGroup).
 *
 * All components accept standard HTML attributes plus optional styling
 * overrides; they pull colours, radii, and gradients from the theme module.
 */

'use client'

import type { CSSProperties, ReactNode } from 'react'
import { colors, gradients, radii, fontSizes } from '@/lib/theme'

const inputStyle: CSSProperties = {
  width: '100%',
  background: colors.bgInput,
  border: `1px solid ${colors.border}`,
  color: colors.textPrimary,
  padding: '8px 10px',
  fontSize: fontSizes.base,
  borderRadius: radii.md,
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
}

const numberInputStyle: CSSProperties = {
  ...inputStyle,
  padding: '8px 6px',
  lineHeight: 1,
  flex: 1,
  minWidth: 0,
}

const labelStyle: CSSProperties = {
  color: colors.textMuted,
  marginBottom: 4,
  display: 'block',
  fontSize: fontSizes.sm,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const sectionTitleStyle: CSSProperties = {
  color: '#1a1a1a',
  marginBottom: 4,
  fontSize: fontSizes.title,
  fontWeight: 700,
}

const subtitleStyle: CSSProperties = {
  color: colors.textSecondary,
  marginBottom: 16,
  fontSize: fontSizes.base,
  lineHeight: 1.5,
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  full?: boolean
}

export function Input({ full, style, ...props }: InputProps) {
  return <input style={full ? inputStyle : { ...inputStyle, ...style }} {...props} />
}

export function NumberInput(props: InputProps) {
  return <input style={numberInputStyle} {...props} />
}

interface LabelProps {
  children: ReactNode
  hint?: ReactNode
  style?: CSSProperties
}

export function Label({ children, hint, style }: LabelProps) {
  return (
    <label style={{ ...labelStyle, ...style }}>
      {children}
      {hint && (
        <span style={{ marginLeft: 8, fontSize: fontSizes.xs, cursor: 'pointer', color: colors.accent, fontWeight: 400, textTransform: 'none' as const }}>
          {hint}
        </span>
      )}
    </label>
  )
}

export function SectionTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <h2 style={{ ...sectionTitleStyle, ...style }}>{children}</h2>
}

export function Subtitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ ...subtitleStyle, ...style }}>{children}</p>
}

export function H3({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <h3 style={{ color: '#1a1a1a', marginBottom: 8, fontSize: fontSizes.xxl, fontWeight: 700, ...style }}>{children}</h3>
}

export function Divider() {
  return <hr style={{ border: 'none', borderTop: `1px solid ${colors.border}`, marginTop: 16, marginBottom: 16 }} />
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'purple'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
}

const buttonGradients: Record<string, string> = {
  primary: gradients.primary,
  success: gradients.green,
  warning: gradients.orange,
  purple: gradients.purple,
  danger: gradients.primary,
}

export function Button({ variant = 'primary', disabled, loading, fullWidth, style, children, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        background: loading ? colors.borderLight : buttonGradients[variant],
        color: '#fff',
        padding: '9px 20px',
        fontSize: fontSizes.base,
        fontWeight: 600,
        borderRadius: radii.md,
        cursor: disabled || loading ? 'default' : 'pointer',
        border: 'none',
        opacity: loading ? 0.6 : 1,
        width: fullWidth ? '100%' : undefined,
        boxShadow: loading ? 'none' : `0 2px 8px ${colors.accentAlpha}`,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}

interface ResultsBoxProps {
  title?: string
  children: ReactNode
  maxHeight?: number
}

export function ResultsBox({ title, children, maxHeight = 200 }: ResultsBoxProps) {
  return (
    <div style={{ background: colors.bgSecondary, padding: 10, marginTop: 8, borderRadius: radii.lg, maxHeight, overflowY: 'auto' }}>
      {title && <div style={{ color: colors.textSecondary, fontSize: fontSizes.sm, marginBottom: 6 }}>{title}</div>}
      {children}
    </div>
  )
}

interface StatusBannerProps {
  variant: 'success' | 'info' | 'error' | 'warning'
  children: ReactNode
}

const bannerStyles: Record<string, CSSProperties> = {
  success: { background: gradients.success, color: colors.successText, border: `1px solid ${colors.successBorder}` },
  info: { background: colors.infoBg, color: colors.accent, border: `1px solid ${colors.infoBorder}` },
  error: { background: colors.dangerBg, color: colors.accent, border: `1px solid ${colors.dangerBorder}` },
  warning: { background: colors.bgSecondary, color: colors.textPrimary, border: `1px solid ${colors.borderLight}` },
}

export function StatusBanner({ variant, children }: StatusBannerProps) {
  return (
    <div style={{ ...bannerStyles[variant], padding: 10, marginBottom: 8, borderRadius: radii.lg, fontSize: fontSizes.base }}>
      {children}
    </div>
  )
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: '#f3e5f5', color: colors.accent, padding: 10, marginTop: 8, borderRadius: radii.lg, fontSize: fontSizes.base, border: `1px solid ${colors.border}` }}>
      {children}
    </div>
  )
}

interface FieldGroupProps {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
}

export function FieldGroup({ label, hint, children }: FieldGroupProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  )
}

interface CoordInputProps {
  lat: number
  lng: number
  onLatChange: (v: number) => void
  onLngChange: (v: number) => void
  step?: number
}

export function CoordInput({ lat, lng, onLatChange, onLngChange, step = 0.0001 }: CoordInputProps) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <NumberInput type="number" value={lat} step={step} onChange={e => onLatChange(+e.target.value)} />
      <NumberInput type="number" value={lng} step={step} onChange={e => onLngChange(+e.target.value)} />
    </div>
  )
}
