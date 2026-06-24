'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '../../../../lib/supabase'
import { getStoredUser } from '../../../../lib/helpers'
import type { RatUser, FacadeRepair, FacadeRepairStep } from '../../../../lib/types'

type RepairWithSteps = FacadeRepair & { facade_repair_steps: FacadeRepairStep[] }

export default function DropRepairsPage() {
  const params = useParams()
  const buildingId = params.buildingId as string
  const drop = decodeURIComponent(params.drop as string)

  const [user, setUser] = useState<RatUser | null>(null)
  const [repairs, setRepairs] = useState<RepairWithSteps[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)

    async function load() {
      const { data } = await getSupabase()
        .from('facade_repairs')
        .select('*, facade_repair_steps(*)')
        .eq('inspection_id', buildingId)
        .eq('drop', drop)
        .order('repair_number', { ascending: true })

      if (data) setRepairs(data as RepairWithSteps[])
      setLoading(false)
    }
    load()
  }, [buildingId, drop])

  if (!user) return null

  function getStatusBadge(status: string) {
    switch (status) {
      case 'completed':
        return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Completed</span>
      case 'in_progress':
        return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange/10 text-orange">In Progress</span>
      default:
        return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-navy/50">Not Started</span>
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href={`/facade-repair/${buildingId}`} className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">Drop {drop}</div>
            <div className="text-xs text-white/50">{repairs.length} repair{repairs.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : repairs.length === 0 ? (
            <div className="text-center py-12 text-navy/40">No repairs for this drop</div>
          ) : (
            <div className="flex flex-col gap-3">
              {repairs.map(r => {
                const steps = r.facade_repair_steps || []
                const completedSteps = steps.filter(s => s.completed).length
                const totalSteps = steps.length
                const stepPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

                return (
                  <Link key={r.id} href={`/facade-repair/${buildingId}/${drop}/${r.id}`}>
                    <div className="bg-white rounded-xl p-4 shadow-sm active:scale-95 transition-all duration-150">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-navy text-sm">{r.repair_number}</div>
                        {getStatusBadge(r.status)}
                      </div>
                      <div className="text-xs text-navy/50 mb-2">
                        {r.defect_type}{r.sub_type ? ` — ${r.sub_type}` : ''}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all duration-300"
                            style={{ width: `${stepPct}%` }}
                          />
                        </div>
                        <div className="text-xs text-navy/40 whitespace-nowrap">
                          {completedSteps}/{totalSteps} complete
                        </div>
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
