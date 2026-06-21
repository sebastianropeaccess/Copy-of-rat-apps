'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser, Asset, AssetInspection, AssetAssignment } from '@/lib/types'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  available:  { label: 'Available',  bg: 'bg-green-100',  text: 'text-green-700' },
  assigned:   { label: 'Assigned',   bg: 'bg-blue-100',   text: 'text-blue-700' },
  on_job:     { label: 'On Job',     bg: 'bg-indigo-100', text: 'text-indigo-700' },
  in_service: { label: 'In Service', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  broken:     { label: 'Broken',     bg: 'bg-red-100',    text: 'text-red-700' },
  retired:    { label: 'Retired',    bg: 'bg-gray-100',   text: 'text-gray-500' },
  lost:       { label: 'Lost',       bg: 'bg-orange-100', text: 'text-orange-700' },
  quarantine: { label: 'Quarantine', bg: 'bg-purple-100', text: 'text-purple-700' },
}

const CATEGORY_LABELS: Record<string, string> = {
  rope_access_gear: 'Rope Access Gear',
  height_safety:    'Height Safety',
  tools:            'Tools',
  electrical:       'Electrical',
  consumables:      'Consumables',
  plant:            'Plant',
  vehicles:         'Vehicles',
  job_kits:         'Job Kits',
}

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  routine_ppe:  'Routine PPE',
  test_and_tag: 'Test & Tag',
  visual:       'Visual',
}

const RESULT_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pass:             { label: 'Pass',             bg: 'bg-green-100', text: 'text-green-700' },
  fail:             { label: 'Fail',             bg: 'bg-red-100',   text: 'text-red-700' },
  conditional_pass: { label: 'Conditional Pass', bg: 'bg-yellow-100', text: 'text-yellow-700' },
}

