'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser, ToolboxTalk, ToolboxTalkSignon } from '@/lib/types'

export default function ToolboxTalkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [user, setUser] = useState<RatUser | null>(null)
  const [talk, setTalk] = useState<ToolboxTalk | null>(null)
  const [signons, setSignons] = useState<ToolboxTalkSignon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)

    async function load() {
      const { data: talkData } = await getSupabase()
        .from('toolbox_talks')
        .select('*')
        .eq('id', id)
        .single()

      if (talkData) setTalk(talkData)

      const { data: signonData } = await getSupabase()
        .from('toolbox_talk_signons')
        .select('*')
        .eq('toolbox_talk_id', id)
        .order('team_member_name')

      if (signonData) setSignons(signonData)
      setLoading(false)
    }
    load()
  }, [id])

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/toolbox-talk" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="text-lg font-bold text-white">Toolbox Talk</div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !talk ? (
            <div className="text-center py-12 text-navy/40">Talk not found</div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-lg font-bold text-navy mb-1">{talk.job_name}</div>
                <div className="text-sm text-navy/50">
                  {new Date(talk.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-navy/40 font-semibold mb-0.5">Presenter</div>
                    <div className="text-navy">{talk.presenter}</div>
                  </div>
                  <div>
                    <div className="text-xs text-navy/40 font-semibold mb-0.5">Location</div>
                    <div className="text-navy">{talk.location || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-navy/40 font-semibold mb-0.5">Weather</div>
                    <div className="text-navy">{talk.weather || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-navy/40 font-semibold mb-0.5">Site Conditions</div>
                    <div className="text-navy">{talk.site_conditions || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-xs text-navy/40 font-semibold mb-2">Topics</div>
                <div className="flex flex-wrap gap-2">
                  {talk.topics.map(t => (
                    <span key={t} className="bg-orange/10 text-orange text-xs font-medium px-2.5 py-1 rounded-full">{t}</span>
                  ))}
                </div>
              </div>

              {talk.additional_notes && (
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-navy/40 font-semibold mb-1">Additional Notes</div>
                  <div className="text-sm text-navy whitespace-pre-wrap">{talk.additional_notes}</div>
                </div>
              )}

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-xs text-navy/40 font-semibold mb-2">
                  Team Sign-On ({signons.length})
                </div>
                {signons.length === 0 ? (
                  <div className="text-sm text-navy/30">No sign-ons</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {signons.map(s => (
                      <div key={s.id} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                        <svg className="w-4 h-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                        <span className="text-sm text-navy truncate">{s.team_member_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
