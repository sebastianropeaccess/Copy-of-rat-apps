'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser, ToolboxTalk } from '@/lib/types'

interface TalkWithCount extends ToolboxTalk {
  signon_count: number
}

export default function ToolboxTalkListPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [talks, setTalks] = useState<TalkWithCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)

    async function load() {
      const { data } = await getSupabase()
        .from('toolbox_talks')
        .select('*, toolbox_talk_signons(id)')
        .order('date', { ascending: false })

      if (data) {
        setTalks(data.map((t: ToolboxTalk & { toolbox_talk_signons: { id: string }[] }) => ({
          ...t,
          signon_count: t.toolbox_talk_signons?.length || 0,
        })))
      }
      setLoading(false)
    }
    load()
  }, [])

  const grouped = talks.reduce<Record<string, TalkWithCount[]>>((acc, t) => {
    const d = t.date
    if (!acc[d]) acc[d] = []
    acc[d].push(t)
    return acc
  }, {})

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60 active:scale-95 transition-transform">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
            </Link>
            <div>
              <div className="text-lg font-bold text-white">Toolbox Talks</div>
              <div className="text-xs text-white/50">{user.name}</div>
            </div>
          </div>
          <Link
            href="/toolbox-talk/new"
            className="bg-orange text-white text-sm font-semibold px-4 py-2 rounded-xl
              active:scale-95 transition-all duration-150 min-h-[48px] flex items-center"
          >
            + Add
          </Link>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : talks.length === 0 ? (
            <div className="text-center py-12 text-navy/40">No toolbox talks yet</div>
          ) : (
            Object.entries(grouped).map(([date, items]) => (
              <div key={date} className="mb-5">
                <div className="text-xs font-semibold text-navy/40 uppercase mb-2">
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((talk) => (
                    <Link key={talk.id} href={`/toolbox-talk/${talk.id}`}>
                      <div className="bg-white rounded-xl p-4 shadow-sm active:scale-95 transition-all duration-150">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-semibold text-navy text-sm">{talk.job_name}</div>
                          <div className="bg-orange/10 text-orange text-xs font-medium px-2 py-0.5 rounded-full">
                            {talk.signon_count} signed
                          </div>
                        </div>
                        <div className="text-xs text-navy/50">Presenter: {talk.presenter}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
