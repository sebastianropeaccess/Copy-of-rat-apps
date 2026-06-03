'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { AssetCategory } from '@/lib/types'

const CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: 'rope_access_gear', label: 'Rope Access Gear' },
  { value: 'height_safety',    label: 'Height Safety' },
  { value: 'tools',            label: 'Tools' },
  { value: 'electrical',       label: 'Electrical' },
  { value: 'consumables',      label: 'Consumables' },
  { value: 'plant',            label: 'Plant' },
  { value: 'vehicles',         label: 'Vehicles' },
  { value: 'job_kits',         label: 'Job Kits' },
]

const ASSET_TYPES: Record<AssetCategory, string[]> = {
  rope_access_gear: ['Harness', 'Helmet', 'Rope', 'Descender', 'Ascender', 'Lanyard', 'Karabiner', 'Pulley', 'Rigging Plate', 'Chest Harness', 'Croll', 'Hand Ascender', 'Foot Loop', 'Bag', 'Other'],
  height_safety:    ['Anchor Point', 'Self-Retracting Lifeline', 'Energy Absorber', 'Fall Arrest Block', 'Inertia Reel', 'Safety Net', 'Davit Arm', 'Other'],
  tools:            ['Angle Grinder', 'Drill', 'Impact Driver', 'Circular Saw', 'Hammer', 'Chisel Set', 'Caulking Gun', 'Pressure Washer', 'Heat Gun', 'Wire Brush', 'Other'],
  electrical:       ['Extension Cord', 'Transformer', 'RCD', 'Power Board', 'Cable Reel', 'Other'],
  consumables:      ['Rope Bag', 'Sling', 'Tape', 'Fixings', 'Other'],
  plant:            ['EWP', 'Scaffold', 'Hoist', 'Generator', 'Other'],
  vehicles:         ['Van', 'Truck', 'Ute', 'Trailer', 'Other'],
  job_kits:         ['Job Kit'],
}

const METADATA_FIELDS: Partial<Record<AssetCategory, { key: string; label: string; type: 'text' | 'number' }[]>> = {
  rope_access_gear: [
    { key: 'size',     label: 'Size',      type: 'text' },
    { key: 'colour',   label: 'Colour',    type: 'text' },
    { key: 'length_m', label: 'Length (m)', type: 'number' },
  ],
  height_safety: [
    { key: 'length_m',    label: 'Length (m)',    type: 'number' },
    { key: 'capacity_kg', label: 'Capacity (kg)', type: 'number' },
  ],
  tools: [
    { key: 'voltage',  label: 'Voltage',  type: 'text' },
    { key: 'wattage',  label: 'Wattage',  type: 'number' },
  ],
  electrical: [
    { key: 'voltage',  label: 'Voltage',  type: 'text' },
    { key: 'amperage', label: 'Amperage', type: 'number' },
    { key: 'length_m', label: 'Length (m)', type: 'number' },
  ],
  vehicles: [
    { key: 'rego',   label: 'Registration', type: 'text' },
    { key: 'colour', label: 'Colour',       type: 'text' },
  ],
  plant: [
    { key: 'capacity', label: 'Capacity', type: 'text' },
  ],
}

export default function NewAssetPage() {
  const router = useRouter()
  const user = getStoredUser()

  const [category, setCategory] = useState<AssetCategory | null>(null)
  const [assetType, setAssetType] = useState('')
  const [itemNumber, setItemNumber] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [dateOfManufacture, setDateOfManufacture] = useState('')
  const [dateOfPurchase, setDateOfPurchase] = useState('')
  const [dateOfFirstUse, setDateOfFirstUse] = useState('')
  const [comments, setComments] = useState('')
  const [metadata, setMetadata] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return null
  }

  const metaFields = category ? (METADATA_FIELDS[category] || []) : []
  const typeOptions = category ? ASSET_TYPES[category] : []

  function setMeta(key: string, value: string) {
    setMetadata(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!category || !assetType || !itemNumber.trim() || saving) return
    setSaving(true)

    const metadataObj: Record<string, unknown> = {}
    for (const field of metaFields) {
      const val = metadata[field.key]
      if (val) {
        metadataObj[field.key] = field.type === 'number' ? parseFloat(val) : val
      }
    }

    const { data, error } = await getSupabase()
      .from('assets')
      .insert({
        item_number: itemNumber.trim(),
        asset_type: assetType,
        category,
        manufacturer: manufacturer.trim() || null,
        model: model.trim() || null,
        serial_number: serialNumber.trim() || null,
        date_of_manufacture: dateOfManufacture || null,
        date_of_purchase: dateOfPurchase || null,
        date_of_first_use: dateOfFirstUse || null,
        comments: comments.trim() || null,
        metadata: Object.keys(metadataObj).length > 0 ? metadataObj : null,
        status: 'available',
        created_by: user!.name,
      })
      .select()
      .single()

    setSaving(false)
    if (error || !data) {
      alert('Failed to save: ' + (error?.message || 'Unknown error'))
      return
    }
    router.push(`/assets/${data.id}`)
  }

  const canSave = !!category && !!assetType && !!itemNumber.trim()

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
          <div className="text-lg font-bold text-white">New Asset</div>
        </div>

        <div className="flex-1 px-4 py-4 pb-32 flex flex-col gap-4">
          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Category *</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => { setCategory(c.value); setAssetType('') }}
                  className={`py-3 px-3 rounded-xl text-sm font-medium min-h-[48px] text-left transition-all ${
                    category === c.value
                      ? 'bg-navy text-white'
                      : 'bg-white text-navy border border-navy/10 active:scale-95'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Asset Type */}
          {category && (
            <div>
              <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Asset Type *</label>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map(t => (
                  <button
                    key={t}
                    onClick={() => setAssetType(t)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium min-h-[40px] transition-all ${
                      assetType === t
                        ? 'bg-orange text-white'
                        : 'bg-white text-navy border border-navy/10 active:scale-95'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Core fields */}
          {category && assetType && (
            <>
              <div>
                <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Item Number *</label>
                <input
                  type="text"
                  value={itemNumber}
                  onChange={e => setItemNumber(e.target.value)}
                  placeholder="e.g. HAR-001"
                  className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-navy/70 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={e => setManufacturer(e.target.value)}
                    placeholder="e.g. Petzl"
                    className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/70 mb-1">Model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder="e.g. Avao Bod"
                    className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-navy/70 mb-1">Serial Number</label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={e => setSerialNumber(e.target.value)}
                  placeholder="Manufacturer serial"
                  className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                />
              </div>

              {/* Metadata fields */}
              {metaFields.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {metaFields.map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-navy/70 mb-1">{f.label}</label>
                      <input
                        type={f.type === 'number' ? 'number' : 'text'}
                        value={metadata[f.key] || ''}
                        onChange={e => setMeta(f.key, e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                        step={f.type === 'number' ? '0.1' : undefined}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Dates */}
              <div>
                <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Dates</label>
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Date of Manufacture', value: dateOfManufacture, set: setDateOfManufacture },
                    { label: 'Date of Purchase',    value: dateOfPurchase,    set: setDateOfPurchase },
                    { label: 'Date of First Use',   value: dateOfFirstUse,   set: setDateOfFirstUse },
                  ].map(d => (
                    <div key={d.label}>
                      <label className="block text-xs font-medium text-navy/70 mb-1">{d.label}</label>
                      <input
                        type="date"
                        value={d.value}
                        onChange={e => d.set(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-navy/70 mb-1">Comments</label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  rows={3}
                  placeholder="Any notes about this asset"
                  className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 resize-none"
                />
              </div>
            </>
          )}
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
              ) : 'Save Asset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
