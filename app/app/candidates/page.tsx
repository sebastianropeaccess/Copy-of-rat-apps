'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../lib/supabase'
import { getStoredUser } from '../../lib/helpers'
import type { RatUser, Candidate } from '../../lib/types'

const STATUS_FILTERS = ['all', 'new', 'screened', 'shortlisted', 'phone_interview', 'in_person', 'hired', 'pool', 'rejected'] as const
type StatusFilter = typeof STATUS_FILTERS[number]

const STATUS_LABELS: Record<string, string> = {
  all: 'All',
  new: 'New',
  screened: 'Screened',
  shortlisted: 'Shortlisted',
  phone_interview: 'Phone',
  in_person: 'In Person',
  hired: 'Hired',
  pool: 'Pool',
  rejected: 'Rejected',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  screened: 'bg-yellow-100 text-yellow-700',
  shortlisted: 'bg-orange-100 text-orange-700',
  phone_interview: 'bg-purple-100 text-purple-700',
  in_person: 'bg-indigo-100 text-indigo-700',
  hired: 'bg-green-100 text-green-700',
  pool: 'bg-teal-100 text-teal-700',
  rejected: 'bg-red-100 text-red-600',
}

const IRATA_LEVELS = ['', '1', '2', '3']
const LOCATIONS = ['Gold Coast', 'Brisbane', 'Sydney', 'Melbourne', 'Other']

