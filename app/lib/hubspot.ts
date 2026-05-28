const HS_BASE = 'https://api.hubapi.com'

export const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || ''

export type HubSpotObject = {
  id: string
  properties?: Record<string, string | null>
  createdAt?: string
  updatedAt?: string
  associations?: Record<string, { results?: Array<{ id: string; type?: string }> }>
}

export async function hubspotFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HubSpot ${res.status}: ${text.slice(0, 500)}`)
  }

  return res.json() as Promise<T>
}

export async function hubspotPaged<T extends HubSpotObject>(
  path: string,
  params: Record<string, string>
): Promise<T[]> {
  const rows: T[] = []
  let after: string | undefined

  do {
    const qs = new URLSearchParams({ limit: '100', ...params })
    if (after) qs.set('after', after)
    const json = await hubspotFetch<{ results?: T[]; paging?: { next?: { after?: string } } }>(
      `${path}?${qs.toString()}`
    )
    rows.push(...(json.results || []))
    after = json.paging?.next?.after
  } while (after)

  return rows
}

export async function hubspotBatchRead<T extends HubSpotObject>(
  objectType: 'contacts' | 'companies',
  ids: string[],
  properties: string[]
): Promise<T[]> {
  const uniqueIds = [...new Set(ids)].filter(Boolean)
  const results: T[] = []

  for (let i = 0; i < uniqueIds.length; i += 100) {
    const batch = uniqueIds.slice(i, i + 100)
    const json = await hubspotFetch<{ results?: T[] }>(`/crm/v3/objects/${objectType}/batch/read`, {
      method: 'POST',
      body: JSON.stringify({
        properties,
        inputs: batch.map((id) => ({ id })),
      }),
    })
    results.push(...(json.results || []))
  }

  return results
}

export async function createDealNote(dealId: string, body: string): Promise<string | null> {
  if (!body.trim()) return null
  const json = await hubspotFetch<{ id: string }>('/crm/v3/objects/notes', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        hs_note_body: body,
        hs_timestamp: new Date().toISOString(),
      },
      associations: [
        {
          to: { id: dealId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }],
        },
      ],
    }),
  })
  return json.id
}

export async function associateDefault(
  fromType: 'deals',
  fromId: string,
  toType: 'contacts' | 'companies',
  toId: string
): Promise<void> {
  await hubspotFetch(`/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`, {
    method: 'PUT',
    body: JSON.stringify({}),
  })
}
