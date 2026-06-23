import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'
import { getSupabase } from '../../../../lib/supabase'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface InspectionRow {
  id: string
  building_name: string
  drop_count: number
  floor_count: number
  drop_labelling: string
  relevant_locations: string[] | null
  relevant_defect_types: string[] | null
  drop_plan_url: string | null
  inspector_names: string[] | null
  status: string
  created_by: string
  created_at: string
}

interface DefectRow {
  id: string
  inspection_id: string
  drop: string
  floor: number
  location: string | null
  defect_type: string
  sub_type: string | null
  repair_number: string | null
  length_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  quantity: number | null
  photo1_url: string | null
  photo2_url: string | null
  comments: string | null
  created_by: string
  created_at: string
}

interface ReportPhoto {
  label: string
  url: string
}

interface CompressedPhoto extends ReportPhoto {
  bytes: Uint8Array
}

const pageSize: [number, number] = [595.28, 841.89]
const margin = 36
const navy = rgb(0.1, 0.13, 0.2)
const orange = rgb(0.91, 0.39, 0)
const gray = rgb(0.42, 0.46, 0.52)
const lightGray = rgb(0.94, 0.95, 0.97)

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'inspection_report'
}

function photoSettings(photoCount: number) {
  if (photoCount <= 80) return { width: 900, quality: 52 }
  if (photoCount <= 200) return { width: 720, quality: 45 }
  if (photoCount <= 500) return { width: 640, quality: 38 }
  return { width: 520, quality: 32 }
}

function isImageUrl(url: string) {
  const clean = url.split('?')[0].toLowerCase()
  return !clean.endsWith('.mp4') && !clean.endsWith('.mov') && !clean.endsWith('.webm')
}

function uniquePhotos(photos: ReportPhoto[]) {
  const seen = new Set<string>()
  return photos.filter((photo) => {
    if (!photo.url || seen.has(photo.url) || !isImageUrl(photo.url)) return false
    seen.add(photo.url)
    return true
  })
}

function defectPhotos(defect: DefectRow): ReportPhoto[] {
  const photos: ReportPhoto[] = []
  if (defect.photo1_url) photos.push({ label: 'Photo 1', url: defect.photo1_url })
  if (defect.photo2_url) photos.push({ label: 'Photo 2', url: defect.photo2_url })
  return uniquePhotos(photos)
}

function planPhotos(inspection: InspectionRow): ReportPhoto[] {
  if (!inspection.drop_plan_url) return []
  return uniquePhotos([{ label: 'Drop plan', url: inspection.drop_plan_url }])
}

