/**
 * GET  /api/tracking/[id] — Retrieves a single tracker by ID from the in-memory store.
 * DELETE /api/tracking/[id] — Removes a tracker by ID from the in-memory store.
 * Params: id (path). Returns: tracker object or { ok: true } on deletion.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getTracker, removeTracker } from '@/lib/tracking-store'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tracker = getTracker(id)
  if (!tracker) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(tracker)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!removeTracker(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
