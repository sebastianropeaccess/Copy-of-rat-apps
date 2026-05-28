import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface RepairRow {
  id: number
  building_id: number
  building_name: string
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
  completion_comments: string | null
  status: string
  started_at: string
  completed_at: string | null
  completed_by: string | null
  created_by: string
  urgency: string | null
  assigned_contractor: string | null
  repair_steps: Array<{
    id: number
    step_number: number
    step_name: string | null
    photo_url: string | null
    comments: string | null
  }>
}

interface BuildingRow {
  id: number
  name: string
  drop_count: number
  drop_labelling: string
  floor_count: number
  relevant_locations: string[] | null
  relevant_defect_types: string[] | null
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

// Fetch image as base64 data URI for embedding in PDF.
// Aggressively downsample at fetch-time using an image CDN hint to keep browser PDF generation stable.
async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    // Google Drive / image hosting can return huge originals. Use a width hint when possible.
    let fetchUrl = url
    if (url.includes('googleusercontent.com') || url.includes('drive.google.com')) {
      fetchUrl = url.includes('?') ? `${url}&sz=w1200` : `${url}?sz=w1200`
    }

    const res = await fetch(fetchUrl, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()

    // Hard cap very large payloads to avoid crashing browser PDF generation.
    if (buf.byteLength > 2_500_000) return null

    const base64 = Buffer.from(buf).toString('base64')
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const buildingId = searchParams.get('buildingId')
  const format = searchParams.get('format') || 'json' // json or csv
  const statusFilter = searchParams.get('status') || 'all'
  const defectFilter = searchParams.get('defectType') || ''
  const dropFilter = searchParams.get('drop') || ''
  const includePhotos = searchParams.get('photos') !== 'false'

  if (!buildingId) {
    return NextResponse.json({ error: 'buildingId required' }, { status: 400 })
  }

  // Fetch building
  const { data: building, error: buildingError } = await supabase
    .from('repair_buildings')
    .select('*')
    .eq('id', buildingId)
    .single()

  if (buildingError || !building) {
    return NextResponse.json({ error: 'Building not found' }, { status: 404 })
  }

  // Fetch repairs with steps
  let query = supabase
    .from('repairs')
    .select('*, repair_steps(*)')
    .eq('building_id', buildingId)
    .order('drop_label')
    .order('floor_number')

  if (statusFilter === 'completed') {
    query = query.eq('status', 'completed')
  } else if (statusFilter === 'in_progress') {
    query = query.eq('status', 'in_progress')
  }

  if (defectFilter) {
    query = query.eq('defect_type', defectFilter)
  }

  if (dropFilter) {
    query = query.eq('drop_label', dropFilter)
  }

  const { data: repairs, error: repairsError } = await query

  if (repairsError) {
    return NextResponse.json({ error: repairsError.message }, { status: 500 })
  }

  const typedRepairs = ((repairs || []) as RepairRow[]).sort(compareRepairsByReportOrder)
  const typedBuilding = building as BuildingRow

  // Sort repair steps by step_number
  for (const r of typedRepairs) {
    if (r.repair_steps) {
      r.repair_steps.sort((a, b) => a.step_number - b.step_number)
    }
  }

  if (format === 'csv') {
    return generateCSV(typedBuilding, typedRepairs)
  }

  // JSON format — includes photo data URIs if requested
  const reportData = {
    building: {
      id: typedBuilding.id,
      name: typedBuilding.name,
      dropCount: typedBuilding.drop_count,
      dropLabelling: typedBuilding.drop_labelling,
      floorCount: typedBuilding.floor_count,
    },
    generated: new Date().toISOString(),
    summary: {
      total: typedRepairs.length,
      completed: typedRepairs.filter(r => r.status === 'completed').length,
      inProgress: typedRepairs.filter(r => r.status === 'in_progress').length,
      byDefectType: groupBy(typedRepairs, 'defect_type'),
      byDrop: groupBy(typedRepairs, 'drop_label'),
      byUrgency: groupBy(typedRepairs, 'urgency'),
    },
    repairs: await Promise.all(typedRepairs.map(async (r) => {
      const photos: { label: string; dataUri: string | null }[] = []

      if (includePhotos) {
        // Initial photo(s)
        if (r.initial_photo_urls && r.initial_photo_urls.length > 0) {
          for (let i = 0; i < Math.min(r.initial_photo_urls.length, 2); i++) {
            photos.push({
              label: `Initial ${i + 1}`,
              dataUri: await fetchImageBase64(r.initial_photo_urls[i]),
            })
          }
        } else if (r.initial_photo_url) {
          photos.push({
            label: 'Initial',
            dataUri: await fetchImageBase64(r.initial_photo_url),
          })
        }

        // Step photos
        for (const step of (r.repair_steps || [])) {
          if (step.photo_url) {
            photos.push({
              label: step.step_name || `Step ${step.step_number}`,
              dataUri: await fetchImageBase64(step.photo_url),
            })
          }
        }

        // Completion photo
        if (r.completion_photo_url) {
          photos.push({
            label: 'Completion',
            dataUri: await fetchImageBase64(r.completion_photo_url),
          })
        }
      }

      return {
        id: r.id,
        repairNumber: r.repair_number,
        drop: r.drop_label,
        floor: r.floor_number,
        defectType: r.defect_type,
        subType: r.sub_type,
        location: r.location,
        dimensions: formatDimensions(r),
        quantity: r.quantity,
        status: r.status,
        urgency: r.urgency,
        assignedContractor: r.assigned_contractor,
        initialComments: r.initial_comments,
        completionComments: r.completion_comments,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        completedBy: r.completed_by,
        createdBy: r.created_by,
        steps: (r.repair_steps || []).map(s => ({
          number: s.step_number,
          name: s.step_name,
          comments: s.comments,
        })),
        photos,
      }
    })),
  }

  return NextResponse.json(reportData)
}

function formatDimensions(r: RepairRow): string | null {
  const parts: string[] = []
  if (r.length_mm) parts.push(`L: ${r.length_mm}mm`)
  if (r.height_mm) parts.push(`H: ${r.height_mm}mm`)
  if (r.depth_mm) parts.push(`D: ${r.depth_mm}mm`)
  return parts.length > 0 ? parts.join(' × ') : null
}

function groupBy(repairs: RepairRow[], key: keyof RepairRow): Record<string, number> {
  const result: Record<string, number> = {}
  for (const r of repairs) {
    const val = (r[key] as string) || 'Unset'
    result[val] = (result[val] || 0) + 1
  }
  return result
}

function generateCSV(building: BuildingRow, repairs: RepairRow[]): NextResponse {
  const headers = [
    'Repair #', 'Drop', 'Floor', 'Defect Type', 'Sub Type', 'Location',
    'Length (mm)', 'Height (mm)', 'Depth (mm)', 'Quantity',
    'Status', 'Urgency', 'Assigned To',
    'Initial Comments', 'Completion Comments',
    'Started', 'Completed', 'Completed By', 'Created By',
    'Steps',
  ]

  const rows = repairs.map(r => [
    r.repair_number || '',
    r.drop_label,
    String(r.floor_number),
    r.defect_type,
    r.sub_type || '',
    r.location || '',
    r.length_mm != null ? String(r.length_mm) : '',
    r.height_mm != null ? String(r.height_mm) : '',
    r.depth_mm != null ? String(r.depth_mm) : '',
    r.quantity != null ? String(r.quantity) : '',
    r.status === 'completed' ? 'Completed' : 'In Progress',
    r.urgency || '',
    r.assigned_contractor || '',
    r.initial_comments || '',
    r.completion_comments || '',
    r.started_at ? new Date(r.started_at).toLocaleDateString('en-AU') : '',
    r.completed_at ? new Date(r.completed_at).toLocaleDateString('en-AU') : '',
    r.completed_by || '',
    r.created_by || '',
    (r.repair_steps || []).map(s => s.step_name || `Step ${s.step_number}`).join('; '),
  ])

  const csvContent = [
    `"${building.name} — Repair Report"`,
    `"Generated: ${new Date().toLocaleDateString('en-AU', { dateStyle: 'long' })}"`,
    `"Total Repairs: ${repairs.length} | Completed: ${repairs.filter(r => r.status === 'completed').length} | In Progress: ${repairs.filter(r => r.status === 'in_progress').length}"`,
    '',
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${building.name.replace(/[^a-zA-Z0-9]/g, '_')}_Repairs_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
