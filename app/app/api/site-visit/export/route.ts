import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type MediaRow = {
  id: string
  section: string | null
  url: string
  comment: string | null
  created_at: string
}

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date = new Date()): { time: number; date: number } {
  const year = Math.max(date.getFullYear(), 1980)
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

function writeU16(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff)
}

function writeU32(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
}

function appendBytes(out: number[], bytes: Uint8Array) {
  for (const byte of bytes) out.push(byte)
}

class JSZip {
  private files: Array<{ name: string; data: Uint8Array; date: Date }> = []

  file(name: string, data: ArrayBuffer | Uint8Array | string) {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data)
    this.files.push({ name, data: bytes, date: new Date() })
    return this
  }

  async generateAsync(_options: { type: 'uint8array' }): Promise<Uint8Array> {
    const output: number[] = []
    const central: number[] = []
    let offset = 0

    for (const entry of this.files) {
      const name = new TextEncoder().encode(entry.name)
      const crc = crc32(entry.data)
      const stamp = dosDateTime(entry.date)

      writeU32(output, 0x04034b50)
      writeU16(output, 20)
      writeU16(output, 0)
      writeU16(output, 0)
      writeU16(output, stamp.time)
      writeU16(output, stamp.date)
      writeU32(output, crc)
      writeU32(output, entry.data.length)
      writeU32(output, entry.data.length)
      writeU16(output, name.length)
      writeU16(output, 0)
      appendBytes(output, name)
      appendBytes(output, entry.data)

      writeU32(central, 0x02014b50)
      writeU16(central, 20)
      writeU16(central, 20)
      writeU16(central, 0)
      writeU16(central, 0)
      writeU16(central, stamp.time)
      writeU16(central, stamp.date)
      writeU32(central, crc)
      writeU32(central, entry.data.length)
      writeU32(central, entry.data.length)
      writeU16(central, name.length)
      writeU16(central, 0)
      writeU16(central, 0)
      writeU16(central, 0)
      writeU16(central, 0)
      writeU32(central, 0)
      writeU32(central, offset)
      appendBytes(central, name)

      offset = output.length
    }

    const centralOffset = output.length
    output.push(...central)
    writeU32(output, 0x06054b50)
    writeU16(output, 0)
    writeU16(output, 0)
    writeU16(output, this.files.length)
    writeU16(output, this.files.length)
    writeU32(output, central.length)
    writeU32(output, centralOffset)
    writeU16(output, 0)

    return new Uint8Array(output)
  }
}

function extensionFrom(contentType: string | null, url: string): string {
  if (contentType?.includes('png')) return 'png'
  if (contentType?.includes('webp')) return 'webp'
  if (contentType?.includes('gif')) return 'gif'
  const match = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i)
  return match?.[1]?.toLowerCase() || 'jpg'
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'photo'
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const inspectionId = request.nextUrl.searchParams.get('inspectionId')
  if (!inspectionId) return NextResponse.json({ error: 'inspectionId required' }, { status: 400 })

  const [{ data: inspection, error }, { data: mediaRows, error: mediaError }] = await Promise.all([
    supabase.from('sv_inspections').select('id,site_name').eq('id', inspectionId).single(),
    supabase
      .from('sv_inspection_media')
      .select('id,section,url,comment,created_at')
      .eq('inspection_id', inspectionId)
      .eq('include_in_proposal', true)
      .eq('media_type', 'photo')
      .order('created_at'),
  ])

  if (error || !inspection) return NextResponse.json({ error: 'Inspection not found' }, { status: 404 })
  if (mediaError) return NextResponse.json({ error: mediaError.message }, { status: 500 })

  const zip = new JSZip()
  const rows = (mediaRows || []) as MediaRow[]
  const manifest: string[] = [`Inspection: ${inspection.site_name || inspectionId}`, `Photos: ${rows.length}`, '']

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    const res = await fetch(row.url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) {
      manifest.push(`${index + 1}. Failed to fetch ${row.url} (${res.status})`)
      continue
    }
    const bytes = await res.arrayBuffer()
    const ext = extensionFrom(res.headers.get('content-type'), row.url)
    const section = safeName(row.section || 'site-visit')
    const filename = `${String(index + 1).padStart(2, '0')}-${section}.${ext}`
    zip.file(filename, bytes)
    manifest.push(`${filename} | ${row.section || 'Unsectioned'}${row.comment ? ` | ${row.comment}` : ''}`)
  }

  zip.file('manifest.txt', manifest.join('\n'))
  const archive = await zip.generateAsync({ type: 'uint8array' })
  const filename = `${safeName(inspection.site_name || 'site-visit')}-proposal-photos.zip`

  return new NextResponse(Buffer.from(archive), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
