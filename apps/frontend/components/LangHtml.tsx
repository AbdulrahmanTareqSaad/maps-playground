/**
 * LangHtml – Synchronises the document's `lang` and `dir` attributes with the
 * current i18n language/direction. Renders nothing (returns null).
 *
 * Placed near the root of the component tree so the entire page reflects the
 * active locale for accessibility and correct text shaping.
 */

'use client'

import { useEffect } from 'react'
import { useTranslation } from '@/lib/i18n'

export default function LangHtml() {
  const { lang, dir } = useTranslation()

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  return null
}
