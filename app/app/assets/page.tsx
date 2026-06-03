'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser, Asset, AssetInspection } from '@/lib/types'

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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  available:    { label: 'Available',   bg: 'bg-green-100',  text: 'text-green-700' },
  assigned:     { label: 'Assigned',    bg: 'bg-blue-100',   text: 'text-blue-700' },
  on_job:       { label: 'On Job',      bg: 'bg-indigo-100', text: 'text-indigo-700' },
  in_service:   { label: 'In Service',  bg: 'bg-yellow-100', text: 'text-yellow-700' },
  broken:       { label: 'Broken',      bg: 'bg-red-100',    text: 'text-red-700' },
  retired:      { label: 'Retired',     bg: 'bg-gray-100',   text: 'text-gray-500' },
  lost:         { label: 'Lost',        bg: 'bg-orange-100', text: 'text-orange-700' },
  quarantine:   { label: 'Quarantine',  bg: 'bg-purple-100', text: 'text-purple-700' },
}

type AssetWithInspection = Asset & { latestInspection: AssetInspection | null }

function getInspectionWarning(asset: AssetWithInspection): 'overdue' | 'due_soon' | null {
  const insp = asset.latestInspection
  if (!insp?.next_due_date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(insp.next_due_date)
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 30) return 'due_soon'
  return null
}

export default function AssetsListPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [assets, setAssets] = useState<AssetWithInspection[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    loadAssets()
  }, [])

  async function loadAssets() {
    const { data } = await getSupabase()
      .from('assets')
      .select('*, asset_inspections(id, result, next_due_date, inspection_date)')
      .order('created_at', { ascending: false })

    const processed: AssetWithInspection[] = (data || []).map((row: Record<string, unknown>) => {
      const inspections = (row.asset_inspections as AssetInspection[] || []).sort(
        (a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime()
      )
      const { asset_inspections: _drop, ...rest } = row
      return { ...(rest as unknown as Asset), latestInspection: inspections[0] || null }
    })
    setAssets(processed)
    setLoading(false)
  }

  if (!user) return null

  const filtered = assets.filter(a => {
    if (filterCategory && a.category !== filterCategory) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        a.item_number.toLowerCase().includes(q) ||
        a.asset_type.toLowerCase().includes(q) ||
        (a.manufacturer || '').toLowerCase().includes(q) ||
        (a.model || '').toLowerCase().includes(q) ||
        (a.serial_number || '').toLowerCase().includes(q) ||
        (a.current_assignee_name || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const total = assets.length
  const available = assets.filter(a => a.status === 'available').length
  const inUse = assets.filter(a => a.status === 'assigned' || a.status === 'on_job').length
  const attention = assets.filter(a => ['broken', 'quarantine', 'lost'].includes(a.status)).length

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60 active:scale-95 transition-transform">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 19l-7-7 7-7"/>
              </svg>
            </Link>
            <div>
              <div className="text-lg font-bold text-white">Asset Management</div>
              <div className="text-xs text-white/50">{user.name}</div>
            </div>
          </div>
          <Link href="/assets/scan" className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl active:scale-95 transition-all text-white" title="Batch Assign">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M15 3h4a2 2 0 012 2v4M15 21h4a2 2 0 002-2v-4"/>
              <rect x="7" y="7" width="10" height="10" rx="1"/>
            </svg>
          </Link>
        </div>

        <div className="flex-1 px-4 py-4 pb-24">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Total',     value: total,     bg: 'bg-navy/5' },
              { label: 'Available', value: available, bg: 'bg-green-50' },
              { label: 'In Use',    value: inUse,     bg: 'bg-blue-50' },
              { label: 'Attention', value: attention, bg: attention > 0 ? 'bg-red-50' : 'bg-gray-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                <div className="text-xl font-bold text-navy">{s.value}</div>
                <div className="text-[10px] text-navy/50 font-medium">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search item #, type, make, serial..."
            className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40 mb-3"
          />

          {/* Category filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            <button
              onClick={() => setFilterCategory(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                !filterCategory ? 'bg-navy text-white' : 'bg-white text-navy/60 border border-navy/10'
              }`}
            >
              All
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setFilterCategory(filterCategory === c.value ? null : c.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  filterCategory === c.value ? 'bg-navy text-white' : 'bg-white text-navy/60 border border-navy/10'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-navy/40 text-sm">
              {assets.length === 0 ? 'No assets yet — tap + New Asset to get started' : 'No assets match your search'}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(asset => {
                const sc = STATUS_CONFIG[asset.status] || STATUS_CONFIG.available
                const warning = getInspectionWarning(asset)
                return (
                  <Link key={asset.id} href={`/assets/${asset.id}`}>
                    <div className="bg-white rounded-xl shadow-sm p-4 active:scale-[0.98] transition-all duration-150">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-navy text-sm">
                            {asset.item_number}
                            <span className="font-normal text-navy/50"> · {asset.asset_type}</span>
                          </div>
                          {(asset.manufacturer || asset.model) && (
                            <div className="text-xs text-navy/50 mt-0.5">
                              {[asset.manufacturer, asset.model].filter(Boolean).join(' ')}
                            </div>
                          )}
                          {asset.current_assignee_name && (
                            <div className="text-xs text-navy/40 mt-0.5">→ {asset.current_assignee_name}</div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                            {sc.label}
                          </span>
                          {warning === 'overdue' && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500 text-white">
                              Overdue
                            </span>
                          )}
                          {warning === 'due_soon' && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                              Due Soon
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* New asset button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-gray/90 backdrop-blur-sm">
          <div className="max-w-[480px] mx-auto">
            <Link href="/assets/new">
              <div className="w-full bg-orange text-white text-center font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] flex items-center justify-center text-sm">
                + New Asset
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
