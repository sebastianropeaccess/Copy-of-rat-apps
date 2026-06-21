'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser, getAllocationQueue, setAllocationQueue } from '@/lib/helpers'
import type { RatUser, Asset } from '@/lib/types'

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

// Open assignment info per asset id: when is it due back?
type OpenInfo = { expected_return_date: string | null }

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

export default function AllocationBuildPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [queue, setQueue] = useState<Asset[]>([])
  const [openMap, setOpenMap] = useState<Record<string, OpenInfo>>({})

  // Add-by-ID modal
  const [showIdModal, setShowIdModal] = useState(false)
  const [idInput, setIdInput] = useState('')
  const [looking, setLooking] = useState(false)
  const [lookupError, setLookupError] = useState('')

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    setQueue(getAllocationQueue())
  }, [])

  // Persist queue to localStorage on every change so a closed app keeps the list.
  const persist = useCallback((next: Asset[]) => {
    setQueue(next)
    setAllocationQueue(next)
  }, [])

  // Look up which queued assets are currently out, and when they're due back.
  useEffect(() => {
    if (queue.length === 0) { setOpenMap({}); return }
    let cancelled = false
    ;(async () => {
      const { data } = await getSupabase()
        .from('asset_assignments')
        .select('asset_id, expected_return_date')
        .in('asset_id', queue.map(a => a.id))
        .is('checked_in_at', null)
      if (cancelled) return
      const map: Record<string, OpenInfo> = {}
      for (const row of (data || []) as { asset_id: string; expected_return_date: string | null }[]) {
        map[row.asset_id] = { expected_return_date: row.expected_return_date }
      }
      setOpenMap(map)
    })()
    return () => { cancelled = true }
  }, [queue])

  function addAsset(asset: Asset) {
    if (queue.find(a => a.id === asset.id)) return
    persist([...queue, asset])
  }

  function removeAsset(id: string) {
    persist(queue.filter(a => a.id !== id))
  }

  async function lookupById() {
    const q = idInput.trim()
    if (!q || looking) return
    setLooking(true)
    setLookupError('')
    const { data } = await getSupabase()
      .from('assets')
      .select('*')
      .or(`item_number.ilike.${q},serial_number.ilike.${q},barcode.eq.${q},nfc_tag_id.eq.${q}`)
      .not('status', 'in', '("retired","lost")')
      .limit(1)
    setLooking(false)
    const found = (data || [])[0] as Asset | undefined
    if (!found) { setLookupError(`No asset found for "${q}"`); return }
    if (queue.find(a => a.id === found.id)) { setLookupError('Already in the list'); return }
    addAsset(found)
    setIdInput('')
    setShowIdModal(false)
  }

  if (!user) return null

  const availableCount = queue.filter(a => !openMap[a.id]).length
  const unavailableCount = queue.length - availableCount

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Link href="/assets" className="text-white/60 active:scale-95 transition-transform">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="text-lg font-bold text-white">Asset Allocation</div>
              <div className="text-xs text-white/50">Build your list</div>
            </div>
          </div>
          {/* Scan — UI only, disabled for now */}
          <button
            disabled
            title="Scan (coming soon)"
            className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl text-white/30 cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M15 3h4a2 2 0 012 2v4M15 21h4a2 2 0 002-2v-4" />
              <path d="M3 12h18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-4 py-4 pb-28 flex flex-col gap-4">
          {/* Two add buttons */}
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => { setShowIdModal(true); setLookupError(''); setIdInput('') }}
              className="bg-white border border-navy/10 rounded-xl px-5 py-4 flex items-center gap-3 active:scale-[0.98] transition-all min-h-[64px]"
            >
              <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center text-navy shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9v6M11 9v6M15 9v6" />
                </svg>
              </div>
              <span className="font-semibold text-navy text-sm">Add asset via ID typing</span>
            </button>

            <Link href="/assets/allocation/search">
              <div className="bg-white border border-navy/10 rounded-xl px-5 py-4 flex items-center gap-3 active:scale-[0.98] transition-all min-h-[64px]">
                <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center text-navy shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                </div>
                <span className="font-semibold text-navy text-sm">Search Asset from List</span>
              </div>
            </Link>
          </div>

          {/* List of assets to be assigned */}
          <div>
            <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2">
              List of assets to be assigned ({queue.length})
            </div>

            {queue.length === 0 ? (
              <div className="text-center py-12 text-navy/40 text-sm">
                No assets yet — add by ID or search the list.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {queue.map(asset => {
                  const sc = STATUS_CONFIG[asset.status] || STATUS_CONFIG.available
                  const open = openMap[asset.id]
                  const unavailable = !!open
                  let unavailableText = ''
                  if (unavailable) {
                    if (open.expected_return_date) {
                      const d = daysUntil(open.expected_return_date)
                      unavailableText = d > 0
                        ? `Asset Not Available till ${d} day${d !== 1 ? 's' : ''}`
                        : 'Asset Not Available (return overdue)'
                    } else {
                      unavailableText = 'Asset Not Available (no return date set)'
                    }
                  }
                  return (
                    <div
                      key={asset.id}
                      className={`rounded-xl shadow-sm px-4 py-3 flex items-center justify-between gap-2 ${
                        unavailable ? 'bg-gray-100 opacity-60' : 'bg-white'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-navy text-sm">
                          {asset.item_number}
                          <span className="font-normal text-navy/50"> · {asset.asset_type}</span>
                        </div>
                        {(asset.manufacturer || asset.model) && (
                          <div className="text-xs text-navy/40 mt-0.5">
                            {[asset.manufacturer, asset.model].filter(Boolean).join(' ')}
                          </div>
                        )}
                        {unavailable && (
                          <div className="text-xs font-semibold text-red-500 mt-1">{unavailableText}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                          {sc.label}
                        </span>
                        <button
                          onClick={() => removeAsset(asset.id)}
                          className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-400 rounded-full active:scale-95 transition-all text-lg leading-none"
                        >×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {unavailableCount > 0 && (
              <div className="mt-2 text-xs text-navy/50">
                {unavailableCount} unavailable item{unavailableCount !== 1 ? 's' : ''} will be skipped on assign.
              </div>
            )}
          </div>
        </div>

        {/* Assign this List */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-gray/90 backdrop-blur-sm">
          <div className="max-w-[480px] mx-auto">
            <Link
              href={availableCount > 0 ? '/assets/allocation/assign' : '#'}
              className={`block ${availableCount === 0 ? 'pointer-events-none' : ''}`}
            >
              <div
                className={`w-full text-center font-semibold py-3 rounded-xl transition-all duration-150 min-h-[48px] flex items-center justify-center text-sm ${
                  availableCount > 0
                    ? 'bg-orange text-white active:scale-95'
                    : 'bg-orange/40 text-white'
                }`}
              >
                {availableCount > 0
                  ? `Assign this List (${availableCount} item${availableCount !== 1 ? 's' : ''})`
                  : 'Add available assets to assign'}
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Add-by-ID modal */}
      {showIdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-[400px] w-full shadow-xl">
            <div className="text-base font-semibold text-navy mb-1">Add asset by ID</div>
            <div className="text-xs text-navy/50 mb-3">Type the item number, serial, or barcode.</div>
            <input
              autoFocus
              type="text"
              value={idInput}
              onChange={e => { setIdInput(e.target.value); setLookupError('') }}
              onKeyDown={e => { if (e.key === 'Enter') lookupById() }}
              placeholder="e.g. HAR-001"
              className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-white text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
            />
            {lookupError && <div className="text-xs text-red-500 mt-2 font-medium">{lookupError}</div>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowIdModal(false)}
                className="flex-1 bg-light-gray text-navy font-semibold py-3 rounded-xl border border-navy/10 active:scale-95 transition-all min-h-[48px] text-sm"
              >
                Cancel
              </button>
              <button
                onClick={lookupById}
                disabled={!idInput.trim() || looking}
                className="flex-1 bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all min-h-[48px] text-sm disabled:opacity-40"
              >
                {looking ? 'Looking…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
