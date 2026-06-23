import { NextRequest, NextResponse } from 'next/server'
import { associateDefault, hubspotFetch } from '../../../../lib/hubspot'

export const dynamic = 'force-dynamic'

type CreateDealBody = {
  dealname?: string
  pipeline?: string
  stage?: string
  properties?: Record<string, string | number | boolean | null>
  contactEmail?: string
  companyName?: string
}

async function findContactByEmail(email?: string): Promise<string | null> {
  if (!email) return null
  const json = await hubspotFetch<{ results?: Array<{ id: string }> }>('/crm/v3/objects/contacts/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
      limit: 1,
    }),
  })
  return json.results?.[0]?.id || null
}

async function findCompanyByName(name?: string): Promise<string | null> {
  if (!name) return null
  const json = await hubspotFetch<{ results?: Array<{ id: string }> }>('/crm/v3/objects/companies/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'name', operator: 'EQ', value: name }] }],
      limit: 1,
    }),
  })
  return json.results?.[0]?.id || null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateDealBody
    if (!body.dealname) return NextResponse.json({ error: 'dealname required' }, { status: 400 })
    if (!body.pipeline) return NextResponse.json({ error: 'pipeline required' }, { status: 400 })
    if (!body.stage) return NextResponse.json({ error: 'stage required' }, { status: 400 })

    const deal = await hubspotFetch<{ id: string }>('/crm/v3/objects/deals', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          ...(body.properties || {}),
          dealname: body.dealname,
          pipeline: body.pipeline,
          dealstage: body.stage,
        },
      }),
    })

    const [contactId, companyId] = await Promise.all([
      findContactByEmail(body.contactEmail),
      findCompanyByName(body.companyName),
    ])

    await Promise.all([
      contactId ? associateDefault('deals', deal.id, 'contacts', contactId) : Promise.resolve(),
      companyId ? associateDefault('deals', deal.id, 'companies', companyId) : Promise.resolve(),
    ])

    return NextResponse.json({ dealId: deal.id, contactId, companyId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
