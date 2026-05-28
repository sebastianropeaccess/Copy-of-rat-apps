'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getStoredUser, isVideoUrl } from '@/lib/helpers'
import { getSupabase } from '@/lib/supabase'
import type { BrokenGearReport, RatUser } from '@/lib/types'

const STATUS_OPTIONS = [
  { value: 'reported', label: 'Reported' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'replacement_arranged', label: 'Replacement Arranged' },
  { value: 'sent_for_repair', label: 'Sent for Repair' },
  { value: 'repaired', label: 'Repaired' },
  { value: 'retired', label: 'Retired' },
  { value: 'closed', label: 'Closed' },
] as const

const OPEN_STATUSES = new Set(['reported', 'reviewed', 'replacement_arranged', 'sent_for_repair'])

function statusLabel(value: string) {
  return STATUS_OPTIONS.find((status) => status.value === value)?.label || value
}

function severityStyle(severity: BrokenGearReport['severity']) {
  if (severity === 'critical') return 'bg-red-600 text-white'
  if (severity === 'high') return 'bg-red-100 text-red-700'
  if (severity === 'medium') return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

function statusStyle(status: BrokenGearReport['status']) {
  if (status === 'closed' || status === 'repaired') return 'bg-green-100 text-green-700'
  if (status === 'retired') return 'bg-zinc-200 text-zinc-700'
  if (status === 'sent_for_repair') return 'bg-blue-100 text-blue-700'
  if (status === 'replacement_arranged') return 'bg-orange/10 text-orange'
  return 'bg-red-50 text-red-700'
}

export default function BrokenGearPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [reports, setReports] = useState<BrokenGearReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'open' | 'all' | 'closed'>('open')
  const [selected, setSelected] = useState<BrokenGearReport | null>(null)
  const [nextStatus, setNextStatus] = useState<BrokenGearReport['status']>('reviewed')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)
    loadReports()
  }, [])

  async function loadReports() {
    setLoading(true)
    const { data } = await getSupabase()
      .from('broken_gear_reports')
      .select('*, broken_gear_media(*)')
      .order('reported_at', { ascending: false })
    setReports((data || []) as BrokenGearReport[])
    setLoading(false)
  }

  const visibleReports = useMemo(() => {
    if (filter === 'all') return reports
    if (filter === 'closed') return reports.filter((report) => !OPEN_STATUSES.has(report.status))
    return reports.filter((report) => OPEN_STATUSES.has(report.status))
  }, [reports, filter])

  const openCount = reports.filter((report) => OPEN_STATUSES.has(report.status)).length
  const replacementCount = reports.filter((report) => OPEN_STATUSES.has(report.status) && report.replacement_required).length
  const outOfServiceCount = reports.filter((report) => OPEN_STATUSES.has(report.status) && report.remove_from_service).length

  function openStatusModal(report: BrokenGearReport) {
    setSelected(report)
    setNextStatus(report.status === 'reported' ? 'reviewed' : report.status)
    setNotes(report.resolution_notes || '')
  }

  async function saveStatus() {
    if (!user || !selected) return
    setSaving(true)
    const response = await fetch('/api/broken-gear', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        status: nextStatus,
        resolution_notes: notes,
        reviewed_by: user.name,
      }),
    })
    setSaving(false)
    if (!response.ok) {
      alert('Could not update report status.')
      return
    }
    setSelected(null)
    await loadReports()
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen flex-col bg-light-gray">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        <div className="bg-navy px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-white/60 active:text-white transition-all">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              </Link>
              <div>
                <div className="text-xl font-bold text-white">Broken Gear</div>
                <div className="text-xs text-white/50">{user.name}</div>
              </div>
            </div>
            <Link href="/broken-gear/new" className="flex min-h-[44px] items-center rounded-xl bg-orange px-4 text-sm font-semibold text-white active:scale-95 transition-all">
              + Report
            </Link>
          </div>
        </div>

        <div className="flex-1 px-4 py-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="text-2xl font-bold text-navy">{openCount}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-navy/45">Open</div>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="text-2xl font-bold text-orange">{replacementCount}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-navy/45">Replace</div>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="text-2xl font-bold text-red-600">{outOfServiceCount}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-navy/45">Stopped</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { value: 'open', label: 'Open' },
              { value: 'all', label: 'All' },
              { value: 'closed', label: 'Closed' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value as typeof filter)}
                className={`min-h-[44px] rounded-xl text-sm font-semibold transition-all ${
                  filter === option.value ? 'bg-navy text-white' : 'bg-white text-navy/55'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 rounded-full border-3 border-orange border-t-transparent animate-spin" />
            </div>
          ) : visibleReports.length === 0 ? (
            <div className="py-12 text-center text-navy/40">No broken gear reports.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {visibleReports.map((report) => {
                const firstMedia = report.broken_gear_media?.[0]
                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => openStatusModal(report)}
                    className="block w-full rounded-2xl bg-white p-4 text-left shadow-sm active:scale-[0.99] transition-all"
                  >
                    <div className="flex gap-3">
                      {firstMedia ? (
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-light-gray">
                          {isVideoUrl(firstMedia.url) ? (
                            <video src={firstMedia.url} className="h-full w-full object-cover" muted />
                          ) : (
                            <img src={firstMedia.url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-light-gray text-navy/30">
                          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${severityStyle(report.severity)}`}>{report.severity}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${statusStyle(report.status)}`}>{statusLabel(report.status)}</span>
                        </div>
                        <div className="mt-2 truncate text-sm font-bold text-navy">{report.gear_make} {report.gear_model}</div>
                        <div className="mt-0.5 text-xs text-navy/50">{report.gear_id || report.gear_category || 'No asset number'}</div>
                        <div className="mt-2 line-clamp-2 text-sm text-navy/70">{report.issue_description}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-navy/45">
                          <span>{report.reported_by}</span>
                          {report.job_number && <span>{report.job_number}</span>}
                          {report.replacement_required && <span className="text-orange">Replacement needed</span>}
                          {report.remove_from_service && <span className="text-red-600">Out of service</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="w-full max-w-[480px] rounded-t-2xl bg-white p-5 pb-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-navy">{selected.gear_make} {selected.gear_model}</div>
                <div className="mt-1 text-sm text-navy/55">{selected.issue_description}</div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-light-gray text-navy/55">×</button>
            </div>

            {selected.broken_gear_media?.length ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {selected.broken_gear_media.map((media) => (
                  <a key={media.id} href={media.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl bg-light-gray">
                    {isVideoUrl(media.url) ? <video src={media.url} className="h-full w-full object-cover" muted /> : <img src={media.url} alt="" className="h-full w-full object-cover" />}
                  </a>
                ))}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy/70">Status</label>
                <select
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value as BrokenGearReport['status'])}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-navy min-h-[48px] focus:border-orange focus:outline-none"
                >
                  {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy/70">Resolution / repair notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="min-h-[100px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-navy focus:border-orange focus:outline-none"
                  placeholder="Replacement sent, sent to supplier, repaired, retired, etc."
                />
              </div>
              {selected.notification_error && (
                <div className="rounded-xl bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-700">
                  Email notice: {selected.notification_error}
                </div>
              )}
              <button
                type="button"
                onClick={saveStatus}
                disabled={saving}
                className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-orange px-4 py-4 text-base font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
