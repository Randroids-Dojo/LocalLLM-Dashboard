/**
 * Raw evidence handling: decompress the submitted gzip blobs for re-audit, and
 * (optionally) archive them to Vercel Blob. Decompression is size-guarded so a
 * decompression-bomb can't exhaust memory.
 */
import { gunzipSync } from 'node:zlib'

const MAX_DECOMPRESSED_BYTES = 8 * 1024 * 1024 // 8 MB / run artifact

export class EvidenceError extends Error {}

/** base64(gzip(text)) -> text, with a hard size cap. */
export function gunzipBase64(b64: string): string {
  let buf: Buffer
  try {
    buf = Buffer.from(b64, 'base64')
  } catch {
    throw new EvidenceError('invalid base64')
  }
  if (buf.byteLength > MAX_DECOMPRESSED_BYTES) {
    throw new EvidenceError('compressed evidence too large')
  }
  let out: Buffer
  try {
    out = gunzipSync(buf, { maxOutputLength: MAX_DECOMPRESSED_BYTES })
  } catch {
    throw new EvidenceError('gunzip failed')
  }
  return out.toString('utf8')
}

/**
 * Archive a run's raw evidence to Vercel Blob. Returns the blob URL, or null
 * when no BLOB_READ_WRITE_TOKEN is configured (v1 can run without archiving —
 * re-audit doesn't depend on it). Dynamically imported so the dependency only
 * loads when used.
 */
export async function archiveEvidence(
  machineId: string,
  runName: string,
  eventsB64: string,
  testB64: string,
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null
  const { put } = await import('@vercel/blob')
  const bundle = JSON.stringify({ events_log_gz: eventsB64, test_output_gz: testB64 })
  const safeRun = runName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180)
  const { url } = await put(`runs/${machineId}/${safeRun}.json`, bundle, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: true,
  })
  return url
}
