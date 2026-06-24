'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getStoredExternalUser, getStoredUser, getDropLabel } from '../../../../../lib/helpers'
import type { ExternalUser, RatUser, RepairBuilding, Repair } from '../../../../../lib/types'

type RepairExt = Repair & { urgency?: string; assigned_contractor?: string }

export default function ExternalReportPage() {
  const params = useParams<{ buildingId: string }>()
  const [extUser, setExtUser] = useState<ExternalUser | null>(null)
  const [internalUser, setInternalUser] = useState<RatUser | null>(null)
  const [building, setBuilding] = useState<RepairBuilding | null>(null)
  const [repairs, setRepairs] = useState<RepairExt[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDrops, setSelectedDrops] = useState<string[]>([])
  const [defectFilter, setDefectFilter] = useState('All')
  const [contractorFilter, setContractorFilter] = useState('All')
  const [urgencyFilter, setUrgencyFilter] = useState('All')
  const [showStepTitles, setShowStepTitles] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')

  useEffect(() => {
    const ext = getStoredExternalUser()
    const internal = getStoredUser()

    if (ext) {
      if (!ext.can_download_reports) {
        window.location.href = '/external/dashboard'
        return
      }
      setExtUser(ext)
    } else if (internal) {
      if (!internal.can_generate_reports && !internal.can_manage_settings) {
        window.location.href = '/'
        return
      }
      setInternalUser(internal)
    } else {
      window.location.href = '/login'
      return
    }

    loadData()
  }, [])

  async function loadData() {
    const [{ data: bld }, { data: reps }] = await Promise.all([
      fetchBuilding(),
      fetchRepairs(),
    ])

    if (bld) setBuilding(bld as RepairBuilding)
    if (reps) setRepairs((reps as RepairExt[]).filter(r => !r.defect_type?.startsWith('__')))
    setLoading(false)
  }

  async function fetchBuilding() {
    const { getSupabase } = await import('../../../../../lib/supabase')
    return getSupabase()
      .from('repair_buildings')
      .select('*')
      .eq('id', params.buildingId)
      .single()
  }

  async function fetchRepairs() {
    const { getSupabase } = await import('../../../../../lib/supabase')
    return getSupabase()
      .from('repairs')
      .select('*')
      .eq('building_id', params.buildingId)
      .order('drop_label')
      .order('floor_number')
  }

  if (!extUser && !internalUser) return null

  const dropLabels: string[] = building
    ? Array.from({ length: building.drop_count }, (_, i) => getDropLabel(i, building.drop_labelling))
    : []

  const contractors = [...new Set(repairs.map(r => r.assigned_contractor).filter(Boolean))] as string[]
  const defectTypes = [...new Set(repairs.map(r => r.defect_type).filter(Boolean))]

  const filtered = repairs.filter(r => {
    if (selectedDrops.length > 0 && !selectedDrops.includes(r.drop_label)) return false
    if (defectFilter !== 'All' && r.defect_type !== defectFilter) return false
    if (contractorFilter !== 'All' && r.assigned_contractor !== contractorFilter) return false
    if (urgencyFilter !== 'All' && r.urgency !== urgencyFilter) return false
    return true
  })

  function toggleDrop(label: string) {
    setSelectedDrops(prev => prev.includes(label) ? prev.filter(d => d !== label) : [...prev, label])
  }

  async function generateCSV() {
    if (!building) return
    const paramsQS = new URLSearchParams({
      buildingId: String(building.id),
      format: 'csv',
      defectType: defectFilter === 'All' ? '' : defectFilter,
      drop: selectedDrops.length === 1 ? selectedDrops[0] : '',
    })

    try {
      const res = await fetch(`/api/repairs/report?${paramsQS}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${building.name}_repairs_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to generate spreadsheet.')
    }
  }

  async function generatePDF() {
    if (!building) return
    setGenerating(true)
    setProgress('Generating compressed PDF on the server...')

    try {
      const paramsQS = new URLSearchParams({
        buildingId: String(building.id),
        defectType: defectFilter === 'All' ? '' : defectFilter,
        drops: selectedDrops.join(','),
        urgency: urgencyFilter === 'All' ? '' : urgencyFilter,
        contractor: contractorFilter === 'All' ? '' : contractorFilter,
        showStepTitles: showStepTitles ? 'true' : 'false',
      })

      const res = await fetch(`/api/external-reports/repair-pdf?${paramsQS}`)
      if (!res.ok) throw new Error(`Failed to fetch report data (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${building.name}_repairs_${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to generate PDF', err)
      alert(`Failed to generate PDF${err instanceof Error ? `: ${err.message}` : '.'}`)
    } finally {
      setGenerating(false)
      setProgress('')
    }
  }

  const backHref = extUser ? `/external/building/${params.buildingId}` : `/repairs/${params.buildingId}`

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href={backHref} className="min-w-[48px] min-h-[48px] flex items-center justify-center text-white active:scale-95 transition-transform -ml-2">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-white truncate">Report — {building?.name || 'Building'}</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
                <div className="text-sm font-semibold text-navy mb-3">Filter Report</div>

                <div className="mb-3">
                  <div className="text-xs font-medium text-navy/60 mb-1">Drops (select to filter, none = all)</div>
                  <div className="flex gap-1 flex-wrap">
                    {dropLabels.map(label => (
                      <button
                        key={label}
                        onClick={() => toggleDrop(label)}
                        className={`rounded-lg text-xs font-semibold px-2.5 py-1.5 transition-all ${selectedDrops.includes(label) ? 'bg-orange text-white' : 'bg-light-gray text-navy/60 border border-navy/10'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-xs font-medium text-navy/60 mb-1">Defect Type</div>
                  <select value={defectFilter} onChange={e => setDefectFilter(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[40px]">
                    <option value="All">All</option>
                    {defectTypes.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                {contractors.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-navy/60 mb-1">Contractor</div>
                    <select value={contractorFilter} onChange={e => setContractorFilter(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[40px]">
                      <option value="All">All</option>
                      {contractors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                <div className="mb-3">
                  <div className="text-xs font-medium text-navy/60 mb-1">Urgency</div>
                  <div className="flex gap-1 flex-wrap">
                    {['All', 'Urgent', 'Later', 'Monitor', 'Leave'].map(u => (
                      <button
                        key={u}
                        onClick={() => setUrgencyFilter(u)}
                        className={`rounded-lg text-xs font-semibold px-2.5 py-1.5 transition-all ${urgencyFilter === u ? 'bg-orange text-white' : 'bg-light-gray text-navy/60 border border-navy/10'}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-light-gray rounded-xl p-3 text-center">
                  <span className="text-2xl font-bold text-orange">{filtered.length}</span>
                  <span className="text-sm text-navy/50 ml-2">repair{filtered.length !== 1 ? 's' : ''} matched</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
                <div className="text-sm font-semibold text-navy mb-3">Report Options</div>
                <label className="flex items-center gap-3 min-h-[48px] cursor-pointer">
                  <div
                    className={`w-11 h-6 rounded-full transition-all duration-200 relative ${showStepTitles ? 'bg-orange' : 'bg-gray-300'}`}
                    onClick={() => setShowStepTitles(!showStepTitles)}
                  >
                    <div
                      className="w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-all duration-200"
                      style={{ left: showStepTitles ? '22px' : '2px' }}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-navy">Show Step Titles</div>
                    <div className="text-xs text-navy/40">Shows step labels under photos and the steps section</div>
                  </div>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={generatePDF}
                  disabled={generating || filtered.length === 0}
                  className="flex-1 bg-red-600 text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40"
                >
                  {generating ? 'Generating...' : 'Download PDF'}
                </button>
                <button
                  onClick={generateCSV}
                  disabled={filtered.length === 0}
                  className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40"
                >
                  Download Spreadsheet
                </button>
              </div>

              {progress && <div className="text-center text-sm text-navy/50 mt-4">{progress}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
