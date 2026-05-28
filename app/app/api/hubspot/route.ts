import { NextRequest, NextResponse } from 'next/server'

const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN
const HS_BASE = 'https://api.hubapi.com'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type HsDeal = {
  id: string
  properties: Record<string, string | null>
  createdAt: string
  updatedAt: string
}

type Stage = {
  id: string
  label: string
  displayOrder: number
  probability: number
  isClosed: boolean
  isWon: boolean
}

type Pipeline = {
  id: string
  label: string
  stages: Stage[]
}

type Owner = { id: string; name: string; email: string }

async function hsFetch(path: string, init?: RequestInit) {
  if (!HS_TOKEN) throw new Error('HUBSPOT_ACCESS_TOKEN not set')
  const res = await fetch(`${HS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${HS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HubSpot ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

async function getPipelines(): Promise<Pipeline[]> {
  const json = await hsFetch('/crm/v3/pipelines/deals')
  return (json.results || []).map((p: {
    id: string
    label: string
    stages: Array<{
      id: string
      label: string
      displayOrder: number
      metadata: { probability?: string; isClosed?: string; isWon?: string }
    }>
  }) => ({
    id: p.id,
    label: p.label,
    stages: (p.stages || [])
      .map((s) => ({
        id: s.id,
        label: s.label,
        displayOrder: s.displayOrder,
        probability: parseFloat(s.metadata?.probability || '0'),
        isClosed: s.metadata?.isClosed === 'true',
        isWon: s.metadata?.isWon === 'true' || s.label === 'Closed Won',
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder),
  }))
}

async function getOwners(): Promise<Record<string, Owner>> {
  const json = await hsFetch('/crm/v3/owners?limit=100')
  const map: Record<string, Owner> = {}
  for (const o of json.results || []) {
    map[o.id] = {
      id: o.id,
      name: [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email,
      email: o.email,
    }
  }
  return map
}

async function getAllDeals(): Promise<HsDeal[]> {
  const props = [
    'dealname',
    'amount',
    'dealstage',
    'pipeline',
    'closedate',
    'createdate',
    'hubspot_owner_id',
    'hs_lastmodifieddate',
    'hs_object_id',
  ]
  const deals: HsDeal[] = []
  let after: string | undefined
  let iterations = 0
  do {
    const qs = new URLSearchParams({ limit: '100', properties: props.join(',') })
    if (after) qs.set('after', after)
    const json = await hsFetch(`/crm/v3/objects/deals?${qs.toString()}`)
    deals.push(...(json.results || []))
    after = json.paging?.next?.after
    iterations++
    if (iterations > 30) break // safety — 3000 deals max
  } while (after)
  return deals
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

type DealOut = {
  id: string
  name: string
  amount: number
  pipelineId: string
  pipelineLabel: string
  stageId: string
  stageLabel: string
  stageOrder: number
  probability: number
  isClosed: boolean
  isWon: boolean
  closeDate: string | null
  createDate: string | null
  ownerId: string | null
  ownerName: string | null
  lastModified: string | null
  ageDays: number | null
  staleDays: number | null
  url: string
}

function shapeDeal(d: HsDeal, pipelinesById: Record<string, Pipeline>, owners: Record<string, Owner>): DealOut | null {
  const pipelineId = d.properties.pipeline || 'default'
  const pipeline = pipelinesById[pipelineId]
  if (!pipeline) return null
  const stageId = d.properties.dealstage || ''
  const stage = pipeline.stages.find((s) => s.id === stageId)
  const created = d.properties.createdate ? new Date(d.properties.createdate) : null
  const modified = d.properties.hs_lastmodifieddate ? new Date(d.properties.hs_lastmodifieddate) : null
  const now = new Date()
  const ownerId = d.properties.hubspot_owner_id || null
  return {
    id: d.id,
    name: d.properties.dealname || 'Untitled',
    amount: parseFloat(d.properties.amount || '0') || 0,
    pipelineId,
    pipelineLabel: pipeline.label,
    stageId,
    stageLabel: stage?.label || stageId,
    stageOrder: stage?.displayOrder ?? 999,
    probability: stage?.probability ?? 0,
    isClosed: stage?.isClosed ?? false,
    isWon: stage?.isWon ?? false,
    closeDate: d.properties.closedate,
    createDate: d.properties.createdate,
    ownerId,
    ownerName: ownerId && owners[ownerId] ? owners[ownerId].name : null,
    lastModified: d.properties.hs_lastmodifieddate,
    ageDays: created ? daysBetween(created, now) : null,
    staleDays: modified ? daysBetween(modified, now) : null,
    url: `https://app-ap1.hubspot.com/contacts/442270346/record/0-3/${d.id}`,
  }
}

