'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '../../lib/supabase'
import { getStoredUser } from '../../lib/helpers'
import type { RatUser, GearItem, GearInspection } from '../../lib/types'

function getInspectionStatus(inspections: GearInspection[]): { label: string; color: string } {
  if (inspections.length === 0) return { label: 'No Inspection', color: 'bg-gray-200 text-gray-600' }
  const latest = inspections.sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0]
  if (latest.result === 'Fail') return { label: 'Failed', color: 'bg-red-100 text-red-700' }
  const months = (Date.now() - new Date(latest.inspected_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
  if (months > 6) return { label: 'Overdue', color: 'bg-red-100 text-red-700' }
  if (months > 5) return { label: 'Due Soon', color: 'bg-yellow-100 text-yellow-700' }
  return { label: 'Current', color: 'bg-green-100 text-green-700' }
}

async function scanNFC(): Promise<string | null> {
  if (!('NDEFReader' in window)) return null
  try {
    const ndef = new (window as any).NDEFReader()
    await ndef.scan()
    return new Promise((resolve) => {
      ndef.addEventListener('reading', (event: any) => {
        resolve(event.serialNumber as string)
      })
    })
  } catch {
    return null
  }
}

export default function GearListPage() {
  const router = useRouter()
  const [user, setUser] = useState<RatUser | null>(null)
  const [items, setItems] = useState<(GearItem & { gear_inspections: GearInspection[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [showScan, setShowScan] = useState(false)
  const [scanSerial, setScanSerial] = useState('')
  const [nfcSupported, setNfcSupported] = useState(false)
  const [nfcScanning, setNfcScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    setNfcSupported('NDEFReader' in window)

    async function load() {
      const { data } = await getSupabase()
        .from('gear_items')
        .select('*, gear_inspections(*)')
        .eq('team_member_name', stored!.name)
        .order('gear_type')

      if (data) setItems(data as (GearItem & { gear_inspections: GearInspection[] })[])
      setLoading(false)
    }
    load()
  }, [])

  async function handleSerialLookup() {
    if (!scanSerial.trim()) return
    setScanError('')
    const { data } = await getSupabase()
      .from('gear_items')
      .select('id')
      .eq('gear_id', scanSerial.trim())
      .maybeSingle()

    if (data) {
      setShowScan(false)
      router.push(`/gear/${data.id}`)
    } else {
      setScanError(`No gear found with serial "${scanSerial.trim()}"`)
    }
  }

  async function handleNfcScan() {
    setNfcScanning(true)
    setScanError('')
    const uid = await scanNFC()
    setNfcScanning(false)
    if (!uid) { setScanError('NFC scan failed or was cancelled'); return }

    const { data } = await getSupabase()
      .from('gear_items')
      .select('id')
      .eq('nfc_uid', uid)
      .maybeSingle()

    if (data) {
      setShowScan(false)
      router.push(`/gear/${data.id}`)
    } else {
      setScanError(`No gear linked to this NFC tag (UID: ${uid})`)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60 active:scale-95 transition-transform">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
            </Link>
            <div>
              <div className="text-lg font-bold text-white">My Gear</div>
              <div className="text-xs text-white/50">{user.name}</div>
            </div>
          </div>
          <div className="flex gap-2">
            {user.can_generate_reports && (
              <Link href="/gear/batch"
                className="text-white/60 text-sm px-3 py-2 rounded-xl bg-white/10 active:scale-95 transition-all duration-150 min-h-[48px] flex items-center">
                Batch Inspect
              </Link>
            )}
            {user.can_view_all_data && (
              <Link href="/gear/all"
                className="text-white/60 text-sm px-3 py-2 rounded-xl bg-white/10 active:scale-95 transition-all duration-150 min-h-[48px] flex items-center">
                All Gear
              </Link>
            )}
            <Link href="/gear/add"
              className="bg-orange text-white text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] flex items-center">
              + Add
            </Link>
          </div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-navy/40">No gear registered</div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map(item => {
                const status = getInspectionStatus(item.gear_inspections || [])
                return (
                  <Link key={item.id} href={`/gear/${item.id}`}>
                    <div className="bg-white rounded-xl p-4 shadow-sm active:scale-95 transition-all duration-150">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold text-navy text-sm">{item.gear_type}</div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                      </div>
                      <div className="text-xs text-navy/50">{item.gear_id}</div>
                      <div className="text-xs text-navy/40 mt-0.5">{item.manufacturer} {item.model}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Floating Scan FAB */}
        <button
          onClick={() => { setShowScan(true); setScanSerial(''); setScanError('') }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-orange text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-all duration-150 z-40"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>

        {/* Scan Modal */}
        {showScan && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
            <div className="w-full max-w-[480px] bg-white rounded-t-2xl p-5 pb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-bold text-navy">Scan Gear</div>
                <button onClick={() => setShowScan(false)} className="text-navy/40 p-2 min-h-[48px] min-w-[48px] flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy/60 mb-1">Serial Number / Gear ID</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={scanSerial}
                      onChange={e => setScanSerial(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSerialLookup()}
                      placeholder="Type or scan serial..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[48px]"
                      autoFocus
                    />
                    <button
                      onClick={handleSerialLookup}
                      className="bg-orange text-white font-semibold px-4 rounded-xl text-sm active:scale-95 transition-all duration-150 min-h-[48px]"
                    >
                      Go
                    </button>
                  </div>
                </div>

                {nfcSupported && (
                  <button
                    onClick={handleNfcScan}
                    disabled={nfcScanning}
                    className="w-full py-3 rounded-xl text-sm font-semibold bg-navy text-white active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[48px] flex items-center justify-center gap-2"
                  >
                    {nfcScanning ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Hold phone near tag...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" /><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" />
                          <path d="M12.91 4.1a16.1 16.1 0 0 1 0 15.8" /><path d="M16.37 2a20.43 20.43 0 0 1 0 20" />
                        </svg>
                        Scan NFC Tag
                      </>
                    )}
                  </button>
                )}

                {scanError && (
                  <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{scanError}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
