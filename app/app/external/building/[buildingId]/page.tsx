'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '../../../../lib/supabase'
import { getStoredExternalUser, getDropLabel } from '../../../../lib/helpers'
import type { ExternalUser, RepairBuilding, Repair } from '../../../../lib/types'

type RepairExt = Repair & { urgency?: string; assigned_contractor?: string }

export default function ExternalBuildingPage() {
  const params = useParams<{ buildingId: string }>()
  const [extUser] = useState<ExternalUser | null>(() => getStoredExternalUser())
  const [building, setBuilding] = useState<RepairBuilding | null>(null)
  const [repairs, setRepairs] = useState<RepairExt[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Filters
  const [urgencyFilter, setUrgencyFilter] = useState('All')
  const [contractorFilter, setContractorFilter] = useState('All')
  const [defectFilter, setDefectFilter] = useState('All')

  const loadData = useCallback(async () => {
    const [{ data: bld }, { data: reps }] = await Promise.all([
      getSupabase()
        .from('repair_buildings')
        .select('*')
        .eq('id', params.buildingId)
        .single(),
      getSupabase()
        .from('repairs')
        .select('*')
        .eq('building_id', params.buildingId)
        .order('created_at', { ascending: false }),
    ])

    if (bld) setBuilding(bld as RepairBuilding)
    if (reps) setRepairs((reps as RepairExt[]).filter(r => !r.defect_type?.startsWith('__')))
    setLoading(false)
  }, [params.buildingId])

  useEffect(() => {
    if (!extUser) { window.location.href = '/login'; return }
    void Promise.resolve().then(loadData)
  }, [extUser, loadData])

  if (!extUser) return null

  const dropLabels: string[] = building
    ? Array.from({ length: building.drop_count }, (_, i) => getDropLabel(i, building.drop_labelling))
    : []

  // Get unique values for filter dropdowns
  const contractors = [...new Set(repairs.map(r => r.assigned_contractor).filter(Boolean))] as string[]
  const defectTypes = [...new Set(repairs.map(r => r.defect_type).filter(Boolean))]

  // Apply filters
  const filtered = repairs.filter(r => {
    if (urgencyFilter !== 'All' && r.urgency !== urgencyFilter) return false
    if (contractorFilter !== 'All' && r.assigned_contractor !== contractorFilter) return false
    if (defectFilter !== 'All' && r.defect_type !== defectFilter) return false
    return true
  })

  const urgentCount = repairs.filter(r => r.urgency === 'Urgent').length
  const completedCount = repairs.filter(r => r.status === 'completed').length
  const openCount = repairs.length - completedCount
  const planUrls = building
    ? building.drop_plan_urls?.length
      ? building.drop_plan_urls
      : building.drop_plan_url
        ? [building.drop_plan_url]
        : []
    : []

  // Group by drop
  const repairsByDrop = filtered.reduce<Record<string, RepairExt[]>>((acc, r) => {
    if (!acc[r.drop_label]) acc[r.drop_label] = []
    acc[r.drop_label].push(r)
    return acc
  }, {})

  function getDropColor(label: string): string {
    const drs = repairsByDrop[label]
    if (!drs || drs.length === 0) return 'bg-gray-200 text-navy/40'
    const allDone = drs.every(r => r.status === 'completed')
    return allDone ? 'bg-green-500 text-white' : 'bg-orange text-white'
  }

  const urgencyOptions = ['All', 'Urgent', 'Later', 'Monitor', 'Leave']

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/external/dashboard" className="min-w-[48px] min-h-[48px] flex items-center justify-center text-white active:scale-95 transition-transform -ml-2">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-white truncate">{building?.name || 'Building'}</div>
            <div className="text-xs text-white/50">{filtered.length} repair{filtered.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !building ? (
            <div className="text-center py-12 text-navy/40">Building not found</div>
          ) : (
            <>
              {/* Building summary */}
              <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1">Building Overview</div>
                    <div className="text-sm text-navy/70 leading-relaxed">
                      Repairs are organised by drop reference so your team and ours can talk about the same locations.
                    </div>
                  </div>
                  {extUser.can_download_reports && (
                    <Link
                      href={`/external/building/${params.buildingId}/report`}
                      className="shrink-0 rounded-xl bg-orange px-3 py-2 text-xs font-semibold text-white active:scale-95 transition-all"
                    >
                      Download Report
                    </Link>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-light-gray p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-navy/40">Open</div>
                    <div className="mt-1 text-xl font-bold text-navy">{openCount}</div>
                  </div>
                  <div className="rounded-xl bg-light-gray p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-navy/40">Completed</div>
                    <div className="mt-1 text-xl font-bold text-green-600">{completedCount}</div>
                  </div>
                  <div className="rounded-xl bg-light-gray p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-navy/40">Urgent</div>
                    <div className="mt-1 text-xl font-bold text-red-600">{urgentCount}</div>
                  </div>
                </div>
              </div>

              {/* Drop reference plan */}
              <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
                <div className="mb-3">
                  <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1">Drop Reference Plan</div>
                  <div className="text-sm text-navy/70 leading-relaxed">
                    Use this plan to match drop references below with the building locations.
                  </div>
                </div>

                {planUrls.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {planUrls.map((url, idx) => (
                      <button
                        key={`${idx}-${url}`}
                        type="button"
                        onClick={() => setLightboxUrl(url)}
                        className="block w-full rounded-xl border border-navy/10 bg-light-gray p-2 active:scale-[0.99] transition-all"
                        aria-label={`Open drop reference plan ${idx + 1}`}
                      >
                        <img
                          src={url}
                          alt={`Drop reference plan ${idx + 1}`}
                          className="w-full max-h-[340px] object-contain rounded-lg"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-navy/15 bg-light-gray px-4 py-6 text-center text-sm text-navy/45">
                    No drop reference plan has been uploaded for this building yet.
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl p-3 shadow-sm mb-4">
                <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2">Filters</div>

                {/* Urgency filter */}
                <div className="mb-2">
                  <div className="text-[10px] font-medium text-navy/40 mb-1">Urgency</div>
                  <div className="flex gap-1 flex-wrap">
                    {urgencyOptions.map(u => (
                      <button
                        key={u}
                        onClick={() => setUrgencyFilter(u)}
                        className={`rounded-lg text-xs font-semibold px-2.5 py-1.5 transition-all ${
                          urgencyFilter === u ? 'bg-orange text-white' : 'bg-light-gray text-navy/60 border border-navy/10'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contractor filter */}
                {contractors.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[10px] font-medium text-navy/40 mb-1">Contractor</div>
                    <select
                      value={contractorFilter}
                      onChange={e => setContractorFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-navy/10 bg-light-gray text-navy text-xs min-h-[36px]"
                    >
                      <option value="All">All Contractors</option>
                      {contractors.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Defect type filter */}
                <div>
                  <div className="text-[10px] font-medium text-navy/40 mb-1">Defect Type</div>
                  <select
                    value={defectFilter}
                    onChange={e => setDefectFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-navy/10 bg-light-gray text-navy text-xs min-h-[36px]"
                  >
                    <option value="All">All Defect Types</option>
                    {defectTypes.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Drop Grid */}
              <div className="mb-5">
                <div className="mb-2 px-1">
                  <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide">Repairs by Drop</div>
                  <div className="mt-1 text-xs text-navy/50">Select a drop reference to view repairs in that location.</div>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {dropLabels.map(label => {
                    const dropRepairs = repairsByDrop[label] || []
                    const count = dropRepairs.length
                    const completed = dropRepairs.filter(r => r.status === 'completed').length
                    return (
                      <Link key={label} href={`/external/building/${params.buildingId}/drop/${encodeURIComponent(label)}`}>
                        <div className={`relative rounded-xl px-2 py-2 text-center font-semibold min-h-[58px] flex flex-col items-center justify-center active:scale-95 transition-all duration-150 ${getDropColor(label)}`}>
                          <span className="text-sm leading-none">{label}</span>
                          <span className="mt-1 text-[10px] leading-none opacity-80">
                            {count > 0 ? `${completed}/${count} done` : 'No repairs'}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        {lightboxUrl && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="Drop reference plan" className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>
    </div>
  )
}
