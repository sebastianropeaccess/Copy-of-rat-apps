'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser } from '@/lib/types'

const STATES = ['QLD', 'NSW', 'VIC']
const BUILDING_TYPES = ['Residential High-Rise', 'Commercial', 'Mixed-Use', 'Industrial', 'Body Corporate', 'Other']
const CONTACT_ROLES = ['Body Corporate Manager', 'Facility Manager', 'Property Manager', 'Builder PM', 'Builder CM', 'Strata Manager', 'Owner', 'Estimator', 'Contract Admin', 'Other']
const HSS_MANUFACTURERS = ['Kattsafe', 'SafetyLink', 'Safety Roof Anchors', 'Other', 'Unknown']
const ROOFTOP_ACCESS = ['Internal Stairs', 'External Ladder', 'Hatch', 'Roof Hatch + Ladder', 'Other']
const SERVICES = ['Height Safety Install', 'Height Safety Certification', 'Concrete Repairs', 'Facade Inspection', 'Window Cleaning', 'Pressure Cleaning', 'Waterproofing', 'Caulking', 'Glazing', 'Building Maintenance', 'Rigging', 'Other']
const VISIT_STATUSES = ['Scheduled', 'Completed', 'Cancelled']

interface SiteVisitData {
  id: string
  buildingName: string
  buildingAddress: string
  suburb: string
  state: string
  postcode: string
  buildingType: string
  numberOfStories: number
  yearBuilt: number
  contactName: string
  contactRole: string
  contactEmail: string
  contactPhone: string
  companyName: string
  hssInstalled: boolean
  hssManufacturer: string
  anchorTestingCurrent: boolean
  lastAnchorTestDate: string
  rooftopAccess: string
  parkingAvailable: boolean
  accessNotes: string
  servicesRequired: string[]
  scopeNotes: string
  estimatedValue: number
  decisionDate: string
  decisionMaker: string
  visitDate: string
  visitTime: string
  salesRep: string
  status: string
  visitNotes: string
  photos: string[]
  createdAt: string
  updatedAt: string
}

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden mb-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 text-white font-medium text-left">
        <span>{title}</span>
        <svg className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-4 bg-zinc-900 space-y-3">{children}</div>}
    </div>
  )
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-1">{label}</label>
      <input {...props} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-3 text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none text-base" />
    </div>
  )
}

