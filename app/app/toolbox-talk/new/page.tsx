'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../../lib/supabase'
import { getStoredUser } from '../../../lib/helpers'
import type { RatUser, TeamMember } from '../../../lib/types'

const TOPIC_OPTIONS = [
  'Weather', 'PPE', 'Site Hazards', 'Emergency Procedures',
  'Working at Height', 'Manual Handling', 'Chemical Safety',
  'Equipment Check', 'Housekeeping', 'Other',
]

export default function NewToolboxTalkPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [jobName, setJobName] = useState('')
  const [presenter, setPresenter] = useState('')
  const [location, setLocation] = useState('')
  const [topics, setTopics] = useState<string[]>([])
  const [weather, setWeather] = useState('')
  const [siteConditions, setSiteConditions] = useState('')
  const [notes, setNotes] = useState('')
  const [signedMembers, setSignedMembers] = useState<Set<string>>(new Set())

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    setPresenter(stored.name)

    async function load() {
      const { data } = await getSupabase()
        .from('team_members')
        .select('*')
        .eq('active', true)
        .order('name')
      if (data) setMembers(data)
      setLoading(false)
    }
    load()
  }, [])

  function toggleTopic(t: string) {
    setTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function toggleMember(id: string) {
    setSignedMembers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (!jobName.trim() || topics.length === 0) return
    setSubmitting(true)

    const { data: talk, error } = await getSupabase()
      .from('toolbox_talks')
      .insert({
        date,
        job_name: jobName.trim(),
        presenter,
        location: location.trim(),
        topics,
        weather: weather.trim(),
        site_conditions: siteConditions.trim(),
        additional_notes: notes.trim() || null,
        created_by: user!.id,
      })
      .select()
      .single()

    if (error || !talk) { setSubmitting(false); return }

    if (signedMembers.size > 0) {
      const signons = Array.from(signedMembers).map(memberId => {
        const member = members.find(m => m.id === memberId)
        return {
          toolbox_talk_id: talk.id,
          team_member_id: memberId,
          team_member_name: member?.name || '',
        }
      })
      await getSupabase().from('toolbox_talk_signons').insert(signons)
    }

    window.location.href = `/toolbox-talk/${talk.id}`
  }

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/toolbox-talk" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="text-lg font-bold text-white">New Toolbox Talk</div>
        </div>

        <div className="flex-1 px-4 py-4 pb-32">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[48px]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Job Name</label>
                <input type="text" value={jobName} onChange={e => setJobName(e.target.value)} placeholder="Enter job name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[48px]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Presenter</label>
                <input type="text" value={presenter} readOnly
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm bg-gray-100 min-h-[48px]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Location</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Site location"
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[48px]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Topics</label>
                <div className="flex flex-wrap gap-2">
                  {TOPIC_OPTIONS.map(t => (
                    <button key={t} onClick={() => toggleTopic(t)}
                      className={`px-3 py-2 rounded-full text-xs font-medium transition-all duration-150 active:scale-95 min-h-[40px]
                        ${topics.includes(t) ? 'bg-orange text-white' : 'bg-white border border-gray-200 text-navy/60'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Weather</label>
                <input type="text" value={weather} onChange={e => setWeather(e.target.value)} placeholder="Weather conditions"
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[48px]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Site Conditions</label>
                <input type="text" value={siteConditions} onChange={e => setSiteConditions(e.target.value)} placeholder="Site conditions"
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[48px]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-1">Additional Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[96px] resize-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy/60 mb-2">Team Sign-On</label>
                <div className="grid grid-cols-2 gap-2">
                  {members.map(m => (
                    <button key={m.id} onClick={() => toggleMember(m.id)}
                      className={`p-3 rounded-xl text-sm font-medium text-left transition-all duration-150 active:scale-95 min-h-[48px] flex items-center gap-2
                        ${signedMembers.has(m.id) ? 'bg-green-500 text-white' : 'bg-white border border-gray-200 text-navy'}`}>
                      {signedMembers.has(m.id) && (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                      )}
                      <span className="truncate">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0">
          <div className="w-full max-w-[480px] mx-auto px-4 py-4 bg-light-gray border-t border-gray-200">
            <button onClick={handleSubmit}
              disabled={submitting || !jobName.trim() || topics.length === 0}
              className="w-full bg-orange text-white font-semibold py-4 rounded-xl text-sm
                active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[48px]">
              {submitting ? 'Submitting...' : 'Submit Toolbox Talk'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
