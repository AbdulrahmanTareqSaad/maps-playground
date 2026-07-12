import { NextRequest, NextResponse } from 'next/server'
import { deleteZone } from '@/lib/geofence-store'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!deleteZone(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
