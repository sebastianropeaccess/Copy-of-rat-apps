'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '../../../lib/supabase'
import { getStoredUser } from '../../../lib/helpers'
import type { RatUser, TeamMember } from '../../../lib/types'

const LOCATION_OPTIONS = [
  'Wall',
  'Window',
  'Slab End',
  'Soffit',
  'Column',
  'Parapet Wall',
  'Balcony',
  'Hub',
  'Rooftop',
  'Hob',
  'Upstand',
]

const DEFECT_TYPE_OPTIONS = [
  'Concrete',
  'Brick',
  'Joint Sealing',
  'Coatings',
  'Waterproofing',
  'Windows & Doors',
  'Other',
]

export default function NewInspectionPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [saving, setSaving] = useState(false)

  // Form state
  const [buildingName, setBuildingName] = useState('')
  const [dropCount, setDropCount] = useState('')
  const [floorCount, setFloorCount] = useState('')
  const [dropLabelling, setDropLabelling] = useState<'alpha' | 'numeric'>('alpha')
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedDefectTypes, setSelectedDefectTypes] = useState<string[]>([])
  const [dropPlanFile, setDropPlanFile] = useState<File | null>(null)
  const [selectedInspectors, setSelectedInspectors] = useState<string[]>([])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)
    loadTeamMembers()
  }, [])

  async function loadTeamMembers() {
    const { data } = await getSupabase()
      .from('team_members')
      .select('*')
      .eq('active', true)
    setTeamMembers(data || [])
  }

  function toggleItem(list: string[], item: string, setter: (v: string[]) => void) {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item))
    } else {
      setter([...list, item])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || saving) return
    if (!buildingName.trim() || !dropCount || !floorCount) return

    setSaving(true)

    try {
      // Create inspection record
      const { data: inspection, error } = await getSupabase()
        .from('facade_inspections')
        .insert({
          building_name: buildingName.trim(),
          drop_count: parseInt(dropCount),
          floor_count: parseInt(floorCount),
          drop_labelling: dropLabelling,
          relevant_locations: selectedLocations,
          relevant_defect_types: selectedDefectTypes,
          inspector_names: selectedInspectors,
          status: 'active',
          created_by: user.name,
        })
        .select()
        .single()

      if (error || !inspection) {
        alert('Failed to create inspection: ' + (error?.message || 'Unknown error'))
        setSaving(false)
        return
      }

      // Upload drop plan if provided
      if (dropPlanFile) {
        const path = `inspections/${inspection.id}/drop_plan.jpg`
        const { error: uploadError } = await getSupabase().storage
          .from('inspections')
          .upload(path, dropPlanFile, { upsert: true })

        if (!uploadError) {
          const { data: urlData } = getSupabase().storage
            .from('inspections')
            .getPublicUrl(path)

          await getSupabase()
            .from('facade_inspections')
            .update({ drop_plan_url: urlData.publicUrl })
            .eq('id', inspection.id)
        }
      }

      window.location.href = `/inspection/${inspection.id}`
    } catch {
      alert('Failed to create inspection')
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-gray">
        <div className="w-8 h-8 border-3 border-navy border-t-orange rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-light-gray">
      {/* Header */}
      <div className="bg-navy text-white px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => window.history.back()}
          className="text-white text-sm font-medium min-h-[48px] flex items-center"
        >
          &larr; Back
        </button>
        <h1 className="text-lg font-bold">New Inspection</h1>
        <div className="w-12" />
      </div>

      <form onSubmit={handleSubmit} className="max-w-[480px] mx-auto px-4 py-4 pb-8">
        {/* Building Name */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-navy mb-1">Building Name *</label>
          <input
            type="text"
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white min-h-[48px]"
            placeholder="Enter building name"
          />
        </div>

        {/* Drop Count */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-navy mb-1">Number of Drops *</label>
          <input
            type="number"
            value={dropCount}
            onChange={(e) => setDropCount(e.target.value)}
            required
            min={1}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white min-h-[48px]"
            placeholder="e.g. 12"
          />
        </div>

        {/* Floor Count */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-navy mb-1">Number of Floors *</label>
          <input
            type="number"
            value={floorCount}
            onChange={(e) => setFloorCount(e.target.value)}
            required
            min={1}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white min-h-[48px]"
            placeholder="e.g. 8"
          />
        </div>

        {/* Drop Labelling */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-navy mb-2">Drop Labelling</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 min-h-[48px] cursor-pointer">
              <input
                type="radio"
                name="dropLabelling"
                value="alpha"
                checked={dropLabelling === 'alpha'}
                onChange={() => setDropLabelling('alpha')}
                className="w-5 h-5 accent-orange"
              />
              <span className="text-base">Alpha (A, B, C...)</span>
            </label>
            <label className="flex items-center gap-2 min-h-[48px] cursor-pointer">
              <input
                type="radio"
                name="dropLabelling"
                value="numeric"
                checked={dropLabelling === 'numeric'}
                onChange={() => setDropLabelling('numeric')}
                className="w-5 h-5 accent-orange"
              />
              <span className="text-base">Numeric (1, 2, 3...)</span>
            </label>
          </div>
        </div>

        {/* Relevant Locations */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-navy mb-2">Relevant Locations</label>
          <div className="grid grid-cols-2 gap-2">
            {LOCATION_OPTIONS.map((loc) => (
              <label
                key={loc}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer min-h-[48px] ${
                  selectedLocations.includes(loc)
                    ? 'bg-orange/10 border-orange text-navy'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedLocations.includes(loc)}
                  onChange={() => toggleItem(selectedLocations, loc, setSelectedLocations)}
                  className="w-5 h-5 accent-orange"
                />
                <span className="text-sm">{loc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Relevant Defect Types */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-navy mb-2">Relevant Defect Types</label>
          <div className="grid grid-cols-2 gap-2">
            {DEFECT_TYPE_OPTIONS.map((dt) => (
              <label
                key={dt}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer min-h-[48px] ${
                  selectedDefectTypes.includes(dt)
                    ? 'bg-orange/10 border-orange text-navy'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDefectTypes.includes(dt)}
                  onChange={() => toggleItem(selectedDefectTypes, dt, setSelectedDefectTypes)}
                  className="w-5 h-5 accent-orange"
                />
                <span className="text-sm">{dt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Drop Plan Upload */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-navy mb-1">Drop Plan (Image)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setDropPlanFile(e.target.files?.[0] || null)}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white min-h-[48px]"
          />
          {dropPlanFile && (
            <p className="text-xs text-gray-500 mt-1">{dropPlanFile.name}</p>
          )}
        </div>

        {/* Inspector Names */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-navy mb-2">Inspectors</label>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-gray-500">Loading team members...</p>
          ) : (
            <div className="space-y-2">
              {teamMembers.map((tm) => (
                <label
                  key={tm.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer min-h-[48px] ${
                    selectedInspectors.includes(tm.name)
                      ? 'bg-orange/10 border-orange text-navy'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedInspectors.includes(tm.name)}
                    onChange={() => toggleItem(selectedInspectors, tm.name, setSelectedInspectors)}
                    className="w-5 h-5 accent-orange"
                  />
                  <span className="text-base">{tm.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || !buildingName.trim() || !dropCount || !floorCount}
          className="w-full bg-orange text-white font-bold py-3 rounded-lg min-h-[48px] disabled:opacity-50 active:bg-orange-light"
        >
          {saving ? 'Creating...' : 'Create Inspection'}
        </button>
      </form>
    </div>
  )
}
