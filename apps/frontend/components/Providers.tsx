/**
 * Providers – Wraps the application tree with necessary context providers.
 * Currently supplies the i18n language context (`LangProvider`).
 *
 * Props:
 *  - children: ReactNode – The subtree to wrap.
 *
 * Sits at the top of the component hierarchy to make locale available everywhere.
 */

'use client'

import { type ReactNode } from 'react'
import { LangProvider } from '@/lib/i18n'

export default function Providers({ children }: { children: ReactNode }) {
  return <LangProvider>{children}</LangProvider>
}
