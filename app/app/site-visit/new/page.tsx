'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser } from '@/lib/types'

const SERVICE_OPTIONS = [
  'Height Safety Install', 'Height Safety Certification', 'Concrete Repairs',
  'Facade Inspection', 'Window Cleaning', 'Pressure Cleaning', 'Waterproofing',
  'Caulking', 'Glazing', 'Building Maintenance', 'Rigging', 'Other'
]

const BUILDING_TYPES = ['Residential High-Rise', 'Commercial', 'Mixed-Use', 'Industrial', 'Body Corporate', 'Other']
const STATES = ['QLD', 'NSW', 'VIC']
const CONTACT_ROLES = ['Body Corporate Manager', 'Facility Manager', 'Property Manager', 'Builder PM', 'Builder CM', 'Strata Manager', 'Owner', 'Estimator', 'Contract Admin', 'Other']
const HSS_MANUFACTURERS = ['Kattsafe', 'SafetyLink', 'Safety Roof Anchors', 'Other', 'Unknown']
const ROOFTOP_ACCESS = ['Internal Stairs', 'External Ladder', 'Hatch', 'Roof Hatch + Ladder', 'Other']
const STATUSES = ['Scheduled', 'Completed', 'Cancelled']
const LEAD_SCORES = ['🔥 Hot', '🟡 Warm', '🔵 Cold']
const WORK_TYPES = ['Once-off', 'Recurring', 'Tender', 'Service Agreement', 'Day Rate']
const QUOTE_FORMATS = ['Combined (one quote, line items)', 'Separate (individual quotes per service)', 'Options (Option A / B / C pricing)']
const FOLLOWUP_OPTIONS = ['3 days', '1 week', '2 weeks', '1 month', 'Custom']

interface FormData {
  buildingName: string
  buildingAddress: string
  suburb: string
  state: string
  postcode: string
  buildingType: string
  numberOfStories: string
  yearBuilt: string
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
  estimatedValue: string
  decisionDate: string
  decisionMaker: string
  leadScore: string
  workType: string
  quoteFormat: string
  quoteRecipientName: string
  quoteRecipientEmail: string
  additionalRecipients: string
  quoteNotes: string
  competitor: string
  readyToQuote: boolean
  followUp: string
  followUpCustomDate: string
  visitDate: string
  visitTime: string
  salesRep: string
  status: string
  visitNotes: string
}

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden mb-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 text-white font-medium text-left">
        <span>{title}</span>
        <svg className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
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

