'use client'

import { useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import Link from 'next/link'
import { getStoredUser } from '../../../lib/helpers'
import { getSupabase } from '../../../lib/supabase'

interface JGIDJob {
  id: number
  job_no: string
  site: string
  title: string
  status: string
  client: string
}

interface ReceiptForm {
  date_of_purchase: string
  store_name: string
  total_inc_gst: string
  payment_type: string
  card_or_account: string
  is_for_job: boolean
  job_id: string
  job_name: string
  job_number: string
  purchase_type: string
  sub_category: string
  vehicle: string
  approved_by: string
}

const PAYMENT_TYPES = [
  'Receipt for Record',
  'Invoice for Payment',
  'Receipt for Reimbursement',
]

const CARD_OPTIONS = [
  'ANZ- Credit',
  'ANZ- Debit',
  'Amex',
  'Bunnings',
  '7-Eleven',
  'On Account',
  'Personal Card',
  'Payment Required',
]

const JOB_SPECIFIC_PURCHASE_TYPES = [
  'Contractors',
  'Fuel',
  'Hire',
  'Materials & Consumables',
  'Parking',
  'Tools',
  'Travel',
  'Other',
]

const GENERAL_PURCHASE_TYPES = [
  'Asset Servicing & Repair',
  'Contractor',
  'Fuel',
  'Gifts',
  'Hire',
  'Marketing/Advertising',
  'Materials & Consumables',
  'Meetings/Dinning',
  'Office Expense',
  'Parking',
  'Postage',
  'PPE',
  'Rope Access Gear',
  'Software',
  'Tools & Equipment',
  'Training',
  'Travel',
  'Uniform',
]

const JOB_SPECIFIC_SUBCATEGORIES = [
  'Height Safety Installs',
  'Window Cleaning',
  'Pressure Cleaning',
  'Painting',
  'Concrete Repairs',
  'Facade Repairs',
  'Joint Sealing',
  'Glazing',
  'Water Proofing',
  'Facade Inspections',
]

const GENERAL_SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  'Asset Servicing & Repair': ['Anchor Testers', 'Pressure Cleaners', 'Tools', 'Vehicles', 'Winches'],
  Fuel: ['EWP', 'Pressure Cleaners', 'Vehicles', 'Other'],
}

const VEHICLE_OPTIONS = [
  'HIACE -2590H9',
  'HIACE - 668MV4',
  'HIACE - 697KY6',
  'Tiguan - QXIX01',
  'Transit-622BB5',
  'Transit- ROP3S',
  'Caddy - 552VFJ',
  'Personal Vehicle',
]

const APPROVERS = ['Chay', 'Liam', 'Peter', 'Jyeha']
const MANUAL_JOB_OPTION = '__manual_job__'

function getSubCategoryOptions(isForJob: boolean, purchaseType: string) {
  if (isForJob) return JOB_SPECIFIC_SUBCATEGORIES
  return GENERAL_SUBCATEGORY_OPTIONS[purchaseType] || []
}

function getAutoCardAccount(paymentType: string) {
  if (paymentType === 'Receipt for Reimbursement') return 'Personal Card'
  if (paymentType === 'Invoice for Payment') return 'Payment Required'
  return ''
}

function getJobDisplayName(job: JGIDJob) {
  return job.site || job.title || job.client || job.job_no
}

