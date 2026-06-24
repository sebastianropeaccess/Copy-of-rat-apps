'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoredUser } from '../../../lib/helpers'
import { getSupabase } from '../../../lib/supabase'
import type { TeamMember } from '../../../lib/types'
import SignatureCanvas from '../components/SignatureCanvas'
import jsPDF from 'jspdf'

interface SimproJob {
  id: number
  description: string
  value: number
}

interface EmployeeRow {
  name: string
  position: string
  onsiteStart: string
  onsiteFinish: string
  onsiteBreaks: number
  onsiteTotal: number
  onsiteComment: string
  offsiteStart: string
  offsiteFinish: string
  offsiteBreaks: number
  offsiteTotal: number
  offsiteComment: string
}

interface MaterialRow {
  materialType: string
  quantity: number
  price: number
}

function calcTotal(start: string, finish: string, breaks: number): number {
  if (!start || !finish) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [fh, fm] = finish.split(':').map(Number)
  const startMin = sh * 60 + sm
  const finishMin = fh * 60 + fm
  const diff = finishMin - startMin - breaks
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMoney(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`
  return `$${amount.toFixed(0)}`
}

export default function NewTimesheetPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')

  // Simpro job state
  const [simproJobs, setSimproJobs] = useState<SimproJob[]>([])
  const [selectedJob, setSelectedJob] = useState<SimproJob | null>(null)
  const [jobSearch, setJobSearch] = useState('')
  const [showJobPicker, setShowJobPicker] = useState(false)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [useManualProject, setUseManualProject] = useState(false)

  // Form state
  const [projectName, setProjectName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [companyRepName, setCompanyRepName] = useState('')
  const [companyRepSig, setCompanyRepSig] = useState<string | null>(null)
  const [clientRepName, setClientRepName] = useState('')
  const [clientRepSig, setClientRepSig] = useState<string | null>(null)

  // UI state
  const [showPicker, setShowPicker] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  useEffect(() => {
    const user = getStoredUser()
    if (!user) { window.location.href = '/login'; return }
    setUserName(user.name)
  }, [])

  // Load Simpro jobs for picker
  const loadSimproJobs = useCallback(async () => {
    if (simproJobs.length > 0) return // already loaded
    setLoadingJobs(true)
    try {
      const res = await fetch('/api/simpro?action=timesheet-jobs')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSimproJobs(data.jobs || [])
    } catch (err) {
      console.error('Failed to load Simpro jobs:', err)
      setToast('Failed to load jobs from Simpro')
      setTimeout(() => setToast(''), 3000)
    } finally {
      setLoadingJobs(false)
    }
  }, [simproJobs.length])

  // When a job is selected, auto-populate scheduled employees
  async function onSelectJob(job: SimproJob) {
    setSelectedJob(job)
    setProjectName(job.description)
    setShowJobPicker(false)
    setJobSearch('')

    // Try to load scheduled staff for this job on the selected date
    setLoadingSchedule(true)
    try {
      const res = await fetch(`/api/simpro?action=schedule-for-job&jobId=${job.id}&date=${date}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      if (data.staff && data.staff.length > 0) {
        // Load team members to get positions
        const sb = getSupabase()
        const { data: members } = await sb.from('team_members').select('*').eq('active', true)
        const memberMap = new Map((members || []).map((m: TeamMember) => [m.name, m]))

        // Auto-populate employees from schedule
        const scheduledEmployees: EmployeeRow[] = data.staff.map((s: { name: string; startTime: string; endTime: string }) => {
          const member = memberMap.get(s.name)
          return {
            name: s.name,
            position: member?.position || 'Technician',
            onsiteStart: s.startTime ? s.startTime.slice(0, 5) : '',
            onsiteFinish: s.endTime ? s.endTime.slice(0, 5) : '',
            onsiteBreaks: 30, // default 30min lunch
            onsiteTotal: calcTotal(
              s.startTime ? s.startTime.slice(0, 5) : '',
              s.endTime ? s.endTime.slice(0, 5) : '',
              30
            ),
            onsiteComment: '',
            offsiteStart: '',
            offsiteFinish: '',
            offsiteBreaks: 0,
            offsiteTotal: 0,
            offsiteComment: '',
          }
        })

        // Only auto-add if no employees already added
        if (employees.length === 0) {
          setEmployees(scheduledEmployees)
          setToast(`${scheduledEmployees.length} employee${scheduledEmployees.length !== 1 ? 's' : ''} loaded from schedule`)
          setTimeout(() => setToast(''), 3000)
        }
      }
    } catch (err) {
      console.error('Failed to load schedule:', err)
      // Non-blocking — schedule auto-fill is optional
    } finally {
      setLoadingSchedule(false)
    }
  }

  const filteredJobs = simproJobs.filter((j) => {
    if (!jobSearch) return true
    const q = jobSearch.toLowerCase()
    return j.description.toLowerCase().includes(q) || String(j.id).includes(q)
  })

  const loadTeamMembers = useCallback(async () => {
    const sb = getSupabase()
    const { data } = await sb.from('team_members').select('*').eq('active', true).order('name')
    if (data) setTeamMembers(data)
  }, [])

  function openPicker() {
    loadTeamMembers()
    setShowPicker(true)
  }

  function addEmployee(member: TeamMember) {
    if (employees.some((e) => e.name === member.name)) return
    setEmployees((prev) => [
      ...prev,
      {
        name: member.name,
        position: member.position,
        onsiteStart: '',
        onsiteFinish: '',
        onsiteBreaks: 0,
        onsiteTotal: 0,
        onsiteComment: '',
        offsiteStart: '',
        offsiteFinish: '',
        offsiteBreaks: 0,
        offsiteTotal: 0,
        offsiteComment: '',
      },
    ])
    setShowPicker(false)
  }

  function removeEmployee(idx: number) {
    setEmployees((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateEmployee(idx: number, field: keyof EmployeeRow, value: string | number) {
    setEmployees((prev) => {
      const updated = [...prev]
      const emp = { ...updated[idx] }
      ;(emp as Record<string, string | number>)[field] = value

      // Auto-calculate totals
      emp.onsiteTotal = calcTotal(emp.onsiteStart, emp.onsiteFinish, emp.onsiteBreaks)
      emp.offsiteTotal = calcTotal(emp.offsiteStart, emp.offsiteFinish, emp.offsiteBreaks)
      updated[idx] = emp
      return updated
    })
  }

  function addMaterial() {
    setMaterials((prev) => [...prev, { materialType: '', quantity: 0, price: 0 }])
  }

  function removeMaterial(idx: number) {
    setMaterials((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateMaterial(idx: number, field: keyof MaterialRow, value: string | number) {
    setMaterials((prev) => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      return updated
    })
  }

  const materialTotal = materials.reduce((sum, m) => sum + m.quantity * m.price, 0)

  async function generatePDF(): Promise<Blob> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 10
    let y = 15

    // Header
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('ROPE ACCESS TECHNICIANS', pageW / 2, y, { align: 'center' })
    y += 6
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Daily Timesheet and Materials Total', pageW / 2, y, { align: 'center' })
    y += 5
    doc.setFontSize(8)
    doc.text('Document Ref: FRM-028', pageW - margin, y, { align: 'right' })
    y += 8

    // Project Info
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Project:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(projectName, margin + 20, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Date:', pageW / 2 + 10, y)
    doc.setFont('helvetica', 'normal')
    doc.text(formatDate(date), pageW / 2 + 25, y)
    y += 5

    // Simpro Job ID if linked
    if (selectedJob) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Simpro Job #${selectedJob.id}`, margin, y)
      y += 5
    }
    y += 5

    // Employee Table Header
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    const cols = [margin, margin + 30, margin + 45, margin + 60, margin + 72, margin + 84, margin + 100, margin + 115, margin + 130, margin + 142, margin + 154]
    doc.text('Employee', cols[0], y)
    doc.text('On Start', cols[1], y)
    doc.text('On Finish', cols[2], y)
    doc.text('On Brk', cols[3], y)
    doc.text('On Total', cols[4], y)
    doc.text('On Comment', cols[5], y)
    doc.text('Off Start', cols[6], y)
    doc.text('Off Finish', cols[7], y)
    doc.text('Off Brk', cols[8], y)
    doc.text('Off Total', cols[9], y)
    doc.text('Off Comment', cols[10], y)
    y += 2
    doc.setDrawColor(200)
    doc.line(margin, y, pageW - margin, y)
    y += 4

    doc.setFont('helvetica', 'normal')
    for (const emp of employees) {
      if (y > 260) { doc.addPage(); y = 15 }
      doc.text(emp.name.substring(0, 15), cols[0], y)
      doc.text(emp.onsiteStart || '-', cols[1], y)
      doc.text(emp.onsiteFinish || '-', cols[2], y)
      doc.text(String(emp.onsiteBreaks || 0), cols[3], y)
      doc.text(emp.onsiteTotal.toFixed(1), cols[4], y)
      doc.text((emp.onsiteComment || '-').substring(0, 12), cols[5], y)
      doc.text(emp.offsiteStart || '-', cols[6], y)
      doc.text(emp.offsiteFinish || '-', cols[7], y)
      doc.text(String(emp.offsiteBreaks || 0), cols[8], y)
      doc.text(emp.offsiteTotal.toFixed(1), cols[9], y)
      doc.text((emp.offsiteComment || '-').substring(0, 12), cols[10], y)
      y += 5
    }
    y += 5

    // Description
    if (y > 240) { doc.addPage(); y = 15 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Brief Description of Work:', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const descLines = doc.splitTextToSize(description || '-', pageW - margin * 2)
    doc.text(descLines, margin, y)
    y += descLines.length * 4 + 5

    // Materials Table
    if (materials.length > 0) {
      if (y > 240) { doc.addPage(); y = 15 }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Materials', margin, y)
      y += 5
      doc.setFontSize(8)
      doc.text('Material Type', margin, y)
      doc.text('QTY', margin + 80, y)
      doc.text('Price', margin + 100, y)
      y += 2
      doc.line(margin, y, pageW - margin, y)
      y += 4

      doc.setFont('helvetica', 'normal')
      for (const mat of materials) {
        if (y > 260) { doc.addPage(); y = 15 }
        doc.text(mat.materialType || '-', margin, y)
        doc.text(String(mat.quantity), margin + 80, y)
        doc.text(`$${(mat.quantity * mat.price).toFixed(2)}`, margin + 100, y)
        y += 5
      }
      y += 2
      doc.setFont('helvetica', 'bold')
      doc.text(`Total: $${materialTotal.toFixed(2)}`, margin + 100, y)
      y += 10
    }

    // Signatures
    if (y > 220) { doc.addPage(); y = 15 }
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Company Representative:', margin, y)
    doc.text('Client Representative:', pageW / 2 + 5, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(companyRepName || '-', margin, y)
    doc.text(clientRepName || '-', pageW / 2 + 5, y)
    y += 3

    if (companyRepSig) {
      try { doc.addImage(companyRepSig, 'PNG', margin, y, 60, 20) } catch { /* skip */ }
    }
    if (clientRepSig) {
      try { doc.addImage(clientRepSig, 'PNG', pageW / 2 + 5, y, 60, 20) } catch { /* skip */ }
    }

    return doc.output('blob')
  }

  async function handleSubmit() {
    if (!projectName.trim()) { setToast('Project name is required'); setTimeout(() => setToast(''), 3000); return }
    if (employees.length === 0) { setToast('Add at least one employee'); setTimeout(() => setToast(''), 3000); return }

    setSubmitting(true)
    try {
      const sb = getSupabase()

      // 1. Insert timesheet
      const { data: ts, error: tsErr } = await sb
        .from('timesheets')
        .insert({
          project_name: projectName.trim(),
          simpro_job_id: selectedJob?.id || null,
          date,
          description: description.trim(),
          company_rep_name: companyRepName.trim(),
          company_rep_signature: companyRepSig,
          client_rep_name: clientRepName.trim(),
          client_rep_signature: clientRepSig,
          total_materials_cost: materialTotal,
          submitted_by: userName,
          submitted_at: new Date().toISOString(),
          emailed: false,
        })
        .select('id')
        .single()

      if (tsErr || !ts) throw new Error(tsErr?.message || 'Failed to create timesheet')

      // 2. Insert entries
      const entries = employees.map((e) => ({
        timesheet_id: ts.id,
        employee_name: e.name,
        onsite_start: e.onsiteStart || null,
        onsite_finish: e.onsiteFinish || null,
        onsite_breaks: e.onsiteBreaks || null,
        onsite_total: e.onsiteTotal || null,
        onsite_comment: e.onsiteComment || null,
        offsite_start: e.offsiteStart || null,
        offsite_finish: e.offsiteFinish || null,
        offsite_breaks: e.offsiteBreaks || null,
        offsite_total: e.offsiteTotal || null,
        offsite_comment: e.offsiteComment || null,
      }))
      await sb.from('timesheet_entries').insert(entries)

      // 3. Insert materials
      if (materials.length > 0) {
        const mats = materials.map((m) => ({
          timesheet_id: ts.id,
          material_type: m.materialType,
          quantity: m.quantity,
          price: m.price,
        }))
        await sb.from('timesheet_materials').insert(mats)
      }

      // 4. Generate PDF
      const pdfBlob = await generatePDF()
      const safeName = projectName.trim().replace(/[^a-zA-Z0-9-_]/g, '_')
      const pdfPath = `${date}/${safeName}.pdf`

      // 5. Upload to storage
      const { error: uploadErr } = await sb.storage
        .from('timesheets')
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true })

      if (!uploadErr) {
        // 6. Get public URL and update record
        const { data: urlData } = sb.storage.from('timesheets').getPublicUrl(pdfPath)
        if (urlData?.publicUrl) {
          await sb.from('timesheets').update({ pdf_url: urlData.publicUrl }).eq('id', ts.id)
        }
      }

      // 7. Navigate back
      router.push('/timesheet')
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Submit failed')
      setTimeout(() => setToast(''), 4000)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3 sticky top-0 z-20">
          <Link href="/timesheet" className="text-white/60 active:text-white">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="text-lg font-bold text-white">New Timesheet</div>
        </div>

        <div className="flex-1 px-4 py-4 space-y-5 pb-32">
          {/* Section 1: Project / Simpro Job */}
          <section className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-navy mb-3">Project Details</div>
            <div className="space-y-3">
              {/* Simpro Job Picker */}
              {!useManualProject ? (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Simpro Job</label>
                  {selectedJob ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="flex-1 px-3 py-2.5 border border-orange/30 bg-orange/5 rounded-lg cursor-pointer
                          active:bg-orange/10 transition-all"
                        onClick={() => {
                          loadSimproJobs()
                          setShowJobPicker(true)
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-navy truncate">{selectedJob.description}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-navy/40">Job #{selectedJob.id}</span>
                              {selectedJob.value > 0 && (
                                <span className="text-[10px] text-green-600">{formatMoney(selectedJob.value)}</span>
                              )}
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-navy/30 shrink-0 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJob(null)
                          setProjectName('')
                        }}
                        className="text-red-400 active:text-red-600 p-2"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        loadSimproJobs()
                        setShowJobPicker(true)
                      }}
                      className="w-full px-3 py-3 border border-dashed border-orange/40 rounded-lg text-sm text-orange font-medium
                        bg-orange/5 active:bg-orange/10 transition-all flex items-center justify-center gap-2"
                    >
                      {loadingJobs ? (
                        <>
                          <div className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                          Loading jobs...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <path d="M8 21h8M12 17v4" />
                          </svg>
                          Select Simpro Job
                        </>
                      )}
                    </button>
                  )}

                  {loadingSchedule && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-navy/40">
                      <div className="w-3 h-3 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                      Loading scheduled employees...
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setUseManualProject(true)}
                    className="text-[11px] text-navy/30 mt-2 underline"
                  >
                    Or enter project name manually
                  </button>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Project Name *</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-orange"
                    placeholder="Enter project name"
                  />
                  <button
                    type="button"
                    onClick={() => setUseManualProject(false)}
                    className="text-[11px] text-navy/30 mt-2 underline"
                  >
                    Or select from Simpro
                  </button>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-orange"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Employees */}
          <section className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-navy">Employees</div>
              <button
                type="button"
                onClick={openPicker}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange text-white text-xs font-medium
                  rounded-lg active:scale-95 transition-transform duration-150"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Employee
              </button>
            </div>

            {employees.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm">
                {selectedJob ? 'No employees scheduled — add manually' : 'No employees added'}
              </div>
            )}

            {/* Summary bar */}
            {employees.length > 0 && (
              <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-navy/5 rounded-lg">
                <div className="text-[10px] text-navy/50">
                  <span className="font-bold text-navy">{employees.length}</span> employee{employees.length !== 1 ? 's' : ''}
                </div>
                <div className="text-[10px] text-navy/50">
                  <span className="font-bold text-orange">
                    {employees.reduce((s, e) => s + e.onsiteTotal + e.offsiteTotal, 0).toFixed(1)}
                  </span> total hrs
                </div>
              </div>
            )}

            <div className="space-y-4">
              {employees.map((emp, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-navy">{emp.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-navy/10 text-navy/70 rounded-full">{emp.position}</span>
                    </div>
                    <button type="button" onClick={() => removeEmployee(idx)} className="text-red-400 active:text-red-600 p-1">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Onsite */}
                  <div className="mb-2">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Onsite</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <div>
                        <label className="text-[9px] text-gray-400">Start</label>
                        <input type="time" value={emp.onsiteStart} onChange={(e) => updateEmployee(idx, 'onsiteStart', e.target.value)}
                          className="w-full px-1.5 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-orange" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400">Finish</label>
                        <input type="time" value={emp.onsiteFinish} onChange={(e) => updateEmployee(idx, 'onsiteFinish', e.target.value)}
                          className="w-full px-1.5 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-orange" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400">Breaks (min)</label>
                        <input type="number" min={0} value={emp.onsiteBreaks || ''} onChange={(e) => updateEmployee(idx, 'onsiteBreaks', Number(e.target.value))}
                          className="w-full px-1.5 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-orange" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400">Total (hrs)</label>
                        <div className="px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs font-medium text-navy">
                          {emp.onsiteTotal.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <input type="text" value={emp.onsiteComment} onChange={(e) => updateEmployee(idx, 'onsiteComment', e.target.value)}
                      placeholder="Comment (optional)"
                      className="w-full mt-1.5 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-orange" />
                  </div>

                  {/* Offsite */}
                  <div>
                    <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Offsite</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <div>
                        <label className="text-[9px] text-gray-400">Start</label>
                        <input type="time" value={emp.offsiteStart} onChange={(e) => updateEmployee(idx, 'offsiteStart', e.target.value)}
                          className="w-full px-1.5 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-orange" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400">Finish</label>
                        <input type="time" value={emp.offsiteFinish} onChange={(e) => updateEmployee(idx, 'offsiteFinish', e.target.value)}
                          className="w-full px-1.5 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-orange" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400">Breaks (min)</label>
                        <input type="number" min={0} value={emp.offsiteBreaks || ''} onChange={(e) => updateEmployee(idx, 'offsiteBreaks', Number(e.target.value))}
                          className="w-full px-1.5 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-orange" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-400">Total (hrs)</label>
                        <div className="px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs font-medium text-navy">
                          {emp.offsiteTotal.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <input type="text" value={emp.offsiteComment} onChange={(e) => updateEmployee(idx, 'offsiteComment', e.target.value)}
                      placeholder="Comment (optional)"
                      className="w-full mt-1.5 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-orange" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Description */}
          <section className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-navy mb-3">Brief Description of Work</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-orange resize-none"
              placeholder="Describe the work performed..."
            />
          </section>

          {/* Section 4: Materials */}
          <section className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-navy">Materials</div>
              <button
                type="button"
                onClick={addMaterial}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange text-white text-xs font-medium
                  rounded-lg active:scale-95 transition-transform duration-150"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Material
              </button>
            </div>

            {materials.length === 0 && (
              <div className="text-center py-4 text-gray-400 text-sm">No materials added</div>
            )}

            <div className="space-y-2">
              {materials.map((mat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mat.materialType}
                    onChange={(e) => updateMaterial(idx, 'materialType', e.target.value)}
                    placeholder="Material type"
                    className="flex-1 px-2 py-2 border border-gray-200 rounded text-xs focus:outline-none focus:border-orange"
                  />
                  <input
                    type="number"
                    min={0}
                    value={mat.quantity || ''}
                    onChange={(e) => updateMaterial(idx, 'quantity', Number(e.target.value))}
                    placeholder="QTY"
                    className="w-16 px-2 py-2 border border-gray-200 rounded text-xs focus:outline-none focus:border-orange"
                  />
                  <div className="relative w-20">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={mat.price || ''}
                      onChange={(e) => updateMaterial(idx, 'price', Number(e.target.value))}
                      placeholder="Price"
                      className="w-full pl-5 pr-2 py-2 border border-gray-200 rounded text-xs focus:outline-none focus:border-orange"
                    />
                  </div>
                  <button type="button" onClick={() => removeMaterial(idx)} className="text-red-400 active:text-red-600 p-1">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {materials.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs font-medium text-gray-500">Total</span>
                <span className="text-sm font-bold text-navy">${materialTotal.toFixed(2)}</span>
              </div>
            )}
          </section>

          {/* Section 5: Signatures */}
          <section className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-navy mb-3">Signatures</div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Company Representative</label>
                <input
                  type="text"
                  value={companyRepName}
                  onChange={(e) => setCompanyRepName(e.target.value)}
                  placeholder="Name"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-orange mb-2"
                />
                <SignatureCanvas onSignatureChange={setCompanyRepSig} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Client Representative</label>
                <input
                  type="text"
                  value={clientRepName}
                  onChange={(e) => setClientRepName(e.target.value)}
                  placeholder="Name"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-orange mb-2"
                />
                <SignatureCanvas onSignatureChange={setClientRepSig} />
              </div>
            </div>
          </section>
        </div>

        {/* Submit Button - Fixed */}
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="max-w-[480px] mx-auto px-4 pb-4 pt-2 bg-gradient-to-t from-light-gray via-light-gray to-transparent">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3.5 bg-orange text-white font-bold text-base rounded-xl
                active:scale-95 active:bg-orange-light transition-all duration-150
                disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Timesheet'
              )}
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm shadow-lg ${
            toast.includes('loaded') || toast.includes('employee') ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {toast}
          </div>
        )}

        {/* Employee Picker Modal */}
        {showPicker && (
          <div className="fixed inset-0 z-30 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPicker(false)} />
            <div className="relative w-full max-w-[480px] bg-white rounded-t-2xl p-5 pb-8 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="font-semibold text-navy">Select Employee</div>
                <button type="button" onClick={() => setShowPicker(false)} className="text-gray-400 active:text-gray-600 p-1">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2">
                {teamMembers.map((m) => {
                  const alreadyAdded = employees.some((e) => e.name === m.name)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => addEmployee(m)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left
                        transition-all duration-150
                        ${alreadyAdded
                          ? 'bg-gray-50 opacity-50'
                          : 'bg-gray-50 active:bg-orange/10 active:scale-[0.98]'
                        }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-navy">{m.name}</div>
                        <div className="text-xs text-gray-400">{m.position}</div>
                      </div>
                      {alreadyAdded && <span className="text-[10px] text-gray-400">Added</span>}
                    </button>
                  )
                })}
                {teamMembers.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Simpro Job Picker Modal */}
        {showJobPicker && (
          <div className="fixed inset-0 z-30 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowJobPicker(false)} />
            <div className="relative w-full max-w-[480px] bg-white rounded-t-2xl p-5 pb-8 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-navy">Select Simpro Job</div>
                <button type="button" onClick={() => setShowJobPicker(false)} className="text-gray-400 active:text-gray-600 p-1">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/30" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  placeholder="Search jobs by name or ID..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-orange"
                />
              </div>

              <div className="text-[10px] text-navy/30 mb-2">{filteredJobs.length} jobs</div>

              {/* Job list */}
              <div className="flex-1 overflow-y-auto space-y-1.5">
                {loadingJobs ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">No jobs found</div>
                ) : (
                  filteredJobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => onSelectJob(job)}
                      className={`w-full px-4 py-3 rounded-xl text-left transition-all duration-150
                        active:scale-[0.98] ${
                          selectedJob?.id === job.id
                            ? 'bg-orange/10 border border-orange/30'
                            : 'bg-gray-50 active:bg-orange/5'
                        }`}
                    >
                      <div className="text-sm font-medium text-navy leading-tight truncate">{job.description}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-navy/40">#{job.id}</span>
                        {job.value > 0 && (
                          <span className="text-[10px] text-green-600 font-medium">{formatMoney(job.value)}</span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