export default function NewSiteVisitPage() {
  const router = useRouter()
  const [user, setUser] = useState<RatUser | null>(null)
  const [saved, setSaved] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState<FormData>({
    buildingName: '', buildingAddress: '', suburb: '', state: 'QLD', postcode: '',
    buildingType: '', numberOfStories: '', yearBuilt: '',
    contactName: '', contactRole: '', contactEmail: '', contactPhone: '', companyName: '',
    hssInstalled: false, hssManufacturer: '', anchorTestingCurrent: false, lastAnchorTestDate: '',
    rooftopAccess: '', parkingAvailable: false, accessNotes: '',
    servicesRequired: [], scopeNotes: '', estimatedValue: '', decisionDate: '', decisionMaker: '',
    leadScore: '', workType: '', quoteFormat: '', quoteRecipientName: '', quoteRecipientEmail: '',
    additionalRecipients: '', quoteNotes: '', competitor: '', readyToQuote: false,
    followUp: '', followUpCustomDate: '',
    visitDate: today, visitTime: '', salesRep: '', status: 'Scheduled', visitNotes: ''
  })

  useEffect(() => {
    const u = getStoredUser()
    setUser(u)
    if (u) setForm(f => ({ ...f, salesRep: u.name || '' }))
    // Restore auto-saved form
    const saved = localStorage.getItem('siteVisitDraft')
    if (saved) {
      try { setForm(JSON.parse(saved)) } catch {}
    }
  }, [])

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('siteVisitDraft', JSON.stringify(form))
    }, 500)
    return () => clearTimeout(timer)
  }, [form])

  const update = (key: keyof FormData, value: string | boolean | string[]) => {
    setForm(f => ({ ...f, [key]: value }))
  }

  const toggleService = (service: string) => {
    setForm(f => ({
      ...f,
      servicesRequired: f.servicesRequired.includes(service)
        ? f.servicesRequired.filter(s => s !== service)
        : [...f.servicesRequired, service]
    }))
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).slice(0, 6 - photos.length).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setPhotos(prev => [...prev, ev.target!.result as string].slice(0, 6))
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const handleSave = () => {
    if (!form.buildingName || !form.buildingAddress || !form.visitDate || !form.contactName) {
      alert('Please fill in Building Name, Address, Contact Name, and Visit Date')
      return
    }
    const visit = {
      id: `sv_${Date.now()}`,
      ...form,
      estimatedValue: parseFloat(form.estimatedValue) || 0,
      numberOfStories: parseInt(form.numberOfStories) || 0,
      photos,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const existing = JSON.parse(localStorage.getItem('siteVisits') || '[]')
    existing.push(visit)
    localStorage.setItem('siteVisits', JSON.stringify(existing))
    localStorage.removeItem('siteVisitDraft')
    setSaved(true)
    setTimeout(() => router.push('/site-visit'), 1500)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <Link href="/site-visit" className="text-zinc-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-lg font-semibold">New Site Visit</h1>
      </div>

      {/* Toast */}
      {saved && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-medium">
          ✅ Site visit saved!
        </div>
      )}

      <div className="px-4 py-4 max-w-lg mx-auto">
        <CollapsibleSection title="📍 Building Info" defaultOpen={true}>
          <Input label="Building Name *" placeholder="e.g. Pacific Towers" value={form.buildingName} onChange={e => update('buildingName', e.target.value)} />
          <Input label="Address *" placeholder="123 Marine Parade" value={form.buildingAddress} onChange={e => update('buildingAddress', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Suburb" placeholder="Broadbeach" value={form.suburb} onChange={e => update('suburb', e.target.value)} />
            <Select label="State" options={STATES} value={form.state} onChange={e => update('state', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Postcode" placeholder="4218" value={form.postcode} onChange={e => update('postcode', e.target.value)} />
            <Input label="Stories" type="number" placeholder="12" value={form.numberOfStories} onChange={e => update('numberOfStories', e.target.value)} />
          </div>
          <Select label="Building Type" options={BUILDING_TYPES} value={form.buildingType} onChange={e => update('buildingType', e.target.value)} />

        </CollapsibleSection>

        <CollapsibleSection title="👤 Contact" defaultOpen={true}>
          <Input label="Contact Name *" placeholder="John Smith" value={form.contactName} onChange={e => update('contactName', e.target.value)} />
          <Select label="Role" options={CONTACT_ROLES} value={form.contactRole} onChange={e => update('contactRole', e.target.value)} />
          <Input label="Email" type="email" placeholder="john@example.com" value={form.contactEmail} onChange={e => update('contactEmail', e.target.value)} />
          <Input label="Phone" type="tel" placeholder="0412 345 678" value={form.contactPhone} onChange={e => update('contactPhone', e.target.value)} />
          <Input label="Company / Body Corporate" placeholder="ABC Strata" value={form.companyName} onChange={e => update('companyName', e.target.value)} />
        </CollapsibleSection>

        <CollapsibleSection title="🏗️ Site Details">
          <Toggle label="Height Safety System Installed?" checked={form.hssInstalled} onChange={v => update('hssInstalled', v)} />
          {form.hssInstalled && (
            <>
              <Select label="HSS Manufacturer" options={HSS_MANUFACTURERS} value={form.hssManufacturer} onChange={e => update('hssManufacturer', e.target.value)} />
              <Toggle label="Anchor Testing Current?" checked={form.anchorTestingCurrent} onChange={v => update('anchorTestingCurrent', v)} />
              <Input label="Last Anchor Test Date" type="date" value={form.lastAnchorTestDate} onChange={e => update('lastAnchorTestDate', e.target.value)} />
            </>
          )}
          <Select label="Rooftop Access" options={ROOFTOP_ACCESS} value={form.rooftopAccess} onChange={e => update('rooftopAccess', e.target.value)} />
          <Toggle label="Parking Available?" checked={form.parkingAvailable} onChange={v => update('parkingAvailable', v)} />
          <TextArea label="Access Notes" placeholder="Any access issues, restrictions, special requirements..." value={form.accessNotes} onChange={e => update('accessNotes', e.target.value)} />
        </CollapsibleSection>

        <CollapsibleSection title="📋 Scope" defaultOpen={true}>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Services Required</label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_OPTIONS.map(service => (
                <button key={service} type="button" onClick={() => toggleService(service)}
                  className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                    form.servicesRequired.includes(service) ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  }`}>
                  {form.servicesRequired.includes(service) ? '✓ ' : ''}{service}
                </button>
              ))}
            </div>
          </div>
          <TextArea label="Scope Notes" placeholder="Detailed scope, special requirements..." value={form.scopeNotes} onChange={e => update('scopeNotes', e.target.value)} />
          <Input label="Estimated Value ($)" type="number" placeholder="25000" value={form.estimatedValue} onChange={e => update('estimatedValue', e.target.value)} />
          <Input label="Decision Date" type="date" value={form.decisionDate} onChange={e => update('decisionDate', e.target.value)} />
          <Input label="Decision Maker" placeholder="Who makes the call?" value={form.decisionMaker} onChange={e => update('decisionMaker', e.target.value)} />
        </CollapsibleSection>

        <CollapsibleSection title="🎯 Lead & Work Type" defaultOpen={true}>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Lead Score</label>
            <div className="grid grid-cols-3 gap-2">
              {LEAD_SCORES.map(score => (
                <button key={score} type="button" onClick={() => update('leadScore', score)}
                  className={`px-3 py-3 rounded-lg text-sm font-medium text-center transition-colors ${
                    form.leadScore === score ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  }`}>
                  {score}
                </button>
              ))}
            </div>
          </div>
          <Select label="Work Type" options={WORK_TYPES} value={form.workType} onChange={e => update('workType', e.target.value)} />
          <Input label="Competitor (who else is quoting?)" placeholder="e.g. Sayfa, another installer" value={form.competitor} onChange={e => update('competitor', e.target.value)} />
        </CollapsibleSection>

        <CollapsibleSection title="📝 Quote Delivery">
          <Select label="Quote Format" options={QUOTE_FORMATS} value={form.quoteFormat} onChange={e => update('quoteFormat', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quote To (Name)" placeholder="Same as contact" value={form.quoteRecipientName} onChange={e => update('quoteRecipientName', e.target.value)} />
            <Input label="Quote To (Email)" type="email" placeholder="john@example.com" value={form.quoteRecipientEmail} onChange={e => update('quoteRecipientEmail', e.target.value)} />
          </div>
          <Input label="Additional Recipients" placeholder="CC emails, comma separated" value={form.additionalRecipients} onChange={e => update('additionalRecipients', e.target.value)} />
          <TextArea label="Quote Notes for Peter" placeholder="e.g. Split HSS install from cert, need 3 pricing options..." value={form.quoteNotes} onChange={e => update('quoteNotes', e.target.value)} />
          <Toggle label="🚀 Ready to Quote? (flags Peter)" checked={form.readyToQuote} onChange={v => update('readyToQuote', v)} />
        </CollapsibleSection>

        <CollapsibleSection title="⏰ Follow-up">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Set Follow-up Reminder</label>
            <div className="grid grid-cols-3 gap-2">
              {FOLLOWUP_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => update('followUp', opt)}
                  className={`px-3 py-2 rounded-lg text-sm text-center transition-colors ${
                    form.followUp === opt ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
          {form.followUp === 'Custom' && (
            <Input label="Custom Follow-up Date" type="date" value={form.followUpCustomDate} onChange={e => update('followUpCustomDate', e.target.value)} />
          )}
        </CollapsibleSection>

        <CollapsibleSection title="📅 Visit">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Visit Date *" type="date" value={form.visitDate} onChange={e => update('visitDate', e.target.value)} />
            <Input label="Visit Time" type="time" value={form.visitTime} onChange={e => update('visitTime', e.target.value)} />
          </div>
          <Input label="Sales Rep" value={form.salesRep} onChange={e => update('salesRep', e.target.value)} />
          <Select label="Status" options={STATUSES} value={form.status} onChange={e => update('status', e.target.value)} />
          <TextArea label="Visit Notes" placeholder="Notes from the visit..." value={form.visitNotes} onChange={e => update('visitNotes', e.target.value)} />
        </CollapsibleSection>

        <CollapsibleSection title="📸 Photos">
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
              </div>
            ))}
            {photos.length < 6 && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-zinc-600 flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 transition-colors">
                <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="text-xs text-zinc-500 mt-1">Add Photo</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1">{photos.length}/6 photos</p>
        </CollapsibleSection>

        {/* Save Button */}
        <button onClick={handleSave}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-xl text-lg mt-4 transition-colors active:scale-[0.98]">
          💾 Save Site Visit
        </button>
      </div>
    </div>
  )
}
