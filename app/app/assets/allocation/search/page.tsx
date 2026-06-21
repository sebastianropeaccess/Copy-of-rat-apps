'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser, getAllocationQueue, setAllocationQueue } from '@/lib/helpers'
import type { RatUser, Asset } from '@/lib/types'

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
  available:  { label: 'Available',  bg: 'bg-green-100',  text: 'text-green-700' },
  assigned:   { label: 'Assigned',   bg: 'bg-blue-100',   text: 'text-blue-700' },
  on_job:     { label: 'On Job',     bg: 'bg-indigo-100', text: 'text-indigo-700' },
  in_service: { label: 'In Service', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  broken:     { label: 'Broken',     bg: 'bg-red-100',    text: 'text-red-700' },
  retired:    { label: 'Retired',    bg: 'bg-gray-100',   text: 'text-gray-500' },
  lost:       { label: 'Lost',       bg: 'bg-orange-100', text: 'text-orange-700' },
  quarantine: { label: 'Quarantine', bg: 'bg-purple-100', text: 'text-purple-700' },
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / 86400000)
}

export default function AllocationSearchPage() {
  const router = useRouter()
  const [user, setUser] = useState<RatUser | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [alreadyQueued, setAlreadyQueued] = useState<Set<string>>(new Set())
  const [openMap, setOpenMap] = useState<Record<string, string | null>>({})

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    setAlreadyQueued(new Set(getAllocationQueue().map(a => a.id)))
    loadAssets()
  }, [])

  async function loadAssets() {
    // Exclude retired/lost from allocation. Pull open assignments to flag availability.
    const [{ data: assetRows }, { data: openRows }] = await Promise.all([
      getSupabase()
        .from('assets')
        .select('*')
        .not('status', 'in', '("retired","lost")')
        .order('item_number', { ascending: true }),
      getSupabase()
        .from('asset_assignments')
        .select('asset_id, expected_return_date')
        .is('checked_in_at', null),
    ])
    const map: Record<string, string | null> = {}
    for (const r of (openRows || []) as { asset_id: string; expected_return_date: string | null }[]) {
      map[r.asset_id] = r.expected_return_date
    }
    setOpenMap(map)
    setAssets((assetRows || []) as Asset[])
    setLoading(false)
  }

  function toggle(id: string) {
    if (alreadyQueued.has(id)) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function addSelected() {
    if (selected.size === 0) return
    const current = getAllocationQueue()
    const currentIds = new Set(current.map(a => a.id))
    const toAdd = assets.filter(a => selected.has(a.id) && !currentIds.has(a.id))
    setAllocationQueue([...current, ...toAdd])
    router.push('/assets/allocation')
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
          <Link href="/assets/allocation" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">Search Assets</div>
            <div className="text-xs text-white/50">Tap to select multiple</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 pb-28">
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
            <div className="text-center py-12 text-navy/40 text-sm">No assets match your search</div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(asset => {
                const sc = STATUS_CONFIG[asset.status] || STATUS_CONFIG.available
                const isQueued = alreadyQueued.has(asset.id)
                const isSelected = selected.has(asset.id)
                const out = asset.id in openMap
                const ret = openMap[asset.id]
                let outText = ''
                if (out) {
                  if (ret) {
                    const d = daysUntil(ret)
                    outText = d > 0 ? `Not available till ${d} day${d !== 1 ? 's' : ''}` : 'Not available (return overdue)'
                  } else outText = 'Not available (no return date)'
                }
                return (
                  <button
                    key={asset.id}
                    onClick={() => toggle(asset.id)}
                    disabled={isQueued}
                    className={`text-left rounded-xl shadow-sm px-4 py-3 flex items-center gap-3 transition-all min-h-[60px] ${
                      isQueued ? 'bg-navy/5 opacity-60'
                        : isSelected ? 'bg-orange/10 border-2 border-orange'
                        : out ? 'bg-gray-100 opacity-70 border-2 border-transparent'
                        : 'bg-white border-2 border-transparent active:scale-[0.99]'
                    }`}
                  >
                    {/* checkbox */}
                    <div className={`w-6 h-6 rounded-md shrink-0 flex items-center justify-center border-2 ${
                      isSelected ? 'bg-orange border-orange' : 'border-navy/20'
                    }`}>
                      {isSelected && (
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-navy text-sm">
                        {asset.item_number}
                        <span className="font-normal text-navy/50"> · {asset.asset_type}</span>
                      </div>
                      {(asset.manufacturer || asset.model) && (
                        <div className="text-xs text-navy/40 mt-0.5">
                          {[asset.manufacturer, asset.model].filter(Boolean).join(' ')}
                        </div>
                      )}
                      {out && <div className="text-xs font-semibold text-red-500 mt-0.5">{outText}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                        {sc.label}
                      </span>
                      {isQueued && <span className="text-[10px] text-navy/30">In list</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Add selected */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-gray/90 backdrop-blur-sm">
          <div className="max-w-[480px] mx-auto">
            <button
              onClick={addSelected}
              disabled={selected.size === 0}
              className="w-full bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100 text-sm"
            >
              {selected.size > 0 ? `Add ${selected.size} to list` : 'Select assets to add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
