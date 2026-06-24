'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '../../../../lib/supabase'
import { getStoredUser, getAllocationQueue, clearAllocationQueue } from '../../../../lib/helpers'
import type { RatUser, Asset } from '../../../../lib/types'

type Member = { id: string; name: string }
type Vehicle = { id: string; name: string; rego: string | null }

function CompletionDot({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  return <span className="w-6 h-6 rounded-full border-2 border-navy/15 shrink-0" />
}

export default function AssignDetailsPage() {
  const router = useRouter()
  const [user, setUser] = useState<RatUser | null>(null)
  const [queue, setQueue] = useState<Asset[]>([])

  const [members, setMembers] = useState<Member[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [jobs, setJobs] = useState<string[]>([])

  // Selections
  const [personId, setPersonId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [job, setJob] = useState('')
  const [returnDate, setReturnDate] = useState('')

  // Inline add-new
  const [showAddCar, setShowAddCar] = useState(false)
  const [newCarName, setNewCarName] = useState('')
  const [newCarRego, setNewCarRego] = useState('')
  const [showAddJob, setShowAddJob] = useState(false)
  const [newJob, setNewJob] = useState('')

  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ assigned: number; skipped: number } | null>(null)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    const q = getAllocationQueue()
    setQueue(q)
    if (q.length === 0) { router.replace('/assets/allocation'); return }
    loadPickers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPickers() {
    const [{ data: m }, { data: v }, { data: j }] = await Promise.all([
      getSupabase().from('team_members').select('id, name').eq('active', true).order('name'),
      getSupabase().from('vehicles').select('id, name, rego').eq('active', true).order('name'),
      getSupabase().from('asset_assignments').select('job_id').not('job_id', 'is', null).limit(500),
    ])
    setMembers((m || []) as Member[])
    setVehicles((v || []) as Vehicle[])
    const distinct = Array.from(new Set(((j || []) as { job_id: string }[]).map(r => r.job_id).filter(Boolean)))
    setJobs(distinct.sort())
  }

  async function addCar() {
    const name = newCarName.trim()
    if (!name) return
    const { data, error } = await getSupabase()
      .from('vehicles')
      .insert({ name, rego: newCarRego.trim() || null, active: true })
      .select('id, name, rego')
      .single()
    if (error || !data) { alert('Failed to add car: ' + (error?.message || 'unknown')); return }
    setVehicles(prev => [...prev, data as Vehicle].sort((a, b) => a.name.localeCompare(b.name)))
    setVehicleId((data as Vehicle).id)
    setNewCarName(''); setNewCarRego(''); setShowAddCar(false)
  }

  function addJob() {
    const j = newJob.trim()
    if (!j) return
    setJobs(prev => Array.from(new Set([...prev, j])).sort())
    setJob(j)
    setNewJob(''); setShowAddJob(false)
  }

  async function handleConfirm() {
    if (confirming || !user) return
    const selectedMember = members.find(m => m.id === personId)
    if (!selectedMember || !job.trim() || !returnDate) return
    setConfirming(true)

    // Re-check availability at confirm time: skip anything currently checked out.
    const { data: openRows } = await getSupabase()
      .from('asset_assignments')
      .select('asset_id')
      .in('asset_id', queue.map(a => a.id))
      .is('checked_in_at', null)
    const unavailable = new Set(((openRows || []) as { asset_id: string }[]).map(r => r.asset_id))
    const toAssign = queue.filter(a => !unavailable.has(a.id))

    const now = new Date().toISOString()
    const vehicle = vehicles.find(v => v.id === vehicleId)
    const carNote = vehicle ? `Car: ${vehicle.name}${vehicle.rego ? ` (${vehicle.rego})` : ''}` : null

    const results = await Promise.all(
      toAssign.map(async asset => {
        const [assignRes, updateRes] = await Promise.all([
          getSupabase().from('asset_assignments').insert({
            asset_id: asset.id,
            assigned_to_type: 'person',
            assigned_to_id: selectedMember.id,
            assigned_to_name: selectedMember.name,
            job_id: job.trim(),
            checked_out_at: now,
            expected_return_date: returnDate,
            processed_by: user.name,
            notes: carNote,
          }),
          getSupabase().from('assets').update({
            status: 'on_job',
            current_assignee_name: selectedMember.name,
          }).eq('id', asset.id),
        ])
        return assignRes.error || updateRes.error ? asset.id : null
      })
    )

    const failed = results.filter(Boolean).length
    const assigned = toAssign.length - failed
    setConfirming(false)
    setResult({ assigned, skipped: queue.length - toAssign.length + failed })
    if (assigned > 0) clearAllocationQueue()
  }

  if (!user) return null

  const selectedMember = members.find(m => m.id === personId)
  const selectedVehicle = vehicles.find(v => v.id === vehicleId)
  const personDone = !!selectedMember
  const jobDone = !!job.trim()
  const dateDone = !!returnDate
  const canConfirm = personDone && jobDone && dateDone

  const filteredMembers = memberSearch
    ? members.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
    : members

  // Success screen
  if (result) {
    return (
      <div className="flex flex-col min-h-screen bg-light-gray items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-[340px] w-full text-center">
          <div className="text-5xl mb-3">✅</div>
          <div className="text-xl font-bold text-navy mb-1">
            {result.assigned} asset{result.assigned !== 1 ? 's' : ''} assigned
          </div>
          <div className="text-sm text-navy/50 mb-1">to {selectedMember?.name}</div>
          <div className="text-xs text-navy/40 mb-6">
            Job {job} · due back {new Date(returnDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          {result.skipped > 0 && (
            <div className="text-xs text-orange font-medium mb-4">
              {result.skipped} item{result.skipped !== 1 ? 's' : ''} skipped (unavailable or failed)
            </div>
          )}
          <div className="flex flex-col gap-3">
            <Link href="/assets/allocation">
              <div className="w-full bg-orange text-white text-center font-semibold py-3 rounded-xl active:scale-95 transition-all min-h-[48px] flex items-center justify-center text-sm">
                New Allocation
              </div>
            </Link>
            <Link href="/assets">
              <div className="w-full bg-light-gray text-navy text-center font-medium py-3 rounded-xl border border-navy/10 active:scale-95 transition-all min-h-[48px] flex items-center justify-center text-sm">
                Back to Asset Management
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
          <Link href="/assets/allocation" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">Assignment Details</div>
            <div className="text-xs text-white/50">{queue.length} item{queue.length !== 1 ? 's' : ''} to assign</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 pb-28 flex flex-col gap-4">
          {/* Person (required) */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-navy">Person <span className="text-red-400">*</span></div>
              <CompletionDot done={personDone} />
            </div>
            <input
              type="text"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="Search name..."
              className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40 mb-2"
            />
            <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto">
              {filteredMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setPersonId(m.id); setMemberSearch(m.name) }}
                  className={`px-4 py-3 rounded-xl text-sm text-left transition-all min-h-[44px] ${
                    personId === m.id ? 'bg-navy text-white font-semibold' : 'bg-light-gray text-navy active:scale-[0.98]'
                  }`}
                >{m.name}</button>
              ))}
            </div>
            <div className="text-[11px] text-navy/40 mt-2">
              Need a new team member? Add them in the Team app (requires a PIN).
            </div>
          </div>

          {/* Car (optional) */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-navy">Car <span className="text-navy/40 font-normal">(optional)</span></div>
              <CompletionDot done={!!selectedVehicle} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setVehicleId('')}
                className={`px-3 py-2 rounded-xl text-sm font-medium min-h-[40px] transition-all ${
                  !vehicleId ? 'bg-navy text-white' : 'bg-light-gray text-navy active:scale-95'
                }`}
              >None</button>
              {vehicles.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVehicleId(v.id)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium min-h-[40px] transition-all ${
                    vehicleId === v.id ? 'bg-navy text-white' : 'bg-light-gray text-navy active:scale-95'
                  }`}
                >{v.name}{v.rego ? ` · ${v.rego}` : ''}</button>
              ))}
              <button
                onClick={() => setShowAddCar(true)}
                className="px-3 py-2 rounded-xl text-sm font-medium min-h-[40px] border border-dashed border-orange/50 text-orange active:scale-95 transition-all"
              >+ Add new car</button>
            </div>
            {showAddCar && (
              <div className="mt-3 flex flex-col gap-2 p-3 bg-light-gray rounded-xl">
                <input
                  type="text" value={newCarName} onChange={e => setNewCarName(e.target.value)}
                  placeholder="Car name (e.g. Van 3)"
                  className="w-full px-3 py-2.5 rounded-lg border border-navy/10 bg-white text-navy text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                />
                <input
                  type="text" value={newCarRego} onChange={e => setNewCarRego(e.target.value)}
                  placeholder="Rego (optional)"
                  className="w-full px-3 py-2.5 rounded-lg border border-navy/10 bg-white text-navy text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                />
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddCar(false); setNewCarName(''); setNewCarRego('') }}
                    className="flex-1 bg-white text-navy font-medium py-2.5 rounded-lg border border-navy/10 text-sm min-h-[44px]">Cancel</button>
                  <button onClick={addCar} disabled={!newCarName.trim()}
                    className="flex-1 bg-orange text-white font-semibold py-2.5 rounded-lg text-sm min-h-[44px] disabled:opacity-40">Add</button>
                </div>
              </div>
            )}
          </div>

          {/* Job (required) */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-navy">Job <span className="text-red-400">*</span></div>
              <CompletionDot done={jobDone} />
            </div>
            <div className="flex flex-wrap gap-2">
              {jobs.map(j => (
                <button
                  key={j}
                  onClick={() => setJob(j)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium min-h-[40px] transition-all ${
                    job === j ? 'bg-navy text-white' : 'bg-light-gray text-navy active:scale-95'
                  }`}
                >{j}</button>
              ))}
              <button
                onClick={() => setShowAddJob(true)}
                className="px-3 py-2 rounded-xl text-sm font-medium min-h-[40px] border border-dashed border-orange/50 text-orange active:scale-95 transition-all"
              >+ Add new job</button>
            </div>
            {showAddJob && (
              <div className="mt-3 flex flex-col gap-2 p-3 bg-light-gray rounded-xl">
                <input
                  type="text" value={newJob} onChange={e => setNewJob(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addJob() }}
                  placeholder="Job # or name (e.g. Job 12345)"
                  className="w-full px-3 py-2.5 rounded-lg border border-navy/10 bg-white text-navy text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                />
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddJob(false); setNewJob('') }}
                    className="flex-1 bg-white text-navy font-medium py-2.5 rounded-lg border border-navy/10 text-sm min-h-[44px]">Cancel</button>
                  <button onClick={addJob} disabled={!newJob.trim()}
                    className="flex-1 bg-orange text-white font-semibold py-2.5 rounded-lg text-sm min-h-[44px] disabled:opacity-40">Add</button>
                </div>
              </div>
            )}
            {job && <div className="mt-2 text-xs text-navy/50">Selected job: <span className="font-semibold text-navy">{job}</span></div>}
          </div>

          {/* Returning date (required) */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-navy">Returning Date <span className="text-red-400">*</span></div>
              <CompletionDot done={dateDone} />
            </div>
            <input
              type="date"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
            />
          </div>
        </div>

        {/* Confirm */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-gray/90 backdrop-blur-sm">
          <div className="max-w-[480px] mx-auto">
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || confirming}
              className="w-full bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100 text-sm"
            >
              {confirming ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Assigning…
                </span>
              ) : canConfirm
                ? `Confirm & Assign ${queue.length} item${queue.length !== 1 ? 's' : ''}`
                : 'Complete Person, Job and Returning Date'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
