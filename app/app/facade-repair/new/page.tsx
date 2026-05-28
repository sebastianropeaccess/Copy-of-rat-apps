'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser, FacadeInspection, FacadeDefect } from '@/lib/types'

function getPresetSteps(defectType: string): string[] {
  const key = defectType.toLowerCase()
  if (key.includes('spalling') || key.includes('concrete spalling')) {
    return ['Breakout', 'Clean Steel', 'Anode Installation', 'Prime Steel', 'Straight Cut Edge', 'Pack Out', 'Prime', 'Paint']
  }
  if (key.includes('concrete cracking') || key.includes('concrete crack')) {
    return ['Crack Chase', 'Clean', 'Fill', 'Prime', 'Paint']
  }
  if (key.includes('brick cracking') || key.includes('brick crack')) {
    return ['Clean', 'Fill', 'Point', 'Paint']
  }
  if (key.includes('joint seal')) {
    return ['Remove Old Sealant', 'Clean', 'Prime', 'Apply Sealant']
  }
  if (key.includes('paint defect') || key.includes('paint')) {
    return ['Scrape', 'Sand', 'Prime', 'Paint']
  }
  return ['Before Photo', 'Repair', 'After Photo']
}

export default function NewFacadeRepairPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [inspections, setInspections] = useState<FacadeInspection[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)

    async function load() {
      const { data } = await getSupabase()
        .from('facade_inspections')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) setInspections(data as FacadeInspection[])
      setLoading(false)
    }
    load()
  }, [])

  async function handleCreate() {
    if (!selectedId || !user) return
    setCreating(true)
    setError('')

    try {
      const supabase = getSupabase()
      const inspection = inspections.find(i => i.id === selectedId)
      if (!inspection) throw new Error('Inspection not found')

      // Load all defects for this inspection
      const { data: defects, error: defectsError } = await supabase
        .from('facade_defects')
        .select('*')
        .eq('inspection_id', selectedId)
        .order('created_at', { ascending: true })

      if (defectsError) throw defectsError
      if (!defects || defects.length === 0) {
        setError('No defects found for this inspection.')
        setCreating(false)
        return
      }

      const typedDefects = defects as FacadeDefect[]

      // Create facade_repair records
      const repairInserts = typedDefects.map(d => ({
        inspection_id: selectedId,
        defect_id: d.id,
        building_name: inspection.building_name,
        drop: d.drop,
        floor: d.floor,
        defect_type: d.defect_type,
        sub_type: d.sub_type,
        repair_number: d.repair_number,
        initial_photo_url: d.photo1_url,
        status: 'not_started',
        created_by: user.name,
      }))

      const { data: repairs, error: repairError } = await supabase
        .from('facade_repairs')
        .insert(repairInserts)
        .select('id, defect_type')

      if (repairError) throw repairError
      if (!repairs) throw new Error('Failed to create repairs')

      // Create steps for each repair
      const stepInserts: {
        facade_repair_id: string
        step_number: number
        step_name: string
        completed: boolean
      }[] = []

      for (const repair of repairs) {
        const steps = getPresetSteps(repair.defect_type)
        for (let i = 0; i < steps.length; i++) {
          stepInserts.push({
            facade_repair_id: repair.id,
            step_number: i + 1,
            step_name: steps[i],
            completed: false,
          })
        }
      }

      // Insert steps in batches of 500 to avoid payload limits
      for (let i = 0; i < stepInserts.length; i += 500) {
        const batch = stepInserts.slice(i, i + 500)
        const { error: stepError } = await supabase
          .from('facade_repair_steps')
          .insert(batch)
        if (stepError) throw stepError
      }

      window.location.href = `/facade-repair/${selectedId}`
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create repair program'
      setError(message)
      setCreating(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/facade-repair" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="text-lg font-bold text-white">New Repair Program</div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : inspections.length === 0 ? (
            <div className="text-center py-12 text-navy/40">No inspections available</div>
          ) : (
            <div className="flex flex-col gap-4">
              <label className="text-sm font-semibold text-navy">Select Inspection</label>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-navy min-h-[48px]"
              >
                <option value="">Choose an inspection...</option>
                {inspections.map(insp => (
                  <option key={insp.id} value={insp.id}>
                    {insp.building_name} — {new Date(insp.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={!selectedId || creating}
                className="w-full bg-orange text-white font-semibold py-3 rounded-xl min-h-[48px] disabled:opacity-50 active:scale-95 transition-all duration-150"
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating repairs...
                  </span>
                ) : (
                  'Create Repair Program'
                )}
              </button>

              {creating && (
                <div className="text-xs text-navy/50 text-center">
                  This may take a moment as repairs and steps are being created for each defect.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
