'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser } from '@/lib/types'

interface JobData {
  id: number
  description: string
  parsedDescription: {
    location: string
    client: string
    services: string
    date: string
  }
  customer: string | null
  site: string | null
  stage: string | null
  status: { name: string; color: string } | null
  dateIssued: string | null
  dueDate: string | null
  completedDate: string | null
  total: { exTax: number; incTax: number; tax: number }
  financials: {
    invoicedValue: number
    invoicePercentage: number
    laborHoursActual: number
    materialsCostEstimate: number
    grossMarginActual: number
  }
  crew: string[]
  totalScheduledHours: number
  scheduleDateRange: { start: string; end: string; totalDays: number } | null
  upcomingSchedule: Array<{
    date: string
    staff: string
    hours: number
    startTime: string
    endTime: string
  }>
}

interface JobsSummary {
  total: number
  inProgress: number
  totalValueExTax: number
  totalInvoiced: number
}

type StageFilter = 'all' | 'Progress' | 'Complete' | 'Pending'

const STAGE_LABELS: Record<StageFilter, string> = {
  all: 'All',
  Progress: 'In Progress',
  Complete: 'Complete',
  Pending: 'Pending',
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`
  }
  return `$${amount.toFixed(0)}`
}

function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getStageColor(stage: string | null): string {
  switch (stage) {
    case 'Progress': return 'bg-blue-100 text-blue-700'
    case 'Complete': return 'bg-green-100 text-green-700'
    case 'Pending': return 'bg-yellow-100 text-yellow-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function getJobTitle(job: JobData): string {
  // Try to extract a clean title from description
  if (job.site) return job.site
  const desc = job.description
  // Remove "GC - " prefix
  const cleaned = desc.replace(/^GC\s*-\s*/, '').replace(/\s*\[.*\].*$/, '')
  // Take first meaningful part
  const parts = cleaned.split(' - ')
  return parts[0] || desc.slice(0, 50)
}

function getJobSubtitle(job: JobData): string {
  const parts: string[] = []
  if (job.customer) parts.push(job.customer)
  if (job.parsedDescription.services) parts.push(job.parsedDescription.services)
  return parts.join(' · ') || job.description.slice(0, 60)
}

export default function JobsPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [jobs, setJobs] = useState<JobData[]>([])
  const [summary, setSummary] = useState<JobsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StageFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const loadJobs = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/simpro?action=jobs')
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`)
      const data = await res.json()
      setJobs(data.jobs)
      setSummary(data.summary)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)
    loadJobs()
  }, [loadJobs])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const j of jobs) {
      const stage = j.stage || 'Unknown'
      counts[stage] = (counts[stage] || 0) + 1
    }
    return counts
  }, [jobs])

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      // Stage filter
      if (filter !== 'all' && j.stage !== filter) return false
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          (j.site || '').toLowerCase().includes(q) ||
          (j.customer || '').toLowerCase().includes(q) ||
          j.description.toLowerCase().includes(q) ||
          j.crew.some(c => c.toLowerCase().includes(q)) ||
          String(j.id).includes(q)
        )
      }
      return true
    })
  }, [jobs, filter, searchQuery])

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-navy/40">Loading jobs from Simpro...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-white/60">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Link>
              <div>
                <div className="text-lg font-bold text-white">Jobs</div>
                <div className="text-[10px] text-white/40">
                  {summary ? `${summary.total} jobs · ${formatCurrency(summary.totalValueExTax)} pipeline` : 'Loading...'}
                </div>
              </div>
            </div>
            <button
              onClick={() => loadJobs(true)}
              disabled={refreshing}
              className="text-white/60 p-2 rounded-lg bg-white/10
                active:bg-white/20 active:scale-95 transition-all duration-150
                disabled:opacity-40"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={refreshing ? 'animate-spin' : ''}
              >
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0115-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 01-15 6.7L3 16" />
              </svg>
            </button>
          </div>

          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-white/10 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-white">{summary.inProgress}</div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider">Active</div>
              </div>
              <div className="bg-white/10 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-orange">{formatCurrency(summary.totalValueExTax)}</div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider">Pipeline</div>
              </div>
              <div className="bg-white/10 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-green-400">{formatCurrency(summary.totalInvoiced)}</div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider">Invoiced</div>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/30"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs, sites, clients, crew..."
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-orange"
            />
          </div>
        </div>

        {/* Stage filter pills */}
        <div className="px-4 pt-3 overflow-x-auto">
          <div className="flex gap-1.5 pb-1">
            {(Object.keys(STAGE_LABELS) as StageFilter[]).map((s) => {
              const count = s === 'all' ? jobs.length : (stageCounts[s] || 0)
              const isActive = filter === s
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all
                    ${isActive
                      ? 'bg-navy text-white'
                      : 'bg-white text-navy/50 border border-gray-200'
                    }`}
                >
                  {STAGE_LABELS[s]}
                  <span className={`text-[9px] ${isActive ? 'text-white/60' : 'text-navy/30'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 text-red-600 text-sm rounded-xl">
            {error}
          </div>
        )}

        {/* Job list */}
        <div className="flex-1 px-4 py-3">
          {filtered.length === 0 ? (
            <div className="text-center text-navy/40 py-20">
              <svg className="mx-auto mb-3 text-navy/20" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
              </svg>
              <div className="text-lg mb-1">No jobs found</div>
              <div className="text-sm">
                {searchQuery ? 'Try a different search' : 'No jobs match this filter'}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 text-center text-[10px] text-navy/30">
          Data from Simpro · Auto-refreshes every 5 min
        </div>
      </div>
    </div>
  )
}

function JobCard({ job }: { job: JobData }) {
  const [expanded, setExpanded] = useState(false)

  const title = getJobTitle(job)
  const subtitle = getJobSubtitle(job)
  const stageColor = getStageColor(job.stage)

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div
        className="p-4 active:bg-gray-50 transition-all cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-sm text-navy truncate">{title}</span>
              <span className="text-[9px] text-navy/30 flex-shrink-0">#{job.id}</span>
            </div>
            <div className="text-[11px] text-navy/40 truncate">{subtitle}</div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${stageColor}`}>
              {job.status?.name || job.stage || '—'}
            </span>
            <span className="text-sm font-bold text-navy">
              {formatCurrencyFull(job.total.exTax)}
            </span>
          </div>
        </div>

        {/* Quick info row */}
        <div className="flex items-center gap-3 mt-2">
          {job.crew.length > 0 && (
            <div className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-navy/30">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <span className="text-[10px] text-navy/40">{job.crew.length}</span>
            </div>
          )}
          {job.totalScheduledHours > 0 && (
            <div className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-navy/30">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="text-[10px] text-navy/40">{job.totalScheduledHours}h</span>
            </div>
          )}
          {job.scheduleDateRange && (
            <div className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-navy/30">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <span className="text-[10px] text-navy/40">
                {formatDate(job.scheduleDateRange.start)}
                {job.scheduleDateRange.totalDays > 1 && ` → ${formatDate(job.scheduleDateRange.end)}`}
              </span>
            </div>
          )}
          <div className="flex-1" />
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-navy/20 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          {/* Financials */}
          <div className="mb-3">
            <div className="text-[10px] font-medium text-navy/40 uppercase tracking-wider mb-2">Financials</div>
            <div className="grid grid-cols-2 gap-2">
              <FinancialItem label="Job Value (ex GST)" value={formatCurrencyFull(job.total.exTax)} />
              <FinancialItem label="Inc GST" value={formatCurrencyFull(job.total.incTax)} />
              <FinancialItem label="Invoiced" value={formatCurrencyFull(job.financials.invoicedValue)} />
              <FinancialItem
                label="Invoice %"
                value={`${job.financials.invoicePercentage.toFixed(0)}%`}
                highlight={job.financials.invoicePercentage < 100 && job.total.exTax > 0}
              />
              <FinancialItem label="Labour Hours" value={`${job.financials.laborHoursActual}h`} />
              <FinancialItem
                label="Gross Margin"
                value={`${job.financials.grossMarginActual.toFixed(0)}%`}
                highlight={job.financials.grossMarginActual < 30}
              />
            </div>
          </div>

          {/* Invoice progress bar */}
          {job.total.exTax > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-navy/40">Invoiced vs Value</span>
                <span className="text-[10px] font-medium text-navy/60">
                  {formatCurrencyFull(job.financials.invoicedValue)} / {formatCurrencyFull(job.total.exTax)}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    job.financials.invoicePercentage >= 100
                      ? 'bg-green-500'
                      : job.financials.invoicePercentage >= 50
                      ? 'bg-blue-500'
                      : job.financials.invoicePercentage > 0
                      ? 'bg-orange'
                      : 'bg-red-400'
                  }`}
                  style={{ width: `${Math.min(job.financials.invoicePercentage, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Crew */}
          {job.crew.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-medium text-navy/40 uppercase tracking-wider mb-2">
                Crew ({job.crew.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {job.crew.map((name) => (
                  <span
                    key={name}
                    className="text-[11px] bg-navy/5 text-navy/60 px-2.5 py-1 rounded-full"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Schedule */}
          {job.scheduleDateRange && (
            <div className="mb-3">
              <div className="text-[10px] font-medium text-navy/40 uppercase tracking-wider mb-2">
                Schedule · {job.scheduleDateRange.totalDays} day{job.scheduleDateRange.totalDays !== 1 ? 's' : ''} · {job.totalScheduledHours}h total
              </div>
              <div className="text-[11px] text-navy/50">
                {formatDateFull(job.scheduleDateRange.start)} → {formatDateFull(job.scheduleDateRange.end)}
              </div>
            </div>
          )}

          {/* Upcoming schedule entries */}
          {job.upcomingSchedule.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-medium text-navy/40 uppercase tracking-wider mb-2">Upcoming</div>
              <div className="flex flex-col gap-1">
                {job.upcomingSchedule.map((s, i) => (
                  <div
                    key={`${s.date}-${s.staff}-${i}`}
                    className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-navy/60 w-14">
                        {formatDate(s.date)}
                      </span>
                      <span className="text-[11px] text-navy/50">{s.staff}</span>
                    </div>
                    <span className="text-[10px] text-navy/40">
                      {s.startTime}–{s.endTime} ({s.hours}h)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="mt-2 pt-2 border-t border-gray-50">
            <div className="grid grid-cols-2 gap-y-1.5">
              {job.customer && (
                <>
                  <span className="text-[10px] text-navy/30">Customer</span>
                  <span className="text-[11px] text-navy/60 text-right">{job.customer}</span>
                </>
              )}
              {job.site && (
                <>
                  <span className="text-[10px] text-navy/30">Site</span>
                  <span className="text-[11px] text-navy/60 text-right">{job.site}</span>
                </>
              )}
              {job.dateIssued && (
                <>
                  <span className="text-[10px] text-navy/30">Issued</span>
                  <span className="text-[11px] text-navy/60 text-right">{formatDateFull(job.dateIssued)}</span>
                </>
              )}
              <span className="text-[10px] text-navy/30">Simpro ID</span>
              <span className="text-[11px] text-navy/60 text-right">#{job.id}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FinancialItem({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-[9px] text-navy/30 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-semibold ${highlight ? 'text-orange' : 'text-navy/70'}`}>
        {value}
      </div>
    </div>
  )
}
