'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { FacadeInspection, FacadeDefect, RatUser } from '@/lib/types'

const SUB_TYPE_MAP: Record<string, string[]> = {
  Concrete: ['Spalling', 'Cracking', 'Bar Ends', 'Rust Spot'],
  Brick: ['Cracking', 'Pointing', 'Loose', 'Mortar Repair', 'Cavity Flashing'],
  'Joint Sealing': ['Around Frame', 'Expansion Joint'],
  Coatings: ['Paint Blister', 'Missing Paint', 'Paint Failure', 'Efflorescence'],
  Waterproofing: ['Failed Waterproofing', 'Water Ingress'],
  'Windows & Doors': ['Damaged Frame', 'Failed Seal', 'Broken Glass'],
}

export default function DropDetailPage() {
  const params = useParams<{ id: string; drop: string }>()
  const [user, setUser] = useState<RatUser | null>(null)
  const [inspection, setInspection] = useState<FacadeInspection | null>(null)
  const [defects, setDefects] = useState<FacadeDefect[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [location, setLocation] = useState('')
  const [defectType, setDefectType] = useState('')
  const [subType, setSubType] = useState('')
  const [customSubType, setCustomSubType] = useState('')
  const [lengthMm, setLengthMm] = useState('')
  const [heightMm, setHeightMm] = useState('')
  const [depthMm, setDepthMm] = useState('')
  const [quantity, setQuantity] = useState('')
  const [photo1, setPhoto1] = useState<File | null>(null)
  const [photo2, setPhoto2] = useState<File | null>(null)
  const [comments, setComments] = useState('')

  const loadData = useCallback(async () => {
    const { data: insp } = await getSupabase()
      .from('facade_inspections')
      .select('*')
      .eq('id', params.id)
      .single()

    if (insp) setInspection(insp as FacadeInspection)

    const { data: defs } = await getSupabase()
      .from('facade_defects')
      .select('*')
      .eq('inspection_id', params.id)
      .eq('drop', params.drop)
      .order('floor', { ascending: true })

    setDefects((defs as FacadeDefect[]) || [])
    setLoading(false)
  }, [params.id, params.drop])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)
    loadData()
  }, [loadData])

  function resetForm() {
    setLocation('')
    setDefectType('')
    setSubType('')
    setCustomSubType('')
    setLengthMm('')
    setHeightMm('')
    setDepthMm('')
    setQuantity('')
    setPhoto1(null)
    setPhoto2(null)
    setComments('')
  }

  function getRepairNumber(floor: number): string {
    const existingCount = defects.filter(
      (d) => d.drop === params.drop && d.floor === floor
    ).length
    return `${params.drop}.${floor}.${existingCount + 1}`
  }

  async function uploadPhoto(file: File, path: string): Promise<string | null> {
    const { error } = await getSupabase().storage
      .from('inspections')
      .upload(path, file, { upsert: true })

    if (error) return null

    const { data } = getSupabase().storage.from('inspections').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSaveDefect(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !inspection || selectedFloor === null || saving) return
    if (!location || !defectType || !photo1) return

    setSaving(true)

    try {
      const repairNumber = getRepairNumber(selectedFloor)
      const seq = defects.filter(
        (d) => d.drop === params.drop && d.floor === selectedFloor
      ).length + 1

      // Upload photos
      let photo1Url: string | null = null
      let photo2Url: string | null = null

      if (photo1) {
        const path = `inspections/${params.id}/${params.drop}_${selectedFloor}_${seq}_1.jpg`
        photo1Url = await uploadPhoto(photo1, path)
      }

      if (photo2) {
        const path = `inspections/${params.id}/${params.drop}_${selectedFloor}_${seq}_2.jpg`
        photo2Url = await uploadPhoto(photo2, path)
      }

      const resolvedSubType = defectType === 'Other' ? customSubType : subType

      const { error } = await getSupabase().from('facade_defects').insert({
        inspection_id: params.id,
        drop: params.drop,
        floor: selectedFloor,
        location,
        defect_type: defectType,
        sub_type: resolvedSubType || null,
        repair_number: repairNumber,
        length_mm: lengthMm ? parseFloat(lengthMm) : null,
        height_mm: heightMm ? parseFloat(heightMm) : null,
        depth_mm: depthMm ? parseFloat(depthMm) : null,
        quantity: quantity ? parseInt(quantity) : null,
        photo1_url: photo1Url,
        photo2_url: photo2Url,
        comments: comments || null,
        created_by: user.name,
      })

      if (error) {
        alert('Failed to save defect: ' + error.message)
        setSaving(false)
        return
      }

      resetForm()
      setSelectedFloor(null)
      await loadData()
    } catch {
      alert('Failed to save defect')
    }

    setSaving(false)
  }

  if (!user || loading || !inspection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-gray">
        <div className="w-8 h-8 border-3 border-navy border-t-orange rounded-full animate-spin" />
      </div>
    )
  }

  // Group defects by floor
  const defectsByFloor: Record<number, FacadeDefect[]> = {}
  for (const d of defects) {
    if (!defectsByFloor[d.floor]) defectsByFloor[d.floor] = []
    defectsByFloor[d.floor].push(d)
  }

  const subTypeOptions = SUB_TYPE_MAP[defectType] || []

  return (
    <div className="min-h-screen bg-light-gray">
      {/* Header */}
      <div className="bg-navy text-white px-4 py-4 flex items-center justify-between">
        <Link
          href={`/inspection/${params.id}`}
          className="text-white text-sm font-medium min-h-[48px] flex items-center"
        >
          &larr; Back
        </Link>
        <h1 className="text-lg font-bold">Drop {params.drop}</h1>
        <div className="w-12" />
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-4">
        {/* Building info */}
        <p className="text-sm text-gray-500 mb-4">
          {inspection.building_name} &middot; Drop {params.drop}
        </p>

        {/* Floor selector */}
        <h3 className="font-bold text-navy text-sm mb-2">Select Floor</h3>
        <div className="grid grid-cols-5 gap-2 mb-6">
          {Array.from({ length: inspection.floor_count }, (_, i) => {
            const floor = i + 1
            const floorDefectCount = defectsByFloor[floor]?.length || 0
            return (
              <button
                key={floor}
                onClick={() => {
                  if (selectedFloor === floor) {
                    setSelectedFloor(null)
                    resetForm()
                  } else {
                    setSelectedFloor(floor)
                    resetForm()
                  }
                }}
                className={`relative rounded-lg p-2 min-h-[48px] font-bold text-center ${
                  selectedFloor === floor
                    ? 'bg-orange text-white'
                    : 'bg-white text-navy shadow-sm'
                }`}
              >
                {floor}
                {floorDefectCount > 0 && selectedFloor !== floor && (
                  <span className="absolute -top-1 -right-1 bg-orange text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {floorDefectCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Defect entry form */}
        {selectedFloor !== null && (
          <form onSubmit={handleSaveDefect} className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <h3 className="font-bold text-navy text-base mb-3">
              New Defect &mdash; Floor {selectedFloor}
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Repair #: {getRepairNumber(selectedFloor)}
            </p>

            {/* Location */}
            <div className="mb-3">
              <label className="block text-sm font-semibold text-navy mb-1">Location *</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white min-h-[48px]"
              >
                <option value="">Select location</option>
                {inspection.relevant_locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Defect Type */}
            <div className="mb-3">
              <label className="block text-sm font-semibold text-navy mb-1">Defect Type *</label>
              <select
                value={defectType}
                onChange={(e) => {
                  setDefectType(e.target.value)
                  setSubType('')
                  setCustomSubType('')
                }}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white min-h-[48px]"
              >
                <option value="">Select defect type</option>
                {inspection.relevant_defect_types.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub Type */}
            {defectType && defectType !== 'Other' && subTypeOptions.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm font-semibold text-navy mb-1">Sub Type</label>
                <select
                  value={subType}
                  onChange={(e) => setSubType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white min-h-[48px]"
                >
                  <option value="">Select sub type</option>
                  {subTypeOptions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Other - free text */}
            {defectType === 'Other' && (
              <div className="mb-3">
                <label className="block text-sm font-semibold text-navy mb-1">Sub Type</label>
                <input
                  type="text"
                  value={customSubType}
                  onChange={(e) => setCustomSubType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white min-h-[48px]"
                  placeholder="Describe the defect"
                />
              </div>
            )}

            {/* Measurements */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Length (mm)</label>
                <input
                  type="number"
                  value={lengthMm}
                  onChange={(e) => setLengthMm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-white min-h-[48px]"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Height (mm)</label>
                <input
                  type="number"
                  value={heightMm}
                  onChange={(e) => setHeightMm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-white min-h-[48px]"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Depth (mm)</label>
                <input
                  type="number"
                  value={depthMm}
                  onChange={(e) => setDepthMm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-white min-h-[48px]"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-white min-h-[48px]"
                  placeholder="1"
                />
              </div>
            </div>

            {/* Photo 1 - required */}
            <div className="mb-3">
              <label className="block text-sm font-semibold text-navy mb-1">Photo 1 *</label>
              <input
                type="file"
                accept="image/*"
               
                required
                onChange={(e) => setPhoto1(e.target.files?.[0] || null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[48px]"
              />
            </div>

            {/* Photo 2 - optional */}
            <div className="mb-3">
              <label className="block text-sm font-semibold text-navy mb-1">Photo 2 (optional)</label>
              <input
                type="file"
                accept="image/*"
               
                onChange={(e) => setPhoto2(e.target.files?.[0] || null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[48px]"
              />
            </div>

            {/* Comments */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-navy mb-1">Comments</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-white"
                placeholder="Additional notes..."
              />
            </div>

            <button
              type="submit"
              disabled={saving || !location || !defectType || !photo1}
              className="w-full bg-orange text-white font-bold py-3 rounded-lg min-h-[48px] disabled:opacity-50 active:bg-orange-light"
            >
              {saving ? 'Saving...' : 'Save Defect'}
            </button>
          </form>
        )}

        {/* Existing defects */}
        <h3 className="font-bold text-navy text-sm mb-2">
          Defects ({defects.length})
        </h3>

        {defects.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            No defects recorded for this drop yet.
          </p>
        ) : (
          <div className="space-y-2 pb-6">
            {Object.entries(defectsByFloor)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([floor, floorDefects]) => (
                <div key={floor}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 mt-3">
                    Floor {floor}
                  </p>
                  {floorDefects.map((d) => (
                    <div
                      key={d.id}
                      className="bg-white rounded-lg shadow-sm p-3 mb-2 flex items-start gap-3"
                    >
                      {d.photo1_url && (
                        <img
                          src={d.photo1_url}
                          alt="Defect"
                          className="w-14 h-14 object-cover rounded-md flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-navy text-sm">
                          #{d.repair_number}
                        </p>
                        <p className="text-sm text-gray-700">
                          {d.defect_type}
                          {d.sub_type ? ` - ${d.sub_type}` : ''}
                        </p>
                        <p className="text-xs text-gray-500">{d.location}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
