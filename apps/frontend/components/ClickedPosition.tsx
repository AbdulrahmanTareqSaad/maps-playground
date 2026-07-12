'use client'

import { useTranslation } from '@/lib/i18n'

interface Props {
  pos: { lat: string; lng: string } | null
}

export default function ClickedPosition({ pos }: Props) {
  const { t } = useTranslation()
  if (!pos) {
    return (
      <div className="text-[11px]" style={{ color: '#555' }}>
        Click the map to see coordinates
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <span style={{ color: '#888' }}>{t('app.clicked')}</span>
      <span style={{ color: '#5238e1', fontWeight: 600 }}>
        {pos.lat}, {pos.lng}
      </span>
    </div>
  )
}
