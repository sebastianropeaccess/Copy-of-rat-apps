'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getStoredUser } from '@/lib/helpers'
import { getSupabase } from '@/lib/supabase'
import type { RatUser, SvCompany, SvProperty, TeamMember } from '@/lib/types'

type StartMode = 'hubspot' | 'new'
type HubSpotDeal = {
  id: string
  dealname: string | null
  amount: string | null
  dealstage?: string | null
  pipeline?: string | null
  pipelineId?: string
  stageId?: string
  stageLabel?: string
  ownerName?: string | null
  properties?: Record<string, string | null>
}

type Draft = {
  site_name: string
  site_address: string
  site_contact: string
  site_phone: string
  site_email: string
  company_name: string
  visit_date: string
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-navy/70">{label}</label>
      {children}
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="min-h-[48px] w-full rounded-xl border border-navy/10 bg-light-gray px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-orange/40" />
}

function formatDealAmount(amount: string | null | undefined) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return 'No amount recorded'
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value)
}

function MatchCard({
  title,
  detail,
  value,
  onChange,
}: {
  title: string
  detail: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="rounded-xl border border-orange/20 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-navy">{title}</div>
      <div className="mt-1 text-xs text-navy/55">{detail}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onChange(true)} className={`min-h-[48px] rounded-xl text-sm font-semibold ${value ? 'bg-orange text-white' : 'border border-navy/10 bg-light-gray text-navy/60'}`}>Yes</button>
        <button type="button" onClick={() => onChange(false)} className={`min-h-[48px] rounded-xl text-sm font-semibold ${!value ? 'bg-orange text-white' : 'border border-navy/10 bg-light-gray text-navy/60'}`}>No</button>
      </div>
    </div>
  )
}

