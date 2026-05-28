import { NextRequest, NextResponse } from 'next/server'
import { hubspotFetch } from '@/lib/hubspot'

export const dynamic = 'force-dynamic'

type CreateTaskBody = {
  dealId?: string
  title?: string
  assignedTo?: string
  dueDate?: string
  body?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateTaskBody
    if (!body.dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 })
    if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const due = body.dueDate ? new Date(body.dueDate) : new Date()
    if (Number.isNaN(due.getTime())) {
      return NextResponse.json({ error: 'dueDate must be a valid date' }, { status: 400 })
    }

    const task = await hubspotFetch<{ id: string }>('/crm/v3/objects/tasks', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          hs_task_subject: body.title,
          hs_task_body: body.body || '',
          hs_task_status: 'NOT_STARTED',
          hs_task_priority: 'HIGH',
          hs_timestamp: due.toISOString(),
          ...(body.assignedTo ? { hubspot_owner_id: body.assignedTo } : {}),
        },
        associations: [
          {
            to: { id: body.dealId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 216 }],
          },
        ],
      }),
    })

    return NextResponse.json({ taskId: task.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
