'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../lib/supabase'
import type { TeamMember, ExternalUser } from '../../lib/types'
import { getStoredUser, getStoredExternalUser, setStoredExternalUser } from '../../lib/helpers'

export default function LoginPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'team' | 'external'>('team')

  // External login state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [externalLoading, setExternalLoading] = useState(false)
  const [externalError, setExternalError] = useState('')

  useEffect(() => {
    const user = getStoredUser()
    if (user) {
      window.location.href = '/'
      return
    }
    const extUser = getStoredExternalUser()
    if (extUser) {
      window.location.href = '/external/dashboard'
      return
    }

    async function loadMembers() {
      const { data } = await getSupabase()
        .from('team_members')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true })
      setMembers(data || [])
      setLoading(false)
    }
    loadMembers()
  }, [])

  async function handleExternalLogin() {
    if (!email.trim() || !password.trim()) return
    setExternalLoading(true)
    setExternalError('')

    try {
      const { error: authError } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })

      if (authError) {
        setExternalError(authError.message)
        setExternalLoading(false)
        return
      }

      const { data: extUser, error: lookupError } = await getSupabase()
        .from('external_users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .single()

      if (lookupError || !extUser) {
        setExternalError('No external user record found for this email.')
        await getSupabase().auth.signOut()
        setExternalLoading(false)
        return
      }

      setStoredExternalUser(extUser as ExternalUser)
      window.location.href = '/external/dashboard'
    } catch {
      setExternalError('Something went wrong. Please try again.')
      setExternalLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-navy">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="pt-12 pb-6 px-6 text-center">
          <div className="text-4xl font-bold text-orange mb-1">RAT</div>
          <div className="text-sm text-white/70 tracking-widest uppercase">
            Rope Access Technicians
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="px-4 mb-4">
          <div className="flex rounded-xl overflow-hidden border border-white/20">
            <button
              onClick={() => setMode('team')}
              className={`flex-1 py-3 text-sm font-semibold transition-all ${
                mode === 'team'
                  ? 'bg-orange text-white'
                  : 'bg-white/5 text-white/60'
              }`}
            >
              Team Member
            </button>
            <button
              onClick={() => setMode('external')}
              className={`flex-1 py-3 text-sm font-semibold transition-all ${
                mode === 'external'
                  ? 'bg-orange text-white'
                  : 'bg-white/5 text-white/60'
              }`}
            >
              External Access
            </button>
          </div>
        </div>

        {mode === 'team' ? (
          <>
            <div className="px-4 pb-3">
              <h2 className="text-lg font-semibold text-white/90">Select your name</h2>
            </div>

            {/* Member Grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-8">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center text-white/50 py-20">
                  No team members found
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {members.map((member) => (
                    <Link
                      key={member.id}
                      href={`/pin/${member.id}`}
                      className="bg-white/10 rounded-xl p-4 min-h-[80px] flex flex-col justify-center
                        active:scale-95 active:bg-orange/30 transition-all duration-150 cursor-pointer"
                    >
                      <div className="text-white font-semibold text-base leading-tight">
                        {member.name}
                      </div>
                      {member.position && (
                        <div className="text-white/50 text-xs mt-1">{member.position}</div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 px-4 pb-8">
            <div className="px-0 pb-3">
              <h2 className="text-lg font-semibold text-white/90">External Login</h2>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 text-white text-sm min-h-[48px] border border-white/20 focus:outline-none focus:ring-2 focus:ring-orange/40 placeholder:text-white/30"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleExternalLogin()}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 text-white text-sm min-h-[48px] border border-white/20 focus:outline-none focus:ring-2 focus:ring-orange/40 placeholder:text-white/30"
                  placeholder="Enter password"
                />
              </div>

              {externalError && (
                <div className="text-red-400 text-sm bg-red-400/10 px-4 py-2 rounded-xl">
                  {externalError}
                </div>
              )}

              <button
                onClick={handleExternalLogin}
                disabled={externalLoading || !email.trim() || !password.trim()}
                className="w-full bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100"
              >
                {externalLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
