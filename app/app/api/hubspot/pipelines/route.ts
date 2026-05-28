import { NextResponse } from 'next/server'
import { hubspotFetch } from '@/lib/hubspot'

export const dynamic = 'force-dynamic'

type PipelinePayload = {
  pipelines: Array<{
    id: string
    label: string
    stages: Array<{ id: string; label: string }>
  }>
}

let cache: { at: number; payload: PipelinePayload } | null = null
const CACHE_MS = 60 * 60 * 1000

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return NextResponse.json(cache.payload)
    }

    const json = await hubspotFetch<{
      results?: Array<{
        id: string
        label: string
        stages?: Array<{ id: string; label: string; displayOrder?: number }>
      }>
    }>('/crm/v3/pipelines/deals')

    const payload: PipelinePayload = {
      pipelines: (json.results || []).map((pipeline) => ({
        id: pipeline.id,
        label: pipeline.label,
        stages: (pipeline.stages || [])
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          .map((stage) => ({ id: stage.id, label: stage.label })),
      })),
    }

    cache = { at: Date.now(), payload }
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
