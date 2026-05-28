import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface BuildingRow {
  id: number
  name: string
  drop_count: number
  drop_labelling: string
  floor_count: number
  drop_plan_url: string | null
  drop_plan_urls: string[] | null
}

interface RepairStepRow {
  id: number | string
  step_number: number
  step_name: string | null
  photo_url: string | null
  photo_urls: string[] | null
  comments: string | null
}

interface RepairRow {
  id: number | string
  drop_label: string
  floor_number: number | string
  defect_type: string
  sub_type: string | null
  location: string | null
  repair_number: string | null
  height_mm: number | null
  length_mm: number | null
  depth_mm: number | null
  quantity: number | null
  initial_photo_url: string | null
  initial_photo_urls: string[] | null
  initial_comments: string | null
  completion_photo_url: string | null
  completion_photo_urls: string[] | null
  completion_comments: string | null
  status: string
  started_at: string
  completed_at: string | null
  completed_by: string | null
  created_by: string
  urgency: string | null
  assigned_contractor: string | null
  repair_steps: RepairStepRow[]
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
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'repair_report'
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

function arrayUrls(value: string[] | null | undefined, fallback?: string | null) {
  const urls = Array.isArray(value) ? value.filter(Boolean) : []
  if (urls.length > 0) return urls
  return fallback ? [fallback] : []
}

function repairPhotos(repair: RepairRow, showStepTitles = true): ReportPhoto[] {
  const photos: ReportPhoto[] = []

  arrayUrls(repair.initial_photo_urls, repair.initial_photo_url).forEach((url, index) => {
    photos.push({ label: showStepTitles ? `Initial ${index + 1}` : '', url })
  })

  for (const step of repair.repair_steps || []) {
    arrayUrls(step.photo_urls, step.photo_url).forEach((url, index) => {
      photos.push({ label: showStepTitles ? `${step.step_name || `Step ${step.step_number}`} ${index + 1}` : '', url })
    })
  }

  arrayUrls(repair.completion_photo_urls, repair.completion_photo_url).forEach((url, index) => {
    photos.push({ label: showStepTitles ? `Completion ${index + 1}` : '', url })
  })

  return uniquePhotos(photos)
}

function buildingPlanPhotos(building: BuildingRow): ReportPhoto[] {
  return uniquePhotos(arrayUrls(building.drop_plan_urls, building.drop_plan_url).map((url, index) => ({
    label: `Drop plan ${index + 1}`,
    url,
  })))
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

function dimensions(repair: RepairRow) {
  const parts: string[] = []
  if (repair.length_mm) parts.push(`L ${repair.length_mm}mm`)
  if (repair.height_mm) parts.push(`H ${repair.height_mm}mm`)
  if (repair.depth_mm) parts.push(`D ${repair.depth_mm}mm`)
  if (repair.quantity) parts.push(`Qty ${repair.quantity}`)
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

function compareRepairsByReportOrder(a: RepairRow, b: RepairRow) {
  const dropA = dropSortValue(a.drop_label)
  const dropB = dropSortValue(b.drop_label)

  if (dropA.type !== dropB.type) return dropA.type - dropB.type
  if (dropA.value !== dropB.value) return dropA.value - dropB.value

  const labelCompare = dropA.label.localeCompare(dropB.label, undefined, { numeric: true, sensitivity: 'base' })
  if (labelCompare !== 0) return labelCompare

  return String(a.floor_number).localeCompare(String(b.floor_number), undefined, { numeric: true, sensitivity: 'base' })
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
    const boxH = i === 0 ? 240 : 300
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const buildingId = searchParams.get('buildingId')
  const defectFilter = searchParams.get('defectType') || ''
  const dropFilter = searchParams.get('drop') || ''
  const dropsFilter = searchParams.get('drops') || ''
  const urgencyFilter = searchParams.get('urgency') || ''
  const contractorFilter = searchParams.get('contractor') || ''
  const statusFilter = searchParams.get('status') || ''
  const includePhotos = searchParams.get('photos') !== 'false'
  const showStepTitles = searchParams.get('showStepTitles') !== 'false'

  if (!buildingId) {
    return NextResponse.json({ error: 'buildingId required' }, { status: 400 })
  }

  const { data: building, error: buildingError } = await supabase
    .from('repair_buildings')
    .select('*')
    .eq('id', buildingId)
    .single()

  if (buildingError || !building) {
    return NextResponse.json({ error: 'Building not found' }, { status: 404 })
  }

  let query = supabase
    .from('repairs')
    .select('*, repair_steps(*)')
    .eq('building_id', buildingId)
    .order('drop_label')
    .order('floor_number')

  const selectedDrops = dropsFilter ? dropsFilter.split(',').filter(Boolean) : dropFilter ? [dropFilter] : []
  if (selectedDrops.length === 1) query = query.eq('drop_label', selectedDrops[0])
  if (statusFilter === 'completed' || statusFilter === 'in_progress') query = query.eq('status', statusFilter)
  if (defectFilter) query = query.eq('defect_type', defectFilter)
  if (urgencyFilter) query = query.eq('urgency', urgencyFilter)
  if (contractorFilter) query = query.eq('assigned_contractor', contractorFilter)

  const { data: rows, error: repairError } = await query
  if (repairError) {
    return NextResponse.json({ error: repairError.message }, { status: 500 })
  }

  let repairs = ((rows || []) as RepairRow[]).filter((repair) => !repair.defect_type?.startsWith('__'))
  if (selectedDrops.length > 1) repairs = repairs.filter((repair) => selectedDrops.includes(repair.drop_label))
  repairs.sort(compareRepairsByReportOrder)
  for (const repair of repairs) {
    repair.repair_steps = (repair.repair_steps || []).sort((a, b) => a.step_number - b.step_number)
  }

  const typedBuilding = building as BuildingRow
  const planPhotoRefs = buildingPlanPhotos(typedBuilding)
  const compressedPlans = (await mapConcurrent(planPhotoRefs, 6, (photo) => compressPhoto(photo, 10)))
    .filter(Boolean) as CompressedPhoto[]

  const allPhotos = includePhotos ? repairs.flatMap((repair) => repairPhotos(repair, showStepTitles)) : []
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
  text(page, 'Defect Repair Report', margin, pageSize[1] - 35, 22, boldFont, rgb(1, 1, 1))
  text(page, typedBuilding.name, margin, pageSize[1] - 56, 13, regularFont, rgb(0.82, 0.86, 0.9))
  text(page, `Generated ${new Date().toLocaleDateString('en-AU', { dateStyle: 'medium' })}`, margin, pageSize[1] - 72, 9, regularFont, rgb(0.72, 0.76, 0.82))
  text(page, 'Rope Access Technicians', pageW - 166, pageSize[1] - 72, 9, regularFont, rgb(0.72, 0.76, 0.82))
  y = pageSize[1] - 116

  const completed = repairs.filter((repair) => repair.status === 'completed').length
  const totalEmbeddedPhotos = compressedByUrl.size
  const summary = [
    `Repairs: ${repairs.length}`,
    `Completed: ${completed}`,
    `Photos included: ${totalEmbeddedPhotos}/${allPhotos.length}`,
    `Compression: server-side report images; originals retained separately`,
  ]

  for (let i = 0; i < summary.length; i++) {
    const x = margin + (i % 2) * 260
    const boxY = y - Math.floor(i / 2) * 34
    page.drawRectangle({ x, y: boxY - 18, width: 238, height: 26, color: lightGray })
    text(page, summary[i], x + 8, boxY - 2, 10, boldFont, i === 3 ? orange : navy)
  }
  y -= 86

  const planResult = await drawDropPlans(pdf, page, compressedPlans, y, boldFont, regularFont)
  page = planResult.page
  y = planResult.y

  for (const repair of repairs) {
    const repairPhotoRefs = repairPhotos(repair, showStepTitles)
    const photos = repairPhotoRefs.map((photo) => compressedByUrl.get(photo.url)).filter(Boolean) as CompressedPhoto[]

    if (y < 160) {
      page = pdf.addPage(pageSize)
      y = pageSize[1] - margin
    }

    page.drawRectangle({ x: margin, y: y - 22, width: pageW - margin * 2, height: 24, color: lightGray })
    text(page, repair.repair_number || `Repair ${repair.id}`, margin + 8, y - 7, 11, boldFont)
    text(page, `Drop ${repair.drop_label} | Floor ${repair.floor_number} | ${repair.status === 'completed' ? 'Completed' : 'In Progress'}`, pageW - 226, y - 7, 9, regularFont, gray)
    y -= 38

    const meta = [
      `Defect: ${repair.defect_type}${repair.sub_type ? ` - ${repair.sub_type}` : ''}`,
      repair.location ? `Location: ${repair.location}` : '',
      dimensions(repair) ? `Dimensions: ${dimensions(repair)}` : '',
      repair.urgency ? `Urgency: ${repair.urgency}` : '',
      repair.assigned_contractor ? `Contractor: ${repair.assigned_contractor}` : '',
    ].filter(Boolean)

    for (const row of meta) {
      y = drawWrapped(page, row, margin + 8, y, 95, 9, regularFont)
    }

    if (repair.initial_comments) {
      y = drawWrapped(page, `Initial comments: ${repair.initial_comments}`, margin + 8, y - 3, 105, 8, regularFont, gray)
    }
    if (repair.completion_comments) {
      y = drawWrapped(page, `Completion comments: ${repair.completion_comments}`, margin + 8, y - 3, 105, 8, regularFont, gray)
    }

    y -= 8
    if (photos.length > 0) {
      const result = await drawPhotoGrid(pdf, page, photos, y, regularFont)
      page = result.page
      y = result.y
    } else {
      text(page, 'No photos available for this repair.', margin + 8, y, 8, regularFont, gray)
      y -= 22
    }

    if (showStepTitles && repair.repair_steps?.length > 0) {
      if (y < 100) {
        page = pdf.addPage(pageSize)
        y = pageSize[1] - margin
      }
      text(page, 'Steps', margin + 8, y, 9, boldFont)
      y -= 14
      for (const step of repair.repair_steps) {
        const stepLine = `${step.step_number}. ${step.step_name || 'Step'}${step.comments ? ` - ${step.comments}` : ''}`
        y = drawWrapped(page, stepLine, margin + 12, y, 108, 8, regularFont, gray)
      }
    }

    y -= 12
  }

  const bytes = await pdf.save({ useObjectStreams: true })
  const fileName = `${safeFileName(typedBuilding.name)}_repair_report_${new Date().toISOString().slice(0, 10)}.pdf`

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'X-Report-Photo-Count': String(allPhotos.length),
      'X-Report-Drop-Plan-Count': String(compressedPlans.length),
      'X-Report-Embedded-Photo-Count': String(totalEmbeddedPhotos),
      'X-Report-Size-Bytes': String(bytes.byteLength),
    },
  })
}
