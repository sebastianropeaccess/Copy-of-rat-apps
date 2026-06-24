'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../../lib/supabase'
import { getStoredUser } from '../../../lib/helpers'
import type { RatUser, GearItem, GearInspection, GearAssignment, TeamMember } from '../../../lib/types'

async function scanNFC(): Promise<string | null> {
  if (!('NDEFReader' in window)) return null
  try {
    const ndef = new (window as any).NDEFReader()
    await ndef.scan()
    return new Promise((resolve) => {
      ndef.addEventListener('reading', (event: any) => {
        resolve(event.serialNumber as string)
      })
    })
  } catch {
    return null
  }
}

export default function GearDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [user, setUser] = useState<RatUser | null>(null)
  const [item, setItem] = useState<GearItem | null>(null)
  const [inspections, setInspections] = useState<GearInspection[]>([])
  const [assignments, setAssignments] = useState<GearAssignment[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showInspect, setShowInspect] = useState(false)
  const [inspResult, setInspResult] = useState<'Pass' | 'Fail'>('Pass')
  const [inspNotes, setInspNotes] = useState('')
  const [inspPhoto, setInspPhoto] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showAssignPicker, setShowAssignPicker] = useState(false)
  const [nfcScanning, setNfcScanning] = useState(false)
  const [nfcSupported, setNfcSupported] = useState(false)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    setNfcSupported('NDEFReader' in window)
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadData() {
    const [gearRes, inspRes, assignRes, membersRes] = await Promise.all([
      getSupabase().from('gear_items').select('*').eq('id', id).single(),
      getSupabase().from('gear_inspections').select('*').eq('gear_item_id', id).order('inspected_at', { ascending: false }),
      getSupabase().from('gear_assignments').select('*').eq('gear_item_id', id).order('created_at', { ascending: false }),
      getSupabase().from('team_members').select('*').eq('active', true).order('name'),
    ])

    if (gearRes.data) setItem(gearRes.data)
    if (inspRes.data) setInspections(inspRes.data)
    if (assignRes.data) setAssignments(assignRes.data)
    if (membersRes.data) setTeamMembers(membersRes.data)
    setLoading(false)
  }

  async function handleInspection() {
    if (!user) return
    setSubmitting(true)

    let photoUrl: string | null = null
    if (inspPhoto) {
      const timestamp = Date.now()
      const path = `gear-inspections/${id}/${timestamp}.jpg`
      const { error: uploadError } = await getSupabase().storage
        .from('gear-inspections')
        .upload(path, inspPhoto, { contentType: inspPhoto.type })

      if (!uploadError) {
        const { data: urlData } = getSupabase().storage
          .from('gear-inspections')
          .getPublicUrl(path)
        photoUrl = urlData.publicUrl
      }
    }

    const { error } = await getSupabase()
      .from('gear_inspections')
      .insert({
        gear_item_id: id,
        inspected_by: user.name,
        result: inspResult,
        photo_url: photoUrl,
        notes: inspNotes.trim() || null,
      })

    if (!error) {
      setShowInspect(false)
      setInspResult('Pass')
      setInspNotes('')
      setInspPhoto(null)
      await loadData()
    }
    setSubmitting(false)
  }

  async function handleAssign(memberName: string) {
    if (!user) return
    setSubmitting(true)

    await getSupabase()
      .from('gear_items')
      .update({ assigned_to: memberName, assigned_at: new Date().toISOString() })
      .eq('id', id)

    await getSupabase()
      .from('gear_assignments')
      .insert({
        gear_item_id: id,
        assigned_to: memberName,
        assigned_by: user.name,
        action: 'assign',
      })

    setShowAssignPicker(false)
    await loadData()
    setSubmitting(false)
  }

  async function handleReturn() {
    if (!user || !item?.assigned_to) return
    setSubmitting(true)

    await getSupabase()
      .from('gear_items')
      .update({ assigned_to: null, assigned_at: null })
      .eq('id', id)

    await getSupabase()
      .from('gear_assignments')
      .insert({
        gear_item_id: id,
        assigned_to: item.assigned_to,
        assigned_by: user.name,
        action: 'return',
      })

    await loadData()
    setSubmitting(false)
  }

  async function handleLinkNfc() {
    setNfcScanning(true)
    const uid = await scanNFC()
    setNfcScanning(false)
    if (!uid) return

    await getSupabase()
      .from('gear_items')
      .update({ nfc_uid: uid })
      .eq('id', id)

    await loadData()
  }

  if (!user) return null

  const fields = item ? [
    { label: 'Serial / Gear ID', value: item.gear_id },
    { label: 'Type', value: item.gear_type },
    { label: 'Manufacturer', value: item.manufacturer },
    { label: 'Model', value: item.model },
    { label: 'Size', value: item.size },
    { label: 'Length', value: item.length },
    { label: 'Colour', value: item.colour },
    { label: 'Date of Manufacture', value: item.date_of_manufacture },
    { label: 'Date of Purchase', value: item.date_of_purchase },
    { label: 'Date of First Use', value: item.date_of_first_use },
    { label: 'Retirement Rule', value: item.retirement_rule },
    { label: 'Retirement Date', value: item.retirement_date },
    { label: 'Owner', value: item.team_member_name },
    { label: 'NFC Tag', value: item.nfc_uid },
  ] : []

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/gear" className="text-white/60 active:scale-95 transition-transform">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
            </Link>
            <div className="text-lg font-bold text-white">Gear Detail</div>
          </div>
          {!showInspect && (
            <button onClick={() => setShowInspect(true)}
              className="bg-orange text-white text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px]">
              Inspect
            </button>
          )}
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !item ? (
            <div className="text-center py-12 text-navy/40">Gear not found</div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Gear Details */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-3">
                  {fields.map(f => f.value ? (
                    <div key={f.label}>
                      <div className="text-xs text-navy/40 font-semibold mb-0.5">{f.label}</div>
                      <div className="text-sm text-navy">{f.value}</div>
                    </div>
                  ) : null)}
                </div>
              </div>

              {/* Assign / Return Section */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-xs text-navy/40 font-semibold mb-2">Assignment</div>
                {item.assigned_to ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm text-navy font-medium">Assigned to: {item.assigned_to}</span>
                    </div>
                    <button
                      onClick={handleReturn}
                      disabled={submitting}
                      className="bg-gray-100 text-navy/60 text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[48px]"
                    >
                      Return to Store
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-navy/40">Unassigned</span>
                    <button
                      onClick={() => setShowAssignPicker(true)}
                      className="bg-orange text-white text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px]"
                    >
                      Assign to...
                    </button>
                  </div>
                )}
              </div>

              {/* Link NFC Tag */}
              {!item.nfc_uid && nfcSupported && (
                <button
                  onClick={handleLinkNfc}
                  disabled={nfcScanning}
                  className="w-full bg-white rounded-xl p-4 shadow-sm text-sm font-semibold text-navy flex items-center justify-center gap-2 active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[48px]"
                >
                  {nfcScanning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                      Hold phone near tag...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" /><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" />
                        <path d="M12.91 4.1a16.1 16.1 0 0 1 0 15.8" /><path d="M16.37 2a20.43 20.43 0 0 1 0 20" />
                      </svg>
                      Link NFC Tag
                    </>
                  )}
                </button>
              )}

              {/* Inspection Form */}
              {showInspect && (
                <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-orange">
                  <div className="text-sm font-bold text-navy mb-3">New Inspection</div>

                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-navy/60 mb-1">Result</label>
                    <div className="flex gap-2">
                      {(['Pass', 'Fail'] as const).map(r => (
                        <button key={r} onClick={() => setInspResult(r)}
                          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95 min-h-[48px]
                            ${inspResult === r
                              ? r === 'Pass' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                              : 'bg-gray-100 text-navy/40'}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-navy/60 mb-1">Photo</label>
                    <input type="file" accept="image/*"
                      onChange={e => setInspPhoto(e.target.files?.[0] || null)}
                      className="w-full text-sm text-navy/60 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-orange/10 file:text-orange file:font-medium file:text-xs min-h-[48px]" />
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-navy/60 mb-1">Notes</label>
                    <textarea value={inspNotes} onChange={e => setInspNotes(e.target.value)}
                      placeholder="Inspection notes..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[80px] resize-none" />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setShowInspect(false)}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-navy/60 active:scale-95 transition-all duration-150 min-h-[48px]">
                      Cancel
                    </button>
                    <button onClick={handleInspection} disabled={submitting}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold bg-orange text-white active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[48px]">
                      {submitting ? 'Saving...' : 'Save Inspection'}
                    </button>
                  </div>
                </div>
              )}

              {/* Inspection History */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-xs text-navy/40 font-semibold mb-2">Inspection History ({inspections.length})</div>
                {inspections.length === 0 ? (
                  <div className="text-sm text-navy/30">No inspections yet</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {inspections.map(insp => (
                      <div key={insp.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            insp.result === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>{insp.result}</span>
                          <span className="text-xs text-navy/40">
                            {new Date(insp.inspected_at).toLocaleDateString('en-AU')}
                          </span>
                        </div>
                        <div className="text-xs text-navy/50">By {insp.inspected_by}</div>
                        {insp.notes && <div className="text-xs text-navy/40 mt-1">{insp.notes}</div>}
                        {insp.photo_url && (
                          <img src={insp.photo_url} alt="Inspection" className="mt-2 rounded-lg w-full max-h-48 object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignment History */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-xs text-navy/40 font-semibold mb-2">Assignment History ({assignments.length})</div>
                {assignments.length === 0 ? (
                  <div className="text-sm text-navy/30">No assignment history</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {assignments.map(a => (
                      <div key={a.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            a.action === 'assign' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {a.action === 'assign' ? 'Assigned' : 'Returned'}
                          </span>
                          <div className="text-xs text-navy/50 mt-1">
                            {a.action === 'assign' ? `To ${a.assigned_to}` : `From ${a.assigned_to}`} by {a.assigned_by}
                          </div>
                        </div>
                        <span className="text-xs text-navy/40">
                          {new Date(a.created_at).toLocaleDateString('en-AU')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Assign Picker Modal */}
        {showAssignPicker && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
            <div className="w-full max-w-[480px] bg-white rounded-t-2xl p-5 pb-8 max-h-[70vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-bold text-navy">Assign to Team Member</div>
                <button onClick={() => setShowAssignPicker(false)} className="text-navy/40 p-2 min-h-[48px] min-w-[48px] flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {teamMembers.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleAssign(m.name)}
                      disabled={submitting}
                      className="bg-light-gray text-navy text-sm font-medium p-3 rounded-xl active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[48px] text-left"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
