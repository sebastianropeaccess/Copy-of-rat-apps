'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { Asset, AssetStatus } from '@/lib/types'

const STATUSES: { value: AssetStatus; label: string }[] = [
  { value: 'available',   label: 'Available' },
  { value: 'assigned',    label: 'Assigned' },
  { value: 'on_job',      label: 'On Job' },
  { value: 'in_service',  label: 'In Service' },
  { value: 'broken',      label: 'Broken' },
  { value: 'retired',     label: 'Retired' },
  { value: 'lost',        label: 'Lost' },
  { value: 'quarantine',  label: 'Quarantine' },
]

const METADATA_FIELDS: Record<string, { key: string; label: string; type: 'text' | 'number' }[]> = {
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
    { key: 'voltage', label: 'Voltage', type: 'text' },
    { key: 'wattage', label: 'Wattage', type: 'number' },
  ],
  electrical: [
    { key: 'voltage',  label: 'Voltage',   type: 'text' },
    { key: 'amperage', label: 'Amperage',  type: 'number' },
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

export default function EditAssetPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const router = useRouter()
  const user = getStoredUser()

  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form fields
  const [itemNumber, setItemNumber] = useState('')
  const [assetType, setAssetType] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [status, setStatus] = useState<AssetStatus>('available')
  const [dateOfManufacture, setDateOfManufacture] = useState('')
  const [dateOfPurchase, setDateOfPurchase] = useState('')
  const [dateOfFirstUse, setDateOfFirstUse] = useState('')
  const [dateOfRetirement, setDateOfRetirement] = useState('')
  const [nfcTagId, setNfcTagId] = useState('')
  const [barcode, setBarcode] = useState('')
  const [comments, setComments] = useState('')
  const [metadata, setMetadata] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!user) { window.location.href = '/login'; return }
    loadAsset()
  }, [assetId])

  async function loadAsset() {
    const { data } = await getSupabase().from('assets').select('*').eq('id', assetId).single()
    if (!data) { setLoading(false); return }
    setAsset(data)
    setItemNumber(data.item_number)
    setAssetType(data.asset_type)
    setManufacturer(data.manufacturer || '')
    setModel(data.model || '')
    setSerialNumber(data.serial_number || '')
    setStatus(data.status)
    setDateOfManufacture(data.date_of_manufacture || '')
    setDateOfPurchase(data.date_of_purchase || '')
    setDateOfFirstUse(data.date_of_first_use || '')
    setDateOfRetirement(data.date_of_retirement || '')
    setNfcTagId(data.nfc_tag_id || '')
    setBarcode(data.barcode || '')
    setComments(data.comments || '')
    const meta = data.metadata as Record<string, unknown> | null
    if (meta) {
      const stringified: Record<string, string> = {}
      for (const [k, v] of Object.entries(meta)) stringified[k] = String(v)
      setMetadata(stringified)
    }
    setLoading(false)
  }

  function setMeta(key: string, value: string) {
    setMetadata(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!asset || saving || !itemNumber.trim()) return
    setSaving(true)

    const metaFields = METADATA_FIELDS[asset.category] || []
    const metadataObj: Record<string, unknown> = {}
    for (const field of metaFields) {
      const val = metadata[field.key]
      if (val) metadataObj[field.key] = field.type === 'number' ? parseFloat(val) : val
    }

    const { error } = await getSupabase()
      .from('assets')
      .update({
        item_number: itemNumber.trim(),
        asset_type: assetType,
        manufacturer: manufacturer.trim() || null,
        model: model.trim() || null,
        serial_number: serialNumber.trim() || null,
        status,
        date_of_manufacture: dateOfManufacture || null,
        date_of_purchase: dateOfPurchase || null,
        date_of_first_use: dateOfFirstUse || null,
        date_of_retirement: dateOfRetirement || null,
        nfc_tag_id: nfcTagId.trim() || null,
        barcode: barcode.trim() || null,
        comments: comments.trim() || null,
        metadata: Object.keys(metadataObj).length > 0 ? metadataObj : null,
      })
      .eq('id', assetId)

    setSaving(false)
    if (error) { alert('Failed to save: ' + error.message); return }
    router.push(`/assets/${assetId}`)
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    await getSupabase().from('assets').delete().eq('id', assetId)
    setDeleting(false)
    router.push('/assets')
  }

  if (!user) return null
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!asset) return null

  const metaFields = METADATA_FIELDS[asset.category] || []

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
          <div className="text-lg font-bold text-white">Edit Asset</div>
        </div>

        <div className="flex-1 px-4 py-4 pb-32 flex flex-col gap-4">
          {/* Item Number */}
          <div>
            <label className="block text-xs font-medium text-navy/70 mb-1">Item Number *</label>
            <input
              type="text"
              value={itemNumber}
              onChange={e => setItemNumber(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
            />
          </div>

          {/* Asset type */}
          <div>
            <label className="block text-xs font-medium text-navy/70 mb-1">Asset Type</label>
            <input
              type="text"
              value={assetType}
              onChange={e => setAssetType(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={`py-3 px-3 rounded-xl text-sm font-medium min-h-[44px] transition-all ${
                    status === s.value
                      ? 'bg-navy text-white'
                      : 'bg-white text-navy border border-navy/10 active:scale-95'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Make / Model / Serial */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-navy/70 mb-1">Manufacturer</label>
              <input
                type="text"
                value={manufacturer}
                onChange={e => setManufacturer(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy/70 mb-1">Model</label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
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
              className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
            />
          </div>

          {/* Metadata */}
          {metaFields.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Specifications</label>
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
            </div>
          )}

          {/* Dates */}
          <div>
            <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Dates</label>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Date of Manufacture', value: dateOfManufacture, set: setDateOfManufacture },
                { label: 'Date of Purchase',    value: dateOfPurchase,    set: setDateOfPurchase },
                { label: 'Date of First Use',   value: dateOfFirstUse,    set: setDateOfFirstUse },
                { label: 'Date of Retirement',  value: dateOfRetirement,  set: setDateOfRetirement },
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

          {/* NFC / Barcode */}
          <div>
            <label className="block text-xs font-semibold text-navy/70 uppercase tracking-wide mb-2">Scanning (Future)</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-navy/70 mb-1">NFC Tag ID</label>
                <input
                  type="text"
                  value={nfcTagId}
                  onChange={e => setNfcTagId(e.target.value)}
                  placeholder="Not assigned"
                  className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-navy/70 mb-1">Barcode</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder="Not assigned"
                  className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                />
              </div>
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-xs font-medium text-navy/70 mb-1">Comments</label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 resize-none"
            />
          </div>

          {/* Delete */}
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full py-3 rounded-xl border-2 border-red-200 text-red-500 font-medium text-sm min-h-[48px] active:scale-95 transition-all mt-2"
          >
            Delete Asset
          </button>
        </div>

        {/* Save button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-gray/90 backdrop-blur-sm">
          <div className="max-w-[480px] mx-auto">
            <button
              onClick={handleSave}
              disabled={saving || !itemNumber.trim()}
              className="w-full bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100 text-sm"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 max-w-[360px] w-full shadow-xl">
            <div className="text-base font-semibold text-navy mb-2">Delete Asset?</div>
            <div className="text-sm text-navy/60 mb-4">
              This will permanently delete this asset, all its inspections, and all assignment records. This cannot be undone.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-light-gray text-navy font-semibold py-3 rounded-xl border border-navy/10 active:scale-95 transition-all min-h-[48px] text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white font-semibold py-3 rounded-xl active:scale-95 transition-all min-h-[48px] text-sm disabled:opacity-40"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
