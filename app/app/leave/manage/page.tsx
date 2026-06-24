'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../../lib/supabase'
import { getStoredUser } from '../../../lib/helpers'
import type { RatUser, LeaveRequest } from '../../../lib/types'

function statusBadge(status: string) {
  switch (status) {
    case 'Approved': return 'bg-green-100 text-green-700'
    case 'Denied': return 'bg-red-100 text-red-700'
    default: return 'bg-yellow-100 text-yellow-700'
  }
}

export default function ManageLeavePage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    if (!stored.can_view_all_data) { window.location.href = '/leave'; return }
    setUser(stored)
    loadData()
  }, [])

  async function loadData() {
    const { data } = await getSupabase()
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setRequests(data)
    setLoading(false)
  }

  async function handleAction(id: string, status: 'Approved' | 'Denied') {
    if (!user) return
    setUpdating(id)

    await getSupabase()
      .from('leave_requests')
      .update({ status, approved_by: user.name })
      .eq('id', id)

    await loadData()
    setUpdating(null)
  }

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/leave" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="text-lg font-bold text-white">Manage Leave</div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-navy/40">No leave requests</div>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map(req => (
                <div key={req.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-navy text-sm">{req.team_member_name}</div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(req.status)}`}>{req.status}</span>
                  </div>

                  <div className="text-xs text-navy/40 uppercase font-semibold mb-1">{req.request_type}</div>

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

                  {req.reason && <div className="text-xs text-navy/40 mb-3">{req.reason}</div>}

                  {req.status === 'Requested' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleAction(req.id, 'Approved')}
                        disabled={updating === req.id}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold bg-green-500 text-white active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[48px]">
                        Approve
                      </button>
                      <button onClick={() => handleAction(req.id, 'Denied')}
                        disabled={updating === req.id}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold bg-red-500 text-white active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[48px]">
                        Deny
                      </button>
                    </div>
                  )}

                  {req.approved_by && (
                    <div className="text-xs text-navy/30 mt-2">
                      {req.status} by {req.approved_by}
                    </div>
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
