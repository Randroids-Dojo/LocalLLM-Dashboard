/** Shared HTTP helpers for route handlers. */
import { NextResponse } from 'next/server'

/**
 * Silent drop — mirror VibeRacer: return 202 with {ok:false} for malformed /
 * rejected / rate-limited submissions so scrapers learn nothing about why.
 */
export function silentDrop() {
  return NextResponse.json({ ok: false }, { status: 202 })
}

/** Permissive CORS for the GET endpoints the macOS app calls cross-origin. */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function json(data: unknown, init?: ResponseInit & { cache?: string }) {
  const headers = new Headers(init?.headers)
  if (init?.cache) headers.set('Cache-Control', init.cache)
  return NextResponse.json(data, { ...init, headers })
}

export function corsJson(data: unknown, init?: ResponseInit & { cache?: string }) {
  const headers = new Headers(init?.headers)
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v)
  if (init?.cache) headers.set('Cache-Control', init.cache)
  return NextResponse.json(data, { ...init, headers })
}

export function intParam(value: string | null, fallback: number): number {
  if (value === null) return fallback
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}