function Select({ label, options, ...props }: { label: string; options: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-1">{label}</label>
      <select {...props} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-3 text-white focus:border-orange-500 focus:outline-none text-base">
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function TextArea({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-1">{label}</label>
      <textarea {...props} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-3 text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none text-base min-h-[80px]" />
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-zinc-300">{label}</span>
      <button type="button" onClick={() => onChange(!checked)} className={`w-12 h-7 rounded-full transition-colors ${checked ? 'bg-orange-500' : 'bg-zinc-600'} relative`}>
        <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="py-1">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm text-white">{value || '—'}</div>
    </div>
  )
}

export default function SiteVisitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<RatUser | null>(null)
  const [visit, setVisit] = useState<SiteVisitData | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const visitId = params.id as string

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
  }, [])

  const loadVisit = useCallback(() => {
    try {
      const raw = localStorage.getItem('siteVisits')
      if (raw) {
        const list: SiteVisitData[] = JSON.parse(raw)
        const found = list.find(v => v.id === visitId)
        if (found) setVisit(found)
      }
    } catch { /* ignore */ }
  }, [visitId])

  useEffect(() => { if (user) loadVisit() }, [user, loadVisit])

  function updateField<K extends keyof SiteVisitData>(key: K, value: SiteVisitData[K]) {
    setVisit(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function toggleService(svc: string) {
    setVisit(prev => {
      if (!prev) return prev
      const arr = prev.servicesRequired.includes(svc)
        ? prev.servicesRequired.filter(s => s !== svc)
        : [...prev.servicesRequired, svc]
      return { ...prev, servicesRequired: arr }
    })
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !visit) return
    const remaining = 6 - visit.photos.length
    Array.from(files).slice(0, remaining).forEach(file => {
      const r = new FileReader()
      r.onload = () => {
        setVisit(prev => prev ? { ...prev, photos: [...prev.photos, r.result as string].slice(0, 6) } : prev)
      }
      r.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function removePhoto(idx: number) {
    setVisit(prev => prev ? { ...prev, photos: prev.photos.filter((_, i) => i !== idx) } : prev)
  }

  function handleSave() {
    if (!visit) return
    if (!visit.buildingName.trim() || !visit.buildingAddress.trim() || !visit.contactName.trim() || !visit.visitDate) {
      setToast('Please fill required fields')
      setTimeout(() => setToast(''), 3000)
      return
    }
    setSaving(true)
    try {
      const raw = localStorage.getItem('siteVisits')
      const list: SiteVisitData[] = raw ? JSON.parse(raw) : []
      const idx = list.findIndex(v => v.id === visitId)
      const updated = { ...visit, updatedAt: new Date().toISOString() }
      if (idx >= 0) list[idx] = updated; else list.push(updated)
      localStorage.setItem('siteVisits', JSON.stringify(list))
      setVisit(updated)
      setEditing(false)
      setToast('Updated!')
      setTimeout(() => setToast(''), 2000)
    } catch {
      setToast('Error saving')
      setTimeout(() => setToast(''), 3000)
    }
    setSaving(false)
  }

  function handleDelete() {
    if (!confirm('Delete this site visit?')) return
    try {
      const raw = localStorage.getItem('siteVisits')
      const list: SiteVisitData[] = raw ? JSON.parse(raw) : []
      localStorage.setItem('siteVisits', JSON.stringify(list.filter(v => v.id !== visitId)))
      router.push('/site-visit')
    } catch { /* ignore */ }
  }

  const formatDate = (d: string) => {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const statusColor = (s: string) => {
    switch (s) {
      case 'Scheduled': return 'bg-blue-500/20 text-blue-400'
      case 'Completed': return 'bg-green-500/20 text-green-400'
      case 'Cancelled': return 'bg-red-500/20 text-red-400'
      default: return 'bg-zinc-700 text-zinc-400'
    }
  }

  if (!user) return null

  if (!visit) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
          <Link href="/site-visit" className="text-zinc-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-lg font-semibold">Not Found</h1>
        </div>
        <div className="text-center py-20 text-zinc-600 text-sm">Site visit not found</div>
      </div>
    )
  }

  // ---- VIEW MODE ----
  if (!editing) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/site-visit" className="text-zinc-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div>
              <h1 className="text-lg font-semibold truncate max-w-[200px]">{visit.buildingName}</h1>
              <p className="text-xs text-zinc-500">{user.name}</p>
            </div>
          </div>
          <button onClick={() => setEditing(true)}
            className="text-zinc-400 text-sm px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 active:scale-95 transition-all duration-150">
            Edit
          </button>
        </div>

        <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
          {/* Status Banner */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColor(visit.status)}`}>{visit.status}</span>
            {visit.estimatedValue > 0 && (
              <span className="text-lg font-bold text-orange-500">${visit.estimatedValue.toLocaleString('en-AU')}</span>
            )}
          </div>

          <CollapsibleSection title="Building Info" defaultOpen>
            <Info label="Building" value={visit.buildingName} />
            <Info label="Address" value={`${visit.buildingAddress}${visit.suburb ? ', ' + visit.suburb : ''}${visit.state ? ' ' + visit.state : ''} ${visit.postcode}`} />
            <div className="grid grid-cols-2 gap-2">
              <Info label="Type" value={visit.buildingType} />
              <Info label="Stories" value={visit.numberOfStories || undefined} />
            </div>
            {visit.yearBuilt > 0 && <Info label="Year Built" value={visit.yearBuilt} />}
          </CollapsibleSection>

          <CollapsibleSection title="Contact">
            <Info label="Name" value={visit.contactName} />
            <Info label="Role" value={visit.contactRole} />
            {visit.contactPhone && (
              <div className="py-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Phone</div>
                <a href={`tel:${visit.contactPhone}`} className="text-sm text-orange-400 font-medium">{visit.contactPhone}</a>
              </div>
            )}
            {visit.contactEmail && (
              <div className="py-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Email</div>
                <a href={`mailto:${visit.contactEmail}`} className="text-sm text-orange-400 font-medium">{visit.contactEmail}</a>
              </div>
            )}
            <Info label="Company" value={visit.companyName} />
          </CollapsibleSection>

          <CollapsibleSection title="Site Details">
            <Info label="HSS Installed" value={visit.hssInstalled ? 'Yes' : 'No'} />
            {visit.hssInstalled && <Info label="HSS Manufacturer" value={visit.hssManufacturer} />}
            <Info label="Anchor Testing Current" value={visit.anchorTestingCurrent ? 'Yes' : 'No'} />
            {visit.lastAnchorTestDate && <Info label="Last Test" value={formatDate(visit.lastAnchorTestDate)} />}
            <Info label="Rooftop Access" value={visit.rooftopAccess} />
            <Info label="Parking" value={visit.parkingAvailable ? 'Yes' : 'No'} />
            {visit.accessNotes && <Info label="Access Notes" value={visit.accessNotes} />}
          </CollapsibleSection>

          <CollapsibleSection title="Scope">
            {visit.servicesRequired?.length > 0 && (
              <div className="py-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Services</div>
                <div className="flex flex-wrap gap-1">
                  {visit.servicesRequired.map(s => (
                    <span key={s} className="text-xs bg-orange-500/10 text-orange-400 px-2 py-1 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {visit.scopeNotes && <Info label="Scope Notes" value={visit.scopeNotes} />}
            <Info label="Decision Maker" value={visit.decisionMaker} />
            {visit.decisionDate && <Info label="Decision Date" value={formatDate(visit.decisionDate)} />}
          </CollapsibleSection>

          <CollapsibleSection title="Visit Info">
            <Info label="Date" value={formatDate(visit.visitDate)} />
            <Info label="Time" value={visit.visitTime || undefined} />
            <Info label="Sales Rep" value={visit.salesRep} />
            {visit.visitNotes && <Info label="Notes" value={visit.visitNotes} />}
          </CollapsibleSection>

          {visit.photos?.length > 0 && (
            <CollapsibleSection title={`Photos (${visit.photos.length})`}>
              <div className="grid grid-cols-3 gap-2">
                {visit.photos.map((p, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden bg-zinc-800">
                    <img src={p} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-zinc-950 border-t border-zinc-800">
          <div className="max-w-lg mx-auto px-4 py-3 flex gap-3">
            <button onClick={handleDelete}
              className="px-5 py-3.5 rounded-xl text-sm font-semibold text-red-400 bg-zinc-900 border border-zinc-700 active:scale-95 transition-all duration-150">
              Delete
            </button>
            <button onClick={() => setEditing(true)}
              className="flex-1 bg-orange-500 text-white font-bold text-base py-3.5 rounded-xl active:scale-[0.98] transition-all duration-150">
              Edit Visit
            </button>
          </div>
        </div>

        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-medium">{toast}</div>
          </div>
        )}
      </div>
    )
  }

  // ---- EDIT MODE ----
  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => { setEditing(false); loadVisit() }} className="text-zinc-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold">Edit Visit</h1>
            <p className="text-xs text-zinc-500">{user.name}</p>
          </div>
        </div>
        <button onClick={() => { setEditing(false); loadVisit() }}
          className="text-zinc-400 text-sm px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 active:scale-95 transition-all duration-150">
          Cancel
        </button>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">
        <CollapsibleSection title="Building Info" defaultOpen>
          <Input label="Building Name *" value={visit.buildingName} onChange={e => updateField('buildingName', e.target.value)} />
          <Input label="Address *" value={visit.buildingAddress} onChange={e => updateField('buildingAddress', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Suburb" value={visit.suburb} onChange={e => updateField('suburb', e.target.value)} />
            <Select label="State" options={STATES} value={visit.state} onChange={e => updateField('state', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Postcode" value={visit.postcode} onChange={e => updateField('postcode', e.target.value)} />
            <Input label="Stories" type="number" value={visit.numberOfStories || ''} onChange={e => updateField('numberOfStories', parseInt(e.target.value) || 0)} />
          </div>
          <Select label="Building Type" options={BUILDING_TYPES} value={visit.buildingType} onChange={e => updateField('buildingType', e.target.value)} />
          <Input label="Year Built" type="number" value={visit.yearBuilt || ''} onChange={e => updateField('yearBuilt', parseInt(e.target.value) || 0)} />
        </CollapsibleSection>

        <CollapsibleSection title="Contact" defaultOpen>
          <Input label="Contact Name *" value={visit.contactName} onChange={e => updateField('contactName', e.target.value)} />
          <Select label="Role" options={CONTACT_ROLES} value={visit.contactRole} onChange={e => updateField('contactRole', e.target.value)} />
          <Input label="Email" type="email" value={visit.contactEmail} onChange={e => updateField('contactEmail', e.target.value)} />
          <Input label="Phone" type="tel" value={visit.contactPhone} onChange={e => updateField('contactPhone', e.target.value)} />
          <Input label="Company / Body Corporate" value={visit.companyName} onChange={e => updateField('companyName', e.target.value)} />
        </CollapsibleSection>

        <CollapsibleSection title="Site Details">
          <Toggle label="Height Safety System Installed?" checked={visit.hssInstalled} onChange={v => updateField('hssInstalled', v)} />
          {visit.hssInstalled && (
            <>
              <Select label="HSS Manufacturer" options={HSS_MANUFACTURERS} value={visit.hssManufacturer} onChange={e => updateField('hssManufacturer', e.target.value)} />
              <Toggle label="Anchor Testing Current?" checked={visit.anchorTestingCurrent} onChange={v => updateField('anchorTestingCurrent', v)} />
              <Input label="Last Anchor Test Date" type="date" value={visit.lastAnchorTestDate} onChange={e => updateField('lastAnchorTestDate', e.target.value)} />
            </>
          )}
          <Select label="Rooftop Access" options={ROOFTOP_ACCESS} value={visit.rooftopAccess} onChange={e => updateField('rooftopAccess', e.target.value)} />
          <Toggle label="Parking Available?" checked={visit.parkingAvailable} onChange={v => updateField('parkingAvailable', v)} />
          <TextArea label="Access Notes" value={visit.accessNotes} onChange={e => updateField('accessNotes', e.target.value)} />
        </CollapsibleSection>

        <CollapsibleSection title="Scope" defaultOpen>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Services Required</label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICES.map(svc => (
                <button key={svc} type="button" onClick={() => toggleService(svc)}
                  className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                    visit.servicesRequired?.includes(svc) ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  }`}>
                  {visit.servicesRequired?.includes(svc) ? '✓ ' : ''}{svc}
                </button>
              ))}
            </div>
          </div>
          <TextArea label="Scope Notes" value={visit.scopeNotes} onChange={e => updateField('scopeNotes', e.target.value)} />
          <Input label="Estimated Value ($)" type="number" value={visit.estimatedValue || ''} onChange={e => updateField('estimatedValue', parseFloat(e.target.value) || 0)} />
          <Input label="Decision Date" type="date" value={visit.decisionDate} onChange={e => updateField('decisionDate', e.target.value)} />
          <Input label="Decision Maker" value={visit.decisionMaker} onChange={e => updateField('decisionMaker', e.target.value)} />
        </CollapsibleSection>

        <CollapsibleSection title="Visit Info" defaultOpen>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Visit Date *" type="date" value={visit.visitDate} onChange={e => updateField('visitDate', e.target.value)} />
            <Input label="Visit Time" type="time" value={visit.visitTime} onChange={e => updateField('visitTime', e.target.value)} />
          </div>
          <Input label="Sales Rep" value={visit.salesRep} onChange={e => updateField('salesRep', e.target.value)} />
          <Select label="Status" options={VISIT_STATUSES} value={visit.status} onChange={e => updateField('status', e.target.value)} />
          <TextArea label="Visit Notes" value={visit.visitNotes} onChange={e => updateField('visitNotes', e.target.value)} />
        </CollapsibleSection>

        <CollapsibleSection title={`Photos (${visit.photos?.length || 0}/6)`}>
          <div className="grid grid-cols-3 gap-2">
            {visit.photos?.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                <img src={p} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                <button type="button" onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
              </div>
            ))}
            {(visit.photos?.length || 0) < 6 && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-zinc-600 flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 transition-colors">
                <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="text-xs text-zinc-500 mt-1">Add</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhoto} />
              </label>
            )}
          </div>
        </CollapsibleSection>

        {/* Save Button */}
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-orange-500 text-white font-semibold py-4 rounded-xl text-lg mt-4 transition-colors active:scale-[0.98] disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className={`px-6 py-3 rounded-lg shadow-lg font-medium ${
            toast.includes('Error') || toast.includes('required') ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
          }`}>{toast}</div>
        </div>
      )}
    </div>
  )
}
