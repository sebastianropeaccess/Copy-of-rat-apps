'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser } from '@/lib/types'

export default function NewLeaveRequestPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [requestType, setRequestType] = useState<'Time Off' | 'Leave Early'>('Time Off')
  const [lastDayWork, setLastDayWork] = useState('')
  const [firstDayBack, setFirstDayBack] = useState('')
  const [leaveEarlyDate, setLeaveEarlyDate] = useState('')
  const [leaveEarlyTime, setLeaveEarlyTime] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
  }, [])

  function calcDaysOff(): number | null {
    if (!lastDayWork || !firstDayBack) return null
    const start = new Date(lastDayWork)
    const end = new Date(firstDayBack)
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : null
  }

  async function handleSubmit() {
    if (!reason.trim()) return
    if (requestType === 'Time Off' && (!lastDayWork || !firstDayBack)) return
    if (requestType === 'Leave Early' && (!leaveEarlyDate || !leaveEarlyTime)) return
    setSubmitting(true)

    const { error } = await getSupabase()
      .from('leave_requests')
      .insert({
        team_member_id: user!.id,
        team_member_name: user!.name,
        request_type: requestType,
        last_day_work: requestType === 'Time Off' ? lastDayWork : null,
        first_day_back: requestType === 'Time Off' ? firstDayBack : null,
        days_off: requestType === 'Time Off' ? calcDaysOff() : null,
        leave_early_date: requestType === 'Leave Early' ? leaveEarlyDate : null,
        leave_early_time: requestType === 'Leave Early' ? leaveEarlyTime : null,
        reason: reason.trim(),
        status: 'Requested',
      })

    if (!error) {
      window.location.href = '/leave'
    } else {
      setSubmitting(false)
    }
  }

  if (!user) return null

  const daysOff = calcDaysOff()
  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[48px]"

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/leave" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="text-lg font-bold text-white">New Leave Request</div>
        </div>

        <div className="flex-1 px-4 py-4 pb-32">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy/60 mb-1">Request Type</label>
              <div className="flex gap-2">
                {(['Time Off', 'Leave Early'] as const).map(t => (
                  <button key={t} onClick={() => setRequestType(t)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95 min-h-[48px]
                      ${requestType === t ? 'bg-navy text-white' : 'bg-white text-navy/40 border border-gray-200'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {requestType === 'Time Off' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-navy/60 mb-1">Last Day of Work</label>
                  <input type="datetime-local" value={lastDayWork} onChange={e => setLastDayWork(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy/60 mb-1">First Day Back</label>
                  <input type="datetime-local" value={firstDayBack} onChange={e => setFirstDayBack(e.target.value)} className={inputCls} />
                </div>
                {daysOff != null && (
                  <div className="bg-white rounded-xl p-3 border border-gray-200 text-center">
                    <span className="text-2xl font-bold text-orange">{daysOff}</span>
                    <span className="text-sm text-navy/40 ml-2">day{daysOff !== 1 ? 's' : ''} off</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-navy/60 mb-1">Date</label>
                  <input type="date" value={leaveEarlyDate} onChange={e => setLeaveEarlyDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy/60 mb-1">Leave Early Time</label>
                  <input type="time" value={leaveEarlyTime} onChange={e => setLeaveEarlyTime(e.target.value)} className={inputCls} />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-navy/60 mb-1">Reason</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Reason for leave..."
                className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[96px] resize-none" />
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0">
          <div className="w-full max-w-[480px] mx-auto px-4 py-4 bg-light-gray border-t border-gray-200">
            <button onClick={handleSubmit} disabled={submitting || !reason.trim()}
              className="w-full bg-orange text-white font-semibold py-4 rounded-xl text-sm
                active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[48px]">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
