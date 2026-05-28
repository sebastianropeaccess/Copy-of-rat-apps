import { NextResponse } from 'next/server'
import { hubspotBatchRead, hubspotPaged, HubSpotObject } from '@/lib/hubspot'

export const dynamic = 'force-dynamic'

type CachedDeals = { at: number; payload: unknown[] }
let cache: CachedDeals | null = null
const CACHE_MS = 5 * 60 * 1000

type DealOut = {
  id: string
  dealname: string | null
  amount: string | null
  dealstage: string | null
  pipeline: string | null
  closedate: string | null
  hs_lastmodifieddate: string | null
  contacts: Array<{
    id: string
    firstname: string | null
    lastname: string | null
    email: string | null
    phone: string | null
  }>
  companies: Array<{
    id: string
    name: string | null
    domain: string | null
  }>
}

function associatedIds(deal: HubSpotObject, type: 'contacts' | 'companies'): string[] {
  return deal.associations?.[type]?.results?.map((row) => row.id).filter(Boolean) || []
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return NextResponse.json(cache.payload)
    }

    const deals = await hubspotPaged<HubSpotObject>('/crm/v3/objects/deals', {
      properties: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'hs_lastmodifieddate'].join(','),
      associations: 'contacts,companies',
    })

    const contactIds = deals.flatMap((deal) => associatedIds(deal, 'contacts'))
    const companyIds = deals.flatMap((deal) => associatedIds(deal, 'companies'))
    const [contacts, companies] = await Promise.all([
      hubspotBatchRead<HubSpotObject>('contacts', contactIds, ['firstname', 'lastname', 'email', 'phone']),
      hubspotBatchRead<HubSpotObject>('companies', companyIds, ['name', 'domain']),
    ])

    const contactsById = new Map(contacts.map((contact) => [contact.id, contact]))
    const companiesById = new Map(companies.map((company) => [company.id, company]))

    const payload: DealOut[] = deals.map((deal) => ({
      id: deal.id,
      dealname: deal.properties?.dealname || null,
      amount: deal.properties?.amount || null,
      dealstage: deal.properties?.dealstage || null,
      pipeline: deal.properties?.pipeline || null,
      closedate: deal.properties?.closedate || null,
      hs_lastmodifieddate: deal.properties?.hs_lastmodifieddate || null,
      contacts: associatedIds(deal, 'contacts').map((id) => {
        const props = contactsById.get(id)?.properties || {}
        return {
          id,
          firstname: props.firstname || null,
          lastname: props.lastname || null,
          email: props.email || null,
          phone: props.phone || null,
        }
      }),
      companies: associatedIds(deal, 'companies').map((id) => {
        const props = companiesById.get(id)?.properties || {}
        return {
          id,
          name: props.name || null,
          domain: props.domain || null,
        }
      }),
    }))

    cache = { at: Date.now(), payload }
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
