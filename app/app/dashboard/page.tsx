'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser } from '@/lib/types'

interface DashboardData {
  stats: {
    totalJobs: number
    totalPipelineExTax: number
    totalPipelineIncTax: number
    totalQuotesExTax: number
    employeeCount: number
    weekHours: number
    weekTechCount: number
  }
  jobs: Array<{
    id: number
    description: string
    location: string
    client: string
    services: string
    dateInfo: string
    totalExTax: number
    totalIncTax: number
  }>
  weekSchedule: Array<{
    date: string
    dayName: string
    isToday: boolean
    entries: Array<{
      staff: string
      staffId: number
      hours: number
      startTime: string
      endTime: string
      jobRef: string
    }>
  }>
  nextWeekSchedule: Array<{
    date: string
    dayName: string
    isToday: boolean
    entries: Array<{
      staff: string
      staffId: number
      hours: number
      startTime: string
      endTime: string
      jobRef: string
    }>
  }>
  employees: Array<{ id: number; name: string }>
}

function formatMoney(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`
  return `$${amount.toFixed(0)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default function DashboardPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'this-week' | 'next-week'>('this-week')
  const [showAllJobs, setShowAllJobs] = useState(false)

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/simpro?action=dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)
    loadDashboard()
  }, [loadDashboard])

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-navy/40">Loading from Simpro...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-light-gray">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/" className="text-white/60">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="text-lg font-bold text-white">Ops Dashboard</div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center max-w-sm">
            <div className="text-red-600 font-semibold mb-1">Connection Error</div>
            <div className="text-red-500 text-sm mb-3">{error}</div>
            <button
              onClick={() => { setLoading(true); setError(null); loadDashboard() }}
              className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const schedule = tab === 'this-week' ? data.weekSchedule : data.nextWeekSchedule
  const visibleJobs = showAllJobs ? data.jobs : data.jobs.slice(0, 5)

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <div>
              <div className="text-lg font-bold text-white">Ops Dashboard</div>
              <div className="text-[10px] text-white/40">Live from Simpro</div>
            </div>
          </div>
          <button
            onClick={() => { setLoading(true); loadDashboard() }}
            className="text-white/60 p-2 rounded-lg bg-white/10 active:bg-white/20 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-4 py-4 flex flex-col gap-4 pb-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Job Pipeline"
              value={formatMoney(data.stats.totalPipelineExTax)}
              sub={`${data.stats.totalJobs} active jobs`}
              color="text-green-600"
              bgColor="bg-green-50"
            />
            <StatCard
              label="Quote Pipeline"
              value={formatMoney(data.stats.totalQuotesExTax)}
              sub="pending quotes"
              color="text-blue-600"
              bgColor="bg-blue-50"
            />
            <StatCard
              label="Week Hours"
              value={`${data.stats.weekHours}h`}
              sub={`${data.stats.weekTechCount} techs scheduled`}
              color="text-orange"
              bgColor="bg-orange-50"
            />
            <StatCard
              label="Team Size"
              value={String(data.stats.employeeCount)}
              sub="in Simpro"
              color="text-purple-600"
              bgColor="bg-purple-50"
            />
          </div>

          {/* Schedule Section */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy">Schedule</h2>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setTab('this-week')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    tab === 'this-week'
                      ? 'bg-white text-navy shadow-sm'
                      : 'text-navy/40'
                  }`}
                >
                  This Week
                </button>
                <button
                  onClick={() => setTab('next-week')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    tab === 'next-week'
                      ? 'bg-white text-navy shadow-sm'
                      : 'text-navy/40'
                  }`}
                >
                  Next Week
                </button>
              </div>
            </div>

            <div className="px-4 pb-4">
              {schedule.map((day) => (
                <div
                  key={day.date}
                  className={`py-3 border-b border-gray-50 last:border-b-0 ${
                    day.isToday ? 'bg-orange/5 -mx-4 px-4 rounded-lg' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${day.isToday ? 'text-orange' : 'text-navy/60'}`}>
                        {day.dayName}
                      </span>
                      <span className="text-[10px] text-navy/30">{formatDate(day.date)}</span>
                      {day.isToday && (
                        <span className="text-[9px] bg-orange text-white px-1.5 py-0.5 rounded-full font-bold">
                          TODAY
                        </span>
                      )}
                    </div>
                    {day.entries.length > 0 && (
                      <span className="text-[10px] text-navy/30">
                        {day.entries.reduce((s, e) => s + e.hours, 0)}h · {new Set(day.entries.map((e) => e.staffId)).size} techs
                      </span>
                    )}
                  </div>
                  {day.entries.length === 0 ? (
                    <div className="text-[11px] text-navy/20 italic">No schedule</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {/* Group by job ref */}
                      {Object.entries(
                        day.entries.reduce<Record<string, typeof day.entries>>((acc, e) => {
                          if (!acc[e.jobRef]) acc[e.jobRef] = []
                          acc[e.jobRef].push(e)
                          return acc
                        }, {})
                      ).map(([ref, entries]) => (
                        <div key={ref} className="flex items-start gap-2">
                          <span className="text-[10px] text-navy/30 font-mono mt-0.5 shrink-0 w-10">
                            {entries[0].startTime}
                          </span>
                          <div className="flex-1">
                            <div className="text-[11px] text-navy/50 font-medium">
                              Job {ref}
                            </div>
                            <div className="text-[10px] text-navy/30">
                              {entries.map((e) => e.staff).join(', ')} · {entries[0].hours}h
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Jobs Pipeline */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy">Active Jobs</h2>
              <span className="text-[10px] text-navy/30 bg-navy/5 px-2 py-0.5 rounded-full">
                {data.stats.totalJobs} total
              </span>
            </div>
            <div className="px-4 pb-4">
              {visibleJobs.map((job) => (
                <div key={job.id} className="py-3 border-b border-gray-50 last:border-b-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 mr-2">
                      <div className="text-[11px] font-semibold text-navy leading-tight">
                        {job.description}
                      </div>
                      {job.dateInfo && (
                        <div className="text-[10px] text-navy/30 mt-0.5">{job.dateInfo}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-green-600">
                        {formatMoney(job.totalExTax)}
                      </div>
                      <div className="text-[9px] text-navy/30">ex GST</div>
                    </div>
                  </div>
                </div>
              ))}
              {data.jobs.length > 5 && (
                <button
                  onClick={() => setShowAllJobs(!showAllJobs)}
                  className="w-full text-center text-xs text-orange font-medium py-2 mt-1"
                >
                  {showAllJobs ? 'Show less' : `Show all ${data.jobs.length} jobs`}
                </button>
              )}
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-sm font-bold text-navy">Team ({data.employees.length})</h2>
            </div>
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {data.employees.map((emp) => {
                  // Check if scheduled this week
                  const isScheduled = data.weekSchedule.some((day) =>
                    day.entries.some((e) => e.staffId === emp.id)
                  )
                  return (
                    <span
                      key={emp.id}
                      className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                        isScheduled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-navy/40'
                      }`}
                    >
                      {emp.name}
                    </span>
                  )
                })}
              </div>
              <div className="flex items-center gap-3 mt-3 text-[10px] text-navy/30">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400" /> Scheduled this week
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-300" /> Not scheduled
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  color,
  bgColor,
}: {
  label: string
  value: string
  sub: string
  color: string
  bgColor: string
}) {
  return (
    <div className={`${bgColor} rounded-xl p-4`}>
      <div className="text-[10px] font-medium text-navy/40 uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold ${color} mt-1`}>{value}</div>
      <div className="text-[10px] text-navy/30 mt-0.5">{sub}</div>
    </div>
  )
}
