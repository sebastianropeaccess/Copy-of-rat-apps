'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import { getSupabase } from '@/lib/supabase'
import type { Timesheet, TimesheetEntry, TimesheetMaterial } from '@/lib/types'

export default function ViewTimesheetPage() {
  const params = useParams()
  const id = params.id as string
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null)
  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [materials, setMaterials] = useState<TimesheetMaterial[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const user = getStoredUser()
    if (!user) { window.location.href = '/login'; return }

    async function load() {
      const sb = getSupabase()
      const [{ data: ts }, { data: ents }, { data: mats }] = await Promise.all([
        sb.from('timesheets').select('*').eq('id', id).single(),
        sb.from('timesheet_entries').select('*').eq('timesheet_id', id),
        sb.from('timesheet_materials').select('*').eq('timesheet_id', id),
      ])
      if (ts) setTimesheet(ts)
      if (ents) setEntries(ents)
      if (mats) setMaterials(mats)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!timesheet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-light-gray text-gray-400">
        <div className="text-lg font-medium">Timesheet not found</div>
        <Link href="/timesheet" className="mt-3 text-orange underline text-sm">Back to list</Link>
      </div>
    )
  }

  const totalHours = entries.reduce(
    (sum, e) => sum + (e.onsite_total || 0) + (e.offsite_total || 0),
    0
  )

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/timesheet" className="text-white/60 active:text-white">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">{timesheet.project_name}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">{timesheet.date}</span>
              {timesheet.simpro_job_id && (
                <span className="text-[9px] bg-white/20 text-white/80 px-1.5 py-0.5 rounded-full font-medium">
                  Simpro #{timesheet.simpro_job_id}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 space-y-4">
          {/* Summary */}
          <div className="flex gap-3">
            <div className="flex-1 bg-white rounded-xl p-3 shadow-sm text-center">
              <div className="text-lg font-bold text-navy">{entries.length}</div>
              <div className="text-[10px] text-gray-400">Employees</div>
            </div>
            <div className="flex-1 bg-white rounded-xl p-3 shadow-sm text-center">
              <div className="text-lg font-bold text-navy">{totalHours.toFixed(1)}</div>
              <div className="text-[10px] text-gray-400">Total Hours</div>
            </div>
            <div className="flex-1 bg-white rounded-xl p-3 shadow-sm text-center">
              <div className="text-lg font-bold text-navy">${timesheet.total_materials_cost?.toFixed(2) || '0.00'}</div>
              <div className="text-[10px] text-gray-400">Materials</div>
            </div>
          </div>

          {/* PDF link */}
          {timesheet.pdf_url && (
            <a
              href={timesheet.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-navy text-white py-3 rounded-xl text-sm font-medium
                active:scale-95 transition-transform duration-150"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" />
              </svg>
              View PDF
            </a>
          )}

          {/* Employees */}
          <section className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-navy mb-3">Employees</div>
            <div className="space-y-3">
              {entries.map((e) => (
                <div key={e.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="font-medium text-sm text-navy mb-2">{e.employee_name}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Onsite</div>
                      <div className="text-gray-600">
                        {e.onsite_start || '-'} → {e.onsite_finish || '-'}
                      </div>
                      <div className="text-gray-400">Breaks: {e.onsite_breaks || 0}min</div>
                      <div className="font-medium text-navy">Total: {(e.onsite_total || 0).toFixed(1)} hrs</div>
                      {e.onsite_comment && <div className="text-gray-400 italic mt-0.5">{e.onsite_comment}</div>}
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Offsite</div>
                      <div className="text-gray-600">
                        {e.offsite_start || '-'} → {e.offsite_finish || '-'}
                      </div>
                      <div className="text-gray-400">Breaks: {e.offsite_breaks || 0}min</div>
                      <div className="font-medium text-navy">Total: {(e.offsite_total || 0).toFixed(1)} hrs</div>
                      {e.offsite_comment && <div className="text-gray-400 italic mt-0.5">{e.offsite_comment}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Description */}
          {timesheet.description && (
            <section className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm font-semibold text-navy mb-2">Description</div>
              <div className="text-sm text-gray-600 whitespace-pre-wrap">{timesheet.description}</div>
            </section>
          )}

          {/* Materials */}
          {materials.length > 0 && (
            <section className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm font-semibold text-navy mb-3">Materials</div>
              <div className="space-y-2">
                {materials.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <div className="text-gray-600">{m.material_type}</div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 text-xs">×{m.quantity}</span>
                      <span className="font-medium text-navy">${(m.quantity * m.price).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
                <span className="text-xs font-medium text-gray-500">Total</span>
                <span className="text-sm font-bold text-navy">${timesheet.total_materials_cost?.toFixed(2) || '0.00'}</span>
              </div>
            </section>
          )}

          {/* Signatures */}
          <section className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-navy mb-3">Signatures</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">Company Rep</div>
                <div className="text-sm font-medium text-navy">{timesheet.company_rep_name || '-'}</div>
                {timesheet.company_rep_signature && (
                  <img src={timesheet.company_rep_signature} alt="Company signature" className="mt-1 border border-gray-200 rounded-lg w-full h-16 object-contain bg-white" />
                )}
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Client Rep</div>
                <div className="text-sm font-medium text-navy">{timesheet.client_rep_name || '-'}</div>
                {timesheet.client_rep_signature && (
                  <img src={timesheet.client_rep_signature} alt="Client signature" className="mt-1 border border-gray-200 rounded-lg w-full h-16 object-contain bg-white" />
                )}
              </div>
            </div>
          </section>

          {/* Footer info */}
          <div className="text-center text-xs text-gray-400 pb-8">
            Submitted by {timesheet.submitted_by} at {new Date(timesheet.submitted_at).toLocaleString('en-AU')}
          </div>
        </div>
      </div>
    </div>
  )
}
