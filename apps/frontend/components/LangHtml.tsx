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
