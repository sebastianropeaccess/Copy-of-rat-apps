'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getStoredUser } from '../../../lib/helpers'
import { getSupabase } from '../../../lib/supabase'
import type { RatUser, SvCompany, SvDeal, SvInspection, SvInspectionMedia, TeamMember } from '../../../lib/types'

type JsonMap = Record<string, unknown>
type InspectionRow = SvInspection & {
  sv_companies: Pick<SvCompany, 'name' | 'discovery_answers'> | null
  sv_deals: Pick<SvDeal, 'hubspot_deal_id' | 'stage' | 'pipeline'> | null
}
type Quoter = Pick<TeamMember, 'id' | 'name' | 'email' | 'hubspot_owner_id'>

const STATUS_LABELS: Record<string, string> = {
  enquiry: 'Enquiry',
  site_visit_scheduled: 'Scheduled',
  site_visit_in_progress: 'In Progress',
  inspection_complete: 'Complete',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
}

const STATUS_CLASSES: Record<string, string> = {
  enquiry: 'bg-blue-100 text-blue-700',
  site_visit_scheduled: 'bg-amber-100 text-amber-700',
  site_visit_in_progress: 'bg-orange/10 text-orange',
  inspection_complete: 'bg-green-100 text-green-700',
  quoted: 'bg-purple-100 text-purple-700',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-red-100 text-red-700',
}

const DISCOVERY_QUESTIONS = [
  'What is important to you when hiring a contractor?',
  'Who is the best contractor you have worked with and why?',
  'What does a successful job look like?',
  'What rope access contractors have you worked with recently?',
  'What could have been done better?',
]

const SERVICE_CATEGORIES: Record<string, string[]> = {
  'Window Cleaning': ['Inaccessible Windows', 'External Balustrades', 'Internal Balustrades', 'Balcony Windows & Doors', 'High Common Area Glass', 'Low Common Area Glass', 'Reception Area Glass', 'Glass Awnings (Top Side)', 'Glass Awnings (Underside)', 'Town Houses'],
  'Pressure Cleaning': ['Inaccessible Facade', 'Balconies', 'Rooftop', 'Ground Floor', 'Perimeter Walls', 'Car Park'],
  'Joint Sealing': ['Expansion Joints', 'Window Perimeter Seals', 'Flashings', 'Wet Sealing Glass', 'Apolic Cladding Re-seals', 'Balcony Perimeter Joints', 'Other'],
  Painting: ['Lift Motor Room', 'Rooftop', 'Whole Facade', 'Ground Floor Walls', 'Handrails', 'Window Frames', 'Awning'],
  'Facade Inspection': ['Whole Facade', 'Specific Areas'],
  'Glass Replacement': ['Panels', 'Daylight Measurements'],
  'Concrete Repairs': ['Locations Identified', 'Facade Inspection Done'],
  'Height Safety System Install': ['Locations', 'Access Areas', 'Roof Structure', 'Design In Mind', 'Budget In Mind'],
}

const BUILDING_QUESTIONS = [
  'Can every drop be safely egressed to a common area?',
  'Is there an elevator?',
  'How many flights of stairs to get to the roof?',
  'Do we need to abseil over a gutter?',
  'Is there a lot of walk between drops?',
  'Are there multiple rigging levels?',
  'Is the building like a maze?',
  'Does the Height Safety System seem sufficient?',
  'How tall is the building?',
  'Is ground floor G or 1?',
  'Are there any skipped levels?',
]

const HSS_COMPONENTS = ['Concrete Anchors', 'Surface Mount', 'Static Lines', 'Fixed Ladders', 'Fold Down Ladder', 'Ladder Brackets', 'Needles', 'Davit Arms', 'Rails', 'Roof Hatch', 'System ID Plate', 'System Tagged']
const HAZARDS = ['Power Lines', 'Sharp Flashing', 'Exposed Roof Edge', 'Plant/Equipment', 'Public Thoroughfare', 'Abseil Over Balustrade', 'RF Towers', 'Unsafe HSS']
const ELEVATIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const LOGISTICS = ['Grounds', 'Parking', 'Storage Area', 'Rooftop Access', 'Toilet Locations']

function asMap(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {}
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function getNestedString(source: JsonMap, key: string, child = 'comment') {
  const value = source[key]
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const nested = (value as JsonMap)[child]
    return typeof nested === 'string' ? nested : ''
  }
  return ''
}

function getChecked(source: JsonMap, key: string) {
  const value = source[key]
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value as JsonMap).checked)
}

