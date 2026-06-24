'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../../lib/supabase'
import { getStoredExternalUser, clearStoredExternalUser } from '../../../lib/helpers'
import type { ExternalUser, RepairBuilding } from '../../../lib/types'

export default function ExternalDashboardPage() {
  const [extUser, setExtUser] = useState<ExternalUser | null>(null)
  const [buildings, setBuildings] = useState<RepairBuilding[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredExternalUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setExtUser(stored)
    loadBuildings(stored)
  }, [])

  async function loadBuildings(eu: ExternalUser) {
    if (!eu.building_ids || eu.building_ids.length === 0) {
      setBuildings([])
      setLoading(false)
      return
    }

    const { data } = await getSupabase()
      .from('repair_buildings')
      .select('*')
      .in('id', eu.building_ids)
      .order('name')

    setBuildings((data || []) as RepairBuilding[])
    setLoading(false)
  }

  function handleLogout() {
    clearStoredExternalUser()
    getSupabase().auth.signOut()
    window.location.href = '/login'
  }

  if (!extUser) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-lg font-bold text-white truncate">{extUser.name}</div>
            <div className="text-xs text-white/50">{extUser.company}</div>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/60 text-sm px-3 py-1.5 rounded-lg bg-white/10 active:bg-white/20 active:scale-95 transition-all duration-150 shrink-0"
          >
            Logout
          </button>
        </div>

        <div className="flex-1 px-4 py-4">
          <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-3 px-1">
            Assigned Buildings
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : buildings.length === 0 ? (
            <div className="text-center py-12 text-navy/40">No buildings assigned</div>
          ) : (
            <div className="flex flex-col gap-3">
              {buildings.map(b => (
                <Link key={b.id} href={`/external/building/${b.id}`}>
                  <div className="bg-white rounded-xl p-5 shadow-sm active:scale-[0.98] transition-all duration-150">
                    <div className="font-semibold text-navy text-base">{b.name}</div>
                    <div className="text-xs text-navy/50 mt-1">
                      {b.drop_count} drop{b.drop_count !== 1 ? 's' : ''} &middot; {b.floor_count} floor{b.floor_count !== 1 ? 's' : ''}
                    </div>
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
