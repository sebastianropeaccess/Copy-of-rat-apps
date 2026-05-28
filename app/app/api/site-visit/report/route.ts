import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type JsonMap = Record<string, unknown>
type MediaRow = {
  id: string
  section: string | null
  media_type: 'photo' | 'video'
  url: string
  comment: string | null
  include_in_proposal: boolean
  created_at: string
}
type InspectionRow = {
  id: string
  site_name: string | null
  site_address: string | null
  site_contact: string | null
  site_phone: string | null
  site_email: string | null
  cts_sp_number: string | null
  site_classification: string | null
  visit_date: string | null
  enquiry_date: string | null
  proposal_due_date: string | null
  scopes: unknown
  scope_answers: unknown
  building_notes_snapshot: unknown
  height_safety_snapshot: unknown
  todays_hazards: unknown
  elevations_snapshot: unknown
  site_logistics_snapshot: unknown
  specific_equipment: unknown
  salesperson_id: string | null
  created_by: string | null
  sv_companies?: { name?: string | null } | null
}

const TZ = 'Australia/Brisbane'

function asMap(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {}
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function textValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not recorded'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    const row = value as JsonMap
    const parts = [
      row.checked === true ? 'Checked' : row.checked === false ? 'Not checked' : '',
      typeof row.answer === 'string' ? row.answer.toUpperCase() : '',
      typeof row.comment === 'string' ? row.comment : '',
      typeof row.notes === 'string' ? row.notes : '',
    ].filter(Boolean)
    return parts.length ? parts.join(' - ') : JSON.stringify(value)
  }
  return String(value)
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleDateString('en-AU', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' })
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

function addWrapped(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 5): number {
  const lines = doc.splitTextToSize(text || 'Not recorded', maxWidth)
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

function addPageIfNeeded(doc: jsPDF, y: number, minSpace = 24): number {
  if (y < 270 - minSpace) return y
  doc.addPage()
  return 18
}

function addHeader(doc: jsPDF, title: string) {
  doc.setFillColor(16, 36, 55)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('RAT', 14, 18)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Rope Access Technicians', 14, 24)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 196, 18, { align: 'right' })
  doc.setTextColor(20, 30, 40)
}

function addFooter(doc: jsPDF, salesperson: string, generated: string) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(220, 225, 230)
    doc.line(14, 282, 196, 282)
    doc.setFontSize(8)
    doc.setTextColor(90, 100, 110)
    doc.text(`Generated ${generated} | Salesperson: ${salesperson}`, 14, 288)
    doc.text(`Page ${i} of ${pages}`, 196, 288, { align: 'right' })
    doc.setTextColor(20, 30, 40)
  }
}

