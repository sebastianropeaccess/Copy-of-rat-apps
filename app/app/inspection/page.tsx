'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { FacadeInspection, RatUser } from '@/lib/types'

interface InspectionWithDefects extends FacadeInspection {
  facade_defects: { id: string }[]
}

export default function InspectionListPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [inspections, setInspections] = useState<InspectionWithDefects[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const { data } = await getSupabase()
      .from('facade_inspections')
      .select('*, facade_defects(id)')
      .order('created_at', { ascending: false })

    setInspections((data as InspectionWithDefects[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)
    loadData()
  }, [loadData])

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-gray">
        <div className="w-8 h-8 border-3 border-navy border-t-orange rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-light-gray">
      {/* Header */}
      <div className="bg-navy text-white px-4 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-white text-sm font-medium min-h-[48px] flex items-center">
          &larr; Back
        </Link>
        <h1 className="text-lg font-bold">Facade Inspections</h1>
        <div className="w-12" />
      </div>

      {/* Inspection cards */}
      <div className="max-w-[480px] mx-auto px-4 py-4 pb-24">
        {inspections.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No inspections yet. Tap below to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {inspections.map((insp) => (
              <Link
                key={insp.id}
                href={`/inspection/${insp.id}`}
                className="block bg-white rounded-lg shadow-sm p-4 active:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-navy text-base truncate">
                      {insp.building_name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(insp.created_at).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        insp.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {insp.status}
                    </span>
                    <span className="bg-orange text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center">
                      {insp.facade_defects?.length || 0}
                    </span>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-400">
                  <span>{insp.drop_count} drops</span>
                  <span>{insp.floor_count} floors</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Fixed add button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-gray">
        <div className="max-w-[480px] mx-auto">
          <Link
            href="/inspection/new"
            className="block w-full bg-orange text-white text-center font-bold py-3 rounded-lg min-h-[48px] flex items-center justify-center active:bg-orange-light"
          >
            + Add Inspection
          </Link>
        </div>
      </div>
    </div>
  )
}
