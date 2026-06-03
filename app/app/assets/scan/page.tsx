'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser, Asset, AssignmentType } from '@/lib/types'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  available:  { label: 'Available',  bg: 'bg-green-100',  text: 'text-green-700' },
  assigned:   { label: 'Assigned',   bg: 'bg-blue-100',   text: 'text-blue-700' },
  on_job:     { label: 'On Job',     bg: 'bg-indigo-100', text: 'text-indigo-700' },
  in_service: { label: 'In Service', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  broken:     { label: 'Broken',     bg: 'bg-red-100',    text: 'text-red-700' },
  retired:    { label: 'Retired',    bg: 'bg-gray-100',   text: 'text-gray-500' },
  lost:       { label: 'Lost',       bg: 'bg-orange-100', text: 'text-orange-700' },
  quarantine: { label: 'Quarantine', bg: 'bg-purple-100', text: 'text-purple-700' },
}

const ASSIGN_TYPES: { value: AssignmentType; label: string; icon: string }[] = [
  { value: 'person',           label: 'Person',   icon: '👤' },
  { value: 'vehicle',          label: 'Vehicle',  icon: '🚚' },
  { value: 'storage_location', label: 'Location', icon: '📦' },
  { value: 'job',              label: 'Job',      icon: '🔧' },
]

type QueueItem = Asset & { error?: string }

