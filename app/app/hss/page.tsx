'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser, HssInspection } from '@/lib/types'

type InspectionWithAnchors = HssInspection & { hss_anchors: { id: string }[] }

export default function HssListPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [inspections, setInspections] = useState<InspectionWithAnchors[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)

    async function load() {
      const { data } = await getSupabase()
        .from('hss_inspections')
        .select('*, hss_anchors(id)')
        .order('created_at', { ascending: false })

      if (data) setInspections(data as InspectionWithAnchors[])
      setLoading(false)
    }
    load()
  }, [])

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
              <div className="text-lg font-bold text-white">HSS Inspections</div>
              <div className="text-xs text-white/50">{user.name}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 pb-24">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : inspections.length === 0 ? (
            <div className="text-center py-12 text-navy/40">No inspections yet</div>
          ) : (
            <div className="flex flex-col gap-3">
              {inspections.map(insp => {
                const anchorCount = insp.hss_anchors?.length || 0
                const isComplete = insp.inspection_complete
                return (
                  <Link key={insp.id} href={`/hss/${insp.id}`}>
                    <div className="bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-all duration-150">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold text-navy text-sm">{insp.building_name}</div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          isComplete
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange/10 text-orange'
                        }`}>
                          {isComplete ? 'Complete' : 'In Progress'}
                        </span>
                      </div>
                      <div className="text-xs text-navy/50">{insp.inspection_date}</div>
                      <div className="text-xs text-navy/40 mt-0.5">
                        {insp.inspectors?.join(', ')}
                      </div>
                      <div className="text-xs text-navy/40 mt-0.5">
                        {anchorCount} anchor{anchorCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-gray/80 backdrop-blur-sm">
          <div className="max-w-[480px] mx-auto">
            <Link href="/hss/new"
              className="block w-full bg-orange text-white text-center font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] flex items-center justify-center">
              + Add Inspection
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