export default function CandidatesPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Add form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formIrata, setFormIrata] = useState('')
  const [formLocation, setFormLocation] = useState('Gold Coast')
  const [formSource, setFormSource] = useState('Seek')
  const [formNotes, setFormNotes] = useState('')
  const [formCoverLetterKeyword, setFormCoverLetterKeyword] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadCandidates = useCallback(async () => {
    const query = getSupabase()
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false })

    const { data } = await query
    setCandidates(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)
    loadCandidates()
  }, [loadCandidates])

  const filtered = candidates.filter((c) => {
    if (filter !== 'all' && c.status !== filter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.location || '').toLowerCase().includes(q) ||
        (c.skills || []).some(s => s.toLowerCase().includes(q))
      )
    }
    return true
  })

  const statusCounts = candidates.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {})

  async function handleAdd() {
    if (!formName.trim()) return
    setSaving(true)
    const { error } = await getSupabase().from('candidates').insert({
      name: formName.trim(),
      email: formEmail.trim() || null,
      phone: formPhone.trim() || null,
      irata_level: formIrata || null,
      location: formLocation,
      source: formSource,
      notes: formNotes.trim() || null,
      cover_letter_keyword: formCoverLetterKeyword,
      status: 'new',
      added_by: user?.name || null,
    })

    if (!error) {
      // Reset form
      setFormName('')
      setFormEmail('')
      setFormPhone('')
      setFormIrata('')
      setFormLocation('Gold Coast')
      setFormSource('Seek')
      setFormNotes('')
      setFormCoverLetterKeyword(false)
      setShowAdd(false)
      loadCandidates()
    }
    setSaving(false)
  }

  async function updateStatus(id: string, newStatus: string) {
    await getSupabase().from('candidates').update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    loadCandidates()
  }

  if (!user || loading) {
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <div>
              <div className="text-lg font-bold text-white">Candidates</div>
              <div className="text-[10px] text-white/40">{candidates.length} total</div>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-orange text-white text-sm font-semibold px-4 py-2 rounded-lg
              active:scale-95 active:bg-orange-light transition-all duration-150"
          >
            + Add
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/30" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidates..."
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-orange"
            />
          </div>
        </div>

        {/* Status filter pills */}
        <div className="px-4 pt-3 overflow-x-auto">
          <div className="flex gap-1.5 pb-1">
            {STATUS_FILTERS.map((s) => {
              const count = s === 'all' ? candidates.length : (statusCounts[s] || 0)
              const isActive = filter === s
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all
                    ${isActive
                      ? 'bg-navy text-white'
                      : 'bg-white text-navy/50 border border-gray-200'
                    }`}
                >
                  {STATUS_LABELS[s]}
                  <span className={`text-[9px] ${isActive ? 'text-white/60' : 'text-navy/30'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Candidate list */}
        <div className="flex-1 px-4 py-3">
          {filtered.length === 0 ? (
            <div className="text-center text-navy/40 py-20">
              <svg className="mx-auto mb-3 text-navy/20" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
              <div className="text-lg mb-1">No candidates</div>
              <div className="text-sm">
                {filter !== 'all' ? `No candidates with status "${STATUS_LABELS[filter]}"` : 'Tap "+ Add" to add your first candidate'}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  onStatusChange={updateStatus}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Candidate Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="w-full max-w-[480px] bg-white rounded-t-2xl p-5 pb-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-navy">Add Candidate</h2>
              <button onClick={() => setShowAdd(false)} className="text-navy/40 p-1">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <FormField label="Full Name *" value={formName} onChange={setFormName} placeholder="e.g. John Smith" />
              <FormField label="Email" value={formEmail} onChange={setFormEmail} placeholder="john@email.com" type="email" />
              <FormField label="Phone" value={formPhone} onChange={setFormPhone} placeholder="0412 345 678" type="tel" />

              <div>
                <label className="text-xs font-medium text-navy/60 mb-1 block">IRATA Level</label>
                <div className="flex gap-2">
                  {IRATA_LEVELS.map((lvl) => (
                    <button
                      key={lvl || 'none'}
                      onClick={() => setFormIrata(lvl)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all
                        ${formIrata === lvl ? 'bg-navy text-white' : 'bg-gray-100 text-navy/50'}`}
                    >
                      {lvl || 'None'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-navy/60 mb-1 block">Location</label>
                <select
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm bg-white focus:outline-none focus:border-orange"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-navy/60 mb-1 block">Source</label>
                <select
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm bg-white focus:outline-none focus:border-orange"
                >
                  {['Seek', 'Indeed', 'Website', 'Referral', 'LinkedIn', 'Walk-in', 'Other'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Cover letter keyword check */}
              <div
                onClick={() => setFormCoverLetterKeyword(!formCoverLetterKeyword)}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer active:bg-gray-100 transition-all"
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                  formCoverLetterKeyword ? 'bg-green-500' : 'bg-gray-200'
                }`}>
                  {formCoverLetterKeyword && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-navy">Cover letter keyword</div>
                  <div className="text-[10px] text-navy/40">&quot;Highly organized&quot; included in cover letter</div>
                </div>
              </div>

              <FormField label="Notes" value={formNotes} onChange={setFormNotes} placeholder="Skills, certs, availability..." multiline />

              <button
                onClick={handleAdd}
                disabled={saving || !formName.trim()}
                className="w-full bg-orange text-white font-semibold py-3.5 rounded-xl mt-1
                  active:scale-95 transition-all duration-150
                  disabled:opacity-40 disabled:active:scale-100"
              >
                {saving ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </div>
                ) : (
                  'Add Candidate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  multiline = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  multiline?: boolean
}) {
  return (
    <div>
      <label className="text-xs font-medium text-navy/60 mb-1 block">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-orange resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-orange"
        />
      )}
    </div>
  )
}

function CandidateCard({
  candidate: c,
  onStatusChange,
}: {
  candidate: Candidate
  onStatusChange: (id: string, status: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const statusColor = STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'
  const appliedDate = new Date(c.created_at).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  // Quick action buttons based on current status
  const quickActions = getQuickActions(c.status)

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div
        className="p-4 active:bg-gray-50 transition-all cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 mr-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-navy">{c.name}</span>
              {c.irata_level && (
                <span className="text-[9px] bg-navy/10 text-navy/60 px-1.5 py-0.5 rounded-full font-bold">
                  L{c.irata_level}
                </span>
              )}
              {c.cover_letter_keyword && (
                <span className="text-[9px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium">
                  ✓ Keyword
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-navy/40">
              {c.location && <span>{c.location}</span>}
              {c.location && c.source && <span>·</span>}
              {c.source && <span>{c.source}</span>}
              <span>·</span>
              <span>{appliedDate}</span>
            </div>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColor}`}>
            {STATUS_LABELS[c.status] || c.status}
          </span>
        </div>

        {c.notes && !expanded && (
          <div className="text-[11px] text-navy/40 mt-2 line-clamp-1">{c.notes}</div>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          {/* Contact info */}
          <div className="flex flex-col gap-1.5 mb-3">
            {c.email && (
              <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-xs text-blue-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 7L2 7" />
                </svg>
                {c.email}
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-xs text-blue-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
                {c.phone}
              </a>
            )}
          </div>

          {/* Skills/certs */}
          {c.skills && c.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {c.skills.map((skill) => (
                <span key={skill} className="text-[10px] bg-navy/5 text-navy/50 px-2 py-0.5 rounded-full">
                  {skill}
                </span>
              ))}
            </div>
          )}

          {/* Notes */}
          {c.notes && (
            <div className="text-[11px] text-navy/50 mb-3 whitespace-pre-wrap">{c.notes}</div>
          )}

          {/* Scoring */}
          {c.screening_score !== null && c.screening_score !== undefined && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-navy/40">Score:</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    c.screening_score >= 70 ? 'bg-green-500' :
                    c.screening_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${c.screening_score}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-navy/60">{c.screening_score}/100</span>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-2 mt-2">
            {quickActions.map((action) => (
              <button
                key={action.status}
                onClick={(e) => {
                  e.stopPropagation()
                  onStatusChange(c.id, action.status)
                }}
                className={`flex-1 text-[11px] font-medium py-2 rounded-lg transition-all active:scale-95 ${action.style}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getQuickActions(status: string): Array<{ label: string; status: string; style: string }> {
  switch (status) {
    case 'new':
      return [
        { label: '✓ Screened', status: 'screened', style: 'bg-yellow-100 text-yellow-700' },
        { label: '✗ Reject', status: 'rejected', style: 'bg-red-50 text-red-500' },
      ]
    case 'screened':
      return [
        { label: '★ Shortlist', status: 'shortlisted', style: 'bg-orange-100 text-orange-700' },
        { label: '🏊 Pool', status: 'pool', style: 'bg-teal-100 text-teal-700' },
        { label: '✗ Reject', status: 'rejected', style: 'bg-red-50 text-red-500' },
      ]
    case 'shortlisted':
      return [
        { label: '📞 Phone', status: 'phone_interview', style: 'bg-purple-100 text-purple-700' },
        { label: '🏊 Pool', status: 'pool', style: 'bg-teal-100 text-teal-700' },
      ]
    case 'phone_interview':
      return [
        { label: '🤝 In Person', status: 'in_person', style: 'bg-indigo-100 text-indigo-700' },
        { label: '🏊 Pool', status: 'pool', style: 'bg-teal-100 text-teal-700' },
        { label: '✗ Reject', status: 'rejected', style: 'bg-red-50 text-red-500' },
      ]
    case 'in_person':
      return [
        { label: '✅ Hire', status: 'hired', style: 'bg-green-100 text-green-700' },
        { label: '🏊 Pool', status: 'pool', style: 'bg-teal-100 text-teal-700' },
        { label: '✗ Reject', status: 'rejected', style: 'bg-red-50 text-red-500' },
      ]
    case 'pool':
      return [
        { label: '★ Shortlist', status: 'shortlisted', style: 'bg-orange-100 text-orange-700' },
        { label: '✗ Reject', status: 'rejected', style: 'bg-red-50 text-red-500' },
      ]
    case 'rejected':
      return [
        { label: '🏊 Pool', status: 'pool', style: 'bg-teal-100 text-teal-700' },
        { label: '↩ Reopen', status: 'new', style: 'bg-blue-50 text-blue-600' },
      ]
    case 'hired':
      return []
    default:
      return []
  }
}
