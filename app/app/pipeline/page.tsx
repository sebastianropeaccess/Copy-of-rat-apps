'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getStoredUser } from '../../lib/helpers'
import type { RatUser } from '../../lib/types'

type Summary = {
  openCount: number
  openValue: number
  weightedValue: number
  wonThisMonthCount: number
  wonThisMonthValue: number
  won90Count: number
  won90Value: number
  lost90Count: number
  lost90Value: number
  conversionRate: number
  staleCount: number
  target2026: number
}

type Stage = { id: string; label: string; order: number; count: number; value: number; probability: number }
type PipelineBlock = { id: string; label: string; openCount: number; openValue: number; weightedValue: number; stages: Stage[] }
type OwnerRow = { id: string; name: string; count: number; value: number; weighted: number }

type Deal = {
  id: string
  name: string
  amount: number
  pipelineLabel: string
  stageLabel: string
  probability: number
  ownerName: string | null
  ageDays: number | null
  staleDays: number | null
  closeDate: string | null
  url: string
}

type PipelineData = {
  generatedAt: string
  summary: Summary
  byPipeline: PipelineBlock[]
  byOwner: OwnerRow[]
  biggestOpen: Deal[]
  recentWins: Deal[]
  staleDeals: Deal[]
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${n.toFixed(0)}`
}

function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default function PipelinePage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [data, setData] = useState<PipelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'biggest' | 'stale' | 'wins' | 'owners'>('overview')

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/hubspot?action=pipeline', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col min-h-screen bg-light-gray">
        <div className="w-full max-w-[480px] mx-auto p-6">
          <Link href="/" className="text-navy/60 text-sm">&larr; Back</Link>
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="font-bold text-red-700">Pipeline load failed</div>
            <div className="text-sm text-red-600 mt-1">{error || 'No data'}</div>
            <button
              onClick={() => { setLoading(true); load() }}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
            >Retry</button>
          </div>
        </div>
      </div>
    )
  }

  const s = data.summary
  const targetProgress = s.wonThisMonthValue > 0 ? Math.min(1, s.weightedValue / s.target2026) : 0
  void user

  return (
    <div className="flex flex-col min-h-screen bg-light-gray pb-20">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60 text-xl">&larr;</Link>
            <div>
              <div className="text-xl font-bold text-white">Sales Pipeline</div>
              <div className="text-xs text-white/50">Live from HubSpot · {new Date(data.generatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
          <button
            onClick={() => { setLoading(true); load() }}
            className="text-white/80 text-sm px-3 py-1.5 rounded-lg bg-white/10"
          >Refresh</button>
        </div>

        {/* Hero cards */}
        <div className="px-4 pt-4 grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-xs text-navy/50 uppercase font-semibold">Open Pipeline</div>
            <div className="text-2xl font-bold text-navy mt-1">{money(s.openValue)}</div>
            <div className="text-xs text-navy/60 mt-1">{s.openCount} deals</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-xs text-navy/50 uppercase font-semibold">Weighted</div>
            <div className="text-2xl font-bold text-orange mt-1">{money(s.weightedValue)}</div>
            <div className="text-xs text-navy/60 mt-1">probability-adjusted</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-xs text-navy/50 uppercase font-semibold">Won This Month</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{money(s.wonThisMonthValue)}</div>
            <div className="text-xs text-navy/60 mt-1">{s.wonThisMonthCount} deals</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-xs text-navy/50 uppercase font-semibold">Win Rate 90d</div>
            <div className="text-2xl font-bold text-navy mt-1">{pct(s.conversionRate)}</div>
            <div className="text-xs text-navy/60 mt-1">{s.won90Count} won / {s.won90Count + s.lost90Count} closed</div>
          </div>
        </div>

        {/* Target progress */}
        <div className="px-4 pt-4">
          <div className="bg-gradient-to-r from-navy to-navy/80 rounded-2xl p-4 text-white shadow-sm">
            <div className="flex items-baseline justify-between">
              <div className="text-xs uppercase text-white/60 font-semibold">2026 Target</div>
              <div className="text-xs text-white/60">$5M</div>
            </div>
            <div className="text-xl font-bold mt-1">{money(s.weightedValue)} in weighted pipeline</div>
            <div className="h-2 bg-white/15 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-orange transition-all" style={{ width: `${targetProgress * 100}%` }} />
            </div>
            <div className="text-xs text-white/60 mt-2">{pct(targetProgress)} of annual target covered by weighted open deals</div>
          </div>
        </div>

        {/* Stale warning */}
        {s.staleCount > 0 && (
          <div className="px-4 pt-3">
            <button
              onClick={() => setTab('stale')}
              className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-left flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div>
                <div className="text-sm font-semibold text-yellow-800">⚠ {s.staleCount} deals going cold</div>
                <div className="text-xs text-yellow-700 mt-0.5">No activity in 14+ days — follow up or close out</div>
              </div>
              <div className="text-yellow-700">→</div>
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="px-4 pt-4">
          <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm overflow-x-auto">
            {([
              ['overview', 'Stages'],
              ['biggest', 'Biggest'],
              ['stale', 'Stale'],
              ['wins', 'Wins'],
              ['owners', 'By Rep'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 min-w-fit px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  tab === key ? 'bg-navy text-white' : 'text-navy/60'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 px-4 py-4">
          {tab === 'overview' && (
            <div className="space-y-4">
              {data.byPipeline.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="font-bold text-navy">{p.label}</div>
                    <div className="text-xs text-navy/60">{p.openCount} · {money(p.openValue)}</div>
                  </div>
                  <div className="space-y-2">
                    {p.stages.filter((st) => st.count > 0 || st.order <= 5).map((st) => {
                      const maxValue = Math.max(...p.stages.map((x) => x.value), 1)
                      const width = (st.value / maxValue) * 100
                      return (
                        <div key={st.id}>
                          <div className="flex items-baseline justify-between text-xs">
                            <div className="text-navy/80 font-medium">{st.label}</div>
                            <div className="text-navy/60">{st.count} · {money(st.value)}</div>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-orange/80 rounded-full transition-all"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
                    <div className="text-navy/60">Weighted</div>
                    <div className="font-semibold text-orange">{money(p.weightedValue)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'biggest' && (
            <DealList deals={data.biggestOpen} empty="No open deals" showAge />
          )}

          {tab === 'stale' && (
            <DealList
              deals={data.staleDeals}
              empty="Nothing stale — good work 💪"
              showStale
            />
          )}

          {tab === 'wins' && (
            <DealList deals={data.recentWins} empty="No wins in last 30 days" showClosed />
          )}

          {tab === 'owners' && (
            <div className="space-y-2">
              {data.byOwner.map((o) => (
                <div key={o.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-baseline justify-between">
                    <div className="font-semibold text-navy">{o.name}</div>
                    <div className="text-sm text-navy/70">{o.count} deals</div>
                  </div>
                  <div className="flex items-baseline justify-between mt-2 text-xs">
                    <div className="text-navy/60">Open value</div>
                    <div className="font-semibold text-navy">{money(o.value)}</div>
                  </div>
                  <div className="flex items-baseline justify-between mt-1 text-xs">
                    <div className="text-navy/60">Weighted</div>
                    <div className="font-semibold text-orange">{money(o.weighted)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DealList({
  deals,
  empty,
  showAge,
  showStale,
  showClosed,
}: {
  deals: Deal[]
  empty: string
  showAge?: boolean
  showStale?: boolean
  showClosed?: boolean
}) {
  if (deals.length === 0) {
    return <div className="bg-white rounded-xl p-6 text-center text-navy/50 text-sm">{empty}</div>
  }
  return (
    <div className="space-y-2">
      {deals.map((d) => (
        <a
          key={d.id}
          href={d.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white rounded-xl p-3 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-semibold text-navy text-sm line-clamp-2 flex-1">{d.name}</div>
            <div className="font-bold text-navy whitespace-nowrap">{money(d.amount)}</div>
          </div>
          <div className="flex items-baseline justify-between mt-1 text-xs text-navy/60">
            <div className="truncate">
              {d.pipelineLabel} · <span className="text-navy/80">{d.stageLabel}</span>
            </div>
            {d.ownerName && <div className="whitespace-nowrap ml-2">{d.ownerName}</div>}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[10px]">
            {showAge && d.ageDays !== null && (
              <span className="px-1.5 py-0.5 bg-gray-100 rounded">{d.ageDays}d old</span>
            )}
            {showStale && d.staleDays !== null && (
              <span className={`px-1.5 py-0.5 rounded ${d.staleDays > 30 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                {d.staleDays}d silent
              </span>
            )}
            {showClosed && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">won {formatDate(d.closeDate)}</span>
            )}
            <span className="px-1.5 py-0.5 bg-orange/10 text-orange rounded">{pct(d.probability)}</span>
          </div>
        </a>
      ))}
    </div>
  )
}