function isSchemaMismatch(error: { code?: string; message?: string } | null) {
  if (!error) return false
  const message = error.message?.toLowerCase() || ''
  return (
    error.code === 'PGRST204' ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('column') ||
    message.includes('unknown')
  )
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-[56px] w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold uppercase tracking-[0.14em] text-navy/55">{title}</span>
        <svg
          className={`h-5 w-5 text-orange transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="space-y-4 border-t border-navy/8 px-4 py-4">{children}</div>}
    </section>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-navy/70">{children}</label>
}

function TextInput({
  label,
  prefix,
  className = '',
  ...props
}: {
  label: string
  prefix?: string
  className?: string
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-navy/40">
            {prefix}
          </span>
        )}
        <input
          {...props}
          className={`w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-navy min-h-[48px] focus:border-orange focus:outline-none ${prefix ? 'pl-8' : ''} ${className}`}
        />
      </div>
    </div>
  )
}

function SelectField({
  label,
  options,
  placeholder = 'Select...',
  ...props
}: {
  label: string
  options: string[]
  placeholder?: string
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        {...props}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-navy min-h-[48px] focus:border-orange focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

function SegmentedOptions({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid gap-2">
        {options.map((option) => {
          const active = value === option
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`min-h-[48px] rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                active
                  ? 'border-orange bg-orange text-white'
                  : 'border-gray-200 bg-light-gray text-navy active:border-orange/40'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ToggleOptions({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ].map((option) => {
          const active = value === option.value
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onChange(option.value)}
              className={`min-h-[48px] rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                active
                  ? 'border-orange bg-orange text-white'
                  : 'border-gray-200 bg-light-gray text-navy active:border-orange/40'
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

function JobPicker({
  jobs,
  jobsLoading,
  selectedJobId,
  onSelect,
  onClear,
}: {
  jobs: JGIDJob[]
  jobsLoading: boolean
  selectedJobId: string
  onSelect: (jobId: string) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selectedJob = jobs.find((job) => String(job.id) === selectedJobId)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredJobs = normalizedQuery
    ? jobs.filter((job) =>
        [job.job_no, job.site, job.title, job.client].some((value) => value.toLowerCase().includes(normalizedQuery))
      )
    : jobs

  function handleSelect(jobId: string) {
    setOpen(false)
    setQuery('')
    onSelect(jobId)
  }

  if (selectedJob) {
    return (
      <div>
        <FieldLabel>Job</FieldLabel>
        <div className="flex items-start justify-between gap-3 rounded-xl border border-orange/25 bg-white px-4 py-3 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy">{getJobDisplayName(selectedJob)}</p>
            <p className="mt-1 text-xs text-navy/55">{selectedJob.job_no}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange/10 text-orange transition-colors hover:bg-orange/20"
            aria-label="Clear selected job"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <FieldLabel>Job</FieldLabel>
      <div className="space-y-2">
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search jobs..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-navy shadow-sm min-h-[48px] focus:border-orange focus:outline-none"
        />

        {open && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="max-h-[200px] overflow-y-auto">
              {jobsLoading ? (
                <div className="px-4 py-3 text-sm text-navy/55">Loading jobs...</div>
              ) : filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => handleSelect(String(job.id))}
                    className="block w-full border-b border-navy/8 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-orange/5"
                  >
                    <span className="block text-sm font-semibold text-navy">{getJobDisplayName(job)}</span>
                    <span className="mt-1 block text-xs text-navy/55">{job.job_no}</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-navy/55">No matching jobs found.</div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleSelect(MANUAL_JOB_OPTION)}
              className="block w-full border-t border-orange/20 px-4 py-3 text-left text-sm font-semibold text-orange transition-colors hover:bg-orange/5"
            >
              Job not listed
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NewReceiptPage() {
  const [jobs, setJobs] = useState<JGIDJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [manualJobSelected, setManualJobSelected] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanned, setScanned] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState<ReceiptForm>({
    date_of_purchase: today,
    store_name: '',
    total_inc_gst: '',
    payment_type: PAYMENT_TYPES[0],
    card_or_account: '',
    is_for_job: false,
    job_id: '',
    job_name: '',
    job_number: '',
    purchase_type: '',
    sub_category: '',
    vehicle: '',
    approved_by: '',
  })

  const purchaseTypeOptions = form.is_for_job ? JOB_SPECIFIC_PURCHASE_TYPES : GENERAL_PURCHASE_TYPES
  const subCategoryOptions = getSubCategoryOptions(form.is_for_job, form.purchase_type)
  const showVehicleField = form.sub_category === 'Vehicles'
  const user = typeof window === 'undefined' ? null : getStoredUser()

  useEffect(() => {
    if (!user) {
      window.location.href = '/login'
      return
    }

    fetch('/api/jgid-jobs')
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load jobs')
        return response.json()
      })
      .then((data) => {
        if (Array.isArray(data)) setJobs(data)
      })
      .catch(() => {})
      .finally(() => setJobsLoading(false))
  }, [user])

  function updateField<K extends keyof ReceiptForm>(field: K, value: ReceiptForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function updatePaymentType(value: string) {
    const autoCardAccount = getAutoCardAccount(value)
    setForm((prev) => ({
      ...prev,
      payment_type: value,
      card_or_account: autoCardAccount || (prev.card_or_account === 'Personal Card' || prev.card_or_account === 'Payment Required' ? '' : prev.card_or_account),
    }))
  }

  function updateIsForJob(value: boolean) {
    setForm((prev) => ({
      ...prev,
      is_for_job: value,
      job_id: value ? prev.job_id : '',
      job_name: value ? prev.job_name : '',
      job_number: value ? prev.job_number : '',
      purchase_type: '',
      sub_category: '',
      vehicle: '',
    }))
    if (!value) setManualJobSelected(false)
  }

  function updatePurchaseType(value: string) {
    const nextSubCategoryOptions = getSubCategoryOptions(form.is_for_job, value)
    setForm((prev) => ({
      ...prev,
      purchase_type: value,
      sub_category: nextSubCategoryOptions.includes(prev.sub_category) ? prev.sub_category : '',
      vehicle: nextSubCategoryOptions.includes(prev.sub_category) && prev.sub_category === 'Vehicles' ? prev.vehicle : '',
    }))
  }

  function updateSubCategory(value: string) {
    setForm((prev) => ({
      ...prev,
      sub_category: value,
      vehicle: value === 'Vehicles' ? prev.vehicle : '',
    }))
  }

  function handleJobChange(jobId: string) {
    if (jobId === MANUAL_JOB_OPTION) {
      setManualJobSelected(true)
      setForm((prev) => ({
        ...prev,
        job_id: '',
        job_name: '',
        job_number: '',
      }))
      return
    }

    const selectedJob = jobs.find((job) => String(job.id) === jobId)
    setManualJobSelected(false)
    setForm((prev) => ({
      ...prev,
      job_id: jobId,
      job_name: selectedJob ? getJobDisplayName(selectedJob) : '',
      job_number: selectedJob?.job_no || '',
    }))
  }

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setPhotoFile(file)
    setScanError(null)
    setScanned(false)

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      setPhotoPreview(dataUrl)
      await scanReceipt(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  async function scanReceipt(dataUrl: string) {
    setScanning(true)
    setScanError(null)

    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })

      if (!response.ok) {
        const error = await response.json()
        setScanError(error.error || 'Scan failed')
        setScanning(false)
        return
      }

      const data = await response.json()
      setForm((prev) => ({
        ...prev,
        date_of_purchase: data.date_of_purchase || prev.date_of_purchase,
        store_name: data.store_name || prev.store_name,
        total_inc_gst: data.total_inc_gst != null ? String(data.total_inc_gst) : prev.total_inc_gst,
      }))
      setScanned(true)
    } catch {
      setScanError('Network error. Fill the form manually if needed.')
    }

    setScanning(false)
  }

  async function uploadPhoto() {
    if (!photoFile) return null

    const supabase = getSupabase()
    const timestamp = Date.now()
    const ext = photoFile.name.split('.').pop() || 'jpg'
    const path = `receipts/${form.date_of_purchase}/${timestamp}.${ext}`
    const { error } = await supabase.storage.from('receipts').upload(path, photoFile)
    if (error) return null

    const { data } = supabase.storage.from('receipts').getPublicUrl(path)
    return data.publicUrl
  }

  async function insertReceipt(payloads: Array<Record<string, unknown>>) {
    const supabase = getSupabase()
    let lastError: { code?: string; message?: string } | null = null

    for (const payload of payloads) {
      const { error } = await supabase.from('purchase_receipts').insert(payload)
      if (!error) return null
      lastError = error
      if (!isSchemaMismatch(error)) return error
    }

    return lastError
  }

  async function handleSubmit() {
    if (!user) return
    const trimmedJobName = form.job_name.trim()

    if (!form.date_of_purchase || !form.store_name.trim() || !form.total_inc_gst || !form.card_or_account || !form.purchase_type || !form.approved_by) {
      alert('Please complete Date, Store Name, Total, Card or Account, Purchase Type, and Purchase Approved By.')
      return
    }
    if (form.is_for_job && !form.job_id && !trimmedJobName) {
      alert('Please select the job this purchase relates to or enter the job name manually.')
      return
    }

    setSubmitting(true)

    const totalAmount = parseFloat(form.total_inc_gst) || 0
    const receiptPhotoUrl = await uploadPhoto()

    const currentPayload = {
      date_of_purchase: form.date_of_purchase,
      store_name: form.store_name.trim(),
      total_inc_gst: totalAmount,
      payment_type: form.payment_type,
      card_or_account: form.card_or_account,
      is_for_job: form.is_for_job,
      job_name: form.is_for_job ? trimmedJobName || null : null,
      job_number: form.is_for_job && form.job_id ? form.job_number : null,
      purchase_category: form.purchase_type || null,
      purchase_for: form.sub_category || null,
      vehicle_id: null,
      details: null,
      receipt_photo_url: receiptPhotoUrl,
      team_member_name: user.name,
      status: 'pending',
      approved_by: form.approved_by || null,
    }

    const enhancedPayload = {
      ...currentPayload,
      date: form.date_of_purchase,
      total: totalAmount,
      photo_url: receiptPhotoUrl,
      card_account: form.card_or_account,
      job_linked: form.is_for_job,
      job_id: form.is_for_job && form.job_id ? Number(form.job_id) : null,
      purchase_type: form.purchase_type || null,
      sub_category: form.sub_category || null,
      vehicle: showVehicleField ? form.vehicle || null : null,
    }

    const legacyPayload = {
      team_member_name: user.name,
      date: form.date_of_purchase,
      store_name: form.store_name.trim(),
      total: totalAmount,
      photo_url: receiptPhotoUrl,
      status: 'pending',
      payment_type: form.payment_type,
      card_account: form.card_or_account,
      job_linked: form.is_for_job,
      job_id: form.is_for_job && form.job_id ? Number(form.job_id) : null,
      job_name: form.is_for_job ? trimmedJobName || null : null,
      purchase_type: form.purchase_type || null,
      sub_category: form.sub_category || null,
      vehicle: showVehicleField ? form.vehicle || null : null,
      approved_by: form.approved_by || null,
    }

    const error = await insertReceipt([enhancedPayload, currentPayload, legacyPayload])
    if (error) {
      alert(`Error saving receipt: ${error.message}`)
      setSubmitting(false)
      return
    }

    window.location.href = '/receipts'
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-light-gray">
        <div className="h-8 w-8 rounded-full border-3 border-orange border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-light-gray">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/receipts" className="text-white/60 active:text-white transition-all">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="text-xl font-bold text-white">New Receipt</div>
        </div>

        <div className="flex-1 space-y-4 px-4 py-4 pb-28">
          <CollapsibleSection title="Receipt Photo" defaultOpen={true}>
            {photoPreview ? (
              <div className="relative overflow-hidden rounded-2xl border border-navy/10 bg-light-gray">
                <img src={photoPreview} alt="Receipt preview" className="max-h-[320px] w-full object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null)
                    setPhotoPreview(null)
                    setScanned(false)
                    setScanError(null)
                  }}
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-navy/70 text-xl text-white"
                >
                  ×
                </button>
                {scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-navy/60">
                    <div className="h-8 w-8 rounded-full border-3 border-white border-t-transparent animate-spin" />
                    <div className="text-sm font-semibold text-white">Scanning receipt...</div>
                  </div>
                )}
              </div>
            ) : (
              <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-orange/35 bg-orange/5 px-6 text-center text-navy transition-all active:bg-orange/10">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange/10 text-orange">
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <div>
                  <div className="text-base font-semibold">Upload receipt photo</div>
                  <div className="mt-1 text-sm text-navy/55">Camera or gallery, then AI fills Date, Store Name and Total.</div>
                </div>
                <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              </label>
            )}

            {photoPreview && !scanning && (
              <label className="flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border border-navy/10 bg-light-gray px-4 py-3 text-sm font-semibold text-navy">
                Retake photo
                <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              </label>
            )}

            {scanned && !scanError && (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                Receipt scanned. Review the fields below before saving.
              </div>
            )}

            {scanError && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {scanError}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Purchase Details" defaultOpen={true}>
            <TextInput
              label="Date of Purchase"
              type="date"
              value={form.date_of_purchase}
              onChange={(event) => updateField('date_of_purchase', event.target.value)}
            />

            <TextInput
              label="Store Name"
              type="text"
              placeholder="e.g. Bunnings"
              value={form.store_name}
              onChange={(event) => updateField('store_name', event.target.value)}
            />

            <TextInput
              label="Total"
              type="number"
              inputMode="decimal"
              step="0.01"
              prefix="$"
              placeholder="0.00"
              value={form.total_inc_gst}
              onChange={(event) => updateField('total_inc_gst', event.target.value)}
            />

            <SegmentedOptions
              label="Payment Type"
              options={PAYMENT_TYPES}
              value={form.payment_type}
              onChange={updatePaymentType}
            />

            <SelectField
              label="Card or Account"
              options={CARD_OPTIONS}
              value={form.card_or_account}
              onChange={(event) => updateField('card_or_account', event.target.value)}
            />
          </CollapsibleSection>

          <CollapsibleSection title="Coding" defaultOpen={true}>
            <ToggleOptions
              label="Is the purchase for a specific job?"
              value={form.is_for_job}
              onChange={updateIsForJob}
            />

            {form.is_for_job && (
              <JobPicker
                jobs={jobs}
                jobsLoading={jobsLoading}
                selectedJobId={form.job_id}
                onSelect={handleJobChange}
                onClear={() => handleJobChange('')}
              />
            )}

            {form.is_for_job && manualJobSelected && (
              <TextInput
                label="Manual Job Name"
                type="text"
                placeholder="Enter job name"
                value={form.job_name}
                onChange={(event) => updateField('job_name', event.target.value)}
              />
            )}

            <SelectField
              label="Purchase Type"
              options={purchaseTypeOptions}
              value={form.purchase_type}
              onChange={(event) => updatePurchaseType(event.target.value)}
            />

            {subCategoryOptions.length > 0 && (
              <SelectField
                label="Sub Category"
                options={subCategoryOptions}
                value={form.sub_category}
                onChange={(event) => updateSubCategory(event.target.value)}
              />
            )}

            {showVehicleField && (
              <SelectField
                label="Vehicles"
                options={VEHICLE_OPTIONS}
                value={form.vehicle}
                onChange={(event) => updateField('vehicle', event.target.value)}
              />
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Approval" defaultOpen={true}>
            <SelectField
              label="Purchase Approved By"
              options={APPROVERS}
              value={form.approved_by}
              onChange={(event) => updateField('approved_by', event.target.value)}
            />
          </CollapsibleSection>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-10 bg-light-gray/92 backdrop-blur-sm">
          <div className="mx-auto max-w-[480px] px-4 pb-6 pt-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || scanning}
              className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-orange px-4 py-4 text-base font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {submitting ? 'Saving...' : 'Save Receipt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
