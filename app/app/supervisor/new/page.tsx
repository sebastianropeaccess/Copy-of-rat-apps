'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import { getSupabase } from '@/lib/supabase'
import type { RatUser, TeamMember } from '@/lib/types'

const SERVICE_TYPE_OPTIONS = [
  'Window Cleaning',
  'Pressure Cleaning',
  'Facade Inspection',
  'Facade Repairs',
  'Concrete Repairs',
  'Joint Sealing',
  'Anchor Inspection',
  'Height Safety Installation',
  'Painting',
  'Water Testing',
  'Misc',
]

export default function NewSupervisorReviewPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [submitting, setSubmitting] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    supervisor: '',
    job_name: '',
    service_types: [] as string[],
    job_date: today,
    start_time: '',
    finish_time: '',
    team_members: [] as string[],
    incidents: false,
    incident_report_filed: false,
    incident_details: '',
    delays: false,
    delay_details: '',
    walkaround_completed: false,
    walkaround_by: [] as string[],
    job_notes_sufficient: true,
    job_notes_feedback: '',
    client_aware: false,
    client_details: '',
    client_conversation: false,
    client_conversation_details: '',
    ops_notified: false,
  })

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    setForm((prev) => ({ ...prev, supervisor: stored.name }))

    const supabase = getSupabase()
    supabase
      .from('team_members')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setTeamMembers(data || []))
  }, [])

  function updateField(field: string, value: string | boolean | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleServiceType(type: string) {
    setForm((prev) => ({
      ...prev,
      service_types: prev.service_types.includes(type)
        ? prev.service_types.filter((t) => t !== type)
        : [...prev.service_types, type],
    }))
  }

  function toggleTeamMember(name: string) {
    setForm((prev) => ({
      ...prev,
      team_members: prev.team_members.includes(name)
        ? prev.team_members.filter((n) => n !== name)
        : [...prev.team_members, name],
    }))
  }

  function toggleWalkaroundBy(name: string) {
    setForm((prev) => ({
      ...prev,
      walkaround_by: prev.walkaround_by.includes(name)
        ? prev.walkaround_by.filter((n) => n !== name)
        : [...prev.walkaround_by, name],
    }))
  }

  async function handleSubmit() {
    if (!user || !form.job_name) return
    setSubmitting(true)

    const supabase = getSupabase()
    const { error } = await supabase.from('supervisor_reviews').insert({
      supervisor: form.supervisor,
      job_name: form.job_name,
      service_types: form.service_types,
      job_date: form.job_date,
      start_time: form.start_time,
      finish_time: form.finish_time,
      team_members: form.team_members,
      incidents: form.incidents,
      incident_report_filed: form.incidents ? form.incident_report_filed : null,
      incident_details: form.incidents ? form.incident_details || null : null,
      delays: form.delays,
      delay_details: form.delays ? form.delay_details || null : null,
      walkaround_completed: form.walkaround_completed,
      walkaround_by: form.walkaround_completed ? form.walkaround_by : [],
      job_notes_sufficient: form.job_notes_sufficient,
      job_notes_feedback: !form.job_notes_sufficient ? form.job_notes_feedback || null : null,
      client_aware: form.client_aware,
      client_details: form.client_aware ? form.client_details || null : null,
      client_conversation: form.client_conversation,
      client_conversation_details: form.client_conversation
        ? form.client_conversation_details || null
        : null,
      ops_notified: form.ops_notified,
      submitted_by: user.name,
    })

    if (!error) {
      window.location.href = '/supervisor'
    } else {
      alert('Error saving review: ' + error.message)
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const labelClass = 'block text-sm font-medium text-navy/70 mb-1'
  const inputClass =
    'w-full px-4 py-3 rounded-xl border border-gray-200 text-navy bg-white min-h-[48px] focus:outline-none focus:border-orange'
  const sectionClass = 'bg-white rounded-xl p-4 shadow-sm space-y-4'
  const sectionTitle = 'font-semibold text-navy text-base'

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/supervisor" className="text-white/60 active:text-white transition-all">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="text-xl font-bold text-white">New Review</div>
        </div>

        {/* Form */}
        <div className="flex-1 px-4 py-4 pb-24 space-y-4">
          {/* Section 1: Job Details */}
          <div className={sectionClass}>
            <div className={sectionTitle}>Job Details</div>

            <div>
              <label className={labelClass}>Supervisor</label>
              <input type="text" value={form.supervisor} readOnly className={inputClass + ' bg-gray-50'} />
            </div>

            <div>
              <label className={labelClass}>Job Name</label>
              <input
                type="text"
                value={form.job_name}
                onChange={(e) => updateField('job_name', e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Service Types</label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_TYPE_OPTIONS.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleServiceType(type)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px]
                      ${form.service_types.includes(type)
                        ? 'bg-orange text-white'
                        : 'bg-gray-100 text-navy/60 active:bg-gray-200'
                      }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Job Date</label>
              <input
                type="date"
                value={form.job_date}
                onChange={(e) => updateField('job_date', e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Start Time</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => updateField('start_time', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Finish Time</label>
                <input
                  type="time"
                  value={form.finish_time}
                  onChange={(e) => updateField('finish_time', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Team */}
          <div className={sectionClass}>
            <div className={sectionTitle}>Team Members</div>
            <div className="flex flex-wrap gap-2">
              {teamMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleTeamMember(m.name)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px]
                    ${form.team_members.includes(m.name)
                      ? 'bg-navy text-white'
                      : 'bg-gray-100 text-navy/60 active:bg-gray-200'
                    }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
            {form.team_members.length > 0 && (
              <div className="text-xs text-navy/40">{form.team_members.length} selected</div>
            )}
          </div>

          {/* Section 3: Incidents */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <div className={sectionTitle}>Incidents</div>
              <Toggle value={form.incidents} onChange={(v) => updateField('incidents', v)} />
            </div>
            {form.incidents && (
              <>
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Incident report filed?</label>
                  <Toggle
                    value={form.incident_report_filed}
                    onChange={(v) => updateField('incident_report_filed', v)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Incident Details</label>
                  <textarea
                    value={form.incident_details}
                    onChange={(e) => updateField('incident_details', e.target.value)}
                    rows={3}
                    className={inputClass + ' min-h-[80px]'}
                  />
                </div>
              </>
            )}
          </div>

          {/* Section 4: Delays */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <div className={sectionTitle}>Delays</div>
              <Toggle value={form.delays} onChange={(v) => updateField('delays', v)} />
            </div>
            {form.delays && (
              <div>
                <label className={labelClass}>Delay Details</label>
                <textarea
                  value={form.delay_details}
                  onChange={(e) => updateField('delay_details', e.target.value)}
                  rows={3}
                  className={inputClass + ' min-h-[80px]'}
                />
              </div>
            )}
          </div>

          {/* Section 5: Walk-around */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <div className={sectionTitle}>Walk-around</div>
              <Toggle
                value={form.walkaround_completed}
                onChange={(v) => updateField('walkaround_completed', v)}
              />
            </div>
            {form.walkaround_completed && (
              <div>
                <label className={labelClass}>Walk-around by</label>
                <div className="flex flex-wrap gap-2">
                  {teamMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleWalkaroundBy(m.name)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px]
                        ${form.walkaround_by.includes(m.name)
                          ? 'bg-navy text-white'
                          : 'bg-gray-100 text-navy/60 active:bg-gray-200'
                        }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 6: Job Notes */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <div className={sectionTitle}>Job Notes Sufficient</div>
              <Toggle
                value={form.job_notes_sufficient}
                onChange={(v) => updateField('job_notes_sufficient', v)}
              />
            </div>
            {!form.job_notes_sufficient && (
              <div>
                <label className={labelClass}>Feedback</label>
                <textarea
                  value={form.job_notes_feedback}
                  onChange={(e) => updateField('job_notes_feedback', e.target.value)}
                  rows={3}
                  className={inputClass + ' min-h-[80px]'}
                />
              </div>
            )}
          </div>

          {/* Section 7: Client */}
          <div className={sectionClass}>
            <div className={sectionTitle}>Client</div>

            <div className="flex items-center justify-between">
              <label className={labelClass}>Client aware of works?</label>
              <Toggle value={form.client_aware} onChange={(v) => updateField('client_aware', v)} />
            </div>
            {form.client_aware && (
              <div>
                <label className={labelClass}>Client Details</label>
                <textarea
                  value={form.client_details}
                  onChange={(e) => updateField('client_details', e.target.value)}
                  rows={2}
                  className={inputClass + ' min-h-[60px]'}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className={labelClass}>Client conversation?</label>
              <Toggle
                value={form.client_conversation}
                onChange={(v) => updateField('client_conversation', v)}
              />
            </div>
            {form.client_conversation && (
              <>
                <div>
                  <label className={labelClass}>Conversation Details</label>
                  <textarea
                    value={form.client_conversation_details}
                    onChange={(e) => updateField('client_conversation_details', e.target.value)}
                    rows={2}
                    className={inputClass + ' min-h-[60px]'}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Ops notified?</label>
                  <Toggle value={form.ops_notified} onChange={(v) => updateField('ops_notified', v)} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="fixed bottom-0 left-0 right-0 z-10">
          <div className="max-w-[480px] mx-auto px-4 pb-6">
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.job_name}
              className="w-full bg-orange text-white font-semibold py-4 rounded-xl
                active:scale-95 active:bg-orange-light transition-all shadow-lg min-h-[48px]
                disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {submitting && (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {submitting ? 'Saving...' : 'Submit Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-12 h-7 rounded-full transition-all relative shrink-0 min-h-[28px] ${
        value ? 'bg-orange' : 'bg-gray-300'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all ${
          value ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  )
}