export default function BatchScanPage() {
  const router = useRouter()
  const [user, setUser] = useState<RatUser | null>(null)
  const [assignType, setAssignType] = useState<AssignmentType>('person')
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [vehicles, setVehicles] = useState<{ id: string; name: string; rego: string | null }[]>([])

  // Assignee fields
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [locationName, setLocationName] = useState('')
  const [jobRef, setJobRef] = useState('')
  const [notes, setNotes] = useState('')

  // Asset queue
  const [assetSearch, setAssetSearch] = useState('')
  const [assetSearchResults, setAssetSearchResults] = useState<Asset[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [searching, setSearching] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [doneCount, setDoneCount] = useState<number | null>(null)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    loadPeople()
  }, [])

  async function loadPeople() {
    const [{ data: m }, { data: v }] = await Promise.all([
      getSupabase().from('team_members').select('id, name').eq('active', true).order('name'),
      getSupabase().from('vehicles').select('id, name, rego').eq('active', true).order('name'),
    ])
    setMembers(m || [])
    setVehicles(v || [])
  }

  async function searchAssets(q: string) {
    if (!q.trim()) { setAssetSearchResults([]); return }
    setSearching(true)
    const { data } = await getSupabase()
      .from('assets')
      .select('*')
      .or(`item_number.ilike.%${q}%,serial_number.ilike.%${q}%,asset_type.ilike.%${q}%`)
      .not('status', 'in', '("retired","lost")')
      .limit(8)
    setAssetSearchResults(data || [])
    setSearching(false)
  }

  function addToQueue(asset: Asset) {
    if (queue.find(a => a.id === asset.id)) return
    setQueue(prev => [...prev, asset])
    setAssetSearch('')
    setAssetSearchResults([])
  }

  function removeFromQueue(id: string) {
    setQueue(prev => prev.filter(a => a.id !== id))
  }

  function getAssigneeName(): string {
    if (assignType === 'person') {
      const m = members.find(m => m.id === selectedMemberId)
      return m?.name || ''
    }
    if (assignType === 'vehicle') {
      const v = vehicles.find(v => v.id === selectedVehicleId)
      return v ? `${v.name}${v.rego ? ` (${v.rego})` : ''}` : ''
    }
    if (assignType === 'storage_location') return locationName.trim()
    if (assignType === 'job') return jobRef.trim()
    return ''
  }

  function getAssigneeId(): string {
    if (assignType === 'person') return selectedMemberId
    if (assignType === 'vehicle') return selectedVehicleId
    if (assignType === 'storage_location') return locationName.trim()
    if (assignType === 'job') return jobRef.trim()
    return ''
  }

  async function handleAssign() {
    if (queue.length === 0 || assigning) return
    const assigneeName = getAssigneeName()
    const assigneeId = getAssigneeId()
    if (!assigneeName || !assigneeId) return

    setAssigning(true)
    const now = new Date().toISOString()

    const newStatus = assignType === 'job' ? 'on_job' : 'assigned'

    const results = await Promise.all(
      queue.map(async asset => {
        const [assignRes, updateRes] = await Promise.all([
          getSupabase().from('asset_assignments').insert({
            asset_id: asset.id,
            assigned_to_type: assignType,
            assigned_to_id: assigneeId,
            assigned_to_name: assigneeName,
            job_id: assignType === 'job' ? jobRef.trim() : null,
            checked_out_at: now,
            processed_by: user!.name,
            notes: notes.trim() || null,
          }),
          getSupabase().from('assets').update({
            status: newStatus,
            current_assignee_name: assigneeName,
          }).eq('id', asset.id),
        ])
        return assignRes.error || updateRes.error ? asset.id : null
      })
    )

    const failed = results.filter(Boolean).length
    const succeeded = queue.length - failed
    setDoneCount(succeeded)
    setAssigning(false)
    if (!failed) {
      setQueue([])
      setNotes('')
    }
  }

  if (!user) return null

  const assigneeName = getAssigneeName()
  const canAssign = queue.length > 0 && !!assigneeName

  const filteredMembers = memberSearch
    ? members.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
    : members

  const filteredVehicles = vehicleSearch
    ? vehicles.filter(v => v.name.toLowerCase().includes(vehicleSearch.toLowerCase()))
    : vehicles

  if (doneCount !== null) {
    return (
      <div className="flex flex-col min-h-screen bg-light-gray items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-[320px] w-full text-center">
          <div className="text-5xl mb-3">✅</div>
          <div className="text-xl font-bold text-navy mb-1">{doneCount} asset{doneCount !== 1 ? 's' : ''} assigned</div>
          <div className="text-sm text-navy/50 mb-6">to {assigneeName}</div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setDoneCount(null); setQueue([]) }}
              className="w-full bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all min-h-[48px] text-sm"
            >
              Assign More
            </button>
            <Link href="/assets">
              <div className="w-full bg-light-gray text-navy text-center font-medium py-3 rounded-xl border border-navy/10 active:scale-95 transition-all min-h-[48px] flex items-center justify-center text-sm">
                Back to Assets
              </div>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
          <Link href="/assets" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">Batch Assign</div>
            <div className="text-xs text-white/50">{user.name}</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 pb-32 flex flex-col gap-4">
          {/* Assignment type */}
          <div>
            <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Assign To</label>
            <div className="grid grid-cols-4 gap-2">
              {ASSIGN_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => { setAssignType(t.value); setSelectedMemberId(''); setSelectedVehicleId('') }}
                  className={`py-3 rounded-xl text-xs font-medium min-h-[56px] flex flex-col items-center justify-center gap-1 transition-all ${
                    assignType === t.value ? 'bg-navy text-white' : 'bg-white text-navy border border-navy/10 active:scale-95'
                  }`}
                >
                  <span className="text-lg">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee picker */}
          {assignType === 'person' && (
            <div>
              <label className="block text-xs font-medium text-navy/70 mb-1">Select Team Member</label>
              <input
                type="text"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Search name..."
                className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40 mb-2"
              />
              <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                {filteredMembers.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedMemberId(m.id); setMemberSearch(m.name) }}
                    className={`px-4 py-3 rounded-xl text-sm text-left transition-all min-h-[44px] ${
                      selectedMemberId === m.id ? 'bg-navy text-white font-semibold' : 'bg-white text-navy border border-navy/10 active:scale-[0.98]'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {assignType === 'vehicle' && (
            <div>
              <label className="block text-xs font-medium text-navy/70 mb-1">Select Vehicle</label>
              <input
                type="text"
                value={vehicleSearch}
                onChange={e => setVehicleSearch(e.target.value)}
                placeholder="Search vehicle..."
                className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40 mb-2"
              />
              <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                {filteredVehicles.map(v => (
                  <button
                    key={v.id}
                    onClick={() => { setSelectedVehicleId(v.id); setVehicleSearch(v.name) }}
                    className={`px-4 py-3 rounded-xl text-sm text-left transition-all min-h-[44px] ${
                      selectedVehicleId === v.id ? 'bg-navy text-white font-semibold' : 'bg-white text-navy border border-navy/10 active:scale-[0.98]'
                    }`}
                  >
                    {v.name}{v.rego ? ` — ${v.rego}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {assignType === 'storage_location' && (
            <div>
              <label className="block text-xs font-medium text-navy/70 mb-1">Location Name</label>
              <input
                type="text"
                value={locationName}
                onChange={e => setLocationName(e.target.value)}
                placeholder="e.g. Warehouse A, Site Office"
                className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
              />
            </div>
          )}

          {assignType === 'job' && (
            <div>
              <label className="block text-xs font-medium text-navy/70 mb-1">Job Reference</label>
              <input
                type="text"
                value={jobRef}
                onChange={e => setJobRef(e.target.value)}
                placeholder="e.g. Job #12345 or job name"
                className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-navy/70 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this assignment"
              className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
            />
          </div>

          {/* Asset search */}
          <div>
            <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Add Assets to Queue</label>
            <div className="relative">
              <input
                type="text"
                value={assetSearch}
                onChange={e => { setAssetSearch(e.target.value); searchAssets(e.target.value) }}
                placeholder="Search item #, type, or serial..."
                className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {assetSearchResults.length > 0 && (
              <div className="mt-2 flex flex-col gap-1 bg-white rounded-xl border border-navy/10 overflow-hidden">
                {assetSearchResults.map(a => {
                  const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG.available
                  const inQueue = !!queue.find(q => q.id === a.id)
                  return (
                    <button
                      key={a.id}
                      onClick={() => addToQueue(a)}
                      disabled={inQueue}
                      className={`px-4 py-3 text-sm text-left transition-all flex items-center justify-between min-h-[48px] ${
                        inQueue ? 'bg-navy/5 text-navy/30' : 'text-navy active:bg-orange/5'
                      }`}
                    >
                      <div>
                        <span className="font-medium">{a.item_number}</span>
                        <span className="text-navy/50"> · {a.asset_type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                          {sc.label}
                        </span>
                        {inQueue && <span className="text-[10px] text-navy/30">Added</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Queue */}
          {queue.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2">
                Queue ({queue.length} item{queue.length !== 1 ? 's' : ''})
              </div>
              <div className="flex flex-col gap-2">
                {queue.map(asset => {
                  const sc = STATUS_CONFIG[asset.status] || STATUS_CONFIG.available
                  return (
                    <div key={asset.id} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-navy text-sm">
                          {asset.item_number}
                          <span className="font-normal text-navy/50"> · {asset.asset_type}</span>
                        </div>
                        {(asset.manufacturer || asset.model) && (
                          <div className="text-xs text-navy/40 mt-0.5">
                            {[asset.manufacturer, asset.model].filter(Boolean).join(' ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} shrink-0`}>
                          {sc.label}
                        </span>
                        <button
                          onClick={() => removeFromQueue(asset.id)}
                          className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-400 rounded-full active:scale-95 transition-all shrink-0 text-lg leading-none"
                        >×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Assign button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-gray/90 backdrop-blur-sm">
          <div className="max-w-[480px] mx-auto">
            <button
              onClick={handleAssign}
              disabled={!canAssign || assigning}
              className="w-full bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100 text-sm"
            >
              {assigning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Assigning...
                </span>
              ) : canAssign ? (
                `Assign ${queue.length} item${queue.length !== 1 ? 's' : ''} → ${assigneeName}`
              ) : 'Select assignee and add assets'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
