import { NextRequest, NextResponse } from 'next/server'
import { createDealNote, hubspotFetch } from '@/lib/hubspot'

export const dynamic = 'force-dynamic'

type UpdateDealBody = {
  dealId?: string
  properties?: Record<string, string | number | boolean | null>
  note?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UpdateDealBody
    if (!body.dealId) {
      return NextResponse.json({ error: 'dealId required' }, { status: 400 })
    }
    if (!body.properties || typeof body.properties !== 'object') {
      return NextResponse.json({ error: 'properties required' }, { status: 400 })
    }

    const deal = await hubspotFetch<{ id: string; properties?: Record<string, string | null> }>(
      `/crm/v3/objects/deals/${body.dealId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ properties: body.properties }),
      }
    )
    const noteId = body.note ? await createDealNote(body.dealId, body.note) : null

    return NextResponse.json({ dealId: deal.id, noteId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
