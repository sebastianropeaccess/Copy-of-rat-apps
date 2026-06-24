'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../lib/supabase'
import { getStoredUser } from '../../lib/helpers'
import type { RatUser, RepairBuilding } from '../../lib/types'

const ALL_LOCATIONS = ['Column', 'Door', 'Floor', 'Hob', 'Parapet Wall', 'Planter Box', 'Rooftop', 'Screen', 'Slab End', 'Slab Top', 'Soffit', 'Sunhood Top', 'Wall', 'Window', 'Other']
const ALL_DEFECT_TYPES = ['Concrete', 'Caulking', 'Coatings', 'Waterproofing', 'Windows & Doors', 'Screens, Fins & Hoods', 'Spitters', 'Brick Work', 'Cleaning', 'Installation', 'Other']

type BuildingWithCounts = RepairBuilding & {
  repair_count: number
  active_count: number
}

export default function RepairsBuildingListPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [buildings, setBuildings] = useState<BuildingWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [dropCount, setDropCount] = useState('')
  const [dropLabelling, setDropLabelling] = useState<'alpha' | 'numeric'>('alpha')
  const [floorCount, setFloorCount] = useState('')
  const [groundIsLevelOne, setGroundIsLevelOne] = useState(false)
  const [skippedLevels, setSkippedLevels] = useState<number[]>([])
  const [dropPlanPhotos, setDropPlanPhotos] = useState<File[]>([])
  const [dropPlanPreviews, setDropPlanPreviews] = useState<string[]>([])
  const [relevantLocations, setRelevantLocations] = useState<string[]>(ALL_LOCATIONS)
  const [relevantDefectTypes, setRelevantDefectTypes] = useState<string[]>(ALL_DEFECT_TYPES)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    loadBuildings()
  }, [])

  async function loadBuildings() {
    const { data: blds } = await getSupabase()
      .from('repair_buildings')
      .select('*')
      .order('created_at', { ascending: false })

    if (!blds) { setLoading(false); return }

    const { data: repairs } = await getSupabase()
      .from('repairs')
      .select('building_id, status')

    const withCounts: BuildingWithCounts[] = blds.map((b: RepairBuilding) => {
      const bRepairs = (repairs || []).filter((r: { building_id: string; status: string }) => r.building_id === b.id)
      return {
        ...b,
        repair_count: bRepairs.length,
        active_count: bRepairs.filter((r: { status: string }) => r.status === 'in_progress').length,
      }
    })

    setBuildings(withCounts)
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

  function resetForm() {
    setName('')
    setDropCount('')
    setDropLabelling('alpha')
    setFloorCount('')
    setGroundIsLevelOne(false)
    setSkippedLevels([])
    setDropPlanPhotos([])
    setDropPlanPreviews([])
    setRelevantLocations(ALL_LOCATIONS)
    setRelevantDefectTypes(ALL_DEFECT_TYPES)
    setShowForm(false)
  }

  async function handleSave() {
    if (!user || saving) return
    if (!name.trim() || !dropCount || !floorCount) return
    setSaving(true)

    const { data: building, error } = await getSupabase()
      .from('repair_buildings')
      .insert({
        name: name.trim(),
        drop_count: parseInt(dropCount),
        drop_labelling: dropLabelling,
        floor_count: parseInt(floorCount),
        skipped_levels: skippedLevels,
        ground_is_level_one: groundIsLevelOne,
        relevant_locations: relevantLocations,
        relevant_defect_types: relevantDefectTypes,
        created_by: user.name,
      })
      .select()
      .single()

    if (error || !building) {
      alert('Failed to create building: ' + (error?.message || 'Unknown error'))
      setSaving(false)
      return
    }

    // Upload drop plan photos if provided
    if (dropPlanPhotos.length > 0) {
      const urls: string[] = []
      for (let i = 0; i < dropPlanPhotos.length; i++) {
        const path = `repairs/drop-plans/${building.id}/${i}.jpg`
        const { error: uploadErr } = await getSupabase()
          .storage
          .from('repairs')
          .upload(path, dropPlanPhotos[i], { upsert: true })

        if (!uploadErr) {
          const { data: urlData } = getSupabase()
            .storage
            .from('repairs')
            .getPublicUrl(path)
          if (urlData?.publicUrl) urls.push(urlData.publicUrl)
        }
      }
      if (urls.length > 0) {
        await getSupabase()
          .from('repair_buildings')
          .update({ drop_plan_urls: urls, drop_plan_url: urls[0] })
          .eq('id', building.id)
      }
    }

    setSaving(false)
    resetForm()
    await loadBuildings()
  }

  async function handleDelete() {
    if (!deleteId || deleting) return
    setDeleting(true)

    await getSupabase().from('repair_steps').delete().in(
      'repair_id',
      (await getSupabase().from('repairs').select('id').eq('building_id', deleteId)).data?.map((r: { id: string }) => r.id) || []
    )
    await getSupabase().from('repairs').delete().eq('building_id', deleteId)
    await getSupabase().from('repair_buildings').delete().eq('id', deleteId)

    setDeleting(false)
    setDeleteId(null)
    await loadBuildings()
  }

  if (!user) return null

  const levelChips = getLevelChips()

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60 active:scale-95 transition-transform">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
            </Link>
            <div>
              <div className="text-lg font-bold text-white">Repairs</div>
              <div className="text-xs text-white/50">{user.name}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 pb-24">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {buildings.length === 0 && !showForm && (
                <div className="text-center py-12 text-navy/40">No buildings yet</div>
              )}

              <div className="flex flex-col gap-3">
                {buildings.map(b => (
                  <div key={b.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <Link href={`/repairs/${b.id}`}>
                      <div className="p-4 active:scale-[0.98] transition-all duration-150">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-semibold text-navy flex-1">{b.name}</div>
                          <Link
                            href={`/repairs/${b.id}/edit`}
                            onClick={e => e.stopPropagation()}
                            className="ml-2 min-w-[56px] min-h-[40px] flex items-center justify-center bg-orange/10 text-orange text-xs font-semibold rounded-lg active:scale-95 transition-all shrink-0"
                          >
                            Edit
                          </Link>
                          {b.active_count > 0 && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange/10 text-orange">
                              {b.active_count} active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-navy/50">
                          {b.drop_count} drops · {b.repair_count} repair{b.repair_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </Link>

                  </div>
                ))}
              </div>

              {showForm && (
                <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-orange/20 mt-4">
                  <div className="text-sm font-semibold text-navy mb-3">New Building</div>
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

                    {/* Drop Plan Upload */}
                    <div>
                      <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Drop Plan Photos (optional)</label>
                      {dropPlanPreviews.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {dropPlanPreviews.map((preview, idx) => (
                            <div key={idx} className="relative aspect-square">
                              <img src={preview} alt={`Drop plan ${idx + 1}`} className="w-full h-full object-cover rounded-xl border border-navy/10" />
                              <button
                                onClick={() => {
                                  setDropPlanPhotos(prev => prev.filter((_, i) => i !== idx))
                                  setDropPlanPreviews(prev => prev.filter((_, i) => i !== idx))
                                }}
                                className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-sm"
                              >×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {dropPlanPhotos.length < 10 && (
                        <label className="flex items-center justify-center w-full min-h-[64px] px-4 py-3 rounded-xl border-2 border-dashed border-navy/20 bg-light-gray text-navy/50 text-sm cursor-pointer active:scale-95 transition-all duration-150">
                          <input
                            type="file"
                            accept="image/*"
                           
                            onChange={e => {
                              const file = e.target.files?.[0]
                              if (file) {
                                setDropPlanPhotos(prev => [...prev, file])
                                setDropPlanPreviews(prev => [...prev, URL.createObjectURL(file)])
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
                        onClick={resetForm}
                        className="flex-1 bg-light-gray text-navy font-semibold py-3 rounded-xl border border-navy/10 active:scale-95 transition-all duration-150 min-h-[48px]"
                      >
                        Cancel
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
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!showForm && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-gray/90 backdrop-blur-sm">
            <div className="max-w-[480px] mx-auto">
              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-orange text-white text-center font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px]"
              >
                + New Building
              </button>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-5 max-w-[360px] w-full shadow-xl">
              <div className="text-base font-semibold text-navy mb-2">Delete Building?</div>
              <div className="text-sm text-navy/60 mb-4">
                This will permanently delete this building and all its repairs. This cannot be undone.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
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
