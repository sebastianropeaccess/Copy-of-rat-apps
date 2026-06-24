'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredUser, clearStoredUser } from '../lib/helpers'
import type { RatUser } from '../lib/types'

const apps = [
  { name: 'Ops Dashboard', icon: 'dashboard', color: 'bg-navy', status: 'Active', href: '/dashboard', appKey: 'dashboard' },
  { name: 'Sales Pipeline', icon: 'chart', color: 'bg-orange', status: 'Active', href: '/pipeline', appKey: 'pipeline' },
  { name: 'Site Visits', icon: 'building-clipboard', color: 'bg-orange', status: 'Active', href: '/site-visits', appKey: 'site_visit' },
  { name: 'Jobs', icon: 'briefcase', color: 'bg-indigo-600', status: 'Active', href: '/jobs', appKey: 'jobs' },
  { name: 'Drop Tracker', icon: 'check', color: 'bg-green-500', status: 'Active', href: '/drop-tracker', appKey: 'drop-tracker' },
  { name: 'Candidates', icon: 'people', color: 'bg-cyan-600', status: 'Active', href: '/candidates', appKey: 'candidates' },
  { name: 'Timesheets', icon: 'clock', color: 'bg-teal-500', status: 'Active', href: '/timesheet', appKey: 'timesheets' },
  { name: 'Receipts', icon: 'receipt', color: 'bg-green-600', status: 'Active', href: '/receipts', appKey: 'receipts' },
  { name: 'Supervisor Review', icon: 'clipboard-check', color: 'bg-navy', status: 'Active', href: '/supervisor', appKey: 'supervisor' },
  { name: 'Toolbox Talk', icon: 'megaphone', color: 'bg-orange', status: 'Active', href: '/toolbox-talk', appKey: 'toolbox-talk' },
  { name: 'Asset Management', icon: 'package', color: 'bg-amber-600', status: 'Active', href: '/assets', appKey: 'asset-management' },
  { name: 'Inspections', icon: 'clipboard-check', color: 'bg-teal-600', status: 'Active', href: '/inspections', appKey: 'inspections' },
  { name: 'Gear Registry', icon: 'shield', color: 'bg-purple-500', status: 'Active', href: '/gear', appKey: 'gear-registry' },
  { name: 'Broken Gear', icon: 'alert-tool', color: 'bg-red-600', status: 'Active', href: '/broken-gear', appKey: 'broken-gear' },
  { name: 'Leave Request', icon: 'calendar', color: 'bg-blue-500', status: 'Active', href: '/leave', appKey: 'leave-request' },
  { name: 'Simple Repair', icon: 'wrench', color: 'bg-red-500', status: 'Active', href: '/repairs', appKey: 'simple-repair' },
  { name: 'Facade Inspection', icon: 'search', color: 'bg-blue-500', status: 'Active', href: '/inspection', appKey: 'facade-inspection' },
  { name: 'HSS Inspection', icon: 'shield-check', color: 'bg-teal-600', status: 'Active', href: '/hss', appKey: 'hss-inspection' },
  { name: 'Facade Repair', icon: 'tools', color: 'bg-purple-500', status: 'Active', href: '/facade-repair', appKey: 'facade-repair' },
  { name: 'Team', icon: 'people', color: 'bg-navy', status: 'Active', href: '/team', appKey: 'team' },
  { name: 'External Users', icon: 'people', color: 'bg-cyan-600', status: 'Active', href: '/external/manage', appKey: 'external-users' },
  { name: 'SDS / TDS', icon: 'shield-check', color: 'bg-yellow-600', status: 'Active', href: '/sds', appKey: 'sds-tds' },
  { name: 'SWMS', icon: 'document', color: 'bg-red-500', status: 'Coming Soon', href: null, appKey: 'swms' },
]

