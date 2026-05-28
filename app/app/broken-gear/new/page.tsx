'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import { getSupabase } from '@/lib/supabase'
import type { GearItem, RatUser } from '@/lib/types'

type JGIDJob = {
  id: string
  job_no: string
  site: string
  title: string
  status: string
  client: string
}

type FormState = {
  gear_item_id: string
  gear_id: string
  gear_make: string
  gear_model: string
  gear_category: string
  issue_description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  remove_from_service: boolean
  replacement_required: boolean
  replacement_urgency: 'same_day' | 'next_day' | 'this_week' | 'not_urgent' | ''
  replacement_needed_by: string
  job_id: string
  job_number: string
  job_name: string
  site_name: string
}

const GEAR_CATEGORIES = ['Rope Access Gear', 'PPE', 'Power Tool', 'Plant / Equipment', 'Vehicle', 'Height Safety Tester', 'Other']
const SEVERITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const
const REPLACEMENT_URGENCIES = [
  { value: 'same_day', label: 'Same day' },
  { value: 'next_day', label: 'Next day' },
  { value: 'this_week', label: 'This week' },
  { value: 'not_urgent', label: 'Not urgent' },
] as const

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-navy/70">{children}</label>
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <FieldLabel>{label}{required ? ' *' : ''}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-navy min-h-[48px] focus:border-orange focus:outline-none"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-navy min-h-[48px] focus:border-orange focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  )
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-navy">{label}</div>
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`relative h-8 w-14 rounded-full transition-colors ${value ? 'bg-orange' : 'bg-gray-300'}`}
          aria-pressed={value}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>
    </div>
  )
}

