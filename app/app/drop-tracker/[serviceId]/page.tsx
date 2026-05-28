'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser, getDropLabel, displayName } from '@/lib/helpers'
import type { Service, DropEntry, RatUser } from '@/lib/types'

export default function DropGridPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params)
  const [user, setUser] = useState<RatUser | null>(null)
  const [service, setService] = useState<Service | null>(null)
  const [entries, setEntries] = useState<Record<string, DropEntry>>({})
  const [loading, setLoading] = useState(true)
  const [planUrls, setPlanUrls] = useState<string[]>([])
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [uploadingPlan, setUploadingPlan] = useState(false)

  const loadData = useCallback(async () => {
    const { data: svc } = await getSupabase()
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single()

    if (!svc) {
      setLoading(false)
      return
    }
    setService(svc)

    // Load drop entries
    const { data: ents } = await getSupabase()
      .from('drop_entries')
      .select('*')
      .eq('service_id', serviceId)

    const entryMap: Record<string, DropEntry> = {}
    for (const e of ents || []) {
      entryMap[e.drop] = e
    }
    setEntries(entryMap)

    // Check for plan images
    const { data: planFiles } = await getSupabase().storage
      .from('drop-plans')
      .list(serviceId, { limit: 20 })

    if (planFiles && planFiles.length > 0) {
      const urls = planFiles
        .filter(f => f.name && !f.name.startsWith('.'))
        .map(f => {
          const { data: urlData } = getSupabase().storage.from('drop-plans').getPublicUrl(`${serviceId}/${f.name}`)
          return urlData.publicUrl
        })
      setPlanUrls(urls)
    }

    setLoading(false)
  }, [serviceId])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)
    loadData()
  }, [loadData])

  async function handlePlanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploadingPlan(true)

    for (const file of files) {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${serviceId}/plan_${Date.now()}.${ext}`
      const { error: upErr } = await getSupabase().storage.from('drop-plans').upload(path, file)
      if (upErr) {
        console.error('[DropTracker] Plan upload failed:', upErr)
        alert('Plan upload failed: ' + upErr.message)
        continue
      }
      const { data: urlData } = getSupabase().storage.from('drop-plans').getPublicUrl(path)
      if (urlData?.publicUrl) {
        setPlanUrls(prev => [...prev, urlData.publicUrl])
      }
    }
    setUploadingPlan(false)
    e.target.value = ''
  }

  async function handleDeletePlan(url: string) {
    if (!confirm('Delete this plan image?')) return
    // Extract path from URL
    const match = url.match(/drop-plans\/(.+)$/)
    if (match) {
      await getSupabase().storage.from('drop-plans').remove([match[1]])
      setPlanUrls(prev => prev.filter(u => u !== url))
    }
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!service) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="text-navy/40">Job not found</div>
      </div>
    )
  }

  const labelling = service.drop_labelling === 'alpha' ? 'alpha' : 'numeric' as const
  const drops = Array.from({ length: service.drop_count }, (_, i) => getDropLabel(i, labelling))
  const completedCount = drops.filter((d) => entries[d]?.completed_at).length

  // Scoreboard
  const scoreboard: Record<string, number> = {}
  for (const entry of Object.values(entries)) {
    if (entry.completed_at && entry.completed_by) {
      const name = displayName(entry.completed_by)
      scoreboard[name] = (scoreboard[name] || 0) + 1
    }
  }
  const sortedScoreboard = Object.entries(scoreboard).sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/drop-tracker" className="min-w-[48px] min-h-[48px] flex items-center justify-center text-white active:scale-95 transition-transform -ml-2">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
            </Link>
            <div className="text-base font-bold text-white leading-tight flex-1">{service.name}</div>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${service.drop_count > 0 ? (completedCount / service.drop_count) * 100 : 0}%` }}
              />
            </div>
            <div className="text-white/70 text-sm font-medium">
              {completedCount}/{service.drop_count}
            </div>
          </div>
        </div>

        {/* Drop plan images */}
        <div className="px-4 pt-4">
          {planUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {planUrls.map((url, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden bg-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Drop plan ${i + 1}`} className="w-full h-auto cursor-pointer" onClick={() => setLightboxUrl(url)} />
                  <button onClick={() => handleDeletePlan(url)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-lg">✕</button>
                </div>
              ))}
            </div>
          )}
          <label className="block border-2 border-dashed border-navy/20 rounded-xl p-4 mb-3 text-center cursor-pointer active:border-orange transition-colors">
            {uploadingPlan ? (
              <div className="flex items-center justify-center gap-2 text-navy/40 text-sm">
                <div className="w-4 h-4 border-2 border-navy/30 border-t-transparent rounded-full animate-spin" />
                Uploading...
              </div>
            ) : (
              <div className="text-navy/40 text-sm">
                <div className="text-lg mb-1">+</div>
                {planUrls.length > 0 ? 'Add More Plans' : 'Upload Drop Plan'}
              </div>
            )}
            <input type="file" accept="image/*" multiple onChange={handlePlanUpload} className="hidden" />
          </label>
        </div>

        {/* Drop grid */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-2">
            {drops.map((label) => {
              const entry = entries[label]
              const isComplete = !!entry?.completed_at

              return (
                <Link key={label} href={`/drop-tracker/${serviceId}/${label}`}>
                  <div
                    className={`rounded-xl p-3 min-h-[80px] flex flex-col items-center justify-center
                      active:scale-95 transition-all duration-150
                      ${isComplete
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-navy shadow-sm'
                      }`}
                  >
                    {isComplete ? (
                      <>
                        <svg className="w-5 h-5 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        <div className="text-xs font-bold">{label}</div>
                        {entry.completed_by && (
                          <div className="text-[10px] font-medium opacity-90 mt-0.5 truncate max-w-full">
                            {displayName(entry.completed_by)}
                          </div>
                        )}
                        <div className="text-[9px] opacity-70">
                          {entry.completed_at ? new Date(entry.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}
                          {entry.completed_at ? ' ' + new Date(entry.completed_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </>
                    ) : (
                      <div className="text-lg font-bold text-navy/30">{label}</div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Report Button */}
        <div className="px-4 pb-4">
          <Link
            href={`/drop-tracker/${serviceId}/report`}
            className="block w-full bg-navy text-white font-bold py-4 rounded-xl text-center text-sm active:scale-95 transition-all"
          >
            📄 Download PDF Report
          </Link>
        </div>

        {/* Job Overview */}
        {sortedScoreboard.length > 0 && (
          <div className="px-4 pb-8">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-xs font-semibold text-navy/40 uppercase tracking-wider mb-3">Job Overview</div>
              <div className="flex flex-col gap-2">
                {sortedScoreboard.map(([name, count], i) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-navy/30 w-4">{i + 1}.</span>
                      <span className="text-sm font-medium text-navy">{name}</span>
                    </div>
                    <span className="text-sm font-bold text-orange">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-white text-3xl font-bold z-50">✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="Drop plan" className="max-w-[95vw] max-h-[90vh] object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
