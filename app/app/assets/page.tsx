'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredUser } from '../../lib/helpers'
import type { RatUser } from '../../lib/types'

const ACTIONS = [
  {
    href: '/assets/allocation',
    title: 'Asset Allocation',
    subtitle: 'Build a list and assign it out',
    bg: 'bg-orange',
    icon: (
      <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    href: '/assets/new',
    title: 'Log New Asset',
    subtitle: 'Register a new item',
    bg: 'bg-navy',
    icon: (
      <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    href: '/assets/report',
    title: 'Asset Status Report',
    subtitle: 'Search, filter and view all assets',
    bg: 'bg-indigo-600',
    icon: (
      <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 4 4 5-6" />
      </svg>
    ),
  },
]

export default function AssetsHomePage() {
  const [user, setUser] = useState<RatUser | null>(null)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
  }, [])

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
          <Link href="/" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">Asset Management</div>
            <div className="text-xs text-white/50">{user.name}</div>
          </div>
        </div>

        {/* Big action buttons */}
        <div className="flex-1 px-4 py-6 flex flex-col gap-4 justify-center">
          {ACTIONS.map(a => (
            <Link key={a.href} href={a.href}>
              <div className={`${a.bg} text-white rounded-2xl px-6 py-7 flex items-center gap-5 shadow-sm active:scale-[0.98] transition-all duration-150 min-h-[120px]`}>
                <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                  {a.icon}
                </div>
                <div>
                  <div className="text-xl font-bold leading-tight">{a.title}</div>
                  <div className="text-sm text-white/70 mt-1">{a.subtitle}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
