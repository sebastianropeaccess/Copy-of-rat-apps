'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '../../../../lib/supabase'
import { getStoredUser, getDropLabel } from '../../../../lib/helpers'
import type { RatUser, RepairBuilding } from '../../../../lib/types'

const DEFECT_TYPES = [
  'Concrete Spalling',
  'Concrete Cracking',
  'Concrete Bar Ends',
  'Brick Cracking',
  'Brick Pointing',
  'Brick Loose',
  'Joint Sealing',
  'Paint Defect',
  'Waterproofing',
  'Rust',
  'Other',
]

function getFloorLabels(floorCount: number, groundIsLevelOne: boolean, skippedLevels: number[]): string[] {
  const labels: string[] = []
  if (!groundIsLevelOne) {
    labels.push('G')
    for (let i = 1; i <= floorCount - 2; i++) {
      if (!skippedLevels.includes(i)) labels.push(String(i))
    }
    labels.push('R')
  } else {
    for (let i = 1; i <= floorCount - 1; i++) {
      if (!skippedLevels.includes(i)) labels.push(String(i))
    }
    labels.push('R')
  }
  return labels
}

export default function NewRepairPage() {
  const params = useParams<{ buildingId: string }>()
  const [user, setUser] = useState<RatUser | null>(null)
  const [building, setBuilding] = useState<RepairBuilding | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedDrop, setSelectedDrop] = useState('')
  const [selectedFloor, setSelectedFloor] = useState('')
  const [defectType, setDefectType] = useState('')
  const [subType, setSubType] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [initialComments, setInitialComments] = useState('')

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)

    async function load() {
      const { data } = await getSupabase()
        .from('repair_buildings')
        .select('*')
        .eq('id', params.buildingId)
        .single()
      if (data) setBuilding(data as RepairBuilding)
      setLoading(false)
    }
    load()
  }, [])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const dropLabels = building
    ? Array.from({ length: building.drop_count }, (_, i) => getDropLabel(i, building.drop_labelling))
    : []

  const floorLabels = building
    ? getFloorLabels(building.floor_count, building.ground_is_level_one, building.skipped_levels || [])
    : []

  const canSave = selectedDrop && selectedFloor && defectType && photo

  async function handleSave() {
    if (!user || !building || saving || !canSave) return
    setSaving(true)

    try {
      const { data: repair, error: insertError } = await getSupabase()
        .from('repairs')
        .insert({
          building_id: building.id,
          building_name: building.name,
          drop_label: selectedDrop,
          floor_number: selectedFloor,
          defect_type: defectType,
          sub_type: subType.trim() || null,
          initial_comments: initialComments.trim() || null,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          created_by: user.name,
        })
        .select()
        .single()

      if (insertError || !repair) {
        alert('Failed to create repair: ' + (insertError?.message || 'Unknown error'))
        setSaving(false)
        return
      }

      if (photo) {
        const path = `repairs/${repair.id}/initial.jpg`
        const { error: uploadError } = await getSupabase()
          .storage
          .from('repairs')
          .upload(path, photo)

        if (!uploadError) {
          const { data: urlData } = getSupabase()
            .storage
            .from('repairs')
            .getPublicUrl(path)

          if (urlData?.publicUrl) {
            await getSupabase()
              .from('repairs')
              .update({ initial_photo_url: urlData.publicUrl })
              .eq('id', repair.id)
          }
        }
      }

      window.location.href = `/repairs/${params.buildingId}/${repair.id}`
    } catch {
      alert('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href={`/repairs/${params.buildingId}`} className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">New Repair</div>
            <div className="text-xs text-white/50">{building?.name || 'Loading...'}</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !building ? (
            <div className="text-center py-12 text-navy/40">Building not found</div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Drop Selector */}
              <div>
                <label className="block text-sm font-medium text-navy/70 mb-2">Select Drop</label>
                <div className="grid grid-cols-4 gap-2">
                  {dropLabels.map(label => (
                    <button
                      key={label}
                      onClick={() => setSelectedDrop(label)}
                      className={`py-3 rounded-xl text-sm font-semibold min-h-[48px] transition-all ${
                        selectedDrop === label
                          ? 'bg-orange text-white'
                          : 'bg-white text-navy border border-navy/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Floor Selector */}
              <div>
                <label className="block text-sm font-medium text-navy/70 mb-2">Select Floor</label>
                <div className="grid grid-cols-4 gap-2">
                  {floorLabels.map(label => (
                    <button
                      key={label}
                      onClick={() => setSelectedFloor(label)}
                      className={`py-3 rounded-xl text-sm font-semibold min-h-[48px] transition-all ${
                        selectedFloor === label
                          ? 'bg-orange text-white'
                          : 'bg-white text-navy border border-navy/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Defect Type */}
              <div>
                <label className="block text-sm font-medium text-navy/70 mb-1">Defect Type</label>
                <select
                  value={defectType}
                  onChange={e => setDefectType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                >
                  <option value="">Select defect type</option>
                  {DEFECT_TYPES.map(dt => (
                    <option key={dt} value={dt}>{dt}</option>
                  ))}
                </select>
              </div>

              {/* Sub Type */}
              {(defectType === 'Other' || subType) && (
                <div>
                  <label className="block text-sm font-medium text-navy/70 mb-1">
                    Sub Type {defectType !== 'Other' && <span className="text-navy/30">(optional)</span>}
                  </label>
                  <input
                    type="text"
                    value={subType}
                    onChange={e => setSubType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                    placeholder="Enter sub type"
                  />
                </div>
              )}

              {/* Always show sub type trigger if not Other */}
              {defectType && defectType !== 'Other' && !subType && (
                <button
                  onClick={() => setSubType(' ')}
                  className="text-xs text-navy/40 text-left px-1"
                >
                  + Add sub type
                </button>
              )}

              {/* Photo */}
              <div>
                <label className="block text-sm font-medium text-navy/70 mb-1">Initial Defect Photo <span className="text-red-400">*</span></label>
                <label className="flex items-center justify-center w-full min-h-[48px] px-4 py-3 rounded-xl border-2 border-dashed border-navy/20 bg-white text-navy/50 text-sm cursor-pointer active:scale-95 transition-all duration-150">
                  <input
                    type="file"
                    accept="image/*"
                   
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  {photo ? 'Change Photo' : 'Take Photo'}
                </label>
                {photoPreview && (
                  <img src={photoPreview} alt="Preview" className="w-full rounded-xl mt-2 max-h-64 object-cover" />
                )}
              </div>

              {/* Comments */}
              <div>
                <label className="block text-sm font-medium text-navy/70 mb-1">Initial Comments</label>
                <textarea
                  value={initialComments}
                  onChange={e => setInitialComments(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 resize-none"
                  placeholder="Describe the defect..."
                />
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="w-full bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100 mt-2"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : 'Save Repair'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