function OptionGrid<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`min-h-[48px] rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                active ? 'border-orange bg-orange text-white' : 'border-gray-200 bg-white text-navy active:border-orange/40'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function getJobDisplayName(job: JGIDJob) {
  return job.site || job.title || job.client || job.job_no
}

export default function NewBrokenGearPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [gearItems, setGearItems] = useState<GearItem[]>([])
  const [jobs, setJobs] = useState<JGIDJob[]>([])
  const [gearQuery, setGearQuery] = useState('')
  const [jobQuery, setJobQuery] = useState('')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notificationWarning, setNotificationWarning] = useState('')
  const [form, setForm] = useState<FormState>({
    gear_item_id: '',
    gear_id: '',
    gear_make: '',
    gear_model: '',
    gear_category: '',
    issue_description: '',
    severity: 'medium',
    remove_from_service: true,
    replacement_required: false,
    replacement_urgency: '',
    replacement_needed_by: '',
    job_id: '',
    job_number: '',
    job_name: '',
    site_name: '',
  })

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)

    getSupabase()
      .from('gear_items')
      .select('*')
      .eq('active', true)
      .order('gear_type')
      .then(({ data }) => setGearItems((data || []) as GearItem[]))

    fetch('/api/jgid-jobs')
      .then((response) => response.ok ? response.json() : [])
      .then((data) => Array.isArray(data) && setJobs(data))
      .catch(() => {})
  }, [])

  const filteredGear = useMemo(() => {
    const query = gearQuery.trim().toLowerCase()
    if (!query) return gearItems.slice(0, 30)
    return gearItems.filter((item) =>
      [item.gear_id, item.gear_type, item.manufacturer, item.model, item.assigned_to, item.team_member_name]
        .some((value) => (value || '').toLowerCase().includes(query))
    ).slice(0, 30)
  }, [gearItems, gearQuery])

  const filteredJobs = useMemo(() => {
    const query = jobQuery.trim().toLowerCase()
    if (!query) return jobs.slice(0, 30)
    return jobs.filter((job) =>
      [job.job_no, job.site, job.title, job.client].some((value) => (value || '').toLowerCase().includes(query))
    ).slice(0, 30)
  }, [jobs, jobQuery])

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function selectGear(item: GearItem) {
    setForm((prev) => ({
      ...prev,
      gear_item_id: item.id,
      gear_id: item.gear_id,
      gear_make: item.manufacturer,
      gear_model: item.model || '',
      gear_category: item.gear_type || '',
    }))
    setGearQuery(`${item.gear_id} - ${item.manufacturer} ${item.model}`)
  }

  function selectJob(job: JGIDJob) {
    setForm((prev) => ({
      ...prev,
      job_id: job.id,
      job_number: job.job_no,
      job_name: getJobDisplayName(job),
      site_name: job.site,
    }))
    setJobQuery(`${job.job_no} - ${getJobDisplayName(job)}`)
  }

  function handleMedia(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, 6)
    setMediaFiles(files)
    setMediaPreviews(files.map((file) => URL.createObjectURL(file)))
  }

  async function handleSubmit() {
    if (!user) return
    setError('')
    setNotificationWarning('')

    if (!form.gear_make.trim() || !form.issue_description.trim()) {
      setError('Please enter the gear make and the issue.')
      return
    }
    if (form.replacement_required && !form.replacement_urgency) {
      setError('Please select how urgently a replacement is needed.')
      return
    }

    setSubmitting(true)
    const body = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      if (typeof value === 'boolean') body.append(key, value ? 'true' : 'false')
      else body.append(key, value || '')
    })
    body.append('reported_by', user.name)
    mediaFiles.forEach((file) => body.append('media', file))

    try {
      const response = await fetch('/api/broken-gear', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Could not submit broken gear report.')
        return
      }
      if (data.notification && !data.notification.sent) {
        setNotificationWarning(data.notification.error || 'Report saved, but email notification was not sent.')
        setTimeout(() => { window.location.href = '/broken-gear' }, 1800)
        return
      }
      window.location.href = '/broken-gear'
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen flex-col bg-light-gray">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        <div className="flex items-center gap-3 bg-navy px-5 py-4">
          <Link href="/broken-gear" className="text-white/60 active:text-white transition-all">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
          <div>
            <div className="text-xl font-bold text-white">Report Broken Gear</div>
            <div className="text-xs text-white/50">{user.name}</div>
          </div>
        </div>

        <div className="flex-1 space-y-4 px-4 py-4 pb-28">
          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <div>
              <div className="text-sm font-bold uppercase tracking-[0.14em] text-navy/50">Gear</div>
              <p className="mt-1 text-sm text-navy/55">Search registered gear or enter details manually.</p>
            </div>
            <div>
              <FieldLabel>Registered gear</FieldLabel>
              <input
                value={gearQuery}
                onChange={(event) => {
                  setGearQuery(event.target.value)
                  update('gear_item_id', '')
                }}
                placeholder="Search serial, make, model..."
                className="w-full rounded-xl border border-gray-200 bg-light-gray px-4 py-3 text-base text-navy min-h-[48px] focus:border-orange focus:outline-none"
              />
              {gearQuery && !form.gear_item_id && (
                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-200">
                  {filteredGear.length ? filteredGear.map((item) => (
                    <button key={item.id} type="button" onClick={() => selectGear(item)} className="block w-full border-b border-navy/8 px-4 py-3 text-left last:border-b-0">
                      <span className="block text-sm font-semibold text-navy">{item.gear_id} - {item.gear_type}</span>
                      <span className="block text-xs text-navy/50">{item.manufacturer} {item.model}</span>
                    </button>
                  )) : <div className="px-4 py-3 text-sm text-navy/45">No matching gear. Enter it manually below.</div>}
                </div>
              )}
            </div>

            <TextInput label="Make" value={form.gear_make} onChange={(value) => update('gear_make', value)} placeholder="e.g. Petzl, Makita, Honda" required />
            <TextInput label="Model" value={form.gear_model} onChange={(value) => update('gear_model', value)} placeholder="e.g. ASAP Lock, DHR242" />
            <TextInput label="Serial / Asset Number" value={form.gear_id} onChange={(value) => update('gear_id', value)} placeholder="Optional but useful" />
            <SelectField label="Category" value={form.gear_category} onChange={(value) => update('gear_category', value)} options={GEAR_CATEGORIES} />
          </section>

          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-sm font-bold uppercase tracking-[0.14em] text-navy/50">Issue</div>
            <div>
              <FieldLabel>What is wrong? *</FieldLabel>
              <textarea
                value={form.issue_description}
                onChange={(event) => update('issue_description', event.target.value)}
                placeholder="Describe the fault, error message, damage, missing part, or behaviour."
                className="min-h-[120px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-navy focus:border-orange focus:outline-none"
              />
            </div>
            <OptionGrid label="Severity" options={SEVERITIES} value={form.severity} onChange={(value) => update('severity', value)} />
            <Toggle label="Remove from service now" value={form.remove_from_service} onChange={(value) => update('remove_from_service', value)} />
          </section>

          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-sm font-bold uppercase tracking-[0.14em] text-navy/50">Job / Location</div>
            <div>
              <FieldLabel>Job</FieldLabel>
              <input
                value={jobQuery}
                onChange={(event) => {
                  setJobQuery(event.target.value)
                  update('job_id', '')
                }}
                placeholder="Search current jobs..."
                className="w-full rounded-xl border border-gray-200 bg-light-gray px-4 py-3 text-base text-navy min-h-[48px] focus:border-orange focus:outline-none"
              />
              {jobQuery && !form.job_id && (
                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-200">
                  {filteredJobs.length ? filteredJobs.map((job) => (
                    <button key={job.id} type="button" onClick={() => selectJob(job)} className="block w-full border-b border-navy/8 px-4 py-3 text-left last:border-b-0">
                      <span className="block text-sm font-semibold text-navy">{getJobDisplayName(job)}</span>
                      <span className="block text-xs text-navy/50">{job.job_no} {job.client ? `- ${job.client}` : ''}</span>
                    </button>
                  )) : <div className="px-4 py-3 text-sm text-navy/45">No matching jobs. Enter details manually below.</div>}
                </div>
              )}
            </div>
            <TextInput label="Manual Job / Site" value={form.job_name} onChange={(value) => update('job_name', value)} placeholder="Optional" />
          </section>

          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-sm font-bold uppercase tracking-[0.14em] text-navy/50">Replacement</div>
            <Toggle
              label="Replacement needed on site"
              value={form.replacement_required}
              onChange={(value) => {
                update('replacement_required', value)
                if (value && !form.replacement_urgency) update('replacement_urgency', 'same_day')
              }}
            />
            {form.replacement_required && (
              <>
                <OptionGrid label="Urgency" options={REPLACEMENT_URGENCIES} value={form.replacement_urgency || 'same_day'} onChange={(value) => update('replacement_urgency', value)} />
                <TextInput label="Needed by" type="datetime-local" value={form.replacement_needed_by} onChange={(value) => update('replacement_needed_by', value)} />
              </>
            )}
          </section>

          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-sm font-bold uppercase tracking-[0.14em] text-navy/50">Photo / Video</div>
            <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-orange/35 bg-orange/5 px-6 text-center">
              <span className="text-base font-semibold text-navy">Upload photo or video</span>
              <span className="text-sm text-navy/55">Up to 6 files</span>
              <input type="file" accept="image/*,video/*" multiple onChange={handleMedia} className="hidden" />
            </label>
            {mediaPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {mediaPreviews.map((preview, index) => (
                  <div key={preview} className="aspect-square overflow-hidden rounded-xl bg-light-gray">
                    {mediaFiles[index]?.type.startsWith('video/') ? (
                      <video src={preview} className="h-full w-full object-cover" muted />
                    ) : (
                      <img src={preview} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
          {notificationWarning && <div className="rounded-xl bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-700">{notificationWarning}</div>}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-10 bg-light-gray/92 backdrop-blur-sm">
          <div className="mx-auto max-w-[480px] px-4 pb-6 pt-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-orange px-4 py-4 text-base font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