function getYesNo(source: JsonMap, key: string) {
  const value = source[key]
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const answer = (value as JsonMap).answer
    return typeof answer === 'string' ? answer : ''
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

function isEstimator(member: TeamMember | RatUser | null) {
  return getPosition(member).includes('estimator')
}

function memberId(member: TeamMember | RatUser | null) {
  return member?.id == null ? null : String(member.id)
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

function canReadInspection(member: TeamMember | RatUser | null, inspection: InspectionRow | null) {
  if (!member || !inspection) return false
  if (isAdmin(member) || isManager(member)) return true
  const id = memberId(member)
  if (isSales(member)) return inspection.salesperson_id === id || inspection.created_by === id
  if (isEstimator(member)) return inspection.assigned_quoter_id === id
  return false
}

function canEditInspection(member: TeamMember | RatUser | null, inspection: InspectionRow | null) {
  if (!member || !inspection || inspection.locked) return false
  if (isAdmin(member)) return true
  const id = memberId(member)
  return isSales(member) && (inspection.salesperson_id === id || inspection.created_by === id)
}

function canUnlockInspection(member: TeamMember | RatUser | null, inspection: InspectionRow | null) {
  if (!member || !inspection?.locked) return false
  if (isAdmin(member)) return true
  const id = memberId(member)
  return isSales(member) && (inspection.salesperson_id === id || inspection.created_by === id)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-navy/70">{label}</label>{children}</div>
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="min-h-[48px] w-full rounded-xl border border-navy/10 bg-light-gray px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-orange/40 disabled:opacity-60" />
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="min-h-[92px] w-full rounded-xl border border-navy/10 bg-light-gray px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-orange/40 disabled:opacity-60" />
}

function ChipButton({ active, children, onClick, disabled = false }: { active: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold transition-all disabled:opacity-50 ${active ? 'border-orange bg-orange text-white' : 'border-navy/10 bg-light-gray text-navy/60'}`}>
      {children}
    </button>
  )
}

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((prev) => !prev)} className="flex min-h-[56px] w-full items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-semibold text-navy">{title}</span>
        <svg className={`h-5 w-5 text-orange transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <div className="space-y-4 border-t border-navy/8 px-4 py-4">{children}</div>}
    </section>
  )
}

function getVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement('video')
    const objectUrl = URL.createObjectURL(file)

    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read video duration'))
    }
    video.src = objectUrl
  })
}