async function addPhotos(doc: jsPDF, y: number, photos: MediaRow[], max = 4): Promise<number> {
  const photoRows = photos.filter((row) => row.media_type === 'photo').slice(0, max)
  if (photoRows.length === 0) return y
  y = addPageIfNeeded(doc, y, 52)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Photos', 14, y)
  y += 4

  for (const row of photoRows) {
    y = addPageIfNeeded(doc, y, 48)
    const dataUrl = await fetchImageDataUrl(row.url)
    if (dataUrl) {
      try {
        const imageType = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
        doc.addImage(dataUrl, imageType, 14, y, 54, 38, undefined, 'FAST')
      } catch {
        doc.setFont('helvetica', 'normal')
        doc.text('Photo could not be embedded', 14, y + 6)
      }
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(row.include_in_proposal ? 'Included in proposal' : 'Reference only', 72, y + 5)
    if (row.comment) addWrapped(doc, row.comment, 72, y + 11, 112, 4)
    y += 44
  }
  return y
}

async function addKeyValueSection(doc: jsPDF, title: string, rows: Array<[string, string]>, y: number): Promise<number> {
  y = addPageIfNeeded(doc, y, 28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(title, 14, y)
  y += 7
  doc.setFontSize(9)
  for (const [label, value] of rows) {
    y = addPageIfNeeded(doc, y, 14)
    doc.setFont('helvetica', 'bold')
    doc.text(label, 14, y)
    doc.setFont('helvetica', 'normal')
    y = addWrapped(doc, value, 62, y, 132, 5) + 1
  }
  return y + 3
}

async function addMapSection(doc: jsPDF, title: string, data: JsonMap, media: MediaRow[], y: number): Promise<number> {
  y = addPageIfNeeded(doc, y, 26)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(title, 14, y)
  y += 7

  const entries = Object.entries(data)
  if (entries.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Not recorded', 14, y)
    return y + 9
  }

  for (const [key, value] of entries) {
    y = addPageIfNeeded(doc, y, 16)
    const cleanKey = key.replace(/^custom:/, '')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    y = addWrapped(doc, cleanKey, 14, y, 52, 5)
    doc.setFont('helvetica', 'normal')
    y = addWrapped(doc, textValue(value), 62, y - 5, 132, 5) + 1
    const sectionPhotos = media.filter((row) => row.section?.endsWith(key) || row.section?.includes(`:${key}`))
    y = await addPhotos(doc, y, sectionPhotos, 2)
  }
  return y + 3
}

export async function GET(request: NextRequest) {
  const inspectionId = request.nextUrl.searchParams.get('inspectionId')
  if (!inspectionId) return NextResponse.json({ error: 'inspectionId required' }, { status: 400 })

  const [{ data: inspection, error }, { data: mediaRows }, { data: members }] = await Promise.all([
    supabase.from('sv_inspections').select('*, sv_companies(name)').eq('id', inspectionId).single(),
    supabase.from('sv_inspection_media').select('*').eq('inspection_id', inspectionId).order('created_at'),
    supabase.from('team_members').select('id,name'),
  ])

  if (error || !inspection) {
    return NextResponse.json({ error: 'Inspection not found' }, { status: 404 })
  }

  const row = inspection as InspectionRow
  const media = (mediaRows || []) as MediaRow[]
  const salespersonId = row.salesperson_id || row.created_by
  const salesperson = (members || []).find((member: { id: string; name: string }) => member.id === salespersonId)?.name || 'Unassigned'
  const generated = new Date().toLocaleDateString('en-AU', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Site Visit Report')
  let y = 40

  y = await addKeyValueSection(doc, 'Site Info', [
    ['Site', row.site_name || 'Not recorded'],
    ['Client', row.sv_companies?.name || 'Not recorded'],
    ['Address', row.site_address || 'Not recorded'],
    ['Contact', [row.site_contact, row.site_phone, row.site_email].filter(Boolean).join(' | ') || 'Not recorded'],
    ['CTS/SP #', row.cts_sp_number || 'Not recorded'],
    ['Classification', row.site_classification || 'Not recorded'],
    ['Visit Date', formatDate(row.visit_date)],
    ['Proposal Due', formatDate(row.proposal_due_date)],
  ], y)

  y = await addKeyValueSection(doc, 'Scopes Selected', [
    ['Scopes', asStringArray(row.scopes).join(', ') || 'Not recorded'],
  ], y)
  y = await addMapSection(doc, 'Scope Notes', asMap(row.scope_answers), media, y)
  y = await addMapSection(doc, 'Building Notes', asMap(row.building_notes_snapshot), media, y)
  y = await addMapSection(doc, 'Height Safety Checklist', asMap(row.height_safety_snapshot), media, y)
  y = await addMapSection(doc, 'Hazards', asMap(row.todays_hazards), media.filter((item) => item.section?.startsWith('hazard:')), y)
  y = await addMapSection(doc, 'Elevations', asMap(row.elevations_snapshot), media.filter((item) => item.section?.startsWith('elevation:')), y)
  y = await addMapSection(doc, 'Site Logistics', asMap(row.site_logistics_snapshot), media.filter((item) => item.section?.startsWith('logistics:')), y)
  y = await addMapSection(doc, 'Equipment', asMap(row.specific_equipment), media.filter((item) => item.section?.startsWith('equipment:')), y)
  await addPhotos(doc, y, media.filter((item) => !item.section), 6)

  addFooter(doc, salesperson, generated)
  const pdf = Buffer.from(doc.output('arraybuffer'))
  const filename = `${(row.site_name || 'site-visit').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-site-visit.pdf`

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
