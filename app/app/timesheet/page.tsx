'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredUser } from '../../lib/helpers'
import { getSupabase } from '../../lib/supabase'
import type { Timesheet } from '../../lib/types'

export default function TimesheetHistoryPage() {
  const [timesheets, setTimesheets] = useState<(Timesheet & { entry_count: number; total_hours: number })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const user = getStoredUser()
    if (!user) { window.location.href = '/login'; return }

    async function load() {
      const sb = getSupabase()
      const { data: sheets } = await sb
        .from('timesheets')
        .select('*')
        .order('date', { ascending: false })

      if (!sheets) { setLoading(false); return }

      const withCounts = await Promise.all(
        sheets.map(async (ts: Timesheet) => {
          const { data: entries } = await sb
            .from('timesheet_entries')
            .select('onsite_total, offsite_total')
            .eq('timesheet_id', ts.id)
          const entry_count = entries?.length || 0
          const total_hours = (entries || []).reduce(
            (sum: number, e: { onsite_total: number | null; offsite_total: number | null }) =>
              sum + (e.onsite_total || 0) + (e.offsite_total || 0),
            0
          )
          return { ...ts, entry_count, total_hours }
        })
      )
      setTimesheets(withCounts)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60 active:text-white">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <div className="text-lg font-bold text-white">Timesheets</div>
          </div>
        </div>

        {/* New Timesheet Button */}
        <div className="px-4 pt-4">
          <Link
            href="/timesheet/new"
            className="flex items-center justify-center gap-2 w-full py-3 bg-orange text-white font-semibold
              rounded-xl active:scale-95 active:bg-orange-light transition-all duration-150"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Timesheet
          </Link>
        </div>

        {/* List */}
        <div className="flex-1 px-4 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : timesheets.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <div className="font-medium">No timesheets yet</div>
              <div className="text-sm mt-1">Tap &quot;New Timesheet&quot; to get started</div>
            </div>
          ) : (
            timesheets.map((ts) => (
              <Link key={ts.id} href={`/timesheet/${ts.id}`}>
                <div className="bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform duration-150">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-navy">{ts.project_name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{ts.date}</span>
                        {ts.simpro_job_id && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                            Simpro #{ts.simpro_job_id}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      ts.submitted_at ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {ts.submitted_at ? 'Submitted' : 'Draft'}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
                        <circle cx="9" cy="7" r="4" />
                      </svg>
                      {ts.entry_count} employee{ts.entry_count !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      {ts.total_hours.toFixed(1)} hrs
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
