/**
 * DELETE /api/geofence/[id]
 * Removes a geofence zone by ID from the in-memory store.
 * Params: id (path). Returns: { ok: true } or 404 if not found.
 */
import { NextRequest, NextResponse } from 'next/server'
import { deleteZone } from '@/lib/geofence-store'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!deleteZone(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
