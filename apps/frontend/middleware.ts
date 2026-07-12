/**
 * Next.js middleware — logs visitor IP for every request hitting the frontend.
 * Runs on the Edge Runtime before page rendering and API routes.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  const ua = req.headers.get('user-agent') || '-'
  console.warn(`[visit] ip=${ip} path=${req.nextUrl.pathname} ua=${ua}`)
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