// In-memory cache for 60s to avoid hammering HubSpot on dashboard refresh
let cache: { at: number; payload: unknown } | null = null
const CACHE_MS = 60_000

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'pipeline'
  try {
    if (action === 'pipeline') {
      if (cache && Date.now() - cache.at < CACHE_MS) {
        return NextResponse.json(cache.payload)
      }
      const [pipelines, owners, rawDeals] = await Promise.all([
        getPipelines(),
        getOwners(),
        getAllDeals(),
      ])
      const pipelinesById: Record<string, Pipeline> = {}
      pipelines.forEach((p) => (pipelinesById[p.id] = p))

      const shaped = rawDeals
        .map((d) => shapeDeal(d, pipelinesById, owners))
        .filter((d): d is DealOut => d !== null)

      // --- Aggregates ---
      const openDeals = shaped.filter((d) => !d.isClosed)
      const wonDeals = shaped.filter((d) => d.isWon)
      const lostDeals = shaped.filter((d) => d.isClosed && !d.isWon)

      const totalOpenValue = openDeals.reduce((s, d) => s + d.amount, 0)
      const weightedValue = openDeals.reduce((s, d) => s + d.amount * d.probability, 0)

      // This month wins
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const wonThisMonth = wonDeals.filter(
        (d) => d.closeDate && new Date(d.closeDate) >= monthStart
      )
      const wonThisMonthValue = wonThisMonth.reduce((s, d) => s + d.amount, 0)

      // Last 90 days conversion
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const closed90 = shaped.filter(
        (d) => d.isClosed && d.closeDate && new Date(d.closeDate) >= ninetyDaysAgo
      )
      const won90 = closed90.filter((d) => d.isWon)
      const conversionRate = closed90.length ? won90.length / closed90.length : 0
      const won90Value = won90.reduce((s, d) => s + d.amount, 0)
      const lost90Value = closed90.filter((d) => !d.isWon).reduce((s, d) => s + d.amount, 0)

      // Stale deals: >14 days no modification and not closed
      const staleDeals = openDeals
        .filter((d) => (d.staleDays ?? 0) > 14)
        .sort((a, b) => (b.staleDays ?? 0) - (a.staleDays ?? 0))

      // Group by pipeline
      const byPipeline: Record<
        string,
        {
          id: string
          label: string
          openCount: number
          openValue: number
          weightedValue: number
          stages: Array<{
            id: string
            label: string
            order: number
            count: number
            value: number
            probability: number
          }>
        }
      > = {}
      for (const p of pipelines) {
        byPipeline[p.id] = {
          id: p.id,
          label: p.label,
          openCount: 0,
          openValue: 0,
          weightedValue: 0,
          stages: p.stages
            .filter((s) => !s.isClosed)
            .map((s) => ({
              id: s.id,
              label: s.label,
              order: s.displayOrder,
              count: 0,
              value: 0,
              probability: s.probability,
            })),
        }
      }
      for (const d of openDeals) {
        const pip = byPipeline[d.pipelineId]
        if (!pip) continue
        pip.openCount++
        pip.openValue += d.amount
        pip.weightedValue += d.amount * d.probability
        const stage = pip.stages.find((s) => s.id === d.stageId)
        if (stage) {
          stage.count++
          stage.value += d.amount
        }
      }

      // Group by owner (open deals only)
      const byOwner: Record<
        string,
        { id: string; name: string; count: number; value: number; weighted: number }
      > = {}
      for (const d of openDeals) {
        const key = d.ownerId || 'unassigned'
        const name = d.ownerName || 'Unassigned'
        if (!byOwner[key]) byOwner[key] = { id: key, name, count: 0, value: 0, weighted: 0 }
        byOwner[key].count++
        byOwner[key].value += d.amount
        byOwner[key].weighted += d.amount * d.probability
      }

      // Biggest open deals (top 10)
      const biggestOpen = [...openDeals].sort((a, b) => b.amount - a.amount).slice(0, 10)

      // Recent wins (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const recentWins = wonDeals
        .filter((d) => d.closeDate && new Date(d.closeDate) >= thirtyDaysAgo)
        .sort((a, b) => new Date(b.closeDate!).getTime() - new Date(a.closeDate!).getTime())
        .slice(0, 15)

      const payload = {
        generatedAt: new Date().toISOString(),
        summary: {
          openCount: openDeals.length,
          openValue: totalOpenValue,
          weightedValue,
          wonThisMonthCount: wonThisMonth.length,
          wonThisMonthValue,
          won90Count: won90.length,
          won90Value,
          lost90Count: closed90.length - won90.length,
          lost90Value,
          conversionRate,
          staleCount: staleDeals.length,
          totalLostValue90: lost90Value,
          target2026: 5_000_000,
        },
        byPipeline: Object.values(byPipeline),
        byOwner: Object.values(byOwner).sort((a, b) => b.value - a.value),
        biggestOpen,
        recentWins,
        staleDeals: staleDeals.slice(0, 25),
      }
      cache = { at: Date.now(), payload }
      return NextResponse.json(payload)
    }

    if (action === 'deals') {
      const pipeline = req.nextUrl.searchParams.get('pipeline') || ''
      const stage = req.nextUrl.searchParams.get('stage') || ''
      const [pipelines, owners, rawDeals] = await Promise.all([
        getPipelines(),
        getOwners(),
        getAllDeals(),
      ])
      const pipelinesById: Record<string, Pipeline> = {}
      pipelines.forEach((p) => (pipelinesById[p.id] = p))
      let shaped = rawDeals
        .map((d) => shapeDeal(d, pipelinesById, owners))
        .filter((d): d is DealOut => d !== null)
      if (pipeline) shaped = shaped.filter((d) => d.pipelineId === pipeline)
      if (stage) shaped = shaped.filter((d) => d.stageId === stage)
      shaped.sort((a, b) => b.amount - a.amount)
      return NextResponse.json({ deals: shaped })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
