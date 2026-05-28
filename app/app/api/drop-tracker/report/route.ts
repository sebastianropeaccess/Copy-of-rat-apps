import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TZ = 'Australia/Brisbane'

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-AU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTime(d: string): string {
  return new Date(d).toLocaleTimeString('en-AU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}

// Fetch image and return as base64 data URL, resized via canvas-free approach
// We'll return raw base64 for jsPDF and let client handle resize
async function fetchImageAsBase64(url: string): Promise<{ data: string; type: string } | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) return null
    const buffer = await resp.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const type = resp.headers.get('content-type') || 'image/jpeg'
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const b64 = btoa(binary)
    return { data: b64, type: type.includes('png') ? 'PNG' : 'JPEG' }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get('serviceId')
  if (!serviceId) return NextResponse.json({ error: 'Missing serviceId' }, { status: 400 })

  const { data: service } = await supabase.from('services').select('*').eq('id', serviceId).single()
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

  const { data: entries } = await supabase.from('drop_entries').select('*').eq('service_id', serviceId)
  
  const entryIds = (entries || []).filter(e => e.completed_at).map(e => e.id)
  const photos: Record<string, string[]> = {}
  if (entryIds.length > 0) {
    const { data: allPhotos } = await supabase.from('drop_photos').select('*').in('drop_entry_id', entryIds)
    for (const p of allPhotos || []) {
      if (!photos[p.drop_entry_id]) photos[p.drop_entry_id] = []
      photos[p.drop_entry_id].push(p.photo_url)
    }
  }

  const { data: planFiles } = await supabase.storage.from('drop-plans').list(serviceId, { limit: 20 })
  const planUrls = (planFiles || [])
    .filter(f => f.name && !f.name.startsWith('.'))
    .map(f => {
      const { data } = supabase.storage.from('drop-plans').getPublicUrl(`${serviceId}/${f.name}`)
      return data.publicUrl
    })

  const completedEntries = (entries || []).filter(e => e.completed_at).sort((a, b) => a.drop.localeCompare(b.drop, undefined, { numeric: true }))
  const totalDrops = service.drop_count || 0
  const completedCount = completedEntries.length
  const now = new Date().toLocaleDateString('en-AU', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' })

  // Pre-fetch all images as base64
  const planImages: { data: string; type: string }[] = []
  for (const url of planUrls) {
    const img = await fetchImageAsBase64(url)
    if (img) planImages.push(img)
  }

  const dropImages: Record<string, { data: string; type: string }[]> = {}
  for (const entry of completedEntries) {
    const urls = photos[entry.id] || []
    dropImages[entry.id] = []
    for (const url of urls) {
      const img = await fetchImageAsBase64(url)
      if (img) dropImages[entry.id].push(img)
    }
  }

  // Return JSON with all data + base64 images for client-side PDF generation
  return NextResponse.json({
    service: {
      name: service.name,
      serviceType: service.service_type,
      dropCount: totalDrops,
    },
    stats: { total: totalDrops, completed: completedCount, remaining: totalDrops - completedCount },
    generatedDate: now,
    planImages,
    drops: completedEntries.map(entry => ({
      drop: entry.drop,
      completedBy: entry.completed_by || 'Unknown',
      completedAt: entry.completed_at ? `${formatDate(entry.completed_at)} at ${formatTime(entry.completed_at)}` : '',
      comments: (entry.comments || '').replace(/\n?\[Logged:.*?\]/g, '').trim(),
      photos: dropImages[entry.id] || [],
    })),
  })
}
