'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../lib/supabase'
import { getStoredUser } from '../../lib/helpers'
import type { RatUser, Asset, AssetInspection } from '../../lib/types'

const CATEGORIES = [
  { value: 'rope_access_gear', label: 'Rope Access' },
  { value: 'height_safety', label: 'Height Safety' },
  { value: 'tools', label: 'Tools' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'consumables', label: 'Consumables' },
  { value: 'plant', label: 'Plant' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'job_kits', label: 'Job Kits' },
]

type AssetWithInspection = Asset & { latestInspection: AssetInspection | null }

function inspectionState(asset: AssetWithInspection): { label: string; cls: string; rank: number } {
  const insp = asset.latestInspection
  if (!insp) return { label: 'Never inspected', cls: 'bg-gray-200 text-gray-600', rank: 1 }
  if (!insp.next_due_date) return { label: 'No due date', cls: 'bg-gray-100 text-gray-500', rank: 3 }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.floor((new Date(insp.next_due_date).getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { label: 'Overdue', cls: 'bg-red-500 text-white', rank: 0 }
  if (diff <= 30) return { label: `Due in ${diff}d`, cls: 'bg-yellow-100 text-yellow-700', rank: 2 }
  return { label: 'Up to date', cls: 'bg-green-100 text-green-700', rank: 4 }
}

export default function InspectionsHomePage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [assets, setAssets] = useState<AssetWithInspection[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [dueOnly, setDueOnly] = useState(false)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    load()
  }, [])

  async function load() {
    const { data } = await getSupabase()
      .from('assets')
      .select('*, asset_inspections(id, result, next_due_date, inspection_date)')
      .not('status', 'in', '("retired","lost")')

    const processed: AssetWithInspection[] = (data || []).map((row: Record<string, unknown>) => {
      const inspections = (row.asset_inspections as AssetInspection[] || []).sort(
        (a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime()
      )
      const { asset_inspections: _drop, ...rest } = row
      return { ...(rest as unknown as Asset), latestInspection: inspections[0] || null }
    })
    // Most-due first so safety-critical items surface at the top.
    processed.sort((a, b) => inspectionState(a).rank - inspectionState(b).rank)
    setAssets(processed)
    setLoading(false)
  }

  if (!user) return null

  const overdue = assets.filter(a => inspectionState(a).label === 'Overdue').length
  const dueSoon = assets.filter(a => inspectionState(a).label.startsWith('Due in')).length

  const filtered = assets.filter(a => {
    if (filterCategory && a.category !== filterCategory) return false
    if (dueOnly) {
      const lbl = inspectionState(a).label
      if (!(lbl === 'Overdue' || lbl.startsWith('Due in') || lbl === 'Never inspected')) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return (
        a.item_number.toLowerCase().includes(q) ||
        a.asset_type.toLowerCase().includes(q) ||
        (a.manufacturer || '').toLowerCase().includes(q) ||
        (a.serial_number || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
          <Link href="/" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">Inspections</div>
            <div className="text-xs text-white/50">Pick an asset to log an inspection</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 pb-8">
          {/* Due summary */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className={`rounded-xl p-3 text-center ${overdue > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <div className="text-xl font-bold text-navy">{overdue}</div>
              <div className="text-[10px] text-navy/50 font-medium">Overdue</div>
            </div>
            <div className={`rounded-xl p-3 text-center ${dueSoon > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
              <div className="text-xl font-bold text-navy">{dueSoon}</div>
              <div className="text-[10px] text-navy/50 font-medium">Due in 30 days</div>
            </div>
          </div>

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search item #, type, serial..."
            className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40 mb-3"
          />

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            <button
              onClick={() => setDueOnly(v => !v)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                dueOnly ? 'bg-orange text-white' : 'bg-white text-navy/60 border border-navy/10'
              }`}
            >Due / Overdue</button>
            <button
              onClick={() => setFilterCategory(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                !filterCategory ? 'bg-navy text-white' : 'bg-white text-navy/60 border border-navy/10'
              }`}
            >All</button>
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setFilterCategory(filterCategory === c.value ? null : c.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  filterCategory === c.value ? 'bg-navy text-white' : 'bg-white text-navy/60 border border-navy/10'
                }`}
              >{c.label}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-navy/40 text-sm">No assets match your filters</div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(asset => {
                const st = inspectionState(asset)
                return (
                  <Link key={asset.id} href={`/inspections/${asset.id}`}>
                    <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between gap-2 active:scale-[0.98] transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-navy text-sm">
                          {asset.item_number}
                          <span className="font-normal text-navy/50"> · {asset.asset_type}</span>
                        </div>
                        {asset.latestInspection?.next_due_date && (
                          <div className="text-[11px] text-navy/40 mt-0.5">
                            Next due {new Date(asset.latestInspection.next_due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
