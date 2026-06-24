'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { getSupabase } from '../../../lib/supabase'
import type { TeamMember } from '../../../lib/types'
import { setStoredUser } from '../../../lib/helpers'

export default function PinPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = use(params)
  const [member, setMember] = useState<TeamMember | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMember() {
      const { data } = await getSupabase()
        .from('team_members')
        .select('*')
        .eq('id', memberId)
        .single()
      setMember(data)
      setLoading(false)
    }
    loadMember()
  }, [memberId])

  const handleDigit = useCallback((digit: string) => {
    setError(false)
    setPin((prev) => {
      if (prev.length >= 4) return prev
      const next = prev + digit
      if (next.length === 4) {
        // Auto-submit
        setTimeout(() => {
          if (member && next === member.pin) {
            setStoredUser({
              id: member.id,
              name: member.name,
              position: member.position,
              role: member.role,
              can_access_apps: member.can_access_apps ?? undefined,
              can_generate_reports: member.can_generate_reports ?? undefined,
              can_view_all_data: member.can_view_all_data ?? undefined,
              can_manage_settings: member.can_manage_settings ?? undefined,
            })
            window.location.href = '/'
          } else {
            setError(true)
            setPin('')
          }
        }, 150)
      }
      return next
    })
  }, [member])

  const handleBackspace = useCallback(() => {
    setError(false)
    setPin((prev) => prev.slice(0, -1))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy">
        <div className="text-white/50">Member not found</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-navy">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Back button */}
        <div className="px-4 pt-6">
          <a
            href="/login"
            className="text-white/60 text-sm flex items-center gap-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </a>
        </div>

        {/* Welcome */}
        <div className="text-center pt-10 pb-8">
          <div className="text-white/60 text-sm mb-1">Welcome,</div>
          <div className="text-white text-2xl font-bold">{member.name}</div>
        </div>

        {/* PIN dots */}
        <div className={`flex justify-center gap-4 mb-4 ${error ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                i < pin.length ? 'bg-orange scale-110' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        <div className="h-8 flex items-center justify-center">
          {error && (
            <div className="text-red-400 text-sm font-medium">Wrong PIN</div>
          )}
        </div>

        {/* Keypad */}
        <div className="flex-1 flex items-start justify-center px-8 pt-4">
          <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map(
              (key) => {
                if (key === '') return <div key="empty" />
                if (key === 'back') {
                  return (
                    <button
                      key="back"
                      onClick={handleBackspace}
                      className="h-16 rounded-xl flex items-center justify-center
                        text-white/60 active:bg-white/10 transition-all duration-150 active:scale-95"
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
                        <line x1="18" y1="9" x2="12" y2="15" />
                        <line x1="12" y1="9" x2="18" y2="15" />
                      </svg>
                    </button>
                  )
                }
                return (
                  <button
                    key={key}
                    onClick={() => handleDigit(key)}
                    className="h-16 rounded-xl bg-white/10 flex items-center justify-center
                      text-white text-2xl font-semibold
                      active:bg-orange/40 active:scale-95 transition-all duration-150"
                  >
                    {key}
                  </button>
                )
              }
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
