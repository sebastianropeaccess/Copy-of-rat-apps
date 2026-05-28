'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import { addToQueue, getQueue, processQueue } from '@/lib/offline'
import type { RatUser, RepairBuilding, Repair } from '@/lib/types'

type RepairExt = Repair & { urgency?: string; assigned_contractor?: string; _pending?: boolean; repair_steps?: { id: string }[] }

const URGENCY_BADGE: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700',
  Later: 'bg-yellow-100 text-yellow-700',
  Monitor: 'bg-blue-100 text-blue-700',
  Leave: 'bg-gray-100 text-gray-600',
}

const URGENCY_OPTIONS = ['Urgent', 'Later', 'Monitor', 'Leave']

const LOCATIONS = ['Column', 'Door', 'Floor', 'Hob', 'Parapet Wall', 'Planter Box', 'Rooftop', 'Screen', 'Slab End', 'Slab Top', 'Soffit', 'Sunhood Top', 'Wall', 'Window', 'Other']

const DEFECT_CATEGORIES = ['Brick Work', 'Caulking', 'Cleaning', 'Coatings', 'Concrete', 'Installation', 'Screens, Fins & Hoods', 'Spitters', 'Waterproofing', 'Windows & Doors', 'Other']

const MEASUREMENT_MAP: Record<string, Record<string, string[]>> = {
  'Concrete': {
    'Spalling': ['height', 'length', 'depth'],
    'Cracking': ['height', 'length'],
    'Patch Needed': ['height', 'length', 'depth'],
    'Bar End': ['quantity'],
    'Rust Spot': ['quantity'],
    'Fixings': ['quantity'],
  },
  'Caulking': {
    'Failing': ['length'],
    'Missing': ['length'],
    'Not Painted': ['length'],
  },
  'Coatings': {
    'Blister': ['height', 'length'],
    'Missing Paint': ['height', 'length'],
    'Paint Failure': ['height', 'length'],
    'Efflorescence': ['quantity'],
  },
  'Waterproofing': {
    'Pooling': ['height', 'length'],
    'Damage': ['height', 'length'],
    'Blisters': ['height', 'length'],
    'Pin Holing': ['height', 'length'],
    'Missing': ['height', 'length'],
  },
  'Windows & Doors': {
    'Broken Glass': ['height', 'length'],
    'Frame Defect': ['quantity'],
    'Rubbers': ['length'],
    'Weep Holes': ['quantity'],
  },
  'Screens, Fins & Hoods': {
    'Missing Fixings': ['quantity'],
  },
  'Spitters': {
    'Wrong Height': ['quantity'],
    'Missing': ['quantity'],
  },
  'Brick Work': {
    'Mortar Defect': ['height', 'length'],
    'Cracking': ['length'],
    'Loose': ['quantity'],
    'Weep Holes': ['quantity'],
    'Cavity Flashing': ['length'],
  },
  'Installation': {
    'Missing Fixings': ['quantity'],
  },
}

const SUB_TYPE_MAP: Record<string, string[]> = {
  'Concrete': ['Bar End', 'Cracking', 'Fixings', 'Patch Needed', 'Rust Spot', 'Spalling'],
  'Caulking': ['Failing', 'Missing', 'Not Painted'],
  'Coatings': ['Blister', 'Efflorescence', 'Missing Paint', 'Paint Failure'],
  'Waterproofing': ['Blisters', 'Damage', 'Missing', 'Pin Holing', 'Pooling'],
  'Windows & Doors': ['Broken Glass', 'Frame Defect', 'Rubbers', 'Weep Holes'],
  'Screens, Fins & Hoods': ['Construction Mess', 'Damaged', 'Loose', 'Missing Fixings', 'Not Level'],
  'Spitters': ['Construction Mess', 'Missing', 'Wrong Height'],
  'Brick Work': ['Cavity Flashing', 'Cracking', 'Loose', 'Mortar Defect', 'Weep Holes'],
  'Cleaning': ['Construction Mess'],
  'Installation': ['Damaged', 'Loose', 'Missing Fixings', 'Not Level'],
  'Other': [],
}

function getTensButtons(floorCount: number, groundIsLevelOne: boolean): string[] {
  const tens: string[] = []
  if (!groundIsLevelOne) tens.push('G')
  tens.push('0')
  for (let t = 10; t <= floorCount; t += 10) {
    tens.push(String(t))
  }
  tens.push('R')
  return tens
}

const ONES_BUTTONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

