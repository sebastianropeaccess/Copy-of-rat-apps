'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { DropEntry, DropPhoto, RatUser } from '@/lib/types'


function getLocalDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function getLocalTime(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function DropEntryPage({
  params,
}: {
  params: Promise<{ serviceId: string; drop: string }>
}) {
  const { serviceId, drop } = use(params)
  const router = useRouter()
  const [user, setUser] = useState<RatUser | null>(null)
  const [entry, setEntry] = useState<DropEntry | null>(null)
  const [photos, setPhotos] = useState<DropPhoto[]>([])
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [workDate, setWorkDate] = useState(getLocalDate())
  const [workTime, setWorkTime] = useState(getLocalTime())

  const loadData = useCallback(async () => {
    const { data: ent } = await getSupabase()
      .from('drop_entries')
      .select('*')
      .eq('service_id', serviceId)
      .eq('drop', drop)
      .maybeSingle()

    if (ent) {
      setEntry(ent)
      setComments((ent.comments || '').replace(/\n?\[Logged:.*?\]/g, '').trim())
      setIsComplete(!!ent.completed_at)
      // Reset date/time to now for incomplete drops
      if (!ent.completed_at) {
        const now = new Date()
        setWorkDate(getLocalDate(now))
        setWorkTime(getLocalTime(now))
      }

      // Load photos
      const { data: phs } = await getSupabase()
        .from('drop_photos')
        .select('*')
        .eq('drop_entry_id', ent.id)
        .order('sort_order', { ascending: true })
      setPhotos(phs || [])
    }

    setLoading(false)
  }, [serviceId, drop])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      window.location.href = '/login'
      return
    }
    setUser(stored)
    loadData()
  }, [loadData])

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingPhoto(true)

    try {
    // Ensure drop entry exists first
    let entryId = entry?.id
    if (!entryId) {
      // Create entry if it doesn't exist (don't update existing)
      await getSupabase()
        .from('drop_entries')
        .upsert(
          { service_id: serviceId, drop, comments: comments || '' },
          { onConflict: 'service_id,drop', ignoreDuplicates: true }
        )
      // Now fetch the entry
      const { data: newEntry, error: upsertErr } = await getSupabase()
        .from('drop_entries')
        .select('id')
        .eq('service_id', serviceId)
        .eq('drop', drop)
        .single()
      if (upsertErr) {
        console.error('[DropTracker] Entry upsert failed:', upsertErr)
        alert('Failed to create drop entry: ' + upsertErr.message)
        setUploadingPhoto(false)
        return
      }
      if (newEntry) {
        entryId = newEntry.id
        setEntry({ ...newEntry, service_id: serviceId, drop, comments, completed_at: null, completed_by: null })
      }
    }

    if (!entryId) {
      alert('Could not create drop entry')
      setUploadingPhoto(false)
      return
    }

    const timestamp = Date.now()
    const idx = photos.length
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${serviceId}/${drop}/${timestamp}-${idx}.${ext}`

    const { error: uploadErr } = await getSupabase().storage
      .from('drop-photos')
      .upload(path, file)

    if (uploadErr) {
      console.error('[DropTracker] Photo upload failed:', uploadErr)
      alert('Photo upload failed: ' + uploadErr.message)
      setUploadingPhoto(false)
      return
    }

    const { data: urlData } = getSupabase().storage
      .from('drop-photos')
      .getPublicUrl(path)

    const { error: insertErr } = await getSupabase().from('drop_photos').insert({
      drop_entry_id: entryId,
      photo_url: urlData.publicUrl,
      sort_order: idx,
    })

    if (insertErr) {
      console.error('[DropTracker] Photo record insert failed:', insertErr)
      alert('Failed to save photo record: ' + insertErr.message)
    }

    // Auto-populate date/time on first photo upload
    const now = new Date()
    setWorkDate(getLocalDate(now))
    setWorkTime(getLocalTime(now))

    await loadData()
    setUploadingPhoto(false)
    } catch (err) {
      console.error('[DropTracker] Photo upload error:', err)
      alert('Photo upload failed: ' + (err instanceof Error ? err.message : String(err)))
      setUploadingPhoto(false)
    }
  }

  async function handleComplete() {
    if (!user) return
    setSaving(true)

    if (isComplete) {
      // Reopen
      await getSupabase()
        .from('drop_entries')
        .update({ completed_at: null, completed_by: null })
        .eq('service_id', serviceId)
        .eq('drop', drop)
      // Reset date/time to now
      const now = new Date()
      setWorkDate(getLocalDate(now))
      setWorkTime(getLocalTime(now))
    } else {
      // Complete
      if (photos.length === 0 && !entry?.id) {
        // Need at least one photo
        setSaving(false)
        return
      }

      // User's chosen date/time for the work
      // Store as local time with timezone offset
      const userDateTime = new Date(`${workDate}T${workTime}:00`).toISOString()
      // System timestamp for records
      const systemNow = new Date()
      const systemStamp = `[Logged: ${systemNow.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} ${systemNow.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}]`
      const finalComments = comments ? `${comments}\n${systemStamp}` : systemStamp
      
      // If entry exists, update it. Otherwise create it.
      if (entry?.id) {
        await getSupabase()
          .from('drop_entries')
          .update({
            comments: finalComments,
            completed_at: userDateTime,
            completed_by: user.name,
          })
          .eq('id', entry.id)
      } else {
        await getSupabase()
          .from('drop_entries')
          .upsert(
            {
              service_id: serviceId,
              drop,
              comments: finalComments,
              completed_at: userDateTime,
              completed_by: user.name,
            },
            { onConflict: 'service_id,drop' }
          )
      }
    }

    await loadData()
    setSaving(false)
  }

  async function handleSaveComments() {
    if (!entry?.id) return
    await getSupabase()
      .from('drop_entries')
      .update({ comments: comments || null })
      .eq('id', entry.id)
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm('Delete this photo?')) return
    await getSupabase().from('drop_photos').delete().eq('id', photoId)
    setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  async function handleDeleteEntry() {
    if (!entry?.id) return
    if (!confirm('Are you sure you want to delete this entry? All photos and data for this drop will be removed.')) return
    await getSupabase().from('drop_photos').delete().eq('drop_entry_id', entry.id)
    await getSupabase().from('drop_entries').delete().eq('id', entry.id)
    router.push(`/drop-tracker/${serviceId}`)
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen pb-24">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href={`/drop-tracker/${serviceId}`} className="min-w-[48px] min-h-[48px] flex items-center justify-center text-white active:scale-95 transition-transform -ml-2">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="text-lg font-bold text-white">Drop {drop}</div>
          {isComplete && (
            <span className="ml-auto bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
              COMPLETE
            </span>
          )}
        </div>

        {/* Photos */}
        <div className="px-4 pt-4">
          <div className="text-xs font-semibold text-navy/40 uppercase tracking-wider mb-2">
            Photos {photos.length === 0 && <span className="text-red-400">(required)</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.photo_url}
                  alt={`Drop ${drop} photo`}
                  className="w-full h-full object-cover"
                />
                <button onClick={() => handleDeletePhoto(photo.id)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-lg">✕</button>
              </div>
            ))}
            {photos.length < 4 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-navy/20
                flex flex-col items-center justify-center cursor-pointer
                active:border-orange transition-colors">
                {uploadingPhoto ? (
                  <div className="w-6 h-6 border-2 border-navy/30 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <div className="text-2xl text-navy/30 mb-1">+</div>
                    <div className="text-[10px] text-navy/30">Add Photo</div>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                 
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploadingPhoto}
                />
              </label>
            )}
          </div>
        </div>

        {/* Comments */}
        <div className="px-4 pb-4">
          <div className="text-xs font-semibold text-navy/40 uppercase tracking-wider mb-2">
            Comments <span className="text-navy/20">(optional)</span>
          </div>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            onBlur={handleSaveComments}
            placeholder="Any notes about this drop..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm
              focus:outline-none focus:border-orange resize-none"
          />
        </div>
        {/* Date & Time */}
        {photos.length > 0 && !isComplete && (
          <div className="px-4 pb-4">
            <div className="text-xs font-semibold text-navy/40 uppercase tracking-wider mb-2">
              Date and Time Drop was Completed
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange"
              />
              <input
                type="time"
                value={workTime}
                onChange={(e) => setWorkTime(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange"
              />
            </div>
          </div>
        )}

        {/* Completion info for completed drops */}
        {isComplete && entry?.completed_at && (
          <div className="px-4 pb-4">
            <div className="bg-green-50 rounded-xl p-3 border border-green-200">
              <div className="text-xs font-semibold text-green-700">
                ✅ Completed by {entry.completed_by}
              </div>
              <div className="text-xs text-green-600 mt-0.5">
                {new Date(entry.completed_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(entry.completed_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {entry.comments && entry.comments.includes('[Logged:') && (
                <div className="text-[10px] text-green-500 mt-1">
                  {entry.comments.match(/\[Logged:.*?\]/)?.[0]}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="w-full max-w-[480px] mx-auto p-4 bg-light-gray">
          <button
            onClick={handleComplete}
            disabled={saving || (!isComplete && photos.length === 0)}
            className={`w-full font-bold py-4 rounded-xl text-base
              active:scale-95 transition-all duration-150
              disabled:opacity-40 disabled:active:scale-100
              ${isComplete
                ? 'bg-navy text-white'
                : 'bg-green-500 text-white'
              }`}
          >
            {saving ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isComplete ? 'Reopening...' : 'Completing...'}
              </div>
            ) : isComplete ? (
              'Reopen Drop'
            ) : (
              'Drop Complete'
            )}
          </button>
          {entry?.id && (
            <button onClick={handleDeleteEntry} className="w-full font-bold py-4 rounded-xl text-base bg-red-500 text-white active:scale-95 transition-all duration-150 mt-2">
              Delete Entry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
