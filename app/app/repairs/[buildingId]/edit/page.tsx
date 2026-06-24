'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '../../../../lib/supabase'
import { getStoredUser } from '../../../../lib/helpers'
import type { RatUser, RepairBuilding } from '../../../../lib/types'

const ALL_LOCATIONS = ['Column', 'Door', 'Floor', 'Hob', 'Parapet Wall', 'Planter Box', 'Rooftop', 'Screen', 'Slab End', 'Slab Top', 'Soffit', 'Sunhood Top', 'Wall', 'Window', 'Other']
const ALL_DEFECT_TYPES = ['Concrete', 'Caulking', 'Coatings', 'Waterproofing', 'Windows & Doors', 'Screens, Fins & Hoods', 'Spitters', 'Brick Work', 'Cleaning', 'Installation', 'Other']

export default function EditBuildingPage() {
  const params = useParams<{ buildingId: string }>()
  const router = useRouter()
  const [user, setUser] = useState<RatUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const [name, setName] = useState('')
  const [dropCount, setDropCount] = useState('')
  const [dropLabelling, setDropLabelling] = useState<'alpha' | 'numeric'>('alpha')
  const [floorCount, setFloorCount] = useState('')
  const [groundIsLevelOne, setGroundIsLevelOne] = useState(false)
  const [skippedLevels, setSkippedLevels] = useState<number[]>([])
  const [existingPlanUrls, setExistingPlanUrls] = useState<string[]>([])
  const [newDropPlanPhotos, setNewDropPlanPhotos] = useState<File[]>([])
  const [newDropPlanPreviews, setNewDropPlanPreviews] = useState<string[]>([])
  const [relevantLocations, setRelevantLocations] = useState<string[]>(ALL_LOCATIONS)
  const [relevantDefectTypes, setRelevantDefectTypes] = useState<string[]>(ALL_DEFECT_TYPES)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    loadBuilding()
  }, [])

  async function loadBuilding() {
    const { data } = await getSupabase()
      .from('repair_buildings')
      .select('*')
      .eq('id', params.buildingId)
      .single()

    if (!data) {
      router.replace('/repairs')
      return
    }

    const b = data as RepairBuilding
    setName(b.name)
    setDropCount(String(b.drop_count))
    setDropLabelling(b.drop_labelling)
    setFloorCount(String(b.floor_count))
    setGroundIsLevelOne(b.ground_is_level_one)
    setSkippedLevels(b.skipped_levels || [])
    setExistingPlanUrls(b.drop_plan_urls?.length ? b.drop_plan_urls : (b.drop_plan_url ? [b.drop_plan_url] : []))
    setRelevantLocations(b.relevant_locations || ALL_LOCATIONS)
    setRelevantDefectTypes(b.relevant_defect_types || ALL_DEFECT_TYPES)
    setLoading(false)
  }

  function getLevelChips(): { label: string; value: number }[] {
    const fc = parseInt(floorCount)
    if (!fc || fc < 2) return []
    const chips: { label: string; value: number }[] = []
    if (!groundIsLevelOne) {
      chips.push({ label: 'G', value: 0 })
      for (let i = 1; i <= fc - 2; i++) chips.push({ label: String(i), value: i })
      chips.push({ label: 'R', value: fc - 1 })
    } else {
      for (let i = 1; i <= fc - 1; i++) chips.push({ label: String(i), value: i })
      chips.push({ label: 'R', value: fc })
    }
    return chips
  }

  function toggleSkipped(val: number) {
    setSkippedLevels(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  async function handleSave() {
    if (!user || saving) return
    if (!name.trim() || !dropCount || !floorCount) return
    setSaving(true)

    // Upload new photos
    const newUrls: string[] = []
    for (let i = 0; i < newDropPlanPhotos.length; i++) {
      const path = `repairs/drop-plans/${params.buildingId}/${Date.now()}-${i}.jpg`
      const { error: uploadErr } = await getSupabase()
        .storage
        .from('repairs')
        .upload(path, newDropPlanPhotos[i], { upsert: true })

      if (!uploadErr) {
        const { data: urlData } = getSupabase()
          .storage
          .from('repairs')
          .getPublicUrl(path)
        if (urlData?.publicUrl) newUrls.push(urlData.publicUrl)
      }
    }

    const allUrls = [...existingPlanUrls, ...newUrls]

    const { error } = await getSupabase()
      .from('repair_buildings')
      .update({
        name: name.trim(),
        drop_count: parseInt(dropCount),
        drop_labelling: dropLabelling,
        floor_count: parseInt(floorCount),
        skipped_levels: skippedLevels,
        ground_is_level_one: groundIsLevelOne,
        drop_plan_url: allUrls[0] || null,
        drop_plan_urls: allUrls.length > 0 ? allUrls : null,
        relevant_locations: relevantLocations,
        relevant_defect_types: relevantDefectTypes,
      })
      .eq('id', params.buildingId)

    if (error) {
      alert('Failed to update building: ' + error.message)
      setSaving(false)
      return
    }

    router.push(`/repairs/${params.buildingId}`)
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)

    await getSupabase().from('repair_steps').delete().in(
      'repair_id',
      (await getSupabase().from('repairs').select('id').eq('building_id', params.buildingId)).data?.map((r: { id: string }) => r.id) || []
    )
    await getSupabase().from('repairs').delete().eq('building_id', params.buildingId)
    await getSupabase().from('repair_buildings').delete().eq('id', params.buildingId)

    router.replace('/repairs')
  }

  if (!user || loading) {
    return (
      <div className="flex flex-col min-h-screen bg-light-gray">
        <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
          <div className="bg-navy px-5 py-4">
            <div className="text-lg font-bold text-white">Edit Building</div>
          </div>
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  const levelChips = getLevelChips()
  const totalPhotos = existingPlanUrls.length + newDropPlanPhotos.length

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push(`/repairs/${params.buildingId}`)}
            className="text-white/60 active:scale-95 transition-transform"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <div className="text-lg font-bold text-white">Edit Building</div>
            <div className="text-xs text-white/50">{user.name}</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 pb-24">
          <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-orange/20">
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-navy/70 mb-1">Building Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                  placeholder="Enter building name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-navy/70 mb-1">Drop Count</label>
                <input
                  type="number"
                  value={dropCount}
                  onChange={e => setDropCount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                  placeholder="Number of drops"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-navy/70 mb-1">Drop Labelling</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDropLabelling('numeric')}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium min-h-[48px] transition-all ${
                      dropLabelling === 'numeric'
                        ? 'bg-orange text-white'
                        : 'bg-light-gray text-navy/50 border border-navy/10'
                    }`}
                  >
                    1, 2, 3...
                  </button>
                  <button
                    onClick={() => setDropLabelling('alpha')}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium min-h-[48px] transition-all ${
                      dropLabelling === 'alpha'
                        ? 'bg-orange text-white'
                        : 'bg-light-gray text-navy/50 border border-navy/10'
                    }`}
                  >
                    A, B, C...
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-navy/70 mb-1">Floor Count (incl. ground &amp; rooftop)</label>
                <input
                  type="number"
                  value={floorCount}
                  onChange={e => { setFloorCount(e.target.value); setSkippedLevels([]) }}
                  className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                  placeholder="Total floors including ground & rooftop"
                  min="2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-navy/70 mb-1">
                  Does this building start at Level 1? <span className="text-navy/30">(no separate ground floor)</span>
                </label>
                <button
                  onClick={() => { setGroundIsLevelOne(!groundIsLevelOne); setSkippedLevels([]) }}
                  className={`w-full py-3 rounded-xl text-sm font-medium min-h-[48px] transition-all ${
                    groundIsLevelOne
                      ? 'bg-orange text-white'
                      : 'bg-light-gray text-navy/50 border border-navy/10'
                  }`}
                >
                  {groundIsLevelOne ? 'Yes — starts at Level 1' : 'No — has separate Ground floor'}
                </button>
              </div>

              {levelChips.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-navy/70 mb-1">Skipped Levels <span className="text-navy/30">(tap to skip)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {levelChips.map(chip => {
                      const isSkipped = skippedLevels.includes(chip.value)
                      return (
                        <button
                          key={chip.value}
                          onClick={() => toggleSkipped(chip.value)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium min-h-[40px] min-w-[40px] transition-all ${
                            isSkipped
                              ? 'bg-red-500 text-white line-through'
                              : 'bg-light-gray text-navy border border-navy/10'
                          }`}
                        >
                          {chip.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Relevant Locations */}
              <div>
                <label className="block text-xs font-medium text-navy/70 mb-1">Relevant Locations <span className="text-navy/30">(tap to deselect)</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_LOCATIONS.map(loc => {
                    const selected = relevantLocations.includes(loc)
                    return (
                      <button
                        key={loc}
                        onClick={() => setRelevantLocations(prev => selected ? prev.filter(l => l !== loc) : [...prev, loc])}
                        className={`px-3 py-2 rounded-lg text-xs font-medium min-h-[36px] transition-all ${
                          selected
                            ? 'bg-orange/10 text-orange border border-orange/30'
                            : 'bg-light-gray text-navy/30 border border-navy/10 line-through'
                        }`}
                      >
                        {loc}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Relevant Defect Types */}
              <div>
                <label className="block text-xs font-medium text-navy/70 mb-1">Relevant Defect Types <span className="text-navy/30">(tap to deselect)</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_DEFECT_TYPES.map(dt => {
                    const selected = relevantDefectTypes.includes(dt)
                    return (
                      <button
                        key={dt}
                        onClick={() => setRelevantDefectTypes(prev => selected ? prev.filter(d => d !== dt) : [...prev, dt])}
                        className={`px-3 py-2 rounded-lg text-xs font-medium min-h-[36px] transition-all ${
                          selected
                            ? 'bg-orange/10 text-orange border border-orange/30'
                            : 'bg-light-gray text-navy/30 border border-navy/10 line-through'
                        }`}
                      >
                        {dt}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Drop Plan Photos (optional)</label>
                {(existingPlanUrls.length > 0 || newDropPlanPreviews.length > 0) && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {existingPlanUrls.map((url, idx) => (
                      <div key={`existing-${idx}`} className="relative aspect-square">
                        <img src={url} alt={`Drop plan ${idx + 1}`} className="w-full h-full object-cover rounded-xl border border-navy/10" />
                        <button
                          onClick={() => setExistingPlanUrls(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-sm"
                        >×</button>
                      </div>
                    ))}
                    {newDropPlanPreviews.map((preview, idx) => (
                      <div key={`new-${idx}`} className="relative aspect-square">
                        <img src={preview} alt={`New drop plan ${idx + 1}`} className="w-full h-full object-cover rounded-xl border border-navy/10" />
                        <button
                          onClick={() => {
                            setNewDropPlanPhotos(prev => prev.filter((_, i) => i !== idx))
                            setNewDropPlanPreviews(prev => prev.filter((_, i) => i !== idx))
                          }}
                          className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-sm"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                {totalPhotos < 10 && (
                  <label className="flex items-center justify-center w-full min-h-[64px] px-4 py-3 rounded-xl border-2 border-dashed border-navy/20 bg-light-gray text-navy/50 text-sm cursor-pointer active:scale-95 transition-all duration-150">
                    <input
                      type="file"
                      accept="image/*"
                     
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setNewDropPlanPhotos(prev => [...prev, file])
                          setNewDropPlanPreviews(prev => [...prev, URL.createObjectURL(file)])
                        }
                        e.target.value = ''
                      }}
                      className="hidden"
                    />
                    Add Drop Plan Photo
                  </label>
                )}
              </div>

              <div className="flex gap-3 mt-1">
                <button
                  onClick={() => router.push(`/repairs/${params.buildingId}`)}
                  className="flex-1 bg-light-gray text-navy font-semibold py-3 rounded-xl border border-navy/10 active:scale-95 transition-all duration-150 min-h-[48px]"
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim() || !dropCount || !floorCount}
                  className="flex-1 bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : 'Save'}
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-navy/10">
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full bg-red-500 text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px]"
                >
                  Delete Building
                </button>
              </div>
            </div>
          </div>
        </div>

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-5 max-w-[360px] w-full shadow-xl">
              <div className="text-base font-semibold text-navy mb-2">Delete Building?</div>
              <div className="text-sm text-navy/60 mb-4">
                This will permanently delete this building and all its repairs. This cannot be undone.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-light-gray text-navy font-semibold py-3 rounded-xl border border-navy/10 active:scale-95 transition-all duration-150 min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-500 text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
