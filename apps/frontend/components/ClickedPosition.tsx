/**
 * ClickedPosition – Displays the lat/lng coordinates of the last map click,
 * or a hint prompting the user to click the map.
 *
 * Props:
 *  - pos: { lat: string; lng: string } | null – The clicked coordinate pair to display.
 *
 * Part of the bottom toolbar; rendered beside other status indicators.
 */

'use client'

import { useTranslation } from '@/lib/i18n'
import { colors } from '@/lib/theme'

interface Props {
  pos: { lat: string; lng: string } | null
}

export default function ClickedPosition({ pos }: Props) {
  const { t } = useTranslation()
  if (!pos) {
    return (
      <div className="text-[11px]" style={{ color: colors.textFaint }}>
        {t('app.clickHint')}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <span style={{ color: colors.textSecondary }}>{t('app.clicked')}</span>
      <span style={{ color: colors.accent, fontWeight: 600 }}>
        {pos.lat}, {pos.lng}
      </span>
    </div>
  )
}
