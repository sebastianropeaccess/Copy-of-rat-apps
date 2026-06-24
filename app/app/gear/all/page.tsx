'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../../lib/supabase'
import { getStoredUser } from '../../../lib/helpers'
import type { RatUser, GearItem, GearInspection } from '../../../lib/types'

function getInspectionStatus(inspections: GearInspection[]): { label: string; color: string } {
  if (inspections.length === 0) return { label: 'No Inspection', color: 'bg-gray-200 text-gray-600' }
  const latest = inspections.sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0]
  if (latest.result === 'Fail') return { label: 'Failed', color: 'bg-red-100 text-red-700' }
  const months = (Date.now() - new Date(latest.inspected_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
  if (months > 6) return { label: 'Overdue', color: 'bg-red-100 text-red-700' }
  if (months > 5) return { label: 'Due Soon', color: 'bg-yellow-100 text-yellow-700' }
  return { label: 'Current', color: 'bg-green-100 text-green-700' }
}

export default function AllGearPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [items, setItems] = useState<(GearItem & { gear_inspections: GearInspection[] })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    if (!stored.can_view_all_data) { window.location.href = '/gear'; return }
    setUser(stored)

    async function load() {
      const { data } = await getSupabase()
        .from('gear_items')
        .select('*, gear_inspections(*)')
        .order('team_member_name')

      if (data) setItems(data as (GearItem & { gear_inspections: GearInspection[] })[])
      setLoading(false)
    }
    load()
  }, [])

  const grouped = items.reduce<Record<string, (GearItem & { gear_inspections: GearInspection[] })[]>>((acc, item) => {
    const name = item.team_member_name || 'Unassigned'
    if (!acc[name]) acc[name] = []
    acc[name].push(item)
    return acc
  }, {})

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/gear" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="text-lg font-bold text-white">All Gear</div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-navy/40">No gear registered</div>
          ) : (
            Object.entries(grouped).map(([name, gearItems]) => (
              <div key={name} className="mb-5">
                <div className="text-xs font-semibold text-navy/40 uppercase mb-2">{name}</div>
                <div className="flex flex-col gap-2">
                  {gearItems.map(item => {
                    const status = getInspectionStatus(item.gear_inspections || [])
                    return (
                      <Link key={item.id} href={`/gear/${item.id}`}>
                        <div className="bg-white rounded-xl p-4 shadow-sm active:scale-95 transition-all duration-150">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold text-navy text-sm">{item.gear_type}</div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                          </div>
                          <div className="text-xs text-navy/50">{item.gear_id}</div>
                          <div className="text-xs text-navy/40 mt-0.5">{item.manufacturer} {item.model}</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
