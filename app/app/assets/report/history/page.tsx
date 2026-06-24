'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../../../lib/supabase'
import { getStoredUser } from '../../../../lib/helpers'
import type { RatUser, AssetAssignment } from '../../../../lib/types'

type AssignmentRow = AssetAssignment & {
  assets: { item_number: string; asset_type: string } | null
}

const ASSIGN_TYPE_LABELS: Record<string, string> = {
  person: 'Person',
  vehicle: 'Vehicle',
  storage_location: 'Location',
  job: 'Job',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AllocationHistoryPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [rows, setRows] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    load()
  }, [])

  async function load() {
    const { data } = await getSupabase()
      .from('asset_assignments')
      .select('*, assets(item_number, asset_type)')
      .order('checked_out_at', { ascending: false })
      .limit(200)
    setRows((data || []) as AssignmentRow[])
    setLoading(false)
  }

  if (!user) return null

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (r.assets?.item_number || '').toLowerCase().includes(q) ||
      (r.assets?.asset_type || '').toLowerCase().includes(q) ||
      r.assigned_to_name.toLowerCase().includes(q) ||
      (r.job_id || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
          <Link href="/assets/report" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">Allocation History</div>
            <div className="text-xs text-white/50">Past &amp; current assignments</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 pb-8">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search asset, person, or job..."
            className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40 mb-3"
          />

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-navy/40 text-sm">No assignments found</div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(r => {
                const active = !r.checked_in_at
                return (
                  <Link key={r.id} href={`/assets/${r.asset_id}`}>
                    <div className="bg-white rounded-xl shadow-sm p-4 active:scale-[0.98] transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-navy text-sm">
                            {r.assets?.item_number || 'Asset'}
                            {r.assets?.asset_type && <span className="font-normal text-navy/50"> · {r.assets.asset_type}</span>}
                          </div>
                          <div className="text-xs text-navy/50 mt-0.5">→ {r.assigned_to_name}</div>
                          <div className="text-[11px] text-navy/40 mt-1">
                            {ASSIGN_TYPE_LABELS[r.assigned_to_type] || r.assigned_to_type}
                            {r.job_id ? ` · Job ${r.job_id}` : ''}
                          </div>
                          <div className="text-[11px] text-navy/40 mt-0.5">
                            Out {formatDate(r.checked_out_at)}
                            {r.expected_return_date ? ` · due back ${formatDate(r.expected_return_date)}` : ''}
                          </div>
                          {r.notes && <div className="text-[11px] text-navy/40 mt-0.5">{r.notes}</div>}
                        </div>
                        {active ? (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium shrink-0">Active</span>
                        ) : (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium shrink-0">
                            Returned {formatDate(r.checked_in_at)}
                          </span>
                        )}
                      </div>
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
