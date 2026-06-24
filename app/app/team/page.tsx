'use client'

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../lib/supabase'
import { getStoredUser } from '../../lib/helpers'
import type { RatUser, TeamMember } from '../../lib/types'

export default function TeamDirectoryPage() {
  const [user] = useState<RatUser | null>(() => getStoredUser())
  const [members, setMembers] = useState<TeamMember[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const loadMembers = useCallback(async () => {
    const { data } = await getSupabase()
      .from('team_members')
      .select('*')
      .eq('active', true)
      .order('name')
    if (data) setMembers(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) { window.location.href = '/login'; return }
    queueMicrotask(() => {
      void loadMembers()
    })
  }, [loadMembers, user])

  const canManage = user?.can_manage_settings === true

  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  )

  const roleBadge = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700'
      case 'manager': return 'bg-blue-100 text-blue-700'
      default: return 'bg-gray-200 text-gray-600'
    }
  }

  const actionClassName = (enabled: boolean) =>
    `flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg min-h-[48px] ${
      enabled
        ? 'bg-orange/10 text-orange active:scale-95 transition-all'
        : 'bg-gray-100 text-navy/30 cursor-not-allowed'
    }`

  const renderActionButton = (
    href: string | undefined,
    title: string,
    label: string,
    icon: ReactNode
  ) => {
    if (!href) {
      return (
        <button disabled title={title} className={actionClassName(false)}>
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </button>
      )
    }

    return (
      <a href={href} className={actionClassName(true)}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </a>
    )
  }

  if (loading) {
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
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <div>
              <div className="text-xl font-bold text-white">Team Directory</div>
              <div className="text-xs text-white/50">{members.length} active members</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pt-4 pb-2">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-navy
              placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-orange/30
              min-h-[48px]"
          />
        </div>

        {/* Member Cards */}
        <div className="flex-1 px-4 py-2 space-y-3">
          {filtered.length === 0 && (
            <div className="text-center text-navy/40 py-12">No members found</div>
          )}
          {filtered.map((m) => (
            <div key={m.id} className="bg-white rounded-xl p-4 shadow-sm">
              {(() => {
                const phone = m.phone?.trim()
                const email = m.email?.trim()
                const phoneHref = phone ? `tel:${phone}` : undefined
                const textHref = phone ? `sms:${phone}` : undefined
                const emailHref = email ? `mailto:${email}` : undefined

                return (
                  <>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-lg font-bold text-navy">{m.name}</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {m.position && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange/10 text-orange">
                        {m.position}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(m.role)}`}>
                      {m.role}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <Link
                    href={`/team/${m.id}`}
                    className="text-navy/40 active:text-orange transition-colors min-w-[48px] min-h-[48px]
                      flex items-center justify-center -mr-2 -mt-1"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </Link>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                {renderActionButton(
                  phoneHref,
                  'No phone on file',
                  'Call',
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                  </svg>
                )}
                {renderActionButton(
                  textHref,
                  'No phone on file',
                  'Text',
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                )}
                {renderActionButton(
                  emailHref,
                  'No email on file',
                  'Email',
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                )}
              </div>
                  </>
                )
              })()}
            </div>
          ))}
        </div>

        {/* Add Member Button */}
        {canManage && (
          <div className="sticky bottom-0 px-4 py-4 bg-light-gray">
            <Link
              href="/team/add"
              className="block w-full bg-orange text-white font-semibold py-3 rounded-xl
                text-center active:scale-95 active:bg-orange-light transition-all min-h-[48px]
                flex items-center justify-center"
            >
              + Add Member
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
