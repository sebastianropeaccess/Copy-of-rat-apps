'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../../lib/supabase'
import { getStoredUser } from '../../../lib/helpers'
import type { RatUser, GearItem } from '../../../lib/types'

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

interface InspectionResult {
  gearId: string
  gearType: string
  result: 'Pass' | 'Fail'
}

export default function BatchInspectionPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [nfcSupported, setNfcSupported] = useState(false)
  const [nfcScanning, setNfcScanning] = useState(false)

  const [serialInput, setSerialInput] = useState('')
  const [currentItem, setCurrentItem] = useState<GearItem | null>(null)
  const [lookupError, setLookupError] = useState('')

  const [inspResult, setInspResult] = useState<'Pass' | 'Fail'>('Pass')
  const [inspNotes, setInspNotes] = useState('')
  const [inspPhoto, setInspPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const [completed, setCompleted] = useState<InspectionResult[]>([])
  const [showSummary, setShowSummary] = useState(false)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    if (!stored.can_generate_reports) { window.location.href = '/gear'; return }
    setUser(stored)
    setNfcSupported('NDEFReader' in window)
  }, [])

  async function lookupSerial() {
    if (!serialInput.trim()) return
    setLookupError('')

    const { data } = await getSupabase()
      .from('gear_items')
      .select('*')
      .eq('gear_id', serialInput.trim())
      .maybeSingle()

    if (data) {
      setCurrentItem(data)
      setSerialInput('')
      setInspResult('Pass')
      setInspNotes('')
      setInspPhoto(null)
    } else {
      setLookupError(`No gear found with serial "${serialInput.trim()}"`)
    }
  }

  async function handleNfcScan() {
    setNfcScanning(true)
    setLookupError('')
    const uid = await scanNFC()
    setNfcScanning(false)
    if (!uid) { setLookupError('NFC scan failed'); return }

    const { data } = await getSupabase()
      .from('gear_items')
      .select('*')
      .eq('nfc_uid', uid)
      .maybeSingle()

    if (data) {
      setCurrentItem(data)
      setSerialInput('')
      setInspResult('Pass')
      setInspNotes('')
      setInspPhoto(null)
    } else {
      setLookupError(`No gear linked to this NFC tag (UID: ${uid})`)
    }
  }

  async function handleSaveAndNext() {
    if (!user || !currentItem) return
    setSaving(true)

    let photoUrl: string | null = null
    if (inspPhoto) {
      const timestamp = Date.now()
      const path = `gear-inspections/${currentItem.id}/${timestamp}.jpg`
      const { error: uploadError } = await getSupabase().storage
        .from('gear-inspections')
        .upload(path, inspPhoto, { contentType: inspPhoto.type })

      if (!uploadError) {
        const { data: urlData } = getSupabase().storage
          .from('gear-inspections')
          .getPublicUrl(path)
        photoUrl = urlData.publicUrl
      }
    }

    const { error } = await getSupabase()
      .from('gear_inspections')
      .insert({
        gear_item_id: currentItem.id,
        inspected_by: user.name,
        result: inspResult,
        photo_url: photoUrl,
        notes: inspNotes.trim() || null,
      })

    if (!error) {
      setCompleted(prev => [...prev, {
        gearId: currentItem.gear_id,
        gearType: currentItem.gear_type,
        result: inspResult,
      }])
      setCurrentItem(null)
      setInspResult('Pass')
      setInspNotes('')
      setInspPhoto(null)
    }
    setSaving(false)
  }

  if (!user) return null

  const passCount = completed.filter(c => c.result === 'Pass').length
  const failCount = completed.filter(c => c.result === 'Fail').length

  if (showSummary) {
    return (
      <div className="flex flex-col min-h-screen bg-light-gray">
        <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
          <div className="bg-navy px-5 py-4 flex items-center gap-3">
            <Link href="/gear" className="text-white/60 active:scale-95 transition-transform">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
            </Link>
            <div className="text-lg font-bold text-white">Batch Summary</div>
          </div>
          <div className="flex-1 px-4 py-4">
            <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-navy">{completed.length}</div>
                <div className="text-sm text-navy/50">Items Inspected</div>
              </div>
              <div className="flex gap-4 justify-center">
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{passCount}</div>
                  <div className="text-xs text-navy/40">Pass</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600">{failCount}</div>
                  <div className="text-xs text-navy/40">Fail</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {completed.map((c, i) => (
                <div key={i} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-navy">{c.gearType}</div>
                    <div className="text-xs text-navy/40">{c.gearId}</div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    c.result === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>{c.result}</span>
                </div>
              ))}
            </div>

            <Link href="/gear"
              className="block w-full mt-6 bg-orange text-white font-semibold py-4 rounded-xl text-sm text-center active:scale-95 transition-all duration-150 min-h-[48px]">
              Done
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/gear" className="text-white/60 active:scale-95 transition-transform">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
            </Link>
            <div className="text-lg font-bold text-white">Batch Inspection</div>
          </div>
          {completed.length > 0 && (
            <button
              onClick={() => setShowSummary(true)}
              className="text-white/60 text-sm px-3 py-2 rounded-xl bg-white/10 active:scale-95 transition-all duration-150 min-h-[48px] flex items-center"
            >
              Finish Batch
            </button>
          )}
        </div>

        <div className="flex-1 px-4 py-4">
          {/* Counter */}
          {completed.length > 0 && (
            <div className="bg-white rounded-xl p-3 shadow-sm mb-4 flex items-center justify-between">
              <div className="text-sm font-medium text-navy">
                {completed.length} item{completed.length !== 1 ? 's' : ''} inspected
              </div>
              <div className="flex gap-3">
                <span className="text-xs font-medium text-green-600">{passCount} pass</span>
                {failCount > 0 && <span className="text-xs font-medium text-red-600">{failCount} fail</span>}
              </div>
            </div>
          )}

          {!currentItem ? (
            /* Scan / Lookup */
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Scan or type serial number</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serialInput}
                    onChange={e => setSerialInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && lookupSerial()}
                    placeholder="Serial number..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[48px]"
                    autoFocus
                  />
                  <button
                    onClick={lookupSerial}
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

              {lookupError && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{lookupError}</div>
              )}
            </div>
          ) : (
            /* Inspection Form */
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-navy">{currentItem.gear_type}</div>
                  <button onClick={() => setCurrentItem(null)} className="text-xs text-navy/40 min-h-[48px] min-w-[48px] flex items-center justify-center">
                    Cancel
                  </button>
                </div>
                <div className="text-xs text-navy/50">{currentItem.gear_id}</div>
                <div className="text-xs text-navy/40">{currentItem.manufacturer} {currentItem.model}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Result</label>
                <div className="flex gap-2">
                  {(['Pass', 'Fail'] as const).map(r => (
                    <button key={r} onClick={() => setInspResult(r)}
                      className={`flex-1 py-4 rounded-xl text-base font-bold transition-all duration-150 active:scale-95 min-h-[56px]
                        ${inspResult === r
                          ? r === 'Pass' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                          : 'bg-gray-100 text-navy/40'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Photo (optional)</label>
                <input type="file" accept="image/*"
                  onChange={e => setInspPhoto(e.target.files?.[0] || null)}
                  className="w-full text-sm text-navy/60 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-orange/10 file:text-orange file:font-medium file:text-xs min-h-[48px]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Notes (optional)</label>
                <textarea value={inspNotes} onChange={e => setInspNotes(e.target.value)}
                  placeholder="Quick notes..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[60px] resize-none" />
              </div>

              <button
                onClick={handleSaveAndNext}
                disabled={saving}
                className="w-full py-4 rounded-xl text-sm font-bold bg-orange text-white active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[56px]"
              >
                {saving ? 'Saving...' : 'Save & Next'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
