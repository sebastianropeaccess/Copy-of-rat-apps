'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../lib/supabase'
import { getStoredUser } from '../../lib/helpers'
import type { RatUser, FacadeRepair } from '../../lib/types'

interface BuildingSummary {
  inspection_id: string
  building_name: string
  total: number
  completed: number
}

export default function FacadeRepairListPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [buildings, setBuildings] = useState<BuildingSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)

    async function load() {
      const { data } = await getSupabase()
        .from('facade_repairs')
        .select('id, inspection_id, building_name, status')
        .order('created_at', { ascending: false })

      if (data) {
        const map = new Map<string, BuildingSummary>()
        for (const r of data as FacadeRepair[]) {
          const key = r.inspection_id
          if (!map.has(key)) {
            map.set(key, {
              inspection_id: r.inspection_id,
              building_name: r.building_name,
              total: 0,
              completed: 0,
            })
          }
          const entry = map.get(key)!
          entry.total++
          if (r.status === 'completed') entry.completed++
        }
        setBuildings(Array.from(map.values()))
      }
      setLoading(false)
    }
    load()
  }, [])

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">Facade Repair</div>
            <div className="text-xs text-white/50">{user.name}</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 pb-24">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : buildings.length === 0 ? (
            <div className="text-center py-12 text-navy/40">No repair programs yet</div>
          ) : (
            <div className="flex flex-col gap-3">
              {buildings.map(b => {
                const pct = b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0
                return (
                  <Link key={b.inspection_id} href={`/facade-repair/${b.inspection_id}`}>
                    <div className="bg-white rounded-xl p-4 shadow-sm active:scale-95 transition-all duration-150">
                      <div className="font-semibold text-navy text-sm mb-1">{b.building_name}</div>
                      <div className="text-xs text-navy/50 mb-2">
                        {b.completed} / {b.total} repairs completed
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-navy/40 mt-1 text-right">{pct}%</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-gray/90 backdrop-blur-sm">
          <div className="max-w-[480px] mx-auto">
            <Link href="/facade-repair/new"
              className="block w-full bg-orange text-white text-center font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] flex items-center justify-center">
              + New Program
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
