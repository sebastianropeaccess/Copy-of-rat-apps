'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import { getSupabase } from '@/lib/supabase'
import type { RatUser, SvCompany, SvDeal, SvInspection, SvProperty, TeamMember } from '@/lib/types'

type StatusFilter = 'all' | 'enquiry' | 'site_visit_scheduled' | 'site_visit_in_progress' | 'inspection_complete' | 'quoted'
type InspectionRow = SvInspection & {
  sv_properties: Pick<SvProperty, 'building_name' | 'address'> | null
  sv_companies: Pick<SvCompany, 'name'> | null
  sv_deals: Pick<SvDeal, 'hubspot_deal_id' | 'stage'> | null
}

const FILTERS: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Enquiry', value: 'enquiry' },
  { label: 'Scheduled', value: 'site_visit_scheduled' },
  { label: 'In Progress', value: 'site_visit_in_progress' },
  { label: 'Complete', value: 'inspection_complete' },
  { label: 'Quoted', value: 'quoted' },
]

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

function formatDate(value: string | null) {
  if (!value) return 'No date set'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
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

function hasSiteVisitAccess(member: TeamMember | RatUser | null) {
  return Boolean(
    member &&
    (isAdmin(member) ||
      isManager(member) ||
      member.can_access_apps?.includes('site_visit') ||
      member.can_access_apps?.includes('site-visits'))
  )
}

function canReadAll(member: TeamMember | RatUser | null) {
  return isAdmin(member) || isManager(member)
}

function canCreate(member: TeamMember | RatUser | null) {
  return isAdmin(member) || isSales(member)
}

export default function SiteVisitsPage() {
  const [user] = useState<RatUser | null>(() => getStoredUser())
  const [member, setMember] = useState<TeamMember | null>(null)
  const [inspections, setInspections] = useState<InspectionRow[]>([])
  const [salespeople, setSalespeople] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)

  const loadInspections = useCallback(async (teamMember: TeamMember) => {
    let query = getSupabase()
      .from('sv_inspections')
      .select('*, sv_properties(building_name,address), sv_companies(name), sv_deals(hubspot_deal_id,stage)')
      .order('created_at', { ascending: false })

    if (!canReadAll(teamMember)) {
      if (isSales(teamMember)) {
        query = query.or(`salesperson_id.eq.${teamMember.id},created_by.eq.${teamMember.id}`)
      } else if (isEstimator(teamMember)) {
        query = query.eq('assigned_quoter_id', teamMember.id)
      } else {
        setInspections([])
        setLoading(false)
        return
      }
    }

    const { data } = await query
    const rows = (data || []) as InspectionRow[]
    const ids = Array.from(new Set(rows.map((row) => row.salesperson_id || row.created_by).filter((id): id is string => Boolean(id))))
    if (ids.length > 0) {
      const { data: members } = await getSupabase().from('team_members').select('id,name').in('id', ids)
      const names: Record<string, string> = {}
      ;(members || []).forEach((member: { id: string; name: string }) => { names[member.id] = member.name })
      setSalespeople(names)
    }
    setInspections(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) { window.location.href = '/login'; return }
    const timer = window.setTimeout(async () => {
      const { data } = await getSupabase().from('team_members').select('*').eq('id', user.id).single()
      const teamMember = data as TeamMember | null
      if (!hasSiteVisitAccess(teamMember || user)) { window.location.href = '/'; return }
      setMember(teamMember)
      await loadInspections(teamMember || user as unknown as TeamMember)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadInspections, user])

  if (!user) return null

  const filtered = filter === 'all' ? inspections : inspections.filter((inspection) => inspection.status === filter)

  return (
    <div className="flex min-h-screen flex-col bg-light-gray">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        <div className="bg-navy px-5 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60 active:scale-95 transition-transform" aria-label="Back to home">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div>
              <div className="text-lg font-bold text-white">Site Visits</div>
              <div className="text-xs text-white/50">{user.name}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 pb-24">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                onClick={() => setFilter(item.value)}
                className={`min-h-[40px] shrink-0 rounded-full px-3 text-xs font-semibold transition-all ${
                  filter === item.value ? 'bg-orange text-white' : 'border border-navy/10 bg-white text-navy/55'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-orange border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-navy/40">No site visits found</div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((inspection) => (
                <Link key={inspection.id} href={`/site-visits/${inspection.id}`}>
                  <div className="rounded-xl bg-white p-4 shadow-sm transition-all duration-150 active:scale-[0.98]">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-navy">{inspection.site_name || inspection.sv_properties?.building_name || 'Unnamed site'}</div>
                        <div className="mt-0.5 truncate text-xs text-navy/50">{inspection.sv_companies?.name || 'No company linked'}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASSES[inspection.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[inspection.status] || inspection.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-navy/55">
                      <span>{formatDate(inspection.visit_date)}</span>
                      <span>{salespeople[inspection.salesperson_id || inspection.created_by || ''] || 'Unassigned'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-light-gray/90 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-[480px]">
            {canCreate(member || user) && (
              <Link href="/site-visits/new" className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-orange py-3 text-center font-semibold text-white transition-all duration-150 active:scale-95">
                + New Site Visit
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
