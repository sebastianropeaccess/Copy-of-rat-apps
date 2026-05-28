'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser, HssInspection, HssAnchor } from '@/lib/types'

export default function HssDetailPage() {
  const params = useParams<{ id: string }>()
  const [user, setUser] = useState<RatUser | null>(null)
  const [inspection, setInspection] = useState<HssInspection | null>(null)
  const [anchors, setAnchors] = useState<HssAnchor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Anchor form state
  const [anchorNumber, setAnchorNumber] = useState('')
  const [anchorType, setAnchorType] = useState('Anchor')
  const [location, setLocation] = useState('')
  const [condition, setCondition] = useState('')
  const [result, setResult] = useState<'Pass' | 'Fail' | 'N/A'>('Pass')
  const [photo, setPhoto] = useState<File | null>(null)
  const [comments, setComments] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    const { data: insp } = await getSupabase()
      .from('hss_inspections')
      .select('*')
      .eq('id', params.id)
      .single()

    if (insp) setInspection(insp as HssInspection)

    const { data: anchorData } = await getSupabase()
      .from('hss_anchors')
      .select('*')
      .eq('inspection_id', params.id)
      .order('created_at', { ascending: true })

    if (anchorData) setAnchors(anchorData as HssAnchor[])
    setLoading(false)
  }

  function resetForm() {
    setAnchorNumber('')
    setAnchorType('Anchor')
    setLocation('')
    setCondition('')
    setResult('Pass')
    setPhoto(null)
    setComments('')
    setCorrectiveAction('')
    setShowForm(false)
  }

  async function handleSaveAnchor() {
    if (!user || !anchorNumber.trim()) return
    setSaving(true)

    try {
      let photoUrl: string | null = null

      if (photo) {
        const path = `${params.id}/anchor_${anchorNumber.trim()}.jpg`
        const { error: uploadError } = await getSupabase()
          .storage
          .from('hss-inspections')
          .upload(path, photo, { upsert: true })

        if (!uploadError) {
          const { data: urlData } = getSupabase()
            .storage
            .from('hss-inspections')
            .getPublicUrl(path)
          photoUrl = urlData.publicUrl
        }
      }

      const { error } = await getSupabase()
        .from('hss_anchors')
        .insert({
          inspection_id: params.id,
          anchor_number: anchorNumber.trim(),
          anchor_type: anchorType,
          location: location.trim(),
          condition: condition.trim(),
          result,
          photo_url: photoUrl,
          comments: comments.trim() || null,
          corrective_action: result === 'Fail' ? correctiveAction.trim() || null : null,
          created_by: user.name,
        })

      if (error) {
        alert('Failed to save anchor')
      } else {
        resetForm()
        await loadData()
      }
    } catch {
      alert('Failed to save anchor')
    }
    setSaving(false)
  }

  async function toggleComplete() {
    if (!inspection) return
    const newStatus = !inspection.inspection_complete
    const { error } = await getSupabase()
      .from('hss_inspections')
      .update({ inspection_complete: newStatus })
      .eq('id', inspection.id)

    if (!error) {
      setInspection({ ...inspection, inspection_complete: newStatus })
    }
  }

  if (!user) return null

  const passCount = anchors.filter(a => a.result === 'Pass').length
  const failCount = anchors.filter(a => a.result === 'Fail').length
  const naCount = anchors.filter(a => a.result === 'N/A').length

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/hss" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-white truncate">{inspection?.building_name || 'Loading...'}</div>
            <div className="text-xs text-white/50">{inspection?.inspection_date}</div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : inspection ? (
          <div className="flex-1 px-4 py-4 pb-6 flex flex-col gap-4">
            {/* Info Section */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm font-medium text-navy mb-2">Inspection Details</div>
              <div className="text-xs text-navy/60 mb-1">
                <span className="font-medium">Date:</span> {inspection.inspection_date}
              </div>
              <div className="text-xs text-navy/60 mb-2">
                <span className="font-medium">Inspectors:</span> {inspection.inspectors?.join(', ') || 'None'}
              </div>
              {inspection.gauges_used && inspection.gauges_used.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-navy/60 mb-1">Gauges:</div>
                  <div className="flex flex-wrap gap-1">
                    {inspection.gauges_used.map(gauge => (
                      <span key={gauge} className="text-xs bg-navy/10 text-navy/70 px-2 py-0.5 rounded-full">{gauge}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Anchor Plans */}
            {inspection.anchor_plan_urls && inspection.anchor_plan_urls.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-sm font-medium text-navy mb-2">Anchor Plans</div>
                <div className="grid grid-cols-2 gap-2">
                  {inspection.anchor_plan_urls.map((url, i) => (
                    <button key={i} onClick={() => setLightboxUrl(url)} className="active:scale-95 transition-all duration-150">
                      <img src={url} alt={`Plan ${i + 1}`} className="w-full h-24 object-cover rounded-lg" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Anchor List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-navy">Anchors ({anchors.length})</div>
              </div>

              {anchors.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {anchors.map(anchor => (
                    <div key={anchor.id} className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-sm text-navy">#{anchor.anchor_number}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-navy/10 text-navy/60 px-2 py-0.5 rounded-full">{anchor.anchor_type}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            anchor.result === 'Pass' ? 'bg-green-100 text-green-700' :
                            anchor.result === 'Fail' ? 'bg-red-100 text-red-700' :
                            'bg-gray-200 text-gray-600'
                          }`}>
                            {anchor.result}
                          </span>
                        </div>
                      </div>
                      {anchor.location && (
                        <div className="text-xs text-navy/50">{anchor.location}</div>
                      )}
                      {anchor.photo_url && (
                        <button onClick={() => setLightboxUrl(anchor.photo_url)} className="mt-2 active:scale-95 transition-all duration-150">
                          <img src={anchor.photo_url} alt={`Anchor ${anchor.anchor_number}`} className="w-16 h-16 object-cover rounded-lg" />
                        </button>
                      )}
                      {anchor.comments && (
                        <div className="text-xs text-navy/40 mt-1 line-clamp-2">{anchor.comments}</div>
                      )}
                      {anchor.result === 'Fail' && anchor.corrective_action && (
                        <div className="text-xs text-red-600 mt-1 font-medium">Corrective: {anchor.corrective_action}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Anchor Button / Form */}
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px]"
                >
                  + Add Anchor
                </button>
              ) : (
                <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="text-sm font-medium text-navy">New Anchor</div>

                  <div>
                    <label className="block text-xs font-medium text-navy/70 mb-1">Anchor Number *</label>
                    <input
                      type="text"
                      value={anchorNumber}
                      onChange={e => setAnchorNumber(e.target.value)}
                      className="w-full border border-navy/20 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange/50 min-h-[48px]"
                      placeholder="e.g. A1"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-navy/70 mb-1">Anchor Type</label>
                    <select
                      value={anchorType}
                      onChange={e => setAnchorType(e.target.value)}
                      className="w-full border border-navy/20 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange/50 min-h-[48px]"
                    >
                      <option value="Anchor">Anchor</option>
                      <option value="Access System">Access System</option>
                      <option value="Rail/Static Line">Rail/Static Line</option>
                      <option value="Compliance Plate">Compliance Plate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-navy/70 mb-1">Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      className="w-full border border-navy/20 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange/50 min-h-[48px]"
                      placeholder="e.g. Roof Level 3"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-navy/70 mb-1">Condition</label>
                    <input
                      type="text"
                      value={condition}
                      onChange={e => setCondition(e.target.value)}
                      className="w-full border border-navy/20 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange/50 min-h-[48px]"
                      placeholder="e.g. Good, Minor rust, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-navy/70 mb-1">Result</label>
                    <div className="flex gap-2">
                      {(['Pass', 'Fail', 'N/A'] as const).map(r => (
                        <button
                          key={r}
                          onClick={() => setResult(r)}
                          className={`flex-1 py-3 rounded-xl text-sm font-medium min-h-[48px] transition-all duration-150 active:scale-95 ${
                            result === r
                              ? r === 'Pass' ? 'bg-green-500 text-white'
                                : r === 'Fail' ? 'bg-red-500 text-white'
                                : 'bg-gray-500 text-white'
                              : 'bg-white border border-navy/20 text-navy/60'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-navy/70 mb-1">Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                     
                      onChange={e => setPhoto(e.target.files?.[0] || null)}
                      className="w-full text-sm text-navy/60 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-orange/10 file:text-orange cursor-pointer min-h-[48px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-navy/70 mb-1">Comments</label>
                    <textarea
                      value={comments}
                      onChange={e => setComments(e.target.value)}
                      rows={2}
                      className="w-full border border-navy/20 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange/50 resize-none"
                      placeholder="Optional comments"
                    />
                  </div>

                  {result === 'Fail' && (
                    <div>
                      <label className="block text-xs font-medium text-red-600 mb-1">Corrective Action</label>
                      <input
                        type="text"
                        value={correctiveAction}
                        onChange={e => setCorrectiveAction(e.target.value)}
                        className="w-full border border-red-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300 min-h-[48px]"
                        placeholder="Required corrective action"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={resetForm}
                      className="flex-1 border border-navy/20 text-navy/60 font-medium py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAnchor}
                      disabled={saving || !anchorNumber.trim()}
                      className="flex-1 bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-50 disabled:active:scale-100"
                    >
                      {saving ? 'Saving...' : 'Save Anchor'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            {anchors.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-sm font-medium text-navy mb-2">Summary</div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-navy">{anchors.length}</div>
                    <div className="text-xs text-navy/50">Total</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">{passCount}</div>
                    <div className="text-xs text-green-600">Pass</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-600">{failCount}</div>
                    <div className="text-xs text-red-600">Fail</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-500">{naCount}</div>
                    <div className="text-xs text-gray-500">N/A</div>
                  </div>
                </div>
              </div>
            )}

            {/* Mark Complete / Reopen */}
            {user.can_generate_reports && (
              <button
                onClick={toggleComplete}
                className={`w-full font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] ${
                  inspection.inspection_complete
                    ? 'bg-white border-2 border-orange text-orange'
                    : 'bg-green-600 text-white'
                }`}
              >
                {inspection.inspection_complete ? 'Reopen Inspection' : 'Mark Complete'}
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-navy/40">Inspection not found</div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="Full size" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  )
}
