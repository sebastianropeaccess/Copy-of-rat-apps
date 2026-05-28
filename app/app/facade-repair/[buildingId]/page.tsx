'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser, FacadeRepair } from '@/lib/types'

interface DropSummary {
  drop: string
  total: number
  completed: number
  inProgress: number
}

export default function BuildingDropsPage() {
  const params = useParams()
  const buildingId = params.buildingId as string

  const [user, setUser] = useState<RatUser | null>(null)
  const [buildingName, setBuildingName] = useState('')
  const [drops, setDrops] = useState<DropSummary[]>([])
  const [totalRepairs, setTotalRepairs] = useState(0)
  const [totalCompleted, setTotalCompleted] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)

    async function load() {
      const { data } = await getSupabase()
        .from('facade_repairs')
        .select('id, drop, status, building_name')
        .eq('inspection_id', buildingId)
        .order('drop', { ascending: true })

      if (data && data.length > 0) {
        const repairs = data as FacadeRepair[]
        setBuildingName(repairs[0].building_name)

        const map = new Map<string, DropSummary>()
        let total = 0
        let completed = 0

        for (const r of repairs) {
          total++
          if (r.status === 'completed') completed++

          if (!map.has(r.drop)) {
            map.set(r.drop, { drop: r.drop, total: 0, completed: 0, inProgress: 0 })
          }
          const entry = map.get(r.drop)!
          entry.total++
          if (r.status === 'completed') entry.completed++
          if (r.status === 'in_progress') entry.inProgress++
        }

        setTotalRepairs(total)
        setTotalCompleted(completed)
        setDrops(Array.from(map.values()).sort((a, b) => a.drop.localeCompare(b.drop, undefined, { numeric: true })))
      }
      setLoading(false)
    }
    load()
  }, [buildingId])

  if (!user) return null

  const overallPct = totalRepairs > 0 ? Math.round((totalCompleted / totalRepairs) * 100) : 0

  function getDropColor(d: DropSummary): string {
    if (d.completed === d.total) return 'bg-green-500 text-white'
    if (d.inProgress > 0) return 'bg-orange text-white'
    return 'bg-gray-300 text-navy'
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/facade-repair" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">{buildingName || 'Building'}</div>
            <div className="text-xs text-white/50">{totalCompleted} / {totalRepairs} repairs complete</div>
          </div>
        </div>

        <div className="px-4 pt-4">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="text-xs text-navy/40 mt-1 text-right">{overallPct}%</div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : drops.length === 0 ? (
            <div className="text-center py-12 text-navy/40">No repairs found</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {drops.map(d => (
                <Link key={d.drop} href={`/facade-repair/${buildingId}/${d.drop}`}>
                  <div className={`rounded-xl p-3 text-center active:scale-95 transition-all duration-150 ${getDropColor(d)}`}>
                    <div className="font-bold text-sm">{d.drop}</div>
                    <div className="text-xs mt-1 opacity-80">{d.completed}/{d.total}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
