'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getStoredUser } from '@/lib/helpers'
import { getSupabase } from '@/lib/supabase'
import type { RatUser, SvAuditLog, SvInspection } from '@/lib/types'

function formatValue(value: unknown) {
  if (value === null || value === undefined) return 'blank'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  try { return JSON.stringify(value) } catch { return String(value) }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SiteVisitAuditPage() {
  const params = useParams<{ inspectionId: string }>()
  const [user] = useState<RatUser | null>(() => getStoredUser())
  const [inspection, setInspection] = useState<SvInspection | null>(null)
  const [logs, setLogs] = useState<SvAuditLog[]>([])
  const [loading, setLoading] = useState(true)

  const loadLogs = useCallback(async () => {
    const [{ data: inspectionRow }, { data: logRows }] = await Promise.all([
      getSupabase().from('sv_inspections').select('*').eq('id', params.inspectionId).single(),
      getSupabase().from('sv_audit_log').select('*').eq('inspection_id', params.inspectionId).order('created_at', { ascending: false }),
    ])
    setInspection(inspectionRow as SvInspection | null)
    setLogs((logRows || []) as SvAuditLog[])
    setLoading(false)
  }, [params.inspectionId])

  useEffect(() => {
    if (!user) { window.location.href = '/login'; return }
    const timer = window.setTimeout(() => { void loadLogs() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadLogs, user])

  if (!user) return null

  return (
    <div className="flex min-h-screen flex-col bg-light-gray">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col">
        <div className="bg-navy px-5 py-4">
          <div className="flex items-center gap-3">
            <Link href={`/site-visits/${params.inspectionId}`} className="text-white/60 active:scale-95 transition-transform" aria-label="Back">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div className="min-w-0">
              <div className="text-lg font-bold text-white">Audit Log</div>
              <div className="truncate text-xs text-white/50">{inspection?.site_name || user.name}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-orange border-t-transparent" />
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-xl bg-white p-5 text-center text-sm text-navy/50 shadow-sm">No post-completion changes logged.</div>
          ) : (
            <div className="space-y-3">
              {logs.map((entry) => (
                <div key={entry.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-navy">{entry.user_name || 'Unknown user'}</div>
                      <div className="text-xs text-navy/45">{formatDate(entry.created_at)}</div>
                    </div>
                    <span className="rounded-full bg-orange/10 px-2 py-0.5 text-[10px] font-semibold text-orange">{entry.action || 'edit'}</span>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-navy/45">{entry.field_name || 'field'}</div>
                  <div className="mt-2 rounded-lg bg-light-gray p-3 text-sm text-navy">
                    <span className="text-navy/45">{formatValue(entry.old_value)}</span>
                    <span className="px-2 text-orange">→</span>
                    <span>{formatValue(entry.new_value)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
