'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '../../../lib/supabase'
import { getStoredUser, getDropLabel } from '../../../lib/helpers'
import type { FacadeInspection, FacadeDefect, RatUser } from '../../../lib/types'

export default function InspectionDetailPage() {
  const params = useParams<{ id: string }>()
  const [user, setUser] = useState<RatUser | null>(null)
  const [inspection, setInspection] = useState<FacadeInspection | null>(null)
  const [defects, setDefects] = useState<FacadeDefect[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  async function handleGenerateReport() {
    if (generating) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/inspection/report?inspectionId=${params.id}`)
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}))
        throw new Error(msg.error || `Report failed (${res.status})`)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const fileName = match ? match[1] : 'inspection_report.pdf'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const loadData = useCallback(async () => {
    const { data: insp } = await getSupabase()
      .from('facade_inspections')
      .select('*')
      .eq('id', params.id)
      .single()

    if (insp) setInspection(insp as FacadeInspection)

    const { data: defs } = await getSupabase()
      .from('facade_defects')
      .select('*')
      .eq('inspection_id', params.id)

    setDefects((defs as FacadeDefect[]) || [])
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)
    loadData()
  }, [loadData])

  if (!user || loading || !inspection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-gray">
        <div className="w-8 h-8 border-3 border-navy border-t-orange rounded-full animate-spin" />
      </div>
    )
  }

  // Count defects per drop
  const defectsByDrop: Record<string, number> = {}
  const defectsByType: Record<string, number> = {}
  for (const d of defects) {
    defectsByDrop[d.drop] = (defectsByDrop[d.drop] || 0) + 1
    defectsByType[d.defect_type] = (defectsByType[d.defect_type] || 0) + 1
  }

  const labelling = inspection.drop_labelling as 'alpha' | 'numeric'

  return (
    <div className="min-h-screen bg-light-gray">
      {/* Header */}
      <div className="bg-navy text-white px-4 py-4 flex items-center justify-between">
        <Link href="/inspection" className="text-white text-sm font-medium min-h-[48px] flex items-center">
          &larr; Back
        </Link>
        <h1 className="text-lg font-bold truncate max-w-[200px]">{inspection.building_name}</h1>
        <div className="w-12" />
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-4">
        {/* Building info */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex justify-between items-start mb-2">
            <h2 className="font-bold text-navy text-base">{inspection.building_name}</h2>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-full ${
                inspection.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {inspection.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
            <p>Drops: {inspection.drop_count}</p>
            <p>Floors: {inspection.floor_count}</p>
            <p>Total Defects: {defects.length}</p>
            <p>Labelling: {inspection.drop_labelling}</p>
          </div>
          {inspection.inspector_names?.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Inspectors: {inspection.inspector_names.join(', ')}
            </p>
          )}
        </div>

        {/* Drop Grid */}
        <h3 className="font-bold text-navy text-sm mb-2">Drops</h3>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {Array.from({ length: inspection.drop_count }, (_, i) => {
            const label = getDropLabel(i, labelling)
            const count = defectsByDrop[label] || 0
            return (
              <Link
                key={i}
                href={`/inspection/${inspection.id}/${label}`}
                className="bg-white rounded-lg shadow-sm p-3 flex flex-col items-center justify-center min-h-[64px] active:bg-gray-50 relative"
              >
                <span className="font-bold text-navy text-lg">{label}</span>
                {count > 0 && (
                  <span className="absolute top-1 right-1 bg-orange text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {count}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Summary by defect type */}
        {defects.length > 0 && (
          <>
            <h3 className="font-bold text-navy text-sm mb-2">Defects by Type</h3>
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              {Object.entries(defectsByType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type} className="flex justify-between py-1 text-sm">
                    <span className="text-gray-700">{type}</span>
                    <span className="font-semibold text-navy">{count}</span>
                  </div>
                ))}
            </div>

            <h3 className="font-bold text-navy text-sm mb-2">Defects by Drop</h3>
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              {Object.entries(defectsByDrop)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([drop, count]) => (
                  <div key={drop} className="flex justify-between py-1 text-sm">
                    <span className="text-gray-700">Drop {drop}</span>
                    <span className="font-semibold text-navy">{count}</span>
                  </div>
                ))}
            </div>
          </>
        )}

        {/* Generate Report */}
        {user.can_generate_reports && (
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="w-full bg-navy text-white font-bold py-3 rounded-lg min-h-[48px] mb-4 active:opacity-80 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {generating && (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {generating ? 'Generating PDF…' : 'Generate Report (PDF)'}
          </button>
        )}
      </div>
    </div>
  )
}
