'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../lib/supabase'
import { getStoredUser } from '../../lib/helpers'
import type { RatUser, LeaveRequest } from '../../lib/types'

const TABS = ['All', 'Requested', 'Approved', 'Denied'] as const

function statusBadge(status: string) {
  switch (status) {
    case 'Approved': return 'bg-green-100 text-green-700'
    case 'Denied': return 'bg-red-100 text-red-700'
    default: return 'bg-yellow-100 text-yellow-700'
  }
}

export default function LeaveListPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<typeof TABS[number]>('All')

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)

    async function load() {
      const { data } = await getSupabase()
        .from('leave_requests')
        .select('*')
        .eq('team_member_id', stored!.id)
        .order('created_at', { ascending: false })

      if (data) setRequests(data)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = tab === 'All' ? requests : requests.filter(r => r.status === tab)

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60 active:scale-95 transition-transform">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
            </Link>
            <div>
              <div className="text-lg font-bold text-white">Leave Requests</div>
              <div className="text-xs text-white/50">{user.name}</div>
            </div>
          </div>
          <div className="flex gap-2">
            {user.can_view_all_data && (
              <Link href="/leave/manage"
                className="text-white/60 text-sm px-3 py-2 rounded-xl bg-white/10 active:scale-95 transition-all duration-150 min-h-[48px] flex items-center">
                Manage
              </Link>
            )}
            <Link href="/leave/new"
              className="bg-orange text-white text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] flex items-center">
              + New
            </Link>
          </div>
        </div>

        <div className="px-4 pt-3 flex gap-2">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 rounded-full text-xs font-semibold transition-all duration-150 active:scale-95 min-h-[40px]
                ${tab === t ? 'bg-navy text-white' : 'bg-white text-navy/50'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-navy/40">No leave requests</div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(req => (
                <div key={req.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-navy/40 uppercase">{req.request_type}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(req.status)}`}>{req.status}</span>
                  </div>
                  {req.request_type === 'Time Off' ? (
                    <div className="text-sm text-navy mb-1">
                      {req.last_day_work && new Date(req.last_day_work).toLocaleDateString('en-AU')} — {req.first_day_back && new Date(req.first_day_back).toLocaleDateString('en-AU')}
                      {req.days_off != null && <span className="text-navy/40 ml-1">({req.days_off} days)</span>}
                    </div>
                  ) : (
                    <div className="text-sm text-navy mb-1">
                      {req.leave_early_date && new Date(req.leave_early_date + 'T00:00:00').toLocaleDateString('en-AU')} at {req.leave_early_time}
                    </div>
                  )}
                  {req.reason && (
                    <div className="text-xs text-navy/40 truncate">{req.reason}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
