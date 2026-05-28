'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser } from '@/lib/types'

const GEAR_TYPES = [
  'Harness', 'Adjustable Lanyard', 'Carabiner', 'Descender', 'Helmet',
  'Rope', 'Sling', 'Ascender', 'Tool Lanyard', 'Other',
]

const RETIREMENT_RULES = ['When Fails Inspection', '10 Years from DoM']

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

export default function AddGearPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [nfcSupported, setNfcSupported] = useState(false)
  const [nfcScanning, setNfcScanning] = useState(false)

  const [gearId, setGearId] = useState('')
  const [gearType, setGearType] = useState(GEAR_TYPES[0])
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [size, setSize] = useState('')
  const [length, setLength] = useState('')
  const [colour, setColour] = useState('')
  const [dateOfManufacture, setDateOfManufacture] = useState('')
  const [dateOfPurchase, setDateOfPurchase] = useState('')
  const [dateOfFirstUse, setDateOfFirstUse] = useState('')
  const [retirementRule, setRetirementRule] = useState(RETIREMENT_RULES[0])
  const [nfcUid, setNfcUid] = useState('')

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    setNfcSupported('NDEFReader' in window)
  }, [])

  function calcRetirementDate(): string | null {
    if (retirementRule === '10 Years from DoM' && dateOfManufacture) {
      const d = new Date(dateOfManufacture)
      d.setFullYear(d.getFullYear() + 10)
      return d.toISOString().split('T')[0]
    }
    return null
  }

  async function handleNfcScan() {
    setNfcScanning(true)
    const uid = await scanNFC()
    setNfcScanning(false)
    if (uid) setNfcUid(uid)
  }

  async function handleSubmit() {
    if (!gearId.trim() || !manufacturer.trim() || !model.trim()) return
    setSubmitting(true)

    const { error } = await getSupabase()
      .from('gear_items')
      .insert({
        gear_id: gearId.trim(),
        gear_type: gearType,
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        size: size.trim() || null,
        length: length.trim() || null,
        colour: colour.trim() || null,
        date_of_manufacture: dateOfManufacture || null,
        date_of_purchase: dateOfPurchase || null,
        date_of_first_use: dateOfFirstUse || null,
        retirement_rule: retirementRule,
        retirement_date: calcRetirementDate(),
        team_member_name: user!.name,
        nfc_uid: nfcUid.trim() || null,
      })

    if (!error) {
      window.location.href = '/gear'
    } else {
      setSubmitting(false)
    }
  }

  if (!user) return null

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[48px]"

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/gear" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="text-lg font-bold text-white">Add Gear</div>
        </div>

        <div className="flex-1 px-4 py-4 pb-32">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-navy/60 mb-1">Serial Number / Gear ID</label>
              <input type="text" value={gearId} onChange={e => setGearId(e.target.value)} placeholder="Enter serial number" className={inputCls} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy/60 mb-1">Gear Type</label>
              <select value={gearType} onChange={e => setGearType(e.target.value)} className={inputCls}>
                {GEAR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Manufacturer</label>
                <input type="text" value={manufacturer} onChange={e => setManufacturer(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Model</label>
                <input type="text" value={model} onChange={e => setModel(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Size</label>
                <input type="text" value={size} onChange={e => setSize(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Length</label>
                <input type="text" value={length} onChange={e => setLength(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Colour</label>
                <input type="text" value={colour} onChange={e => setColour(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy/60 mb-1">Date of Manufacture</label>
              <input type="date" value={dateOfManufacture} onChange={e => setDateOfManufacture(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy/60 mb-1">Date of Purchase</label>
              <input type="date" value={dateOfPurchase} onChange={e => setDateOfPurchase(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy/60 mb-1">Date of First Use</label>
              <input type="date" value={dateOfFirstUse} onChange={e => setDateOfFirstUse(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy/60 mb-1">Retirement Rule</label>
              <select value={retirementRule} onChange={e => setRetirementRule(e.target.value)} className={inputCls}>
                {RETIREMENT_RULES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {retirementRule === '10 Years from DoM' && dateOfManufacture && (
              <div className="bg-white rounded-xl p-3 border border-gray-200">
                <div className="text-xs text-navy/40 font-semibold">Retirement Date</div>
                <div className="text-sm text-navy font-medium">{calcRetirementDate()}</div>
              </div>
            )}

            {/* NFC UID Field */}
            <div>
              <label className="block text-xs font-semibold text-navy/60 mb-1">NFC Tag UID (optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nfcUid}
                  onChange={e => setNfcUid(e.target.value)}
                  placeholder="e.g. 04:a2:3b:7c:d1:e5:80"
                  className={`flex-1 ${inputCls}`}
                />
                {nfcSupported && (
                  <button
                    onClick={handleNfcScan}
                    disabled={nfcScanning}
                    className="bg-navy text-white text-sm font-semibold px-3 rounded-xl active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[48px] flex items-center gap-1"
                  >
                    {nfcScanning ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" /><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" />
                        <path d="M12.91 4.1a16.1 16.1 0 0 1 0 15.8" /><path d="M16.37 2a20.43 20.43 0 0 1 0 20" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0">
          <div className="w-full max-w-[480px] mx-auto px-4 py-4 bg-light-gray border-t border-gray-200">
            <button onClick={handleSubmit}
              disabled={submitting || !gearId.trim() || !manufacturer.trim() || !model.trim()}
              className="w-full bg-orange text-white font-semibold py-4 rounded-xl text-sm
                active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[48px]">
              {submitting ? 'Saving...' : 'Save Gear'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
