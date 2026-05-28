'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser } from '@/lib/types'

interface SiteVisit {
  id: string
  buildingName: string
  buildingAddress: string
  suburb: string
  contactName: string
  contactPhone: string
  status: string
  visitDate: string
  visitTime: string
  salesRep: string
  estimatedValue: number
  servicesRequired: string[]
  createdAt: string
}

type TabFilter = 'All' | 'Scheduled' | 'Completed' | 'Cancelled'

export default function SiteVisitListPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [visits, setVisits] = useState<SiteVisit[]>([])
  const [tab, setTab] = useState<TabFilter>('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    try {
      const raw = localStorage.getItem('siteVisits')
      if (raw) setVisits(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  if (!user) return null

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

  const totalVisits = visits.length
  const scheduledCount = visits.filter(v => v.status === 'Scheduled').length
  const completedThisMonth = visits.filter(v => v.status === 'Completed' && v.visitDate >= monthStart).length

  const filtered = visits
    .filter(v => tab === 'All' || v.status === tab)
    .filter(v => {
      if (!search) return true
      const s = search.toLowerCase()
      return v.buildingName?.toLowerCase().includes(s) ||
        v.contactName?.toLowerCase().includes(s) ||
        v.suburb?.toLowerCase().includes(s) ||
        v.buildingAddress?.toLowerCase().includes(s)
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const tabs: TabFilter[] = ['All', 'Scheduled', 'Completed', 'Cancelled']

  const statusColor = (s: string) => {
    switch (s) {
      case 'Scheduled': return 'bg-blue-500/20 text-blue-400'
      case 'Completed': return 'bg-green-500/20 text-green-400'
      case 'Cancelled': return 'bg-red-500/20 text-red-400'
      default: return 'bg-zinc-700 text-zinc-400'
    }
  }

  const formatDate = (d: string) => {
    if (!d) return ''
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const formatCurrency = (v: number) => {
    if (!v) return ''
    return '$' + v.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Site Visits</h1>
            <p className="text-xs text-zinc-500">{user.name}</p>
          </div>
        </div>
        <Link
          href="/site-visit/new"
          className="bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-xl
            active:scale-95 transition-all duration-150"
        >
          + New
        </Link>
      </div>

      <div className="px-4 max-w-lg mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 py-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-white">{totalVisits}</div>
            <div className="text-[10px] text-zinc-500 font-medium">Total</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">{scheduledCount}</div>
            <div className="text-[10px] text-zinc-500 font-medium">Scheduled</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{completedThisMonth}</div>
            <div className="text-[10px] text-zinc-500 font-medium">Done (Month)</div>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search building, contact, suburb..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white
            focus:border-orange-500 focus:outline-none placeholder-zinc-500 mb-3"
        />

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-150
                ${tab === t
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 active:scale-95'
                }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3 pb-6">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <div className="text-sm font-medium">No site visits yet</div>
              <div className="text-xs mt-1">Tap + New to create one</div>
            </div>
          ) : (
            filtered.map(v => (
              <Link key={v.id} href={`/site-visit/${v.id}`}>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 active:scale-[0.98] transition-all duration-150">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-sm text-white leading-tight flex-1 mr-2">
                      {v.buildingName}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColor(v.status)}`}>
                      {v.status}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 mb-1">{v.buildingAddress}{v.suburb ? `, ${v.suburb}` : ''}</div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs text-zinc-600">
                      {v.contactName && <span>{v.contactName} · </span>}
                      {formatDate(v.visitDate)}
                    </div>
                    {v.estimatedValue > 0 && (
                      <div className="text-xs font-bold text-orange-500">{formatCurrency(v.estimatedValue)}</div>
                    )}
                  </div>
                  {v.servicesRequired?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {v.servicesRequired.slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded-full">{s}</span>
                      ))}
                      {v.servicesRequired.length > 3 && (
                        <span className="text-[10px] text-zinc-600">+{v.servicesRequired.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
