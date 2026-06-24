'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '../../../../../../lib/supabase'
import { getStoredExternalUser, isVideoUrl } from '../../../../../../lib/helpers'
import type { ExternalUser, RepairBuilding, Repair, RepairStep } from '../../../../../../lib/types'

type RepairWithSteps = Repair & { repair_steps: RepairStep[] } & { urgency?: string; assigned_contractor?: string }

const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Urgent: { label: 'Urgent', color: 'text-red-700', bg: 'bg-red-100' },
  Later: { label: 'Later', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  Monitor: { label: 'Monitor', color: 'text-blue-700', bg: 'bg-blue-100' },
  Leave: { label: 'Leave', color: 'text-gray-600', bg: 'bg-gray-100' },
}

export default function ExternalDropPage() {
  const params = useParams<{ buildingId: string; dropLabel: string }>()
  const dropLabel = decodeURIComponent(params.dropLabel)
  const [extUser, setExtUser] = useState<ExternalUser | null>(null)
  const [building, setBuilding] = useState<RepairBuilding | null>(null)
  const [repairs, setRepairs] = useState<RepairWithSteps[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  useEffect(() => {
    const stored = getStoredExternalUser()
    if (!stored) { window.location.href = '/login'; return }
    setExtUser(stored)
    loadData()
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
        .select('*, repair_steps(*)')
        .eq('building_id', params.buildingId)
        .eq('drop_label', dropLabel)
        .order('created_at', { ascending: false }),
    ])

    if (bld) setBuilding(bld as RepairBuilding)
    if (reps) {
      const visible = (reps as RepairWithSteps[]).filter(r => !r.defect_type?.startsWith('__'))
      visible.forEach(r => {
        r.repair_steps = (r.repair_steps || []).sort((a, b) => a.step_number - b.step_number)
      })
      setRepairs(visible)
    }
    setLoading(false)
  }

  async function setUrgency(repairId: string, urgency: string) {
    await getSupabase().from('repairs').update({ urgency }).eq('id', repairId)
    setRepairs(prev => prev.map(r => r.id === repairId ? { ...r, urgency } : r))
  }

  async function setContractor(repairId: string, contractor: string) {
    await getSupabase().from('repairs').update({ assigned_contractor: contractor }).eq('id', repairId)
    setRepairs(prev => prev.map(r => r.id === repairId ? { ...r, assigned_contractor: contractor } : r))
  }

  if (!extUser) return null

  const canAllocate = extUser.can_allocate || extUser.role === 'allocate' || extUser.role === 'full'
  const isDetailed = extUser.view_level === 'detailed'

  function MediaItem({ url, alt, className }: { url: string; alt: string; className?: string }) {
    if (isVideoUrl(url)) {
      return (
        <video
          src={url}
          controls
          playsInline
          className={className || 'w-20 h-20 rounded-lg object-cover'}
        />
      )
    }
    return (
      <img
        src={url}
        alt={alt}
        className={className || 'w-20 h-20 rounded-lg object-cover cursor-pointer'}
        onClick={() => setLightboxUrl(url)}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href={`/external/building/${params.buildingId}`} className="min-w-[48px] min-h-[48px] flex items-center justify-center text-white active:scale-95 transition-transform -ml-2">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-white truncate">Drop {dropLabel} — {building?.name || 'Loading...'}</div>
            <div className="text-xs text-white/50">{repairs.length} repair{repairs.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4">
          {!loading && building && (
            <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
              <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1">Drop Reference</div>
              <div className="text-sm text-navy/70 leading-relaxed">
                This view shows repairs assigned to Drop {dropLabel}, so your team and ours can refer to the same building location.
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : repairs.length === 0 ? (
            <div className="text-center py-8 text-navy/40">No repairs in this drop</div>
          ) : (
            <div className="flex flex-col gap-3">
              {repairs.map(repair => (
                <div key={repair.id} className="bg-white rounded-xl p-4 shadow-sm">
                  {/* Repair header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-navy text-sm">
                        {repair.repair_number || `${repair.drop_label}.${repair.floor_number}`}
                        <span className="font-normal text-gray-400"> · Floor {repair.floor_number}</span>
                      </div>
                      <div className="text-xs text-navy/50">
                        {repair.defect_type}{repair.sub_type ? ` — ${repair.sub_type}` : ''}
                        {repair.location ? ` · ${repair.location}` : ''}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      repair.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange/10 text-orange'
                    }`}>
                      {repair.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                  </div>

                  {/* Urgency & Contractor badges */}
                  <div className="flex gap-1.5 mb-2 flex-wrap">
                    {repair.urgency && URGENCY_CONFIG[repair.urgency] && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${URGENCY_CONFIG[repair.urgency].bg} ${URGENCY_CONFIG[repair.urgency].color}`}>
                        {repair.urgency}
                      </span>
                    )}
                    {repair.assigned_contractor && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {repair.assigned_contractor}
                      </span>
                    )}
                  </div>

                  {/* Photos: before/after for summary, all steps for detailed */}
                  <div className="flex gap-2 flex-wrap mb-2">
                    {repair.initial_photo_url && (
                      <div className="shrink-0">
                        <div className="text-[10px] text-navy/40 mb-0.5">Before</div>
                        <MediaItem url={repair.initial_photo_url} alt="Before" />
                      </div>
                    )}
                    {repair.completion_photo_url && (
                      <div className="shrink-0">
                        <div className="text-[10px] text-navy/40 mb-0.5">After</div>
                        <MediaItem url={repair.completion_photo_url} alt="After" />
                      </div>
                    )}
                  </div>

                  {/* Detailed: show all steps */}
                  {isDetailed && repair.repair_steps.length > 0 && (
                    <div className="border-t border-navy/5 pt-2 mt-2">
                      <div className="text-[10px] font-semibold text-navy/40 uppercase mb-1">Steps</div>
                      <div className="flex flex-col gap-1.5">
                        {repair.repair_steps.map(s => (
                          <div key={s.id} className="flex items-center gap-2">
                            {s.photo_url && (
                              <MediaItem url={s.photo_url} alt={`Step ${s.step_number}`} className="w-12 h-12 rounded-lg object-cover" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-navy">
                                {s.step_name}
                                {s.created_by && <span className="font-normal text-navy/40"> — {s.created_by}</span>}
                              </div>
                              {s.comments && <div className="text-xs text-navy/50 truncate">{s.comments}</div>}
                              <div className="text-[10px] text-navy/30">
                                {new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Allocate controls */}
                  {canAllocate && (
                    <div className="border-t border-navy/5 pt-3 mt-2">
                      {/* Urgency buttons */}
                      <div className="mb-2">
                        <div className="text-[10px] font-medium text-navy/40 mb-1">Urgency</div>
                        <div className="flex gap-1">
                          {(['Urgent', 'Later', 'Monitor', 'Leave'] as const).map(u => {
                            const isActive = repair.urgency === u
                            const colors: Record<string, string> = {
                              Urgent: isActive ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 border border-red-200',
                              Later: isActive ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 border border-yellow-200',
                              Monitor: isActive ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600 border border-blue-200',
                              Leave: isActive ? 'bg-gray-500 text-white' : 'bg-gray-50 text-gray-600 border border-gray-200',
                            }
                            return (
                              <button
                                key={u}
                                onClick={() => setUrgency(repair.id, u)}
                                className={`flex-1 rounded-lg text-xs font-semibold py-1.5 transition-all active:scale-95 ${colors[u]}`}
                              >
                                {u}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Contractor input */}
                      <div>
                        <div className="text-[10px] font-medium text-navy/40 mb-1">Contractor</div>
                        <input
                          type="text"
                          defaultValue={repair.assigned_contractor || ''}
                          onBlur={e => {
                            const val = e.target.value.trim()
                            if (val !== (repair.assigned_contractor || '')) {
                              setContractor(repair.id, val)
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-navy/10 bg-light-gray text-navy text-xs min-h-[36px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                          placeholder="Assign contractor..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-white/70 hover:text-white z-10">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <img src={lightboxUrl} alt="Full size" className="max-w-full max-h-full object-contain p-4" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