const ASSIGN_TYPE_LABELS: Record<string, string> = {
  person:           'Person',
  vehicle:          'Vehicle',
  storage_location: 'Location',
  job:              'Job',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isOverdue(nextDue: string | null) {
  if (!nextDue) return false
  return new Date(nextDue) < new Date()
}

export default function AssetDetailPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const [user, setUser] = useState<RatUser | null>(null)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [inspections, setInspections] = useState<AssetInspection[]>([])
  const [assignments, setAssignments] = useState<AssetAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    loadAll()
  }, [assetId])

  async function loadAll() {
    const [{ data: a }, { data: i }, { data: aa }] = await Promise.all([
      getSupabase().from('assets').select('*').eq('id', assetId).single(),
      getSupabase().from('asset_inspections').select('*').eq('asset_id', assetId).order('inspection_date', { ascending: false }),
      getSupabase().from('asset_assignments').select('*').eq('asset_id', assetId).order('checked_out_at', { ascending: false }),
    ])
    setAsset(a)
    setInspections(i || [])
    setAssignments(aa || [])
    setLoading(false)
  }

  async function handleCheckIn() {
    if (!asset || checkingIn) return
    const openAssignment = assignments.find(a => !a.checked_in_at)
    if (!openAssignment) return
    setCheckingIn(true)

    await Promise.all([
      getSupabase()
        .from('asset_assignments')
        .update({ checked_in_at: new Date().toISOString() })
        .eq('id', openAssignment.id),
      getSupabase()
        .from('assets')
        .update({ status: 'available', current_assignee_name: null })
        .eq('id', asset.id),
    ])

    setCheckingIn(false)
    await loadAll()
  }

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-light-gray gap-4">
        <div className="text-navy/50">Asset not found</div>
        <Link href="/assets" className="text-orange font-medium">Back to Assets</Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[asset.status] || STATUS_CONFIG.available
  const latestInspection = inspections[0] || null
  const openAssignment = assignments.find(a => !a.checked_in_at)
  const meta = asset.metadata as Record<string, unknown> | null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Link href="/assets" className="text-white/60 active:scale-95 transition-transform">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 19l-7-7 7-7"/>
              </svg>
            </Link>
            <div>
              <div className="text-lg font-bold text-white">{asset.item_number}</div>
              <div className="text-xs text-white/50">{asset.asset_type}</div>
            </div>
          </div>
          <Link
            href={`/assets/${asset.id}/edit`}
            className="px-4 py-2 bg-white/10 text-white text-sm font-medium rounded-xl active:scale-95 transition-all"
          >
            Edit
          </Link>
        </div>

        <div className="flex-1 px-4 py-4 pb-8 flex flex-col gap-4">
          {/* Status + category */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${sc.bg} ${sc.text}`}>
                {sc.label}
              </span>
              <span className="text-xs text-navy/40">{CATEGORY_LABELS[asset.category] || asset.category}</span>
            </div>

            {latestInspection?.next_due_date && isOverdue(latestInspection.next_due_date) && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                Inspection overdue — next due {formatDate(latestInspection.next_due_date)}
              </div>
            )}

            <div className="grid grid-cols-2 gap-y-3 text-sm">
              {[
                { label: 'Manufacturer', value: asset.manufacturer },
                { label: 'Model',        value: asset.model },
                { label: 'Serial No.',   value: asset.serial_number },
                { label: 'Date Manufactured', value: formatDate(asset.date_of_manufacture) },
                { label: 'Date Purchased',    value: formatDate(asset.date_of_purchase) },
                { label: 'First Use',         value: formatDate(asset.date_of_first_use) },
              ].map(row => row.value ? (
                <div key={row.label}>
                  <div className="text-[10px] text-navy/40 font-medium uppercase tracking-wide">{row.label}</div>
                  <div className="text-navy font-medium text-xs mt-0.5">{row.value}</div>
                </div>
              ) : null)}
            </div>

            {/* Metadata */}
            {meta && Object.keys(meta).length > 0 && (
              <div className="mt-3 pt-3 border-t border-navy/5 grid grid-cols-2 gap-y-3">
                {Object.entries(meta).map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[10px] text-navy/40 font-medium uppercase tracking-wide">{k.replace(/_/g, ' ')}</div>
                    <div className="text-navy font-medium text-xs mt-0.5">{String(v)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* NFC / barcode */}
            <div className="mt-3 pt-3 border-t border-navy/5 flex gap-4 text-xs">
              <div>
                <div className="text-[10px] text-navy/40 font-medium uppercase tracking-wide">NFC Tag</div>
                <div className={asset.nfc_tag_id ? 'text-navy font-medium mt-0.5' : 'text-navy/30 mt-0.5'}>
                  {asset.nfc_tag_id || 'Not assigned'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-navy/40 font-medium uppercase tracking-wide">Barcode</div>
                <div className={asset.barcode ? 'text-navy font-medium mt-0.5' : 'text-navy/30 mt-0.5'}>
                  {asset.barcode || 'Not assigned'}
                </div>
              </div>
            </div>

            {asset.comments && (
              <div className="mt-3 pt-3 border-t border-navy/5 text-xs text-navy/60">{asset.comments}</div>
            )}
          </div>

          {/* Current assignment */}
          {openAssignment && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-blue-800">Currently Assigned</div>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                  {ASSIGN_TYPE_LABELS[openAssignment.assigned_to_type]}
                </span>
              </div>
              <div className="text-base font-bold text-blue-900 mb-1">{openAssignment.assigned_to_name}</div>
              <div className="text-xs text-blue-600">Since {formatDate(openAssignment.checked_out_at)}</div>
              {openAssignment.notes && (
                <div className="text-xs text-blue-600 mt-1">{openAssignment.notes}</div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Link
              href={`/inspections/${asset.id}`}
              className="flex-1 bg-orange text-white text-center font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] flex items-center justify-center text-sm"
            >
              Log Inspection
            </Link>
            {openAssignment && (
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="flex-1 bg-green-500 text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] text-sm disabled:opacity-40"
              >
                {checkingIn ? 'Checking In...' : 'Check In'}
              </button>
            )}
            {!openAssignment && (
              <Link
                href="/assets/allocation"
                className="flex-1 bg-navy text-white text-center font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] flex items-center justify-center text-sm"
              >
                Assign
              </Link>
            )}
          </div>

          {/* Inspection history */}
          {inspections.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2">Inspection History</div>
              <div className="flex flex-col gap-2">
                {inspections.map(insp => {
                  const rc = RESULT_CONFIG[insp.result] || RESULT_CONFIG.pass
                  return (
                    <div key={insp.id} className="bg-white rounded-xl shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="text-xs font-semibold text-navy">
                            {INSPECTION_TYPE_LABELS[insp.inspection_type] || insp.inspection_type}
                          </div>
                          <div className="text-[10px] text-navy/40 mt-0.5">
                            {formatDate(insp.inspection_date)} · {insp.inspected_by}
                          </div>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${rc.bg} ${rc.text} shrink-0`}>
                          {rc.label}
                        </span>
                      </div>
                      {insp.next_due_date && (
                        <div className={`text-[10px] font-medium ${isOverdue(insp.next_due_date) ? 'text-red-600' : 'text-navy/50'}`}>
                          Next due: {formatDate(insp.next_due_date)}
                        </div>
                      )}
                      {insp.action_required && (
                        <div className="text-xs text-orange mt-1">Action: {insp.action_required}</div>
                      )}
                      {insp.comments && (
                        <div className="text-xs text-navy/50 mt-1">{insp.comments}</div>
                      )}
                      {insp.photo_urls && insp.photo_urls.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {insp.photo_urls.map((url, i) => (
                            <button key={i} onClick={() => setLightboxUrl(url)}>
                              <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-navy/10" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Assignment history */}
          {assignments.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2">Assignment History</div>
              <div className="flex flex-col gap-2">
                {assignments.map(a => (
                  <div key={a.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-navy">{a.assigned_to_name}</div>
                        <div className="text-[10px] text-navy/40 mt-0.5">
                          {ASSIGN_TYPE_LABELS[a.assigned_to_type]} · {formatDate(a.checked_out_at)}
                        </div>
                      </div>
                      {!a.checked_in_at ? (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium shrink-0">Active</span>
                      ) : (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium shrink-0">
                          Returned {formatDate(a.checked_in_at)}
                        </span>
                      )}
                    </div>
                    {a.notes && <div className="text-xs text-navy/50 mt-1">{a.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Photo lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  )
}