function AppIcon({ icon, className }: { icon: string; className?: string }) {
  const cls = className || 'w-8 h-8'
  switch (icon) {
    case 'dashboard':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="4" rx="1" />
          <rect x="14" y="10" width="7" height="11" rx="1" />
          <rect x="3" y="13" width="7" height="8" rx="1" />
        </svg>
      )
    case 'check':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12l2.5 2.5L16 9" />
        </svg>
      )
    case 'clipboard':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <path d="M9 3h6v2H9z" />
          <path d="M9 10h6M9 14h4" />
        </svg>
      )
    case 'building-clipboard':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-5h6v5" />
          <rect x="8" y="8" width="8" height="6" rx="1" />
          <path d="M10 10h4M10 12h3" />
        </svg>
      )
    case 'megaphone':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 3v18l-7-4H5a2 2 0 01-2-2V9a2 2 0 012-2h6l7-4z" />
          <path d="M21 10v4" />
        </svg>
      )
    case 'shield':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l8 4v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z" />
        </svg>
      )
    case 'document':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6M8 13h8M8 17h6" />
        </svg>
      )
    case 'people':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      )
    case 'briefcase':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
          <path d="M2 13h20" />
        </svg>
      )
    case 'clock':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      )
    case 'receipt':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" />
          <path d="M8 10h8M8 14h5" />
        </svg>
      )
    case 'clipboard-check':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <path d="M9 3h6v2H9z" />
          <path d="M9 13l2 2 4-4" />
        </svg>
      )
    case 'calendar':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      )
    case 'wrench':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
      )
    case 'search':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      )
    case 'shield-check':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l8 4v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      )
    case 'tools':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
          <path d="M10 13l-2 2M17 3l2.3 2.3" />
        </svg>
      )
    case 'alert-tool':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.3 3.3a6 6 0 017.9 7.9l-6.9 6.9a2.1 2.1 0 01-3-3l6.9-6.9a6 6 0 01-4.9-4.9z" />
          <path d="M12 2l9 18H3L12 2z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      )
    case 'chart':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" />
          <path d="M7 15l4-4 4 4 5-6" />
        </svg>
      )
    case 'package':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      )
    default:
      return null
  }
}

export default function HomePage() {
  const [user] = useState<RatUser | null>(() => getStoredUser())
  const [checked] = useState(() => Boolean(getStoredUser()))

  useEffect(() => {
    if (!user) {
      window.location.href = '/login'
    }
  }, [user])

  function handleLogout() {
    clearStoredUser()
    window.location.href = '/login'
  }

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-white">RAT Apps</div>
            <div className="text-xs text-white/50">{user?.name}</div>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/60 text-sm px-3 py-1.5 rounded-lg bg-white/10
              active:bg-white/20 active:scale-95 transition-all duration-150"
          >
            Logout
          </button>
        </div>

        {/* App Grid */}
        <div className="flex-1 px-4 py-6">
          <div className="grid grid-cols-2 gap-3">
            {apps.filter((app) => {
              if (app.appKey === 'site_visit') {
                return user?.position === 'Manager' ||
                  user?.can_view_all_data === true ||
                  user?.can_access_apps?.includes('site_visit') ||
                  user?.can_access_apps?.includes('site-visits')
              }
              // Managers see everything
              if (user?.position === 'Manager' || user?.can_view_all_data) return true
              if (app.appKey === 'team' || app.appKey === 'external-users') {
                return user?.can_manage_settings === true || user?.can_view_all_data === true
              }
              if (!user?.can_access_apps) return true
              return !app.href || user.can_access_apps.includes(app.appKey)
            }).map((app) => {
              const disabled = !app.href
              const inner = (
                <div
                  className={`rounded-2xl p-5 flex flex-col items-center text-center min-h-[140px] justify-center
                    transition-all duration-150
                    ${disabled
                      ? 'bg-white/60 opacity-50'
                      : 'bg-white shadow-sm active:scale-95 active:shadow-md cursor-pointer'
                    }`}
                >
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 text-white ${app.color}`}
                  >
                    <AppIcon icon={app.icon} />
                  </div>
                  <div className={`font-semibold text-sm ${disabled ? 'text-navy/40' : 'text-navy'}`}>
                    {app.name}
                  </div>
                  <div
                    className={`text-[10px] mt-1 px-2 py-0.5 rounded-full font-medium ${
                      disabled
                        ? 'bg-gray-200 text-gray-400'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {app.status}
                  </div>
                </div>
              )

              if (disabled) {
                return <div key={app.name}>{inner}</div>
              }
              return (
                <Link key={app.name} href={app.href}>
                  {inner}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
