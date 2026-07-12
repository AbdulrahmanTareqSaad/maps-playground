'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import en from './en'
import ar from './ar'
import type { Translations } from './en'

export type Lang = 'en' | 'ar'

const dicts: Record<Lang, Translations> = { en, ar }

interface LangCtx {
  lang: Lang
  dir: 'ltr' | 'rtl'
  t: (key: string, vars?: Record<string, string | number>) => string
  setLang: (l: Lang) => void
  toggleLang: () => void
  tEn: (key: string, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<LangCtx>(null as any)

function resolve(obj: any, path: string): string | undefined {
  return path.split('.').reduce((o, k) => (o ? (o as any)[k] : undefined), obj) as string | undefined
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const val = resolve(dicts[lang], key)
      if (val == null) return key
      if (!vars) return val
      return val.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
    },
    [lang],
  )

  const tEn = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const val = resolve(dicts.en, key)
      if (val == null) return key
      if (!vars) return val
      return val.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
    },
    [],
  )

  const toggleLang = useCallback(() => setLang((l) => (l === 'en' ? 'ar' : 'en')), [])

  return (
    <Ctx.Provider value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t, setLang, toggleLang, tEn }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTranslation() {
  return useContext(Ctx)
}