function PhotoStrip({
  section,
  media,
  locked,
  onUpload,
  onToggleProposal,
}: {
  section: string
  media: SvInspectionMedia[]
  locked: boolean
  onUpload: (section: string, file: File) => void
  onToggleProposal: (item: SvInspectionMedia) => void
}) {
  const items = media.filter((item) => item.section === section)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const isVideo = item.media_type === 'video'
        return (
          <div key={item.id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-navy/10 bg-light-gray">
            {isVideo ? (
              <>
                <video src={item.url} poster={item.thumbnail_url || undefined} controls preload="metadata" className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
                    <svg className="ml-0.5 h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1.8v8.4L9.6 6 3 1.8Z" /></svg>
                  </span>
                </div>
              </>
            ) : (
              <img src={item.thumbnail_url || item.url} alt="" className="h-full w-full object-cover" />
            )}
            <button type="button" disabled={locked} onClick={() => onToggleProposal(item)} className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${item.include_in_proposal ? 'bg-orange text-white' : 'bg-white/85 text-navy/45'}`} aria-label="Include in proposal">★</button>
          </div>
        )
      })}
      {!locked && (
        <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-navy/20 bg-light-gray text-xl font-semibold text-navy/35 active:scale-95">
          +
          <input type="file" accept="image/*,video/*" className="hidden" onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(section, file)
            event.target.value = ''
          }} />
        </label>
      )}
    </div>
  )
}

export default function SiteVisitDetailPage() {
  const params = useParams<{ inspectionId: string }>()
  const [user] = useState<RatUser | null>(() => getStoredUser())
  const [member, setMember] = useState<TeamMember | null>(null)
  const [inspection, setInspection] = useState<InspectionRow | null>(null)
  const [media, setMedia] = useState<SvInspectionMedia[]>([])
  const [quoters, setQuoters] = useState<Quoter[]>([])
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [handoffSaving, setHandoffSaving] = useState(false)
  const [savedState, setSavedState] = useState<'saved' | 'saving' | 'error'>('saved')
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canEdit = canEditInspection(member || user, inspection)
  const locked = Boolean(inspection?.locked) || !canEdit
  const canComment = Boolean(member && inspection && (isEstimator(member) || isManager(member) || isAdmin(member)))
  const currentMemberId = memberId(member)
  const canMarkComplete = Boolean(member && inspection && isSales(member) && inspection.status === 'site_visit_in_progress' && (inspection.salesperson_id === currentMemberId || inspection.created_by === currentMemberId))
  const companyName = inspection?.sv_companies?.name || 'Client'

  const loadInspection = useCallback(async () => {
    const [{ data }, { data: mediaRows }, { data: quoterRows }] = await Promise.all([
      getSupabase()
        .from('sv_inspections')
        .select('*, sv_companies(name,discovery_answers), sv_deals(hubspot_deal_id,stage,pipeline)')
        .eq('id', params.inspectionId)
        .single(),
      getSupabase()
        .from('sv_inspection_media')
        .select('*')
        .eq('inspection_id', params.inspectionId)
        .order('created_at', { ascending: true }),
      getSupabase()
        .from('team_members')
        .select('id,name,email,hubspot_owner_id')
        .eq('active', true)
        .eq('can_quote', true)
        .order('name', { ascending: true }),
    ])
    setInspection(data as InspectionRow | null)
    setMedia((mediaRows || []) as SvInspectionMedia[])
    setQuoters((quoterRows || []).map((quoter) => ({ ...quoter, id: String(quoter.id) })) as Quoter[])
    setLoading(false)
  }, [params.inspectionId])

  useEffect(() => {
    if (!user) { window.location.href = '/login'; return }
    const timer = window.setTimeout(async () => {
      const { data } = await getSupabase().from('team_members').select('*').eq('id', user.id).single()
      const teamMember = data as TeamMember | null
      if (!hasSiteVisitAccess(teamMember || user)) { window.location.href = '/'; return }
      setMember(teamMember)
      await loadInspection()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadInspection, user])

  useEffect(() => {
    if (!loading && inspection && !canReadInspection(member || user, inspection)) {
      window.location.href = '/site-visits'
    }
  }, [inspection, loading, member, user])

  const autosave = useCallback((patch: Partial<SvInspection>) => {
    if (!inspection || !canEdit) return
    const previousInspection = inspection
    setInspection((prev) => prev ? { ...prev, ...patch } : prev)
    setSavedState('saving')
    if (autosaveRef.current) window.clearTimeout(autosaveRef.current)
    autosaveRef.current = setTimeout(async () => {
      const { error } = await getSupabase().from('sv_inspections').update(patch).eq('id', inspection.id)
      if (!error && !previousInspection.locked && previousInspection.status === 'inspection_complete') {
        const auditRows = Object.entries(patch).map(([field, value]) => ({
          inspection_id: previousInspection.id,
          user_name: user?.name || null,
          action: 'post_completion_edit',
          field_name: field,
          old_value: previousInspection[field as keyof SvInspection] ?? null,
          new_value: value ?? null,
        }))
        if (auditRows.length > 0) await getSupabase().from('sv_audit_log').insert(auditRows)
      }
      setSavedState(error ? 'error' : 'saved')
    }, 1000)
  }, [canEdit, inspection, user?.name])

  function updateField<K extends keyof SvInspection>(key: K, value: SvInspection[K]) {
    autosave({ [key]: value } as Partial<SvInspection>)
  }

  function updateJson(column: keyof Pick<SvInspection, 'scopes' | 'scope_answers' | 'todays_hazards' | 'specific_equipment' | 'building_notes_snapshot' | 'height_safety_snapshot' | 'site_logistics_snapshot' | 'elevations_snapshot'>, value: JsonMap | string[]) {
    autosave({ [column]: value } as Partial<SvInspection>)
  }

  async function uploadMedia(section: string, file: File) {
    if (!inspection) return
    const isVideo = file.type.startsWith('video/')
    if (isVideo) {
      try {
        const duration = await getVideoDuration(file)
        if (duration > 300) {
          alert('Video must be under 5 minutes')
          return
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Could not read video duration')
        return
      }
    }
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${inspection.id}/${section.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.${ext}`
    const { error } = await getSupabase().storage.from('site-visits').upload(path, file, { upsert: true })
    if (error) {
      alert(`${isVideo ? 'Video' : 'Photo'} upload failed: ${error.message}`)
      return
    }
    const { data: urlData } = getSupabase().storage.from('site-visits').getPublicUrl(path)
    const { data } = await getSupabase()
      .from('sv_inspection_media')
      .insert({ inspection_id: inspection.id, section, media_type: isVideo ? 'video' : 'photo', url: urlData.publicUrl, thumbnail_url: isVideo ? null : urlData.publicUrl })
      .select()
      .single()
    if (data) setMedia((prev) => [...prev, data as SvInspectionMedia])
  }

  async function toggleProposal(item: SvInspectionMedia) {
    if (!canEdit) return
    const next = !item.include_in_proposal
    setMedia((prev) => prev.map((row) => row.id === item.id ? { ...row, include_in_proposal: next } : row))
    await getSupabase().from('sv_inspection_media').update({ include_in_proposal: next }).eq('id', item.id)
  }

  async function markComplete() {
    if (!inspection || !user || !canMarkComplete) return
    setHandoffSaving(true)
    const { error } = await getSupabase().from('sv_inspections').update({
      status: 'inspection_complete',
      locked: true,
      locked_at: new Date().toISOString(),
      locked_by: user.name,
    }).eq('id', inspection.id)
    if (error) {
      alert('Failed to mark complete: ' + error.message)
      setHandoffSaving(false)
      return
    }
    await syncReadyToQuote(inspection.assigned_quoter_id || '')
    await loadInspection()
    setHandoffSaving(false)
  }

  async function unlock() {
    if (!inspection || !canUnlockInspection(member || user, inspection)) return
    if (!window.confirm('Are you sure? All changes will be audited.')) return
    await getSupabase().from('sv_inspections').update({ locked: false }).eq('id', inspection.id)
    await getSupabase().from('sv_audit_log').insert({ inspection_id: inspection.id, user_name: user?.name || null, action: 'unlock', field_name: 'locked', old_value: true, new_value: false })
    await loadInspection()
  }

  async function syncReadyToQuote(quoterId: string) {
    if (!inspection) return
    const quoter = quoters.find((item) => String(item.id) === quoterId)
    const hubspotDealId = inspection.sv_deals?.hubspot_deal_id
    let driveUrl = inspection.drive_report_url || ''

    try {
      const reportRes = await fetch(`/api/site-visit/report?inspectionId=${inspection.id}`)
      if (reportRes.ok) {
        const pdf = await reportRes.blob()
        const form = new FormData()
        form.append('file', pdf, `${inspection.site_name || 'site-visit'}-report.pdf`)
        form.append('module', 'site_visit')
        form.append('propertyAddress', inspection.site_address || inspection.site_name || 'Unknown Property')
        form.append('inspectionDate', inspection.visit_date || new Date().toISOString().slice(0, 10))
        const uploadRes = await fetch('/api/upload-to-drive', { method: 'POST', body: form })
        const uploadJson = await uploadRes.json().catch(() => null) as { webViewLink?: string; fileId?: string } | null
        if (uploadRes.ok && uploadJson) {
          driveUrl = uploadJson.webViewLink || (uploadJson.fileId ? `https://drive.google.com/file/d/${uploadJson.fileId}/view` : '')
          if (driveUrl) await getSupabase().from('sv_inspections').update({ drive_report_url: driveUrl }).eq('id', inspection.id)
        }
      }
    } catch (error) {
      console.warn('[Site Visit] Report Drive upload failed:', error)
    }

    if (!hubspotDealId) return

    const noteLines = [
      'Inspection complete - ready to quote.',
      quoter ? `Assigned quoter: ${quoter.name}` : '',
      driveUrl ? `Site visit report: ${driveUrl}` : '',
    ].filter(Boolean)

    await Promise.allSettled([
      quoter ? fetch('/api/hubspot/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: hubspotDealId,
          title: 'Quote this job',
          assignedTo: quoter.hubspot_owner_id || undefined,
          body: `Quote this job from the completed site visit.${driveUrl ? `\n\nReport: ${driveUrl}` : ''}`,
        }),
      }) : Promise.resolve(),
      fetch('/api/hubspot/update-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: hubspotDealId,
          properties: { dealstage: 'inspection_complete' },
          note: noteLines.join('\n'),
        }),
      }),
    ])
  }

  async function assignQuoter(quoterId: string) {
    if (!inspection || handoffSaving) return
    const quoter = quoters.find((item) => String(item.id) === quoterId)
    setHandoffSaving(true)
    const patch = {
      assigned_quoter_id: quoter?.id == null ? null : String(quoter.id),
      assigned_quoter_name: quoter?.name || null,
      ready_to_quote_at: new Date().toISOString(),
    }
    const { error } = await getSupabase().from('sv_inspections').update(patch).eq('id', inspection.id)
    if (error) {
      alert('Failed to assign quoter: ' + error.message)
      setHandoffSaving(false)
      return
    }
    setInspection((prev) => prev ? { ...prev, ...patch } : prev)
    await syncReadyToQuote(quoterId)
    await loadInspection()
    setHandoffSaving(false)
  }

  async function addComment() {
    if (!inspection || !comment.trim() || !canComment) return
    await getSupabase().from('sv_audit_log').insert({
      inspection_id: inspection.id,
      user_name: user?.name || null,
      action: 'comment',
      field_name: 'comment',
      old_value: null,
      new_value: comment.trim(),
    })
    setComment('')
    alert('Comment added')
  }

  const scopes = asStringArray(inspection?.scopes)
  const scopeAnswers = asMap(inspection?.scope_answers)
  const buildingNotes = asMap(inspection?.building_notes_snapshot)
  const hss = asMap(inspection?.height_safety_snapshot)
  const hazards = asMap(inspection?.todays_hazards)
  const elevations = asMap(inspection?.elevations_snapshot)
  const logistics = asMap(inspection?.site_logistics_snapshot)
  const equipment = asMap(inspection?.specific_equipment)
  const discoveryAnswers = useMemo(() => asMap(inspection?.sv_companies?.discovery_answers), [inspection?.sv_companies?.discovery_answers])

  if (!user || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-light-gray"><div className="h-8 w-8 animate-spin rounded-full border-3 border-orange border-t-transparent" /></div>
  }

  if (!inspection) {
    return <div className="min-h-screen bg-light-gray p-4 text-navy">Inspection not found.</div>
  }

  return (
    <div className="flex min-h-screen flex-col bg-light-gray">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        <div className="bg-navy px-5 py-4">
          <div className="flex items-center gap-3">
            <Link href="/site-visits" className="text-white/60 active:scale-95 transition-transform" aria-label="Back">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-bold text-white">{inspection.site_name || 'Site Visit'}</div>
              <div className="text-xs text-white/50">{savedState === 'saving' ? 'Saving...' : savedState === 'error' ? 'Save failed' : 'Saved'}</div>
            </div>
            {inspection.locked && <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white">Locked</span>}
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASSES[inspection.status] || 'bg-gray-100 text-gray-600'}`}>{STATUS_LABELS[inspection.status]}</span>
          </div>
        </div>

        <div className="flex-1 space-y-3 px-4 py-4 pb-28">
          {locked && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-navy/10 bg-white p-3 text-sm text-navy shadow-sm">
              <span>🔒 Inspection locked</span>
              <Link href={`/site-visits/${inspection.id}/audit`} className="font-semibold text-orange">Audit log</Link>
            </div>
          )}

          {inspection.status === 'inspection_complete' && (
            <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-navy">Ready to Quote</div>
                  <div className="mt-0.5 text-xs text-navy/50">{inspection.assigned_quoter_name || 'No quoter assigned'}</div>
                </div>
                {handoffSaving && <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange border-t-transparent" />}
              </div>
              {(isSales(member) || isAdmin(member)) && (
                <Field label="Assign estimator">
                  <select
                    disabled={handoffSaving || (!canEdit && !inspection.locked)}
                    value={inspection.assigned_quoter_id || ''}
                    onChange={(event) => { void assignQuoter(event.target.value) }}
                    className="min-h-[48px] w-full rounded-xl border border-navy/10 bg-light-gray px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-orange/40 disabled:opacity-60"
                  >
                    <option value="">Select quoter...</option>
                    {quoters.map((quoter) => <option key={quoter.id} value={String(quoter.id)}>{quoter.name}</option>)}
                  </select>
                </Field>
              )}
              {inspection.drive_report_url && (
                <a href={inspection.drive_report_url} target="_blank" rel="noreferrer" className="block text-sm font-semibold text-orange">Open Drive report</a>
              )}
            </section>
          )}

          {canComment && (
            <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-navy">Comments</div>
              <TextArea value={comment} placeholder="Add a handoff or review comment" onChange={(event) => setComment(event.target.value)} />
              <button type="button" disabled={!comment.trim()} onClick={addComment} className="min-h-[44px] w-full rounded-xl bg-navy font-semibold text-white disabled:opacity-50">Add Comment</button>
            </section>
          )}

          <Section title="A. Site Info" defaultOpen>
            <Field label="Site Name"><TextInput disabled={locked} value={inspection.site_name || ''} onChange={(e) => updateField('site_name', e.target.value)} /></Field>
            <Field label="Address"><TextInput disabled={locked} value={inspection.site_address || ''} onChange={(e) => updateField('site_address', e.target.value)} /></Field>
            <Field label="Contact"><TextInput disabled={locked} value={inspection.site_contact || ''} onChange={(e) => updateField('site_contact', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><TextInput disabled={locked} value={inspection.site_phone || ''} onChange={(e) => updateField('site_phone', e.target.value)} /></Field>
              <Field label="Email"><TextInput disabled={locked} value={inspection.site_email || ''} onChange={(e) => updateField('site_email', e.target.value)} /></Field>
            </div>
            <Field label="CTS/SP#"><TextInput disabled={locked} value={inspection.cts_sp_number || ''} onChange={(e) => updateField('cts_sp_number', e.target.value)} /></Field>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy/70">Site Classification</label>
              <div className="grid grid-cols-2 gap-2">
                <ChipButton disabled={locked} active={inspection.site_classification === 'simple'} onClick={() => updateField('site_classification', 'simple')}>Simple</ChipButton>
                <ChipButton disabled={locked} active={inspection.site_classification === 'complex'} onClick={() => updateField('site_classification', 'complex')}>Complex</ChipButton>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Enquiry"><TextInput disabled={locked} type="date" value={inspection.enquiry_date || ''} onChange={(e) => updateField('enquiry_date', e.target.value)} /></Field>
              <Field label="Visit"><TextInput disabled={locked} type="date" value={inspection.visit_date || ''} onChange={(e) => updateField('visit_date', e.target.value)} /></Field>
              <Field label="Proposal Due"><TextInput disabled={locked} type="date" value={inspection.proposal_due_date || ''} onChange={(e) => updateField('proposal_due_date', e.target.value)} /></Field>
              <Field label="Decision"><TextInput disabled={locked} type="date" value={inspection.decision_date || ''} onChange={(e) => updateField('decision_date', e.target.value)} /></Field>
              <Field label="Expected Start"><TextInput disabled={locked} type="date" value={inspection.expected_start_date || ''} onChange={(e) => updateField('expected_start_date', e.target.value)} /></Field>
            </div>
            <Field label="Reason for contact"><TextArea disabled={locked} value={inspection.reason_for_contact || ''} onChange={(e) => updateField('reason_for_contact', e.target.value)} /></Field>
            <Field label="How heard about us"><TextArea disabled={locked} value={inspection.how_heard_about_us || ''} onChange={(e) => updateField('how_heard_about_us', e.target.value)} /></Field>
          </Section>

          <Section title={`B. Client Discovery - ${companyName}`}>
            {DISCOVERY_QUESTIONS.map((question) => (
              <Field key={question} label={question}>
                <TextArea disabled={locked} value={getNestedString(discoveryAnswers, question, 'answer')} onChange={(e) => {
                  const next = { ...discoveryAnswers, [question]: { answer: e.target.value } }
                  if (inspection.company_id) void getSupabase().from('sv_companies').update({ discovery_answers: next }).eq('id', inspection.company_id)
                  setInspection((prev) => prev ? { ...prev, sv_companies: prev.sv_companies ? { ...prev.sv_companies, discovery_answers: next } : prev.sv_companies } : prev)
                }} />
              </Field>
            ))}
          </Section>

          <Section title="C. Services & Scopes">
            <div className="grid gap-2">
              {Object.keys(SERVICE_CATEGORIES).map((category) => (
                <ChipButton key={category} disabled={locked} active={scopes.includes(category)} onClick={() => updateJson('scopes', scopes.includes(category) ? scopes.filter((item) => item !== category) : [...scopes, category])}>{category}</ChipButton>
              ))}
            </div>
            {scopes.map((category) => (
              <div key={category} className="rounded-xl border border-navy/10 bg-light-gray p-3">
                <div className="mb-2 text-sm font-semibold text-navy">{category}</div>
                <div className="space-y-3">
                  {(SERVICE_CATEGORIES[category] || []).map((item) => {
                    const sectionKey = `${category}:${item}`
                    const checked = getChecked(scopeAnswers, sectionKey)
                    return (
                      <div key={item} className="space-y-2">
                        <ChipButton disabled={locked} active={checked} onClick={() => updateJson('scope_answers', { ...scopeAnswers, [sectionKey]: { ...asMap(scopeAnswers[sectionKey]), checked: !checked } })}>{item}</ChipButton>
                        {checked && <TextArea disabled={locked} placeholder="Comment" value={getNestedString(scopeAnswers, sectionKey)} onChange={(e) => updateJson('scope_answers', { ...scopeAnswers, [sectionKey]: { ...asMap(scopeAnswers[sectionKey]), checked: true, comment: e.target.value } })} />}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </Section>

          <Section title="D. Building Notes">
            {BUILDING_QUESTIONS.map((question) => (
              <div key={question} className="rounded-xl border border-navy/10 bg-light-gray p-3">
                <div className="mb-2 text-sm font-semibold text-navy">{question}</div>
                <div className="mb-2 grid grid-cols-3 gap-2">
                  {['yes', 'no', 'na'].map((answer) => <ChipButton key={answer} disabled={locked} active={getYesNo(buildingNotes, question) === answer} onClick={() => updateJson('building_notes_snapshot', { ...buildingNotes, [question]: { ...asMap(buildingNotes[question]), answer } })}>{answer.toUpperCase()}</ChipButton>)}
                </div>
                <TextArea disabled={locked} placeholder="Comment" value={getNestedString(buildingNotes, question)} onChange={(e) => updateJson('building_notes_snapshot', { ...buildingNotes, [question]: { ...asMap(buildingNotes[question]), comment: e.target.value } })} />
              </div>
            ))}
          </Section>

          <Section title="E. Height Safety System">
            {HSS_COMPONENTS.map((component) => {
              const checked = getChecked(hss, component)
              return (
                <div key={component} className="rounded-xl border border-navy/10 bg-light-gray p-3">
                  <ChipButton disabled={locked} active={checked} onClick={() => updateJson('height_safety_snapshot', { ...hss, [component]: { ...asMap(hss[component]), checked: !checked } })}>{component}</ChipButton>
                  <div className="mt-2 space-y-2">
                    <TextArea disabled={locked} placeholder="Comment" value={getNestedString(hss, component)} onChange={(e) => updateJson('height_safety_snapshot', { ...hss, [component]: { ...asMap(hss[component]), checked, comment: e.target.value } })} />
                    <PhotoStrip locked={locked} section={`hss:${component}`} media={media} onUpload={uploadMedia} onToggleProposal={toggleProposal} />
                  </div>
                </div>
              )
            })}
            <Field label="Last Certified Date"><TextInput disabled={locked} type="date" value={typeof hss.last_certified_date === 'string' ? hss.last_certified_date : ''} onChange={(e) => updateJson('height_safety_snapshot', { ...hss, last_certified_date: e.target.value })} /></Field>
            {['Anchor Plan', 'O&E / User Manual', 'Compliance Plate'].map((item) => <div key={item} className="rounded-xl border border-navy/10 bg-light-gray p-3"><div className="mb-2 text-sm font-semibold text-navy">{item}</div><PhotoStrip locked={locked} section={`hss-doc:${item}`} media={media} onUpload={uploadMedia} onToggleProposal={toggleProposal} /></div>)}
          </Section>

          <Section title="F. Hazards">
            {[...HAZARDS, ...Object.keys(hazards).filter((key) => key.startsWith('custom:'))].map((hazard) => {
              const checked = getChecked(hazards, hazard)
              return (
                <div key={hazard} className="rounded-xl border border-navy/10 bg-light-gray p-3">
                  <ChipButton disabled={locked} active={checked} onClick={() => updateJson('todays_hazards', { ...hazards, [hazard]: { ...asMap(hazards[hazard]), checked: !checked } })}>{hazard.replace('custom:', '')}</ChipButton>
                  <div className="mt-2 space-y-2">
                    <TextArea disabled={locked} placeholder="Comment" value={getNestedString(hazards, hazard)} onChange={(e) => updateJson('todays_hazards', { ...hazards, [hazard]: { ...asMap(hazards[hazard]), checked, comment: e.target.value } })} />
                    {hazard.startsWith('custom:') && <ChipButton disabled={locked} active={Boolean(asMap(hazards[hazard]).permanent)} onClick={() => updateJson('todays_hazards', { ...hazards, [hazard]: { ...asMap(hazards[hazard]), permanent: !asMap(hazards[hazard]).permanent } })}>Permanent property hazard</ChipButton>}
                    <PhotoStrip locked={locked} section={`hazard:${hazard}`} media={media} onUpload={uploadMedia} onToggleProposal={toggleProposal} />
                  </div>
                </div>
              )
            })}
            <button type="button" disabled={locked} onClick={() => {
              const name = window.prompt('Custom hazard name')
              if (name) updateJson('todays_hazards', { ...hazards, [`custom:${name}`]: { checked: true, comment: '', permanent: false } })
            }} className="min-h-[48px] w-full rounded-xl border border-orange/30 bg-orange/10 font-semibold text-orange disabled:opacity-50">Add Custom Hazard</button>
          </Section>

          <Section title="G. Elevations">
            {[...ELEVATIONS, ...Object.keys(elevations).filter((key) => key.startsWith('custom:'))].map((elevation) => (
              <div key={elevation} className="rounded-xl border border-navy/10 bg-light-gray p-3">
                <div className="mb-2 text-sm font-semibold text-navy">{elevation.replace('custom:', '')}</div>
                <PhotoStrip locked={locked} section={`elevation:${elevation}`} media={media} onUpload={uploadMedia} onToggleProposal={toggleProposal} />
                <TextArea disabled={locked} placeholder="Comment" value={getNestedString(elevations, elevation)} onChange={(e) => updateJson('elevations_snapshot', { ...elevations, [elevation]: { ...asMap(elevations[elevation]), comment: e.target.value } })} />
              </div>
            ))}
            <button type="button" disabled={locked} onClick={() => {
              const name = window.prompt('Custom elevation name')
              if (name) updateJson('elevations_snapshot', { ...elevations, [`custom:${name}`]: { comment: '' } })
            }} className="min-h-[48px] w-full rounded-xl border border-orange/30 bg-orange/10 font-semibold text-orange disabled:opacity-50">Add Custom Elevation</button>
          </Section>

          <Section title="H. Site Logistics">
            {LOGISTICS.map((item) => (
              <div key={item} className="rounded-xl border border-navy/10 bg-light-gray p-3">
                <div className="mb-2 text-sm font-semibold text-navy">{item}</div>
                <PhotoStrip locked={locked} section={`logistics:${item}`} media={media} onUpload={uploadMedia} onToggleProposal={toggleProposal} />
                <TextArea disabled={locked} placeholder="Comment" value={getNestedString(logistics, item)} onChange={(e) => updateJson('site_logistics_snapshot', { ...logistics, [item]: { ...asMap(logistics[item]), comment: e.target.value } })} />
              </div>
            ))}
          </Section>

          <Section title="I. Specific Equipment">
            {Object.keys(equipment).map((key) => (
              <div key={key} className="rounded-xl border border-navy/10 bg-light-gray p-3">
                <div className="mb-2 text-sm font-semibold text-navy">{key}</div>
                <PhotoStrip locked={locked} section={`equipment:${key}`} media={media} onUpload={uploadMedia} onToggleProposal={toggleProposal} />
                <TextArea disabled={locked} placeholder="Notes" value={getNestedString(equipment, key, 'notes')} onChange={(e) => updateJson('specific_equipment', { ...equipment, [key]: { ...asMap(equipment[key]), notes: e.target.value } })} />
              </div>
            ))}
            <button type="button" disabled={locked} onClick={() => {
              const name = window.prompt('Equipment item')
              if (name) updateJson('specific_equipment', { ...equipment, [name]: { notes: '' } })
            }} className="min-h-[48px] w-full rounded-xl border border-orange/30 bg-orange/10 font-semibold text-orange disabled:opacity-50">Add Equipment Item</button>
          </Section>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-light-gray/90 p-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[480px] items-center gap-3">
            <div className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${STATUS_CLASSES[inspection.status] || 'bg-gray-100 text-gray-600'}`}>{STATUS_LABELS[inspection.status]}</div>
            {inspection.locked && canUnlockInspection(member || user, inspection) ? (
              <button type="button" onClick={unlock} className="min-h-[48px] flex-1 rounded-xl bg-orange font-semibold text-white active:scale-95">🔒 Unlock for Edit</button>
            ) : canMarkComplete ? (
              <button type="button" disabled={handoffSaving} onClick={markComplete} className="min-h-[48px] flex-1 rounded-xl bg-orange font-semibold text-white active:scale-95 disabled:opacity-50">Mark Complete</button>
            ) : (
              <Link href={`/site-visits/${inspection.id}/audit`} className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-white font-semibold text-navy shadow-sm">Audit Log</Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