async function compressPhoto(photo: ReportPhoto, totalPhotoCount: number): Promise<CompressedPhoto | null> {
  try {
    const response = await fetch(photo.url, { signal: AbortSignal.timeout(6000) })
    if (!response.ok) return null
    const input = Buffer.from(await response.arrayBuffer())
    const settings = photoSettings(totalPhotoCount)

    let quality = settings.quality
    let width = settings.width
    let output = await sharp(input)
      .rotate()
      .resize({ width, height: Math.round(width * 0.75), fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()

    while (output.byteLength > 140_000 && quality > 28) {
      quality -= 6
      width = Math.max(480, width - 80)
      output = await sharp(input)
        .rotate()
        .resize({ width, height: Math.round(width * 0.75), fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer()
    }

    return { ...photo, bytes: new Uint8Array(output) }
  } catch {
    return null
  }
}

async function mapConcurrent<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await mapper(items[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function text(page: PDFPage, value: string, x: number, y: number, size: number, font: Awaited<ReturnType<PDFDocument['embedFont']>>, color = navy) {
  page.drawText(value, { x, y, size, font, color })
}

function truncate(value: string, max = 90) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value
}

function dimensions(defect: DefectRow) {
  const parts: string[] = []
  if (defect.length_mm) parts.push(`L ${defect.length_mm}mm`)
  if (defect.height_mm) parts.push(`H ${defect.height_mm}mm`)
  if (defect.depth_mm) parts.push(`D ${defect.depth_mm}mm`)
  if (defect.quantity) parts.push(`Qty ${defect.quantity}`)
  return parts.join(' | ')
}

function alphaDropValue(value: string) {
  return value.toUpperCase().split('').reduce((total, char) => {
    const code = char.charCodeAt(0)
    if (code < 65 || code > 90) return Number.NaN
    return total * 26 + (code - 64)
  }, 0)
}

function dropSortValue(value: string) {
  const clean = String(value || '').trim()
  if (/^\d+$/.test(clean)) return { type: 0, value: Number(clean), label: clean }
  if (/^[A-Za-z]+$/.test(clean)) return { type: 1, value: alphaDropValue(clean), label: clean.toUpperCase() }
  const numberMatch = clean.match(/\d+/)
  return { type: 2, value: numberMatch ? Number(numberMatch[0]) : Number.MAX_SAFE_INTEGER, label: clean }
}

function compareDefectsByReportOrder(a: DefectRow, b: DefectRow) {
  const dropA = dropSortValue(a.drop)
  const dropB = dropSortValue(b.drop)

  if (dropA.type !== dropB.type) return dropA.type - dropB.type
  if (dropA.value !== dropB.value) return dropA.value - dropB.value

  const labelCompare = dropA.label.localeCompare(dropB.label, undefined, { numeric: true, sensitivity: 'base' })
  if (labelCompare !== 0) return labelCompare

  return String(a.floor).localeCompare(String(b.floor), undefined, { numeric: true, sensitivity: 'base' })
}

function drawWrapped(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  maxChars: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  color = navy
) {
  const words = value.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (`${line} ${word}`.trim().length > maxChars) {
      if (line) lines.push(line)
      line = word
    } else {
      line = `${line} ${word}`.trim()
    }
  }
  if (line) lines.push(line)

  for (const row of lines.slice(0, 4)) {
    text(page, row, x, y, size, font, color)
    y -= size + 3
  }
  return y
}

async function drawPhotoGrid(
  pdf: PDFDocument,
  page: PDFPage,
  photos: CompressedPhoto[],
  startY: number,
  regularFont: Awaited<ReturnType<PDFDocument['embedFont']>>
) {
  let y = startY
  const photoW = 158
  const photoH = 118
  const gap = 12
  const cols = 3
  const minY = 54

  for (let i = 0; i < photos.length; i++) {
    const col = i % cols
    if (col === 0 && i > 0) y -= photoH + 24
    if (y - photoH < minY) {
      page = pdf.addPage(pageSize)
      y = pageSize[1] - margin
    }

    const x = margin + col * (photoW + gap)
    const image = await pdf.embedJpg(photos[i].bytes)
    page.drawImage(image, { x, y: y - photoH, width: photoW, height: photoH })
    if (photos[i].label) {
      text(page, truncate(photos[i].label, 24), x, y - photoH - 10, 7, regularFont, gray)
    }
  }

  return { page, y: y - photoH - 30 }
}

async function drawDropPlans(
  pdf: PDFDocument,
  page: PDFPage,
  plans: CompressedPhoto[],
  startY: number,
  boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>,
  regularFont: Awaited<ReturnType<PDFDocument['embedFont']>>
) {
  let y = startY
  if (plans.length === 0) return { page, y }

  text(page, 'Drop Plan Context', margin, y, 13, boldFont)
  y -= 18

  for (let i = 0; i < plans.length; i++) {
    const boxW = pageSize[0] - margin * 2
    const boxH = 300
    if (y - boxH < 60) {
      page = pdf.addPage(pageSize)
      y = pageSize[1] - margin
      text(page, 'Drop Plan Context', margin, y, 13, boldFont)
      y -= 18
    }

    const image = await pdf.embedJpg(plans[i].bytes)
    const scale = Math.min(boxW / image.width, boxH / image.height)
    const width = image.width * scale
    const height = image.height * scale
    const x = margin + (boxW - width) / 2

    page.drawRectangle({ x: margin, y: y - boxH, width: boxW, height: boxH, color: rgb(0.98, 0.98, 0.98), borderColor: lightGray, borderWidth: 1 })
    page.drawImage(image, { x, y: y - height - 8, width, height })
    text(page, plans[i].label, margin, y - boxH - 12, 8, regularFont, gray)
    y -= boxH + 28
  }

  return { page, y }
}

function countBy(defects: DefectRow[], pick: (d: DefectRow) => string): [string, number][] {
  const result: Record<string, number> = {}
  for (const d of defects) {
    const key = pick(d) || 'Unset'
    result[key] = (result[key] || 0) + 1
  }
  return Object.entries(result).sort((a, b) => b[1] - a[1])
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const searchParams = request.nextUrl.searchParams
  const inspectionId = searchParams.get('inspectionId')
  const defectFilter = searchParams.get('defectType') || ''
  const dropFilter = searchParams.get('drop') || ''
  const includePhotos = searchParams.get('photos') !== 'false'

  if (!inspectionId) {
    return NextResponse.json({ error: 'inspectionId required' }, { status: 400 })
  }

  const { data: inspection, error: inspectionError } = await supabase
    .from('facade_inspections')
    .select('*')
    .eq('id', inspectionId)
    .single()

  if (inspectionError || !inspection) {
    return NextResponse.json({ error: 'Inspection not found' }, { status: 404 })
  }

  let query = supabase
    .from('facade_defects')
    .select('*')
    .eq('inspection_id', inspectionId)

  if (defectFilter) query = query.eq('defect_type', defectFilter)
  if (dropFilter) query = query.eq('drop', dropFilter)

  const { data: rows, error: defectError } = await query
  if (defectError) {
    return NextResponse.json({ error: defectError.message }, { status: 500 })
  }

  const typedInspection = inspection as InspectionRow
  const defects = ((rows || []) as DefectRow[]).sort(compareDefectsByReportOrder)

  const compressedPlans = (await mapConcurrent(planPhotos(typedInspection), 4, (photo) => compressPhoto(photo, 10)))
    .filter(Boolean) as CompressedPhoto[]

  const allPhotos = includePhotos ? defects.flatMap(defectPhotos) : []
  const compressedByUrl = new Map<string, CompressedPhoto>()
  const uniquePhotoList = uniquePhotos(allPhotos)
  const compressedPhotos = await mapConcurrent(uniquePhotoList, 40, (photo) => compressPhoto(photo, allPhotos.length))
  for (const compressed of compressedPhotos) {
    if (compressed) compressedByUrl.set(compressed.url, compressed)
  }

  const pdf = await PDFDocument.create()
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica)
  let page = pdf.addPage(pageSize)
  let y = pageSize[1] - margin
  const pageW = pageSize[0]

  page.drawRectangle({ x: 0, y: pageSize[1] - 82, width: pageW, height: 82, color: navy })
  text(page, 'Facade Inspection Report', margin, pageSize[1] - 35, 22, boldFont, rgb(1, 1, 1))
  text(page, typedInspection.building_name, margin, pageSize[1] - 56, 13, regularFont, rgb(0.82, 0.86, 0.9))
  text(page, `Generated ${new Date().toLocaleDateString('en-AU', { dateStyle: 'medium' })}`, margin, pageSize[1] - 72, 9, regularFont, rgb(0.72, 0.76, 0.82))
  text(page, 'Rope Access Technicians', pageW - 166, pageSize[1] - 72, 9, regularFont, rgb(0.72, 0.76, 0.82))
  y = pageSize[1] - 116

  const totalEmbeddedPhotos = compressedByUrl.size
  const inspectors = (typedInspection.inspector_names || []).join(', ')
  const summary = [
    `Defects: ${defects.length}`,
    `Drops: ${typedInspection.drop_count}`,
    `Floors: ${typedInspection.floor_count}`,
    `Photos included: ${totalEmbeddedPhotos}/${allPhotos.length}`,
  ]

  for (let i = 0; i < summary.length; i++) {
    const x = margin + (i % 2) * 260
    const boxY = y - Math.floor(i / 2) * 34
    page.drawRectangle({ x, y: boxY - 18, width: 238, height: 26, color: lightGray })
    text(page, summary[i], x + 8, boxY - 2, 10, boldFont, i === 3 ? orange : navy)
  }
  y -= 86

  if (inspectors) {
    y = drawWrapped(page, `Inspectors: ${inspectors}`, margin, y, 110, 9, regularFont, gray)
    y -= 6
  }

  // Summary tables: defects by type and by drop
  const byType = countBy(defects, (d) => d.defect_type)
  const byDrop = countBy(defects, (d) => d.drop).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))

  if (defects.length > 0) {
    text(page, 'Defects by Type', margin, y, 12, boldFont)
    text(page, 'Defects by Drop', margin + 280, y, 12, boldFont)
    y -= 16
    const startY = y
    let yType = startY
    for (const [type, count] of byType.slice(0, 14)) {
      text(page, truncate(type, 36), margin, yType, 9, regularFont, gray)
      text(page, String(count), margin + 230, yType, 9, boldFont)
      yType -= 14
    }
    let yDrop = startY
    for (const [drop, count] of byDrop.slice(0, 14)) {
      text(page, `Drop ${drop}`, margin + 280, yDrop, 9, regularFont, gray)
      text(page, String(count), margin + 480, yDrop, 9, boldFont)
      yDrop -= 14
    }
    y = Math.min(yType, yDrop) - 12
  }

  const planResult = await drawDropPlans(pdf, page, compressedPlans, y, boldFont, regularFont)
  page = planResult.page
  y = planResult.y

  for (const defect of defects) {
    const photos = defectPhotos(defect)
      .map((photo) => compressedByUrl.get(photo.url))
      .filter(Boolean) as CompressedPhoto[]

    if (y < 160) {
      page = pdf.addPage(pageSize)
      y = pageSize[1] - margin
    }

    page.drawRectangle({ x: margin, y: y - 22, width: pageW - margin * 2, height: 24, color: lightGray })
    text(page, defect.repair_number || `Defect ${defect.id.slice(0, 8)}`, margin + 8, y - 7, 11, boldFont)
    text(page, `Drop ${defect.drop} | Floor ${defect.floor}${defect.location ? ` | ${defect.location}` : ''}`, pageW - 246, y - 7, 9, regularFont, gray)
    y -= 38

    const meta = [
      `Defect: ${defect.defect_type}${defect.sub_type ? ` - ${defect.sub_type}` : ''}`,
      dimensions(defect) ? `Dimensions: ${dimensions(defect)}` : '',
    ].filter(Boolean)

    for (const row of meta) {
      y = drawWrapped(page, row, margin + 8, y, 95, 9, regularFont)
    }

    if (defect.comments) {
      y = drawWrapped(page, `Comments: ${defect.comments}`, margin + 8, y - 3, 105, 8, regularFont, gray)
    }

    y -= 8
    if (photos.length > 0) {
      const result = await drawPhotoGrid(pdf, page, photos, y, regularFont)
      page = result.page
      y = result.y
    } else {
      text(page, 'No photos available for this defect.', margin + 8, y, 8, regularFont, gray)
      y -= 22
    }

    y -= 12
  }

  if (defects.length === 0) {
    text(page, 'No defects recorded for this inspection.', margin, y, 11, regularFont, gray)
  }

  const bytes = await pdf.save({ useObjectStreams: true })
  const fileName = `${safeFileName(typedInspection.building_name)}_inspection_report_${new Date().toISOString().slice(0, 10)}.pdf`

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'X-Report-Photo-Count': String(allPhotos.length),
      'X-Report-Embedded-Photo-Count': String(totalEmbeddedPhotos),
      'X-Report-Size-Bytes': String(bytes.byteLength),
    },
  })
}