function sortRepairs(repairs: RepairExt[]): RepairExt[] {
  return [...repairs].sort((a, b) => {
    if (a.status === b.status) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return a.status === 'in_progress' ? -1 : 1
  })
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return '<1m'
}

export default function DropWorkspacePage() {
  const params = useParams<{ buildingId: string; dropLabel: string }>()
  const dropLabel = decodeURIComponent(params.dropLabel)
  const [user, setUser] = useState<RatUser | null>(null)
  const [building, setBuilding] = useState<RepairBuilding | null>(null)
  const [repairs, setRepairs] = useState<RepairExt[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [selectedFloor, setSelectedFloor] = useState('')
  const [selectedTens, setSelectedTens] = useState<string | null>(null)
  const [location, setLocation] = useState('')
  const [defectType, setDefectType] = useState('')
  const [subType, setSubType] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [initialComments, setInitialComments] = useState('')
  const [heightMm, setHeightMm] = useState('')
  const [lengthMm, setLengthMm] = useState('')
  const [depthMm, setDepthMm] = useState('')
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Custom sub-types
  type CustomSubType = { name: string; measurements: string[] }
  const [customSubTypes, setCustomSubTypes] = useState<Record<string, CustomSubType[]>>({})
  const [newSubType, setNewSubType] = useState('')
  const [newMeasurements, setNewMeasurements] = useState<string[]>(['height', 'length', 'depth'])
  const [showAddForm, setShowAddForm] = useState(false)
  const MEASUREMENT_OPTIONS = ['height', 'length', 'depth', 'quantity']

  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDefectType, setFilterDefectType] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('')
  const [searchText, setSearchText] = useState('')

  // Load custom sub-types from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`custom_sub_types_${params.buildingId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        const migrated: Record<string, CustomSubType[]> = {}
        for (const [cat, items] of Object.entries(parsed)) {
          if (Array.isArray(items) && items.length > 0) {
            if (typeof items[0] === 'string') {
              migrated[cat] = (items as string[]).map(name => ({ name, measurements: ['height', 'length', 'depth'] }))
            } else {
              migrated[cat] = items as CustomSubType[]
            }
          }
        }
        setCustomSubTypes(migrated)
      }
    } catch { /* ignore */ }
  }, [params.buildingId])

  function saveCustomSubType() {
    const val = newSubType.trim()
    if (!val || !defectType) return
    const updated = { ...customSubTypes }
    if (!updated[defectType]) updated[defectType] = []
    if (!updated[defectType].find(s => s.name === val)) {
      updated[defectType].push({ name: val, measurements: [...newMeasurements] })
      updated[defectType].sort((a, b) => a.name.localeCompare(b.name))
      setCustomSubTypes(updated)
      localStorage.setItem(`custom_sub_types_${params.buildingId}`, JSON.stringify(updated))
    }
    setSubType(val)
    setNewSubType('')
    setNewMeasurements(['height', 'length', 'depth'])
    setShowAddForm(false)
  }

  function removeCustomSubType(category: string, val: string) {
    const updated = { ...customSubTypes }
    updated[category] = (updated[category] || []).filter(s => s.name !== val)
    if (updated[category].length === 0) delete updated[category]
    setCustomSubTypes(updated)
    localStorage.setItem(`custom_sub_types_${params.buildingId}`, JSON.stringify(updated))
    if (subType === val) setSubType('')
  }

  function getCustomMeasurements(category: string, subTypeName: string): string[] | null {
    const custom = customSubTypes[category]?.find(s => s.name === subTypeName)
    return custom ? custom.measurements : null
  }

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    loadData()

    const onFocus = () => loadData()
    window.addEventListener('focus', onFocus)
    const onVis = () => { if (document.visibilityState === 'visible') loadData() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  async function loadData() {
    try {
      const [{ data: bld }, { data: reps }] = await Promise.all([
        getSupabase()
          .from('repair_buildings')
          .select('*')
          .eq('id', params.buildingId)
          .single(),
        getSupabase()
          .from('repairs')
          .select('*, repair_steps(id)')
          .eq('building_id', params.buildingId)
          .eq('drop_label', dropLabel)
          .order('created_at', { ascending: false }),
      ])

      if (bld) setBuilding(bld as RepairBuilding)
      if (reps) setRepairs(reps as RepairExt[])
    } catch {
      // Offline — keep existing data
    }
    setLoading(false)
  }

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setPhotos(prev => [...prev, ...files])
    setPhotoPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  function resetForm() {
    setSelectedFloor('')
    setSelectedTens(null)
    setLocation('')
    setDefectType('')
    setSubType('')
    photos.forEach((_, i) => photoPreviews[i] && URL.revokeObjectURL(photoPreviews[i]))
    setPhotos([])
    setPhotoPreviews([])
    setInitialComments('')
    setHeightMm('')
    setLengthMm('')
    setDepthMm('')
    setQuantity('')
  }

  function handleTensSelect(t: string) {
    if (t === 'G') {
      setSelectedTens(null)
      setSelectedFloor('G')
      return
    }
    if (t === 'R') {
      setSelectedTens(null)
      setSelectedFloor('R')
      return
    }
    setSelectedTens(t)
    setSelectedFloor('')
  }

  function handleOnesSelect(o: string) {
    if (selectedTens === null) return
    const level = selectedTens === '0' ? Number(o) : Number(selectedTens) + Number(o)
    if (level === 0) return
    setSelectedFloor(String(level))
  }

  async function handleSave() {
    if (!user || !building || saving || !selectedFloor || !defectType || photos.length === 0) return
    setSaving(true)

    try {
      const existingOnFloor = repairs.filter(
        r => r.drop_label === dropLabel && String(r.floor_number) === selectedFloor && !r._pending
      )
      const seq = existingOnFloor.length + 1
      const repairNumber = `${dropLabel}.${selectedFloor}.${seq}`
      const tempId = crypto.randomUUID()
      const ts = Date.now()

      const repairData = {
        building_id: building.id,
        building_name: building.name,
        drop_label: dropLabel,
        floor_number: selectedFloor,
        repair_number: repairNumber,
        defect_type: defectType,
        sub_type: subType.trim() || null,
        location: location || null,
        height_mm: heightMm ? Number(heightMm) : null,
        length_mm: lengthMm ? Number(lengthMm) : null,
        depth_mm: depthMm ? Number(depthMm) : null,
        quantity: quantity ? Number(quantity) : null,
        initial_comments: initialComments.trim() || null,
        status: 'in_progress' as const,
        started_at: new Date().toISOString(),
        created_by: user.name,
      }

      // Try online first
      // Always try online first (navigator.onLine is unreliable on mobile)
      {
        try {
          const { data: repair, error: insertError } = await getSupabase()
            .from('repairs')
            .insert(repairData)
            .select()
            .single()

          if (insertError || !repair) throw new Error(insertError?.message || 'Insert failed')

          // Upload photos
          const photoUrls: string[] = []
          for (let i = 0; i < photos.length; i++) {
            const ext = photos[i].name.split('.').pop() || 'jpg'
            const path = `repairs/${ts}/initial_${i}.${ext}`
            console.log(`[Repair] Uploading photo ${i}: ${photos[i].name}, size: ${photos[i].size}, type: ${photos[i].type}`)
            const { error: uploadError } = await getSupabase()
              .storage
              .from('repairs')
              .upload(path, photos[i])

            if (uploadError) {
              console.error(`[Repair] Photo upload failed:`, uploadError)
            } else {
              const { data: urlData } = getSupabase()
                .storage
                .from('repairs')
                .getPublicUrl(path)
              if (urlData?.publicUrl) {
                photoUrls.push(urlData.publicUrl)
                console.log(`[Repair] Photo uploaded: ${urlData.publicUrl}`)
              }

              // Also upload to Google Drive (fire and forget - don't block save)
              try {
                const driveForm = new FormData()
                driveForm.append('file', photos[i])
                driveForm.append('buildingName', building.name)
                driveForm.append('repairNumber', repairNumber)
                driveForm.append('dropLabel', dropLabel)
                fetch('/api/upload-to-drive', { method: 'POST', body: driveForm })
                  .catch(err => console.warn('[Repair] Drive upload failed (non-blocking):', err))
              } catch { /* Drive upload is best-effort */ }
            }
          }

          if (photoUrls.length > 0) {
            const { error: updateError } = await getSupabase()
              .from('repairs')
              .update({
                initial_photo_url: photoUrls[0],
                initial_photo_urls: photoUrls,
              })
              .eq('id', repair.id)

            if (updateError) {
              console.error('[Repair] Failed to update photo URLs:', updateError)
            } else {
              repair.initial_photo_url = photoUrls[0]
              ;(repair as Record<string, unknown>).initial_photo_urls = photoUrls
              console.log(`[Repair] ${photoUrls.length} photo URL(s) saved`)
            }
          }

          setRepairs(prev => [repair as RepairExt, ...prev])
          resetForm()
          // Trigger offline sync for any pending items
          processQueue().catch(() => {})
          setSaving(false)
          return
        } catch (err) {
          console.error('[Repair] Online save failed, falling back to offline queue:', err)
          alert('Online save failed: ' + (err instanceof Error ? err.message : String(err)) + '\nSaving offline for later sync.')
          // Fall through to offline queue
        }
      }

      // Offline: queue for later
      const photoBlobs: { field: string; blob: Blob; storagePath: string }[] = []
      const offlinePhotoUrls: string[] = []
      for (let i = 0; i < photos.length; i++) {
        const ext = photos[i].name.split('.').pop() || 'jpg'
        const path = `repairs/${ts}/initial_${i}.${ext}`
        photoBlobs.push({ field: `_photo_${i}`, blob: photos[i], storagePath: path })
        offlinePhotoUrls.push(path)
      }

      await addToQueue({
        type: 'repair',
        action: 'insert',
        table: 'repairs',
        data: {
          ...repairData,
          // These will be populated on sync from photo uploads
          initial_photo_url: null,
          initial_photo_urls: [],
        },
        photoBlobs,
      })

      // Add to local state with pending flag
      const pendingRepair: RepairExt = {
        ...repairData,
        id: tempId,
        initial_photo_url: photoPreviews[0] || null,
        initial_photo_urls: photoPreviews,
        completion_photo_url: null,
        completion_photo_urls: null,
        completion_comments: null,
        completed_at: null,
        completed_by: null,
        accumulated_seconds: null,
        created_at: new Date().toISOString(),
        _pending: true,
      }
      setRepairs(prev => [pendingRepair, ...prev])
      resetForm()
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  const visibleRepairs = repairs.filter(r => !r.defect_type?.startsWith('__'))

  // Apply filters
  const filteredRepairs = visibleRepairs.filter(r => {
    if (filterStatus === 'inspected' && !(r.status === 'in_progress' && (!r.repair_steps || r.repair_steps.length === 0))) return false
    if (filterStatus === 'in_progress' && !(r.status === 'in_progress' && r.repair_steps && r.repair_steps.length > 0)) return false
    if (filterStatus === 'completed' && r.status !== 'completed') return false
    if (filterDefectType && r.defect_type !== filterDefectType) return false
    if (filterUrgency && r.urgency !== filterUrgency) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      const match = [r.defect_type, r.sub_type, r.initial_comments, r.repair_number, r.location]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
      if (!match) return false
    }
    return true
  })

  const sorted = sortRepairs(filteredRepairs)
  const activeCount = visibleRepairs.filter(r => r.status === 'in_progress').length
  const completedCount = visibleRepairs.filter(r => r.status === 'completed').length

  const activeFilterCount = [
    filterStatus !== 'all' ? 1 : 0,
    filterDefectType ? 1 : 0,
    filterUrgency ? 1 : 0,
    searchText ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const tensButtons = building
    ? getTensButtons(building.floor_count, building.ground_is_level_one)
    : []

  const skippedLevels = building?.skipped_levels || []

  const isLevelSkipped = (level: string): boolean => {
    if (level === 'G' || level === 'R') return false
    return skippedLevels.includes(Number(level))
  }

  const canSave = selectedFloor && defectType && photos.length > 0

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href={`/repairs/${params.buildingId}`} className="min-w-[48px] min-h-[48px] flex items-center justify-center text-white active:scale-95 transition-transform -ml-2">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-white truncate">Drop {dropLabel} — {building?.name || 'Loading...'}</div>
            <div className="text-xs text-white/50">
              {visibleRepairs.length} repair{visibleRepairs.length !== 1 ? 's' : ''} ({activeCount} active, {completedCount} completed)
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !building ? (
            <div className="text-center py-12 text-navy/40">Building not found</div>
          ) : (
            <>
              {/* Filter Bar */}
              {visibleRepairs.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white shadow-sm text-sm font-semibold text-navy active:scale-95 transition-all min-h-[48px] w-full"
                  >
                    <svg className="w-4 h-4 text-navy/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="ml-auto bg-orange text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>
                    )}
                    <svg className={`w-4 h-4 text-navy/40 transition-transform ${showFilters ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </button>

                  {showFilters && (
                    <div className="mt-2 bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      {/* Search */}
                      <input
                        type="text"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                        placeholder="Search repairs..."
                      />

                      {/* Status */}
                      <div>
                        <label className="block text-xs font-medium text-navy/60 mb-1.5">Status</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['all', 'inspected', 'in_progress', 'completed'].map(s => (
                            <button
                              key={s}
                              onClick={() => setFilterStatus(s)}
                              className={`rounded-xl text-xs font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                                filterStatus === s ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                              }`}
                            >
                              {s === 'all' ? 'All' : s === 'inspected' ? 'Inspected' : s === 'in_progress' ? 'In Progress' : 'Completed'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Defect Type */}
                      <div>
                        <label className="block text-xs font-medium text-navy/60 mb-1.5">Defect Type</label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setFilterDefectType('')}
                            className={`rounded-xl text-xs font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                              !filterDefectType ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                            }`}
                          >All</button>
                          {DEFECT_CATEGORIES.filter(c => c !== 'Other').map(cat => (
                            <button
                              key={cat}
                              onClick={() => setFilterDefectType(filterDefectType === cat ? '' : cat)}
                              className={`rounded-xl text-xs font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                                filterDefectType === cat ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                              }`}
                            >{cat}</button>
                          ))}
                        </div>
                      </div>

                      {/* Urgency */}
                      <div>
                        <label className="block text-xs font-medium text-navy/60 mb-1.5">Urgency</label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setFilterUrgency('')}
                            className={`rounded-xl text-xs font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                              !filterUrgency ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                            }`}
                          >All</button>
                          {URGENCY_OPTIONS.map(u => (
                            <button
                              key={u}
                              onClick={() => setFilterUrgency(filterUrgency === u ? '' : u)}
                              className={`rounded-xl text-xs font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                                filterUrgency === u ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                              }`}
                            >{u}</button>
                          ))}
                        </div>
                      </div>

                      {activeFilterCount > 0 && (
                        <button
                          onClick={() => { setFilterStatus('all'); setFilterDefectType(''); setFilterUrgency(''); setSearchText('') }}
                          className="text-xs text-orange font-semibold py-2 active:scale-95 transition-all"
                        >Clear All Filters</button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Repair List */}
              {sorted.length === 0 ? (
                <div className="text-center py-8 text-navy/40">
                  {activeFilterCount > 0 ? 'No repairs match your filters' : 'No repairs in this drop yet'}
                </div>
              ) : (
                <div className="flex flex-col gap-2 mb-6">
                  {sorted.filter(r => r.status === 'in_progress').map(repair => (
                    <Link key={repair.id} href={repair._pending ? '#' : `/repairs/${params.buildingId}/${repair.id}`}>
                      <div className={`bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-all duration-150 flex items-center gap-3 ${repair._pending ? 'opacity-70 border-2 border-dashed border-orange/30' : ''}`}>
                        {(repair.initial_photo_urls?.[0] || repair.initial_photo_url) && (
                          <img src={repair.initial_photo_urls?.[0] || repair.initial_photo_url!} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 cursor-pointer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightboxUrl(repair.initial_photo_urls?.[0] || repair.initial_photo_url!) }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="font-semibold text-navy text-sm">{repair.repair_number || `${repair.drop_label}.${repair.floor_number}`} <span className="font-normal text-gray-400">· Floor {repair.floor_number}</span></div>
                            <div className="flex items-center gap-1">
                              {repair._pending && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange/10 text-orange">Pending</span>
                              )}
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${repair.repair_steps && repair.repair_steps.length > 0 ? "bg-orange/10 text-orange" : "bg-blue-100 text-blue-700"}`}>{repair.repair_steps && repair.repair_steps.length > 0 ? "In Progress" : "Inspected"}</span>
                            </div>
                          </div>
                          <div className="text-xs text-navy/50 truncate">
                            {repair.defect_type}{repair.sub_type ? ` — ${repair.sub_type}` : ''}
                          </div>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {repair.urgency && URGENCY_BADGE[repair.urgency] && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${URGENCY_BADGE[repair.urgency]}`}>{repair.urgency}</span>
                            )}
                            {repair.assigned_contractor && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{repair.assigned_contractor}</span>
                            )}
                            {repair.accumulated_seconds != null && repair.accumulated_seconds > 0 && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-navy/5 text-navy/50">{formatDuration(repair.accumulated_seconds)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}

                  {sorted.some(r => r.status === 'completed') && (
                    <>
                      <div className="flex items-center gap-2 mt-3 mb-1 px-1">
                        <div className="h-px flex-1 bg-navy/10" />
                        <span className="text-xs font-semibold text-navy/40 uppercase tracking-wide">Completed</span>
                        <div className="h-px flex-1 bg-navy/10" />
                      </div>
                      {sorted.filter(r => r.status === 'completed').map(repair => (
                        <Link key={repair.id} href={repair._pending ? '#' : `/repairs/${params.buildingId}/${repair.id}`}>
                          <div className="bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-all duration-150 flex items-center gap-3 opacity-70">
                            {(repair.initial_photo_urls?.[0] || repair.initial_photo_url) && (
                              <img src={repair.initial_photo_urls?.[0] || repair.initial_photo_url!} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 cursor-pointer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightboxUrl(repair.initial_photo_urls?.[0] || repair.initial_photo_url!) }} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="font-semibold text-navy text-sm">{repair.repair_number || `${repair.drop_label}.${repair.floor_number}`} <span className="font-normal text-gray-400">· Floor {repair.floor_number}</span></div>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Completed</span>
                              </div>
                              <div className="text-xs text-navy/50 truncate">
                                {repair.defect_type}{repair.sub_type ? ` — ${repair.sub_type}` : ''}
                              </div>
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {repair.urgency && URGENCY_BADGE[repair.urgency] && (
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${URGENCY_BADGE[repair.urgency]}`}>{repair.urgency}</span>
                                )}
                                {repair.assigned_contractor && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{repair.assigned_contractor}</span>
                                )}
                                {repair.accumulated_seconds != null && repair.accumulated_seconds > 0 && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-navy/5 text-navy/50">{formatDuration(repair.accumulated_seconds)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Add Repair Section */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-sm font-semibold text-navy mb-3">Add Repair</div>

                {/* Level Selector - two-row tens/ones */}
                <div className="mb-3">
                  {selectedFloor && (
                    <div className="text-lg font-bold text-orange mb-3">Level: {selectedFloor}</div>
                  )}
                  {/* Floor Range */}
                  <label className="block text-xs font-semibold text-navy/70 mb-2">Select Floor Range</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {tensButtons.map(t => (
                      <button
                        key={`tens-${t}`}
                        onClick={() => handleTensSelect(t)}
                        className={`rounded-xl text-sm font-semibold min-h-[48px] px-3 transition-all ${
                          (t === 'G' && selectedFloor === 'G') || (t === 'R' && selectedFloor === 'R') || (t !== 'G' && t !== 'R' && selectedTens === t)
                            ? 'bg-orange text-white'
                            : 'bg-light-gray text-navy border border-navy/10'
                        }`}
                      >
                        {t === '0' ? '1-9' : t}
                      </button>
                    ))}
                  </div>
                  {/* Select Level */}
                  {selectedTens !== null && (
                    <div className="mt-4">
                      <label className="block text-xs font-semibold text-navy/70 mb-2">Select Level</label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {ONES_BUTTONS.map(o => {
                          const level = selectedTens === '0' ? Number(o) : Number(selectedTens) + Number(o)
                          if (level === 0) return null
                          if (isLevelSkipped(String(level))) return null
                          if (building && level > building.floor_count) return null
                          return (
                            <button
                              key={`ones-${o}`}
                              onClick={() => handleOnesSelect(o)}
                              className={`rounded-xl text-sm font-semibold min-h-[48px] px-3 transition-all ${
                                selectedFloor === String(level)
                                  ? 'bg-orange text-white'
                                  : 'bg-light-gray text-navy border border-navy/10'
                              }`}
                            >
                              {level}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-navy/60 mb-1.5">Location</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {LOCATIONS.filter(loc => !building.relevant_locations || building.relevant_locations.includes(loc)).map(loc => (
                      <button
                        key={loc}
                        onClick={() => setLocation(loc === location ? '' : loc)}
                        className={`rounded-xl text-xs font-semibold min-h-[48px] px-2 py-2 transition-all text-center ${
                          location === loc
                            ? 'bg-orange text-white'
                            : 'bg-light-gray text-navy border border-navy/10'
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Defect Category */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-navy/60 mb-1.5">Defect Category</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DEFECT_CATEGORIES.filter(cat => !building.relevant_defect_types || building.relevant_defect_types.includes(cat)).map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setDefectType(cat === defectType ? '' : cat); setSubType('') }}
                        className={`rounded-xl text-sm font-semibold min-h-[48px] px-3 py-2 transition-all text-center ${
                          defectType === cat
                            ? 'bg-orange text-white'
                            : 'bg-light-gray text-navy border border-navy/10'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-Type buttons */}
                {defectType && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-navy/60 mb-1.5">Sub-Type</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(SUB_TYPE_MAP[defectType] || []).filter(st => st !== 'Other').map(st => (
                        <button
                          key={st}
                          onClick={() => setSubType(st === subType ? '' : st)}
                          className={`rounded-xl text-sm font-semibold min-h-[48px] px-4 py-2 transition-all ${
                            subType === st
                              ? 'bg-orange text-white'
                              : 'bg-light-gray text-navy border border-navy/10'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                      {(customSubTypes[defectType] || []).map(st => (
                        <button
                          key={`custom-${st.name}`}
                          onClick={() => setSubType(st.name === subType ? '' : st.name)}
                          className={`rounded-xl text-sm font-semibold min-h-[48px] px-4 py-2 transition-all relative group ${
                            subType === st.name
                              ? 'bg-orange text-white'
                              : 'bg-light-gray text-navy border border-dashed border-navy/20'
                          }`}
                        >
                          {st.name}
                          <span
                            onClick={(e) => { e.stopPropagation(); removeCustomSubType(defectType, st.name) }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity"
                          >×</span>
                        </button>
                      ))}
                      {!showAddForm && (
                        <button
                          onClick={() => setShowAddForm(true)}
                          className="rounded-xl text-sm font-semibold min-h-[48px] px-4 py-2 transition-all bg-light-gray text-navy/40 border border-dashed border-navy/20 active:scale-95"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                    {showAddForm && (
                      <div className="mt-2 p-3 bg-white rounded-xl border border-navy/10 shadow-sm">
                        <input
                          type="text"
                          value={newSubType}
                          onChange={e => setNewSubType(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveCustomSubType() } }}
                          className="w-full px-4 py-2.5 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-orange/40 mb-2"
                          placeholder="Sub-type name..."
                          autoFocus
                        />
                        <div className="text-xs font-medium text-navy/60 mb-1.5">Measurements</div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {MEASUREMENT_OPTIONS.map(m => (
                            <button
                              key={m}
                              onClick={() => setNewMeasurements(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                              className={`rounded-lg text-xs font-semibold px-3 py-1.5 transition-all ${
                                newMeasurements.includes(m)
                                  ? 'bg-orange text-white'
                                  : 'bg-light-gray text-navy border border-navy/10'
                              }`}
                            >
                              {m.charAt(0).toUpperCase() + m.slice(1)}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setShowAddForm(false); setNewSubType(''); setNewMeasurements(['height', 'length', 'depth']) }}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-light-gray text-navy text-sm font-semibold min-h-[44px] active:scale-95 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveCustomSubType}
                            disabled={!newSubType.trim()}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-orange text-white text-sm font-semibold min-h-[44px] active:scale-95 transition-all disabled:opacity-40"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Measurement Fields */}
                {defectType && subType && (MEASUREMENT_MAP[defectType]?.[subType] || getCustomMeasurements(defectType, subType)) && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-navy/60 mb-1.5">Measurements</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(MEASUREMENT_MAP[defectType]?.[subType] || getCustomMeasurements(defectType, subType) || []).includes('height') && (
                        <div>
                          <label className="block text-[10px] font-medium text-navy/40 mb-0.5">Height (mm)</label>
                          <input type="number" value={heightMm} onChange={e => setHeightMm(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40" placeholder="0" min="0" />
                        </div>
                      )}
                      {(MEASUREMENT_MAP[defectType]?.[subType] || getCustomMeasurements(defectType, subType) || []).includes('length') && (
                        <div>
                          <label className="block text-[10px] font-medium text-navy/40 mb-0.5">Length (mm)</label>
                          <input type="number" value={lengthMm} onChange={e => setLengthMm(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40" placeholder="0" min="0" />
                        </div>
                      )}
                      {(MEASUREMENT_MAP[defectType]?.[subType] || getCustomMeasurements(defectType, subType) || []).includes('depth') && (
                        <div>
                          <label className="block text-[10px] font-medium text-navy/40 mb-0.5">Depth (mm)</label>
                          <input type="number" value={depthMm} onChange={e => setDepthMm(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40" placeholder="0" min="0" />
                        </div>
                      )}
                      {(MEASUREMENT_MAP[defectType]?.[subType] || getCustomMeasurements(defectType, subType) || []).includes('quantity') && (
                        <div>
                          <label className="block text-[10px] font-medium text-navy/40 mb-0.5">Quantity</label>
                          <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40" placeholder="0" min="0" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Multi-Photo Capture */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-navy/60 mb-1.5">Photos</label>
                  {photoPreviews.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
                      {photoPreviews.map((preview, i) => (
                        <div key={i} className="relative flex-shrink-0">
                          <img
                            src={preview}
                            alt={`Photo ${i + 1}`}
                            className="w-20 h-20 rounded-xl object-cover cursor-pointer"
                            onClick={() => setLightboxUrl(preview)}
                          />
                          <button
                            onClick={() => removePhoto(i)}
                            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center active:scale-90 transition-transform"
                          >×</button>
                          {i === 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-orange/80 text-white text-[8px] font-bold text-center py-0.5 rounded-b-xl">PRIMARY</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="flex items-center justify-center w-full min-h-[48px] px-4 py-3 rounded-xl border-2 border-dashed border-navy/20 bg-light-gray text-navy/50 text-sm active:scale-95 transition-all duration-150"
                  >
                    {photos.length === 0 ? 'Take Photo/Video' : '+ Add Another Photo'}
                  </button>
                </div>

                {/* Comments */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-navy/60 mb-1.5">Initial Comments</label>
                  <textarea
                    value={initialComments}
                    onChange={e => setInitialComments(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 resize-none"
                    placeholder="Describe the defect..."
                  />
                </div>

                {/* Save */}
                <button
                  onClick={handleSave}
                  disabled={saving || !canSave}
                  className="w-full bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : 'Save Repair'}
                </button>
              </div>
            </>
          )}

          {/* Drop Action Buttons */}
          {!loading && building && (
            <div className="mt-6 flex gap-3">
              <button
                onClick={async () => {
                  const user = getStoredUser()
                  if (!user) return
                  const now = new Date().toISOString()
                  const existing = repairs.find(r => r.defect_type === '__inspection_complete')
                  if (existing) {
                    await getSupabase().from('repairs').delete().eq('id', existing.id)
                    setRepairs(prev => prev.filter(r => r.id !== existing.id))
                  } else {
                    const { data } = await getSupabase().from('repairs').insert({
                      building_id: building.id,
                      building_name: building.name,
                      drop_label: dropLabel,
                      floor_number: '0',
                      defect_type: '__inspection_complete',
                      status: 'completed',
                      started_at: now,
                      completed_at: now,
                      completed_by: user.name,
                      created_by: user.name,
                    }).select().single()
                    if (data) setRepairs(prev => [...prev, data as RepairExt])
                  }
                }}
                className={`flex-1 font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[56px] text-sm ${
                  repairs.some(r => r.defect_type === '__inspection_complete')
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-navy border-2 border-navy/20'
                }`}
              >
                {repairs.some(r => r.defect_type === '__inspection_complete') ? '✓ Inspection Complete' : 'Inspection Drop Complete'}
              </button>
              <button
                onClick={async () => {
                  const user = getStoredUser()
                  if (!user) return
                  const now = new Date().toISOString()
                  const existing = repairs.find(r => r.defect_type === '__repairs_complete')
                  if (existing) {
                    await getSupabase().from('repairs').delete().eq('id', existing.id)
                    setRepairs(prev => prev.filter(r => r.id !== existing.id))
                  } else {
                    const { data } = await getSupabase().from('repairs').insert({
                      building_id: building.id,
                      building_name: building.name,
                      drop_label: dropLabel,
                      floor_number: '0',
                      defect_type: '__repairs_complete',
                      status: 'completed',
                      started_at: now,
                      completed_at: now,
                      completed_by: user.name,
                      created_by: user.name,
                    }).select().single()
                    if (data) setRepairs(prev => [...prev, data as RepairExt])
                  }
                }}
                className={`flex-1 font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[56px] text-sm ${
                  repairs.some(r => r.defect_type === '__repairs_complete')
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-navy border-2 border-navy/20'
                }`}
              >
                {repairs.some(r => r.defect_type === '__repairs_complete') ? '✓ Repairs Complete' : 'Repairs Complete'}
              </button>
            </div>
          )}
        </div>
        {lightboxUrl && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
            <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-white/70 hover:text-white z-10">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <img src={lightboxUrl} alt="Full size" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
          </div>
        )}
      </div>
    </div>
  )
}
