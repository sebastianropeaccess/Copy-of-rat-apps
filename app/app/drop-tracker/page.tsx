'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { Service, RatUser, DropEntry } from '@/lib/types'

const SERVICE_TYPES = [
  'Pressure Cleaning',
  'Window Cleaning',
  'Facade Inspection',
  'Facade Repairs',
  'Concrete Repairs',
  'Joint Sealing',
  'Painting',
  'Water Testing',
  'Other',
]

const FREQUENCIES = [
  'Monthly',
  'Bi-Monthly',
  'Quarterly',
  '4-Monthly',
  'Bi-Annual',
  'Annual',
  'Every 2 Years',
  'Every 3 Years',
  'One-off',
  'Ad-hoc',
]

export default function DropTrackerPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [dropCounts, setDropCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // New job form state
  const [building, setBuilding] = useState('')
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0])
  const [projectStartDate, setProjectStartDate] = useState(new Date().toISOString().split('T')[0])
  const [dropCount, setDropCount] = useState('')
  const [dropLabelling, setDropLabelling] = useState<'numeric' | 'alpha'>('numeric')
  const [saving, setSaving] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [editName, setEditName] = useState('')
  const [editServiceType, setEditServiceType] = useState(SERVICE_TYPES[0])
  const [editStartDate, setEditStartDate] = useState('')
  const [editDropCount, setEditDropCount] = useState('')
  const [editDropLabelling, setEditDropLabelling] = useState<'numeric' | 'alpha'>('numeric')

  const loadData = useCallback(async () => {
    const { data: svcs } = await getSupabase()
      .from('services')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    const serviceList = svcs || []
    setServices(serviceList)

    // Load completed drop counts
    if (serviceList.length > 0) {
      const ids = serviceList.map((s) => s.id)
      const { data: entries } = await getSupabase()
        .from('drop_entries')
        .select('service_id')
        .in('service_id', ids)
        .not('completed_at', 'is', null)

      const counts: Record<string, number> = {}
      for (const entry of entries || []) {
        counts[entry.service_id] = (counts[entry.service_id] || 0) + 1
      }
      setDropCounts(counts)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)
    loadData()
  }, [loadData])

  const namePreview = building || ''

  async function handleCreateJob() {
    if (!building.trim() || !dropCount || Number(dropCount) < 1) return
    setSaving(true)

    const jobName = building.trim()

    // Create building
    const { data: bld } = await getSupabase()
      .from('buildings')
      .insert({ name: building.trim() })
      .select('id')
      .single()

    if (!bld) {
      setSaving(false)
      return
    }

    // Create project
    const { data: proj } = await getSupabase()
      .from('projects')
      .insert({ building_id: bld.id, name: jobName, status: 'active' })
      .select('id')
      .single()

    if (!proj) {
      setSaving(false)
      return
    }

    // Create service
    await getSupabase().from('services').insert({
      project_id: proj.id,
      name: jobName,
      status: 'active',
      drop_count: Number(dropCount),
      drop_labelling: dropLabelling,
      service_type: serviceType,
      has_drops: true,
      created_by: user?.name || null,
    })

    // Reset form
    setBuilding('')
    setServiceType(SERVICE_TYPES[0])
    setProjectStartDate(new Date().toISOString().split('T')[0])
    setDropCount('')
    setDropLabelling('numeric')
    setShowModal(false)
    setSaving(false)
    loadData()
  }

  async function handleDeleteJob(svc: Service) {
    if (!confirm(`Delete "${svc.name}"? This will delete all drops and data for this job.`)) return
    await getSupabase().from('services').delete().eq('id', svc.id)
    setEditingService(null)
    loadData()
  }

  function startEditJob(svc: Service) {
    setEditingService(svc)
    setEditName(svc.name)
    setEditServiceType(svc.service_type || SERVICE_TYPES[0])
    setEditDropCount(String(svc.drop_count || ''))
    setEditDropLabelling((svc as unknown as Record<string, unknown>).drop_labelling as 'numeric' | 'alpha' || 'numeric')
    setEditStartDate('')
  }

  async function handleSaveEditJob(svc: Service) {
    if (!editName.trim()) return
    const jobName = editName.trim()
    await getSupabase().from('services').update({
      name: jobName,
      service_type: editServiceType,
      drop_count: Number(editDropCount) || svc.drop_count,
      drop_labelling: editDropLabelling,
    }).eq('id', svc.id)
    setEditingService(null)
    loadData()
  }

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <div className="text-lg font-bold text-white">Drop Tracker</div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-orange text-white text-sm font-semibold px-4 py-2 rounded-lg
              active:scale-95 active:bg-orange-light transition-all duration-150"
          >
            + New Job
          </button>
        </div>

        {/* Jobs list */}
        <div className="flex-1 px-4 py-4">
          {services.length === 0 ? (
            <div className="text-center text-navy/40 py-20">
              <div className="text-lg mb-2">No active jobs</div>
              <div className="text-sm">Tap &quot;+ New Job&quot; to create one</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {services.map((svc) => {
                const completed = dropCounts[svc.id] || 0
                const total = svc.drop_count
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0

                return editingService?.id === svc.id ? (
                  <div key={svc.id} className="bg-white rounded-xl p-4 shadow-sm border-2 border-orange/30">
                    <div className="text-sm font-bold text-navy mb-3">Edit Job</div>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-xs font-medium text-navy/60 mb-1 block">Building Name</label>
                        <input value={editName} onChange={e => setEditName(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-orange" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-navy/60 mb-1 block">Service Type</label>
                        <select value={editServiceType} onChange={e => setEditServiceType(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm bg-white focus:outline-none focus:border-orange">
                          {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-navy/60 mb-1 block">Project Start Date</label>
                        <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-orange" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-navy/60 mb-1 block">Number of Drops</label>
                        <input type="number" inputMode="numeric" value={editDropCount} onChange={e => setEditDropCount(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-orange" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-navy/60 mb-1 block">Drop Labelling</label>
                        <div className="flex gap-2">
                          <button onClick={() => setEditDropLabelling('numeric')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${editDropLabelling === 'numeric' ? 'bg-navy text-white' : 'bg-gray-100 text-navy/50'}`}>1, 2, 3...</button>
                          <button onClick={() => setEditDropLabelling('alpha')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${editDropLabelling === 'alpha' ? 'bg-navy text-white' : 'bg-gray-100 text-navy/50'}`}>A, B, C...</button>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => handleSaveEditJob(svc)} className="flex-1 bg-orange text-white text-sm font-semibold py-3 rounded-xl active:scale-95 transition-all">Save</button>
                        <button onClick={() => setEditingService(null)} className="flex-1 bg-gray-100 text-navy/60 text-sm font-semibold py-3 rounded-xl">Cancel</button>
                      </div>
                      <button onClick={() => handleDeleteJob(svc)} className="w-full text-red-500 text-sm font-medium py-2 mt-1">🗑️ Delete Job</button>
                    </div>
                  </div>
                ) : (
                  <div key={svc.id} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Link href={`/drop-tracker/${svc.id}`} className="flex-1">
                        <div className="active:scale-[0.98] transition-all duration-150">
                          <div className="flex items-start justify-between">
                            <div className="font-semibold text-navy text-sm leading-tight flex-1 mr-2">
                              {svc.name}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-navy">{completed}/{total}</span>
                              <span className="text-[10px] bg-navy/10 text-navy/60 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {svc.service_type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                      <button onClick={() => startEditJob(svc)}
                        className="shrink-0 p-2 text-navy/30 hover:text-navy active:scale-95 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Job Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="w-full max-w-[480px] bg-white rounded-t-2xl p-5 pb-8 animate-slideUp">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-navy">New Job</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-navy/40 p-1"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Building name */}
              <div>
                <label className="text-xs font-medium text-navy/60 mb-1 block">Building Name</label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="e.g. Panorama Towers"
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-orange"
                />
              </div>

              {/* Service type */}
              <div>
                <label className="text-xs font-medium text-navy/60 mb-1 block">Service Type</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm bg-white focus:outline-none focus:border-orange"
                >
                  {SERVICE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Project Start Date */}
              <div>
                <label className="text-xs font-medium text-navy/60 mb-1 block">Project Start Date</label>
                <input
                  type="date"
                  value={projectStartDate}
                  onChange={(e) => setProjectStartDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm bg-white focus:outline-none focus:border-orange"
                />
              </div>

              {/* Drop count */}
              <div>
                <label className="text-xs font-medium text-navy/60 mb-1 block">Number of Drops</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={dropCount}
                  onChange={(e) => setDropCount(e.target.value)}
                  placeholder="e.g. 24"
                  min="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-orange"
                />
              </div>

              {/* Drop labelling toggle */}
              <div>
                <label className="text-xs font-medium text-navy/60 mb-1 block">Drop Labelling</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDropLabelling('numeric')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                      ${dropLabelling === 'numeric'
                        ? 'bg-navy text-white'
                        : 'bg-gray-100 text-navy/50'
                      }`}
                  >
                    1, 2, 3...
                  </button>
                  <button
                    onClick={() => setDropLabelling('alpha')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                      ${dropLabelling === 'alpha'
                        ? 'bg-navy text-white'
                        : 'bg-gray-100 text-navy/50'
                      }`}
                  >
                    A, B, C...
                  </button>
                </div>
              </div>

              {/* Name preview */}
              {namePreview && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-[10px] text-navy/40 uppercase tracking-wider mb-0.5">Job Name</div>
                  <div className="text-sm font-medium text-navy">{namePreview}</div>
                </div>
              )}

              {/* Save button */}
              <button
                onClick={handleCreateJob}
                disabled={saving || !building.trim() || !dropCount || Number(dropCount) < 1}
                className="w-full bg-orange text-white font-semibold py-3.5 rounded-xl mt-1
                  active:scale-95 transition-all duration-150
                  disabled:opacity-40 disabled:active:scale-100"
              >
                {saving ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </div>
                ) : (
                  'Create Job'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
