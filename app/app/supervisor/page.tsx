'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getStoredUser } from '../../lib/helpers'
import { getSupabase } from '../../lib/supabase'
import type { RatUser, SupervisorReview } from '../../lib/types'

export default function SupervisorPage() {
  const [, setUser] = useState<RatUser | null>(null)
  const [reviews, setReviews] = useState<SupervisorReview[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('supervisor_reviews')
      .select('*')
      .order('job_date', { ascending: false })
    setReviews(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    loadData()
  }, [loadData])

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/" className="text-white/60 active:text-white transition-all">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="text-xl font-bold text-white">Supervisor Reviews</div>
        </div>

        {/* List */}
        <div className="flex-1 px-4 py-4 pb-24 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center text-navy/40 py-12">No reviews yet</div>
          ) : (
            reviews.map((r) => (
              <Link key={r.id} href={`/supervisor/${r.id}`}>
                <div className="bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-navy">{r.job_name}</div>
                      <div className="text-sm text-navy/50 mt-0.5">
                        {new Date(r.job_date).toLocaleDateString('en-AU')}
                      </div>
                      <div className="text-xs text-navy/40 mt-1">Supervisor: {r.supervisor}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {r.incidents && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Incidents
                        </span>
                      )}
                      {r.delays && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                          Delays
                        </span>
                      )}
                      {!r.incidents && !r.delays && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          All Clear
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Add Button */}
        <div className="fixed bottom-0 left-0 right-0 z-10">
          <div className="max-w-[480px] mx-auto px-4 pb-6">
            <Link href="/supervisor/new">
              <button className="w-full bg-orange text-white font-semibold py-4 rounded-xl text-center
                active:scale-95 active:bg-orange-light transition-all shadow-lg min-h-[48px]">
                + New Review
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
