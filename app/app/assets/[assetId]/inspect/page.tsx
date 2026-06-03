'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { InspectionType, InspectionResult } from '@/lib/types'

const INSPECTION_TYPES: { value: InspectionType; label: string; desc: string }[] = [
  { value: 'routine_ppe',  label: 'Routine PPE',  desc: 'Pre-use visual check' },
  { value: 'test_and_tag', label: 'Test & Tag',   desc: 'Electrical test record' },
  { value: 'visual',       label: 'Visual Check', desc: 'General condition check' },
]

const RESULTS: { value: InspectionResult; label: string; bg: string; border: string; text: string }[] = [
  { value: 'pass',             label: 'Pass',             bg: 'bg-green-500', border: 'border-green-500', text: 'text-white' },
  { value: 'conditional_pass', label: 'Conditional Pass', bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-white' },
  { value: 'fail',             label: 'Fail',             bg: 'bg-red-500',   border: 'border-red-500',   text: 'text-white' },
]

export default function InspectAssetPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const router = useRouter()
  const user = getStoredUser()

  const today = new Date().toISOString().split('T')[0]
  const [inspType, setInspType] = useState<InspectionType>('routine_ppe')
  const [result, setResult] = useState<InspectionResult | null>(null)
  const [inspDate, setInspDate] = useState(today)
  const [nextDue, setNextDue] = useState('')
  const [actionRequired, setActionRequired] = useState('')
  const [comments, setComments] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return null
  }

  function addPhoto(file: File) {
    setPhotos(prev => [...prev, file])
    setPreviews(prev => [...prev, URL.createObjectURL(file)])
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!result || saving) return
    setSaving(true)

    const photoUrls: string[] = []
    for (let i = 0; i < photos.length; i++) {
      const path = `inspections/${assetId}/${Date.now()}_${i}.jpg`
      const { error } = await getSupabase().storage.from('asset-inspections').upload(path, photos[i])
      if (!error) {
        const { data } = getSupabase().storage.from('asset-inspections').getPublicUrl(path)
        if (data?.publicUrl) photoUrls.push(data.publicUrl)
      }
    }

    const { error: inspError } = await getSupabase().from('asset_inspections').insert({
      asset_id: assetId,
      inspection_type: inspType,
      result,
      inspected_by: user!.name,
      inspection_date: inspDate,
      next_due_date: nextDue || null,
      action_required: actionRequired.trim() || null,
      comments: comments.trim() || null,
      photo_urls: photoUrls.length > 0 ? photoUrls : null,
    })

    if (inspError) {
      alert('Failed to save inspection: ' + inspError.message)
      setSaving(false)
      return
    }

    if (result === 'fail') {
      await getSupabase().from('assets').update({ status: 'broken' }).eq('id', assetId)
    } else if (result === 'conditional_pass') {
      await getSupabase().from('assets').update({ status: 'quarantine' }).eq('id', assetId)
    }

    setSaving(false)
    router.push(`/assets/${assetId}`)
  }

  const canSave = !!result && !!inspDate

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
          <Link href={`/assets/${assetId}`} className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div className="text-lg font-bold text-white">Log Inspection</div>
        </div>

        <div className="flex-1 px-4 py-4 pb-32 flex flex-col gap-4">
          {/* Inspection type */}
          <div>
            <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Inspection Type</label>
            <div className="flex flex-col gap-2">
              {INSPECTION_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setInspType(t.value)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl min-h-[56px] border-2 transition-all text-left ${
                    inspType === t.value
                      ? 'bg-navy border-navy text-white'
                      : 'bg-white border-navy/10 text-navy active:scale-[0.98]'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${inspType === t.value ? 'bg-white border-white' : 'border-navy/30'}`} />
                  <div>
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className={`text-xs ${inspType === t.value ? 'text-white/60' : 'text-navy/40'}`}>{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Result — large buttons */}
          <div>
            <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Result *</label>
            <div className="flex gap-3">
              {RESULTS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setResult(r.value)}
                  className={`flex-1 py-4 rounded-xl font-bold text-sm min-h-[64px] transition-all border-2 ${
                    result === r.value
                      ? `${r.bg} ${r.border} ${r.text} shadow-md`
                      : 'bg-white border-navy/10 text-navy/50 active:scale-95'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-navy/70 mb-1">Inspection Date *</label>
              <input
                type="date"
                value={inspDate}
                onChange={e => setInspDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy/70 mb-1">Next Due Date</label>
              <input
                type="date"
                value={nextDue}
                onChange={e => setNextDue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
              />
            </div>
          </div>

          {/* Action required — shown when fail or conditional */}
          {(result === 'fail' || result === 'conditional_pass') && (
            <div>
              <label className="block text-xs font-medium text-navy/70 mb-1">Action Required</label>
              <input
                type="text"
                value={actionRequired}
                onChange={e => setActionRequired(e.target.value)}
                placeholder="e.g. Remove from service, Send for repair"
                className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
              />
              {result === 'fail' && (
                <div className="mt-1 text-xs text-red-600 font-medium">Asset status will be set to Broken</div>
              )}
              {result === 'conditional_pass' && (
                <div className="mt-1 text-xs text-yellow-700 font-medium">Asset status will be set to Quarantine</div>
              )}
            </div>
          )}

          {/* Comments */}
          <div>
            <label className="block text-xs font-medium text-navy/70 mb-1">Comments</label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              placeholder="Condition notes, observations..."
              className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 resize-none"
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Photos</label>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square">
                    <img src={src} alt="" className="w-full h-full object-cover rounded-xl border border-navy/10" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-sm leading-none"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            {photos.length < 6 && (
              <label className="flex items-center justify-center w-full min-h-[56px] px-4 py-3 rounded-xl border-2 border-dashed border-navy/20 bg-white text-navy/50 text-sm cursor-pointer active:scale-95 transition-all">
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) addPhoto(f); e.target.value = '' }}
                  className="hidden"
                />
                + Add Photo
              </label>
            )}
          </div>
        </div>

        {/* Save button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-gray/90 backdrop-blur-sm">
          <div className="max-w-[480px] mx-auto">
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="w-full bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100 text-sm"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : 'Save Inspection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