function DealPicker({
  deals,
  loading,
  selectedDeal,
  onSelect,
  onClear,
}: {
  deals: HubSpotDeal[]
  loading: boolean
  selectedDeal: HubSpotDeal | null
  onSelect: (deal: HubSpotDeal) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const filtered = query.trim()
    ? deals.filter((deal) => [deal.dealname, deal.stageLabel, deal.ownerName].some((value) => (value || '').toLowerCase().includes(query.trim().toLowerCase())))
    : deals

  if (selectedDeal) {
    return (
      <div className="rounded-xl border border-orange/25 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-navy">{selectedDeal.dealname || selectedDeal.id}</div>
            <div className="mt-1 text-xs text-navy/55">{formatDealAmount(selectedDeal.amount)}</div>
          </div>
          <button type="button" onClick={onClear} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange/10 text-orange" aria-label="Clear selected deal">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <TextInput placeholder="Search HubSpot deals..." value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} />
      {open && (
        <div className="overflow-hidden rounded-xl border border-navy/10 bg-white shadow-sm">
          <div className="max-h-[240px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm text-navy/55">Loading deals...</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-navy/55">No matching deals found.</div>
            ) : (
              filtered.slice(0, 60).map((deal) => (
                <button key={deal.id} type="button" onClick={() => { onSelect(deal); setOpen(false); setQuery('') }} className="block w-full border-b border-navy/8 px-4 py-3 text-left last:border-b-0 hover:bg-orange/5">
                  <span className="block text-sm font-semibold text-navy">{deal.dealname || deal.id}</span>
                  <span className="mt-1 block text-xs text-navy/55">{formatDealAmount(deal.amount)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function readDealProperty(deal: HubSpotDeal, keys: string[]) {
  for (const key of keys) {
    const value = deal.properties?.[key] || (deal as unknown as Record<string, string | null | undefined>)[key]
    if (value) return value
  }
  return ''
}

function getPosition(member: TeamMember | RatUser | null) {
  return (member?.position || '').toLowerCase()
}

function isAdmin(member: TeamMember | RatUser | null) {
  return member?.role === 'admin' || member?.can_manage_settings === true || getPosition(member).includes('admin')
}

function isManager(member: TeamMember | RatUser | null) {
  const position = getPosition(member)
  return member?.role === 'manager' || member?.can_view_all_data === true || position === 'manager' || position.includes('operations manager')
}

function isSales(member: TeamMember | RatUser | null) {
  return getPosition(member).includes('sales')
}

function hasSiteVisitAccess(member: TeamMember | RatUser | null) {
  return Boolean(
    member &&
    (isAdmin(member) ||
      isManager(member) ||
      member.can_access_apps?.includes('site_visit') ||
      member.can_access_apps?.includes('site-visits'))
  )
}

export default function NewSiteVisitPage() {
  const router = useRouter()
  const [user] = useState<RatUser | null>(() => getStoredUser())
  const [member, setMember] = useState<TeamMember | null>(null)
  const [mode, setMode] = useState<StartMode>('hubspot')
  const [deals, setDeals] = useState<HubSpotDeal[]>([])
  const [dealsLoading, setDealsLoading] = useState(true)
  const [selectedDeal, setSelectedDeal] = useState<HubSpotDeal | null>(null)
  const [propertyMatch, setPropertyMatch] = useState<SvProperty | null>(null)
  const [companyMatch, setCompanyMatch] = useState<SvCompany | null>(null)
  const [useProperty, setUseProperty] = useState(false)
  const [useCompany, setUseCompany] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft>({
    site_name: '',
    site_address: '',
    site_contact: '',
    site_phone: '',
    site_email: '',
    company_name: '',
    visit_date: new Date().toISOString().slice(0, 10),
  })

  useEffect(() => {
    if (!user) { window.location.href = '/login'; return }
    getSupabase().from('team_members').select('*').eq('id', user.id).single().then(({ data }) => {
      const teamMember = data as TeamMember | null
      if (!hasSiteVisitAccess(teamMember || user) || (!isSales(teamMember || user) && !isAdmin(teamMember || user))) {
        window.location.href = '/'
        return
      }
      setMember(teamMember)
    })
    fetch('/api/hubspot/deals', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Missing /api/hubspot/deals')
        return response.json()
      })
      .catch(() => fetch('/api/hubspot?action=deals', { cache: 'no-store' }).then((response) => response.json()))
      .then((data) => setDeals(Array.isArray(data) ? data : data.deals || []))
      .catch(() => setDeals([]))
      .finally(() => setDealsLoading(false))
  }, [user])

  async function checkMatches(nextDraft: Draft) {
    if (nextDraft.site_address.trim()) {
      const { data } = await getSupabase()
        .from('sv_properties')
        .select('*')
        .ilike('address', `%${nextDraft.site_address.trim()}%`)
        .limit(1)
        .maybeSingle()
      setPropertyMatch(data as SvProperty | null)
      setUseProperty(Boolean(data))
    }
    if (nextDraft.company_name.trim()) {
      const { data } = await getSupabase()
        .from('sv_companies')
        .select('*')
        .ilike('name', `%${nextDraft.company_name.trim()}%`)
        .limit(1)
        .maybeSingle()
      setCompanyMatch(data as SvCompany | null)
      setUseCompany(Boolean(data))
    }
  }

  function handleDealSelect(deal: HubSpotDeal) {
    const nextDraft = {
      site_name: readDealProperty(deal, ['site_name', 'building_name', 'dealname']) || deal.dealname || '',
      site_address: readDealProperty(deal, ['site_address', 'address', 'property_address']),
      site_contact: readDealProperty(deal, ['site_contact', 'contact_name', 'firstname']),
      site_phone: readDealProperty(deal, ['site_phone', 'phone', 'mobilephone']),
      site_email: readDealProperty(deal, ['site_email', 'email']),
      company_name: readDealProperty(deal, ['company_name', 'company']) || deal.dealname || '',
      visit_date: draft.visit_date,
    }
    setSelectedDeal(deal)
    setDraft(nextDraft)
    void checkMatches(nextDraft)
  }

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    const nextDraft = { ...draft, [key]: value }
    setDraft(nextDraft)
    if (key === 'site_address' || key === 'company_name') void checkMatches(nextDraft)
  }

  async function handleCreate() {
    if (!user || saving) return
    if (!draft.site_name.trim() || !draft.site_address.trim() || !draft.company_name.trim()) {
      alert('Please enter site name, address, and company.')
      return
    }
    setSaving(true)

    const property = useProperty && propertyMatch ? propertyMatch : (await getSupabase()
      .from('sv_properties')
      .insert({ address: draft.site_address.trim(), building_name: draft.site_name.trim() })
      .select()
      .single()).data as SvProperty | null

    const company = useCompany && companyMatch ? companyMatch : (await getSupabase()
      .from('sv_companies')
      .insert({ name: draft.company_name.trim(), type: 'other' })
      .select()
      .single()).data as SvCompany | null

    if (!property || !company) {
      alert('Failed to create property or company.')
      setSaving(false)
      return
    }

    const { data: deal } = await getSupabase()
      .from('sv_deals')
      .insert({
        hubspot_deal_id: mode === 'hubspot' ? selectedDeal?.id || null : null,
        pipeline: selectedDeal?.pipelineId || null,
        stage: selectedDeal?.stageId || selectedDeal?.stageLabel || null,
        property_id: property.id,
        company_id: company.id,
      })
      .select()
      .single()

    const ownerId = String(member?.id || user.id)

    const { data: inspection, error } = await getSupabase()
      .from('sv_inspections')
      .insert({
        deal_id: deal?.id || null,
        property_id: property.id,
        company_id: company.id,
        salesperson_id: ownerId,
        status: 'site_visit_in_progress',
        visit_date: draft.visit_date || null,
        site_name: draft.site_name.trim(),
        site_address: draft.site_address.trim(),
        site_contact: draft.site_contact.trim() || null,
        site_phone: draft.site_phone.trim() || null,
        site_email: draft.site_email.trim() || null,
        property_data_inherited: useProperty,
        company_data_inherited: useCompany,
        building_notes_snapshot: useProperty ? property.building_notes : {},
        height_safety_snapshot: useProperty ? property.height_safety_system : {},
        site_logistics_snapshot: useProperty ? property.site_logistics : {},
        elevations_snapshot: useProperty ? property.elevations : {},
        created_by: ownerId,
      })
      .select()
      .single()

    if (error || !inspection) {
      alert('Failed to create inspection: ' + (error?.message || 'Unknown error'))
      setSaving(false)
      return
    }

    router.push(`/site-visits/${inspection.id}`)
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen flex-col bg-light-gray">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        <div className="bg-navy px-5 py-4">
          <div className="flex items-center gap-3">
            <Link href="/site-visits" className="text-white/60 active:scale-95 transition-transform" aria-label="Back">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div>
              <div className="text-lg font-bold text-white">New Site Visit</div>
              <div className="text-xs text-white/50">{user.name}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 px-4 py-4 pb-24">
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-navy">Step 1: Deal Selection</div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode('hubspot')} className={`min-h-[48px] rounded-xl text-sm font-semibold ${mode === 'hubspot' ? 'bg-orange text-white' : 'border border-navy/10 bg-light-gray text-navy/60'}`}>Link to HubSpot Deal</button>
              <button type="button" onClick={() => { setMode('new'); setSelectedDeal(null) }} className={`min-h-[48px] rounded-xl text-sm font-semibold ${mode === 'new' ? 'bg-orange text-white' : 'border border-navy/10 bg-light-gray text-navy/60'}`}>New Site</button>
            </div>
            {mode === 'hubspot' && <DealPicker deals={deals} loading={dealsLoading} selectedDeal={selectedDeal} onSelect={handleDealSelect} onClear={() => setSelectedDeal(null)} />}
            <div className="mt-4 grid gap-3">
              <Field label="Site Name"><TextInput value={draft.site_name} onChange={(e) => updateDraft('site_name', e.target.value)} placeholder="Building or site name" /></Field>
              <Field label="Site Address"><TextInput value={draft.site_address} onChange={(e) => updateDraft('site_address', e.target.value)} placeholder="Street address" /></Field>
              <Field label="Company"><TextInput value={draft.company_name} onChange={(e) => updateDraft('company_name', e.target.value)} placeholder="Client company" /></Field>
              <Field label="Visit Date"><TextInput type="date" value={draft.visit_date} onChange={(e) => updateDraft('visit_date', e.target.value)} /></Field>
              <Field label="Site Contact"><TextInput value={draft.site_contact} onChange={(e) => updateDraft('site_contact', e.target.value)} placeholder="Contact name" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone"><TextInput value={draft.site_phone} onChange={(e) => updateDraft('site_phone', e.target.value)} /></Field>
                <Field label="Email"><TextInput type="email" value={draft.site_email} onChange={(e) => updateDraft('site_email', e.target.value)} /></Field>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 text-sm font-semibold text-navy">Step 2: Property Matching</div>
            {propertyMatch ? (
              <MatchCard title={`Use existing property data from ${propertyMatch.address || propertyMatch.building_name}?`} detail="Building notes, height safety, logistics, elevations, and permanent hazards can be inherited." value={useProperty} onChange={setUseProperty} />
            ) : (
              <div className="rounded-xl bg-white p-4 text-sm text-navy/50 shadow-sm">No existing property match found.</div>
            )}
          </section>

          <section>
            <div className="mb-2 text-sm font-semibold text-navy">Step 3: Company Matching</div>
            {companyMatch ? (
              <MatchCard title={`Use existing client discovery from ${companyMatch.name}?`} detail="Discovery answers can be inherited and updated during the inspection." value={useCompany} onChange={setUseCompany} />
            ) : (
              <div className="rounded-xl bg-white p-4 text-sm text-navy/50 shadow-sm">No existing company match found.</div>
            )}
          </section>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-light-gray/90 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-[480px]">
            <button onClick={handleCreate} disabled={saving} className="min-h-[48px] w-full rounded-xl bg-orange py-3 font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Site Visit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
