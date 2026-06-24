'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '../../../lib/supabase'
import { getStoredUser, getDropLabel } from '../../../lib/helpers'
import type { RatUser, RepairBuilding, Repair } from '../../../lib/types'

type RepairWithSteps = Repair & { repair_steps: { id: string }[] } & { urgency?: string; assigned_contractor?: string }

const URGENCY_BADGE: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700',
  Later: 'bg-yellow-100 text-yellow-700',
  Monitor: 'bg-blue-100 text-blue-700',
  Leave: 'bg-gray-100 text-gray-600',
}

const URGENCY_OPTIONS = ['Urgent', 'Later', 'Monitor', 'Leave']

const DEFECT_CATEGORIES = ['Brick Work', 'Caulking', 'Cleaning', 'Coatings', 'Concrete', 'Installation', 'Screens, Fins & Hoods', 'Spitters', 'Waterproofing', 'Windows & Doors', 'Other']

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return '<1m'
}

export default function BuildingDetailPage() {
  const params = useParams<{ buildingId: string }>()
  const [user, setUser] = useState<RatUser | null>(null)
  const [building, setBuilding] = useState<RepairBuilding | null>(null)
  const [repairs, setRepairs] = useState<RepairWithSteps[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(Date.now())

  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDefectType, setFilterDefectType] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('')
  const [filterDropLabel, setFilterDropLabel] = useState('')
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    loadData()

    const onFocus = () => loadData()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') loadData()
    })
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  async function loadData() {
    const [{ data: bld }, { data: reps }] = await Promise.all([
      getSupabase()
        .from('repair_buildings')
        .select('*')
        .eq('id', params.buildingId)
        .single(),
      getSupabase()
        .from('repairs')
        .select('*, repair_steps(id)')
        .eq('building_id', params.buildingId)
        .order('created_at', { ascending: false }),
    ])

    if (bld) setBuilding(bld as RepairBuilding)
    if (reps) setRepairs(reps as RepairWithSteps[])
    setRefreshKey(Date.now())
    setLoading(false)
  }

  const bustCache = (url: string) => `${url}${url.includes('?') ? '&' : '?'}v=${refreshKey}`

  if (!user) return null

  const dropLabels: string[] = building
    ? Array.from({ length: building.drop_count }, (_, i) => getDropLabel(i, building.drop_labelling))
    : []

  // Visible repairs (exclude system markers)
  const visibleRepairs = repairs.filter(r => !r.defect_type?.startsWith('__'))

  // Apply filters
  const filteredRepairs = visibleRepairs.filter(r => {
    if (filterStatus === 'inspected' && !(r.status === 'in_progress' && (!r.repair_steps || r.repair_steps.length === 0))) return false
    if (filterStatus === 'in_progress' && !(r.status === 'in_progress' && r.repair_steps && r.repair_steps.length > 0)) return false
    if (filterStatus === 'completed' && r.status !== 'completed') return false
    if (filterDefectType && r.defect_type !== filterDefectType) return false
    if (filterUrgency && r.urgency !== filterUrgency) return false
    if (filterDropLabel && r.drop_label !== filterDropLabel) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      const match = [r.defect_type, r.sub_type, r.initial_comments, r.repair_number, r.drop_label, r.location]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
      if (!match) return false
    }
    return true
  })

  const activeFilterCount = [
    filterStatus !== 'all' ? 1 : 0,
    filterDefectType ? 1 : 0,
    filterUrgency ? 1 : 0,
    filterDropLabel ? 1 : 0,
    searchText ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  // Sort: in_progress first, then completed
  const sortedRepairs = [...filteredRepairs].sort((a, b) => {
    if (a.status === b.status) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return a.status === 'in_progress' ? -1 : 1
  })

  // Group repairs by drop (using filtered set)
  const repairsByDrop = sortedRepairs.reduce<Record<string, RepairWithSteps[]>>((acc, r) => {
    if (!acc[r.drop_label]) acc[r.drop_label] = []
    acc[r.drop_label].push(r)
    return acc
  }, {})

  // Drop colors use ALL repairs (not filtered) for status indication
  const allRepairsByDrop = visibleRepairs.reduce<Record<string, RepairWithSteps[]>>((acc, r) => {
    if (!acc[r.drop_label]) acc[r.drop_label] = []
    acc[r.drop_label].push(r)
    return acc
  }, {})

  function getDropColor(label: string): string {
    const drs = allRepairsByDrop[label]
    if (!drs || drs.length === 0) return 'bg-gray-200 text-navy/40'
    const allDone = drs.every(r => r.status === 'completed')
    return allDone ? 'bg-green-500 text-white' : 'bg-orange text-white'
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/repairs" className="min-w-[48px] min-h-[48px] flex items-center justify-center text-white active:scale-95 transition-transform -ml-2">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-white truncate">{building?.name || 'Building'}</div>
            <div className="text-xs text-white/50">
              {visibleRepairs.length} repair{visibleRepairs.length !== 1 ? 's' : ''}
            </div>
          </div>
          <Link
            href={`/repairs/${params.buildingId}/report`}
            className="text-white/60 text-sm px-3 py-1.5 rounded-lg bg-white/10 active:bg-white/20 active:scale-95 transition-all shrink-0"
          >
            Report
          </Link>
        </div>

        <div className="flex-1 px-4 py-4 pb-24">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !building ? (
            <div className="text-center py-12 text-navy/40">Building not found</div>
          ) : (
            <>
              {/* Drop Plan Images */}
              {(() => {
                const planUrls = building.drop_plan_urls?.length ? building.drop_plan_urls : (building.drop_plan_url ? [building.drop_plan_url] : [])
                if (planUrls.length === 0) return null
                return (
                  <div className="mb-4 -mx-4 px-4 overflow-x-auto">
                    <div className="flex gap-2" style={{ minWidth: 'min-content' }}>
                      {planUrls.map((url, idx) => (
                        <img
                          key={`${idx}-${refreshKey}`}
                          src={bustCache(url)}
                          alt={`Drop plan ${idx + 1}`}
                          className="h-[140px] w-auto rounded-xl border border-navy/10 object-cover cursor-pointer active:scale-95 transition-all flex-shrink-0"
                          onClick={() => setLightboxUrl(bustCache(url))}
                        />
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Summary Stats */}
              {(() => {
                const total = visibleRepairs.length
                const inProgress = visibleRepairs.filter(r => r.status === 'in_progress' && r.repair_steps?.length > 0).length
                const inspected = visibleRepairs.filter(r => r.status === 'in_progress' && (!r.repair_steps || r.repair_steps.length === 0)).length
                const completed = visibleRepairs.filter(r => r.status === 'completed').length
                return (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                      <div className="text-lg font-bold text-navy">{total}</div>
                      <div className="text-[10px] text-navy/50 uppercase font-semibold tracking-wide">Total</div>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                      <div className="text-lg font-bold text-orange">{inspected + inProgress}</div>
                      <div className="text-[10px] text-navy/50 uppercase font-semibold tracking-wide">Active</div>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                      <div className="text-lg font-bold text-green-600">{completed}</div>
                      <div className="text-[10px] text-navy/50 uppercase font-semibold tracking-wide">Completed</div>
                    </div>
                  </div>
                )
              })()}

              {/* Drop Grid */}
              <div className="mb-5">
                <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2 px-1">Drops</div>
                <div className="grid grid-cols-5 gap-2">
                  {dropLabels.map(label => {
                    const count = allRepairsByDrop[label]?.length || 0
                    return (
                      <Link
                        key={label}
                        href={`/repairs/${params.buildingId}/drop/${encodeURIComponent(label)}`}
                      >
                        <div
                          className={`relative rounded-xl p-3 text-center font-semibold text-sm min-h-[48px] flex items-center justify-center active:scale-95 transition-all duration-150 ${getDropColor(label)}`}
                        >
                          {label}
                          {count > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-navy text-white text-[10px] font-bold flex items-center justify-center">
                              {count}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* Filter Bar */}
              {visibleRepairs.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white shadow-sm text-sm font-semibold text-navy active:scale-95 transition-all min-h-[48px] w-full"
                  >
                    <svg className="w-4 h-4 text-navy/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="ml-auto bg-orange text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>
                    )}
                    <svg className={`w-4 h-4 text-navy/40 transition-transform ${showFilters ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </button>

                  {showFilters && (
                    <div className="mt-2 bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      {/* Search */}
                      <input
                        type="text"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                        placeholder="Search repairs..."
                      />

                      {/* Status */}
                      <div>
                        <label className="block text-xs font-medium text-navy/60 mb-1.5">Status</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['all', 'inspected', 'in_progress', 'completed'].map(s => (
                            <button
                              key={s}
                              onClick={() => setFilterStatus(s)}
                              className={`rounded-xl text-xs font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                                filterStatus === s ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                              }`}
                            >
                              {s === 'all' ? 'All' : s === 'inspected' ? 'Inspected' : s === 'in_progress' ? 'In Progress' : 'Completed'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Drop Label */}
                      <div>
                        <label className="block text-xs font-medium text-navy/60 mb-1.5">Drop</label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setFilterDropLabel('')}
                            className={`rounded-xl text-xs font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                              !filterDropLabel ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                            }`}
                          >All</button>
                          {dropLabels.map(label => (
                            <button
                              key={label}
                              onClick={() => setFilterDropLabel(filterDropLabel === label ? '' : label)}
                              className={`rounded-xl text-xs font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                                filterDropLabel === label ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                              }`}
                            >{label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Defect Type */}
                      <div>
                        <label className="block text-xs font-medium text-navy/60 mb-1.5">Defect Type</label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setFilterDefectType('')}
                            className={`rounded-xl text-xs font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                              !filterDefectType ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                            }`}
                          >All</button>
                          {DEFECT_CATEGORIES.filter(c => c !== 'Other').map(cat => (
                            <button
                              key={cat}
                              onClick={() => setFilterDefectType(filterDefectType === cat ? '' : cat)}
                              className={`rounded-xl text-xs font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                                filterDefectType === cat ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                              }`}
                            >{cat}</button>
                          ))}
                        </div>
                      </div>

                      {/* Urgency */}
                      <div>
                        <label className="block text-xs font-medium text-navy/60 mb-1.5">Urgency</label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setFilterUrgency('')}
                            className={`rounded-xl text-xs font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                              !filterUrgency ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                            }`}
                          >All</button>
                          {URGENCY_OPTIONS.map(u => (
                            <button
                              key={u}
                              onClick={() => setFilterUrgency(filterUrgency === u ? '' : u)}
                              className={`rounded-xl text-xs font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                                filterUrgency === u ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                              }`}
                            >{u}</button>
                          ))}
                        </div>
                      </div>

                      {activeFilterCount > 0 && (
                        <button
                          onClick={() => { setFilterStatus('all'); setFilterDefectType(''); setFilterUrgency(''); setFilterDropLabel(''); setSearchText('') }}
                          className="text-xs text-orange font-semibold py-2 active:scale-95 transition-all"
                        >Clear All Filters</button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Repairs list grouped by drop */}
              {dropLabels.filter(l => repairsByDrop[l]?.length).length === 0 ? (
                <div className="text-center py-8 text-navy/40">
                  {activeFilterCount > 0 ? 'No repairs match your filters' : 'No repairs yet'}
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {dropLabels.filter(l => repairsByDrop[l]?.length).map(label => (
                    <div key={label}>
                      <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2 px-1">Drop {label}</div>
                      <div className="flex flex-col gap-2">
                        {repairsByDrop[label].map(repair => {
                          const photoUrl = repair.initial_photo_urls?.[0] || repair.initial_photo_url
                          return (
                            <Link key={repair.id} href={`/repairs/${params.buildingId}/${repair.id}`}>
                              <div className={`bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-all duration-150 flex items-center gap-3 ${repair.status === 'completed' ? 'opacity-70' : ''}`}>
                                {photoUrl && (
                                  <img src={photoUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 cursor-pointer" onClick={(e) => { e.preventDefault(); setLightboxUrl(photoUrl) }} />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <div className="font-semibold text-navy text-sm">
                                      {repair.repair_number || `${repair.drop_label}.${repair.floor_number}`} <span className="font-normal text-gray-400">· Floor {repair.floor_number}</span>
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      repair.status === 'completed'
                                        ? 'bg-green-100 text-green-700'
                                        : repair.repair_steps?.length > 0
                                          ? 'bg-orange/10 text-orange'
                                          : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {repair.status === 'completed' ? 'Completed' : repair.repair_steps?.length > 0 ? 'In Progress' : 'Inspected'}
                                    </span>
                                  </div>
                                  <div className="text-xs text-navy/50 truncate">
                                    {repair.defect_type}{repair.sub_type ? ` — ${repair.sub_type}` : ''}
                                  </div>
                                  {(repair.urgency || repair.assigned_contractor || (repair.accumulated_seconds != null && repair.accumulated_seconds > 0)) && (
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                      {repair.urgency && URGENCY_BADGE[repair.urgency] && (
                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${URGENCY_BADGE[repair.urgency]}`}>{repair.urgency}</span>
                                      )}
                                      {repair.assigned_contractor && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{repair.assigned_contractor}</span>
                                      )}
                                      {repair.accumulated_seconds != null && repair.accumulated_seconds > 0 && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-navy/5 text-navy/50">{formatDuration(repair.accumulated_seconds)}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>


        {lightboxUrl && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="Drop plan" className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>
    </div>
  )
}
