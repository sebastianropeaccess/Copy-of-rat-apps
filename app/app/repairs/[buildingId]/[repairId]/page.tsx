'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser, isVideoUrl } from '@/lib/helpers'
import { addToQueue, processQueue } from '@/lib/offline'
import type { RatUser, Repair, RepairStep } from '@/lib/types'

const SUB_TYPE_MAP: Record<string, string[]> = {
  'Concrete': ['Bar End', 'Cracking', 'Fixings', 'Patch Needed', 'Rust Spot', 'Spalling', 'Other'],
  'Caulking': ['Failing', 'Missing', 'Not Painted', 'Other'],
  'Coatings': ['Blister', 'Efflorescence', 'Missing Paint', 'Paint Failure', 'Other'],
  'Waterproofing': ['Blisters', 'Damage', 'Missing', 'Pin Holing', 'Pooling', 'Other'],
  'Windows & Doors': ['Broken Glass', 'Frame Defect', 'Rubbers', 'Weep Holes', 'Other'],
  'Screens, Fins & Hoods': ['Construction Mess', 'Damaged', 'Loose', 'Missing Fixings', 'Not Level'],
  'Spitters': ['Construction Mess', 'Missing', 'Wrong Height'],
  'Brick Work': ['Cavity Flashing', 'Cracking', 'Loose', 'Mortar Defect', 'Weep Holes'],
  'Cleaning': ['Construction Mess'],
  'Installation': ['Damaged', 'Loose', 'Missing Fixings', 'Not Level'],
  'Other': [],
}

const DEFECT_CATEGORIES = ['Concrete', 'Caulking', 'Coatings', 'Waterproofing', 'Windows & Doors', 'Screens, Fins & Hoods', 'Spitters', 'Brick Work', 'Cleaning', 'Installation', 'Other']

const SUGGESTED_STEPS = [
  'Anode', 'Backing Rod', 'Chased', 'Cleaned', 'Drilled', 'Excavated',
  'Feathered', 'Installed', 'Painted', 'Patched', 'Primed', 'Removed',
  'Replaced', 'Sealed', 'Taped', 'Other',
]

type RepairWithSteps = Repair & { repair_steps: RepairStep[] } & { urgency?: string; assigned_contractor?: string }

type PhotoSource =
  | { type: 'initial'; url: string }
  | { type: 'completion'; url: string }
  | { type: 'step'; url: string; stepId: string }

type PhotoMoveTarget = 'initial' | 'completion' | 'existing_step' | 'new_step'

type ExistingCompletionPhoto = {
  url: string
  label: string
}

const URGENCY_BADGE: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700',
  Later: 'bg-yellow-100 text-yellow-700',
  Monitor: 'bg-blue-100 text-blue-700',
  Leave: 'bg-gray-100 text-gray-600',
}

const MAX_STEP_PHOTOS = 10

function getArrayUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((url): url is string => typeof url === 'string' && url.length > 0)
}

function getStepPhotoUrls(step: RepairStep): string[] {
  const urls = getArrayUrls(step.photo_urls)
  return urls.length > 0 ? urls : (step.photo_url ? [step.photo_url] : [])
}

function getCompletionPhotoUrls(repair: RepairWithSteps): string[] {
  const urls = getArrayUrls(repair.completion_photo_urls)
  return urls.length > 0 ? urls : (repair.completion_photo_url ? [repair.completion_photo_url] : [])
}

function getInitialPhotoUrls(repair: RepairWithSteps): string[] {
  const urls = getArrayUrls(repair.initial_photo_urls)
  return urls.length > 0 ? urls : (repair.initial_photo_url ? [repair.initial_photo_url] : [])
}

function removeUrl(urls: string[], url: string): string[] {
  return urls.filter(existing => existing !== url)
}

function addUniqueUrl(urls: string[], url: string): string[] {
  return urls.includes(url) ? urls : [...urls, url]
}

function toggleUrl(urls: string[], url: string): string[] {
  return urls.includes(url) ? urls.filter(existing => existing !== url) : [...urls, url]
}

function getFileExtension(file: File): string {
  return file.name.split('.').pop() || 'jpg'
}

function getUploadToken(): string {
  return Date.now().toString()
}

function isMissingColumnError(error: { message?: string } | null, column: string): boolean {
  return Boolean(error?.message?.toLowerCase().includes(column.toLowerCase()))
}

function sameId(a: unknown, b: unknown): boolean {
  return String(a) === String(b)
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return '<1m'
}

export default function RepairDetailPage() {
  const params = useParams<{ buildingId: string; repairId: string }>()
  const router = useRouter()
  const [user] = useState<RatUser | null>(() => getStoredUser())
  const [repair, setRepair] = useState<RepairWithSteps | null>(null)
  const [loading, setLoading] = useState(true)

  // Add step form
  const [showAddStep, setShowAddStep] = useState(false)
  const [stepPhotos, setStepPhotos] = useState<File[]>([])
  const [stepPhotoPreviews, setStepPhotoPreviews] = useState<string[]>([])
  const [stepComments, setStepComments] = useState('')
  const [selectedStepName, setSelectedStepName] = useState('')
  const [customStepName, setCustomStepName] = useState('')
  const [savingStep, setSavingStep] = useState(false)

  // Completion form
  const [showComplete, setShowComplete] = useState(false)
  const [completePhotos, setCompletePhotos] = useState<File[]>([])
  const [completePhotoPreviews, setCompletePhotoPreviews] = useState<string[]>([])
  const [selectedCompletionPhotoUrls, setSelectedCompletionPhotoUrls] = useState<string[]>([])
  const [completeComments, setCompleteComments] = useState('')
  const [savingComplete, setSavingComplete] = useState(false)

  const [reopening, setReopening] = useState(false)

  // Edit step
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editStepExistingPhotos, setEditStepExistingPhotos] = useState<string[]>([])
  const [editStepPhotos, setEditStepPhotos] = useState<File[]>([])
  const [editStepPhotoPreviews, setEditStepPhotoPreviews] = useState<string[]>([])
  const [editStepComments, setEditStepComments] = useState('')
  const [savingEditStep, setSavingEditStep] = useState(false)

  // Edit initial defect
  const [editingDefect, setEditingDefect] = useState(false)
  const [editDefectPhoto, setEditDefectPhoto] = useState<File | null>(null)
  const [editDefectPhotoPreview, setEditDefectPhotoPreview] = useState<string | null>(null)
  const [additionalPhotos, setAdditionalPhotos] = useState<File[]>([])
  const [additionalPhotoPreviews, setAdditionalPhotoPreviews] = useState<string[]>([])
  const [editDefectComments, setEditDefectComments] = useState('')
  const [editDropLabel, setEditDropLabel] = useState('')
  const [editFloorNumber, setEditFloorNumber] = useState('')
  const [editDefectType, setEditDefectType] = useState('')
  const [editSubType, setEditSubType] = useState('')
  const [editCustomSubType, setEditCustomSubType] = useState('')
  const [savingEditDefect, setSavingEditDefect] = useState(false)

  // Photo move / step ordering
  const [movingPhoto, setMovingPhoto] = useState<PhotoSource | null>(null)
  const [moveTarget, setMoveTarget] = useState<PhotoMoveTarget>('existing_step')
  const [moveTargetStepIds, setMoveTargetStepIds] = useState<string[]>([])
  const [copyPhotoToTargets, setCopyPhotoToTargets] = useState(false)
  const [moveNewStepName, setMoveNewStepName] = useState('')
  const [moveCustomStepName, setMoveCustomStepName] = useState('')
  const [savingPhotoMove, setSavingPhotoMove] = useState(false)
  const [photoMoveMessage, setPhotoMoveMessage] = useState('')
  const [reorderingStepId, setReorderingStepId] = useState<string | null>(null)

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false)
  const [displaySeconds, setDisplaySeconds] = useState(0)
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const normalizeStepNumbers = useCallback(async (steps: RepairStep[]): Promise<RepairStep[]> => {
    const sorted = [...steps].sort((a, b) => {
      if (a.step_number !== b.step_number) return a.step_number - b.step_number
      return String(a.created_at || '').localeCompare(String(b.created_at || ''))
    })

    const updates = sorted
      .map((step, index) => ({ step, stepNumber: index + 1 }))
      .filter(({ step, stepNumber }) => step.step_number !== stepNumber)

    if (updates.length > 0 && navigator.onLine) {
      const results = await Promise.all(
        updates.map(({ step, stepNumber }) =>
          getSupabase().from('repair_steps').update({ step_number: stepNumber }).eq('id', step.id)
        )
      )

      const error = results.find(result => result.error)?.error
      if (error) throw error
    }

    return sorted.map((step, index) => ({ ...step, step_number: index + 1 }))
  }, [])

  const loadRepair = useCallback(async () => {
    try {
      const { data } = await getSupabase()
        .from('repairs')
        .select('*, repair_steps(*)')
        .eq('id', params.repairId)
        .single()

      if (data) {
        const r = data as RepairWithSteps
        r.repair_steps = await normalizeStepNumbers(r.repair_steps || [])
        setRepair(r)

        // Initialize timer state from DB
        const acc = r.accumulated_seconds || 0
        if (r.started_at && r.status === 'in_progress') {
          // Check if timer was running (started_at is recent and not the creation time)
          // We use a convention: if started_at differs from created_at by more than 5 seconds,
          // the timer might be running. But safer: we store timer state separately.
          // For simplicity: timer is "running" if started_at was updated after creation
          // We'll track this via a flag approach: if accumulated_seconds > 0 or explicitly started
          setDisplaySeconds(acc)
          setTimerRunning(false) // Default to paused on page load
        } else {
          setDisplaySeconds(acc)
          setTimerRunning(false)
        }
      }
    } catch {
      // Offline - keep existing data
    }
    setLoading(false)
  }, [normalizeStepNumbers, params.repairId])

  useEffect(() => {
    if (!user) return

    const initialLoad = window.setTimeout(() => {
      void loadRepair()
    }, 0)
    const onFocus = () => { void loadRepair() }
    const onVis = () => { if (document.visibilityState === 'visible') void loadRepair() }

    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)

    return () => {
      window.clearTimeout(initialLoad)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [loadRepair, user])

  useEffect(() => {
    if (!user) {
      window.location.href = '/login'
    }
  }, [user])

  // Timer tick
  useEffect(() => {
    if (timerRunning) {
      timerInterval.current = setInterval(() => {
        setDisplaySeconds(prev => prev + 1)
      }, 1000)
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
        timerInterval.current = null
      }
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current)
    }
  }, [timerRunning])

  async function handleStartTimer() {
    if (!repair) return
    setTimerRunning(true)
  }

  async function handlePauseTimer() {
    if (!repair) return
    setTimerRunning(false)
    // Save accumulated seconds to DB
    try {
      await getSupabase()
        .from('repairs')
        .update({ accumulated_seconds: displaySeconds })
        .eq('id', repair.id)
    } catch {
      // Will sync later
    }
  }

  function appendStepPhotos(files: File[]) {
    const remainingSlots = MAX_STEP_PHOTOS - stepPhotos.length
    const nextFiles = files.slice(0, remainingSlots)
    if (nextFiles.length < files.length) {
      alert(`Max ${MAX_STEP_PHOTOS} photos per step`)
    }
    if (nextFiles.length === 0) return

    setStepPhotos(prev => [...prev, ...nextFiles])
    setStepPhotoPreviews(prev => [...prev, ...nextFiles.map(file => URL.createObjectURL(file))])
  }

  function handleStepPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    appendStepPhotos(Array.from(e.target.files || []))
    e.target.value = ''
  }

  function removeStepPhoto(index: number) {
    setStepPhotos(prev => prev.filter((_, i) => i !== index))
    setStepPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  function handleCompletePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const remainingSlots = MAX_STEP_PHOTOS - completePhotos.length
    const nextFiles = files.slice(0, remainingSlots)
    if (nextFiles.length < files.length) {
      alert(`Max ${MAX_STEP_PHOTOS} photos`)
    }
    if (nextFiles.length === 0) return

    setCompletePhotos(prev => [...prev, ...nextFiles])
    setCompletePhotoPreviews(prev => [...prev, ...nextFiles.map(file => URL.createObjectURL(file))])
    e.target.value = ''
  }

  function removeCompletePhoto(index: number) {
    setCompletePhotos(prev => prev.filter((_, i) => i !== index))
    setCompletePhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  function toggleExistingCompletionPhoto(url: string) {
    setSelectedCompletionPhotoUrls(prev => toggleUrl(prev, url))
  }

  function getExistingCompletionPhotoOptions(): ExistingCompletionPhoto[] {
    if (!repair) return []

    const optionsByUrl = new Map<string, string[]>()
    const addOption = (url: string, label: string) => {
      const labels = optionsByUrl.get(url) || []
      if (!labels.includes(label)) {
        optionsByUrl.set(url, [...labels, label])
      }
    }

    getInitialPhotoUrls(repair)
      .filter(url => !isVideoUrl(url))
      .forEach((url, i) => {
        addOption(url, `Initial Defect ${i + 1}`)
      })

    const orderedSteps = [...repair.repair_steps].sort((a, b) => {
      if (a.step_number !== b.step_number) return a.step_number - b.step_number
      return String(a.created_at || '').localeCompare(String(b.created_at || ''))
    })

    orderedSteps.forEach((step, stepIndex) => {
      const stepPhotoUrls = getStepPhotoUrls(step)
      stepPhotoUrls
        .filter(url => !isVideoUrl(url))
        .forEach((url, i) => {
          addOption(
            url,
            `Step ${stepIndex + 1}: ${step.step_name || 'Step'}${stepPhotoUrls.length > 1 ? ` (${i + 1})` : ''}`
          )
        })
    })

    return Array.from(optionsByUrl.entries()).map(([url, labels]) => ({
      url,
      label: labels.join(' / '),
    }))
  }

  async function handleAddStep() {
    const resolvedStepName = selectedStepName === 'Other' ? customStepName.trim() : selectedStepName
    if (!user || !repair || savingStep || !resolvedStepName) return
    setSavingStep(true)

    try {
      const stepNumber = (repair.repair_steps?.length || 0) + 1
      const stepId = crypto.randomUUID()
      const photoUrls: string[] = []

      if (navigator.onLine) {
        if (stepPhotos.length > 0) {
          const timestamp = getUploadToken()
          for (let i = 0; i < stepPhotos.length; i++) {
            const ext = getFileExtension(stepPhotos[i])
            const path = `repair-photos/${repair.id}/steps/${stepId}/${timestamp}_${i}.${ext}`
            const { error: uploadError } = await getSupabase()
              .storage
              .from('repairs')
              .upload(path, stepPhotos[i])

            if (!uploadError) {
              const { data: urlData } = getSupabase()
                .storage
                .from('repairs')
                .getPublicUrl(path)
              if (urlData?.publicUrl) photoUrls.push(urlData.publicUrl)
            }
          }
        }

        const insertPayload = {
          repair_id: repair.id,
          step_number: stepNumber,
          step_name: resolvedStepName,
          photo_url: photoUrls[0] || null,
          photo_urls: photoUrls,
          comments: stepComments.trim() || null,
          created_by: user.name,
        }

        let { error } = await getSupabase()
          .from('repair_steps')
          .insert(insertPayload)

        if (error && isMissingColumnError(error, 'photo_urls')) {
          const { photo_urls: _photoUrls, ...fallbackPayload } = insertPayload
          ;({ error } = await getSupabase()
            .from('repair_steps')
            .insert(fallbackPayload))
        }

        if (error) {
          alert('Failed to add step: ' + error.message)
          setSavingStep(false)
          return
        }

        processQueue().catch(() => {})
      } else {
        // Queue for offline sync
        const photoBlobs: { field: string; blob: Blob; storagePath: string }[] = []
        if (stepPhotos.length > 0) {
          const timestamp = getUploadToken()
          for (let i = 0; i < stepPhotos.length; i++) {
            const ext = getFileExtension(stepPhotos[i])
            const path = `repair-photos/${repair.id}/steps/${stepId}/${timestamp}_${i}.${ext}`
            photoBlobs.push({ field: `_step_photo_${i}`, blob: stepPhotos[i], storagePath: path })
          }
        }

        await addToQueue({
          type: 'repair_step',
          action: 'insert',
          table: 'repair_steps',
          data: {
            repair_id: repair.id,
            step_number: stepNumber,
            step_name: resolvedStepName,
            photo_url: null,
            photo_urls: [],
            comments: stepComments.trim() || null,
            created_by: user.name,
          },
          photoBlobs,
        })
      }

      setShowAddStep(false)
      setStepPhotos([])
      setStepPhotoPreviews([])
      setStepComments('')
      setSelectedStepName('')
      setCustomStepName('')
      setSavingStep(false)
      await loadRepair()
    } catch {
      alert('Something went wrong. Please try again.')
      setSavingStep(false)
    }
  }

  async function handleComplete() {
    if (!user || !repair || savingComplete || (completePhotos.length === 0 && selectedCompletionPhotoUrls.length === 0)) return
    setSavingComplete(true)

    // Pause timer and calculate total
    if (timerRunning) {
      setTimerRunning(false)
    }
    const totalSeconds = displaySeconds

    try {
      if (navigator.onLine) {
        const completionPhotoUrls: string[] = [...selectedCompletionPhotoUrls]
        const timestamp = getUploadToken()

        for (let i = 0; i < completePhotos.length; i++) {
          const ext = getFileExtension(completePhotos[i])
          const path = `repair-photos/${repair.id}/completion/${timestamp}_${i}.${ext}`
          const { error: uploadError } = await getSupabase()
            .storage
            .from('repairs')
            .upload(path, completePhotos[i])

          if (!uploadError) {
            const { data: urlData } = getSupabase()
              .storage
              .from('repairs')
              .getPublicUrl(path)
            if (urlData?.publicUrl) completionPhotoUrls.push(urlData.publicUrl)
          }
        }

        const updatePayload = {
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.name,
          completion_photo_url: completionPhotoUrls[0] || null,
          completion_photo_urls: completionPhotoUrls,
          completion_comments: completeComments.trim() || null,
        }

        let { error } = await getSupabase()
          .from('repairs')
          .update(updatePayload)
          .eq('id', repair.id)

        if (error && isMissingColumnError(error, 'completion_photo_urls')) {
          const { completion_photo_urls: _completionPhotoUrls, ...fallbackPayload } = updatePayload
          ;({ error } = await getSupabase()
            .from('repairs')
            .update(fallbackPayload)
            .eq('id', repair.id))
        }

        if (error) {
          alert('Failed to complete repair: ' + error.message)
          setSavingComplete(false)
          return
        }

        processQueue().catch(() => {})
      } else {
        const timestamp = getUploadToken()
        const photoBlobs = completePhotos.map((photo, i) => ({
          field: `_completion_photo_${i}`,
          blob: photo as Blob,
          storagePath: `repair-photos/${repair.id}/completion/${timestamp}_${i}.${getFileExtension(photo)}`,
        }))

        await addToQueue({
          type: 'status_change',
          action: 'update',
          table: 'repairs',
          data: {
            id: repair.id,
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: user.name,
            completion_comments: completeComments.trim() || null,
            accumulated_seconds: totalSeconds,
            completion_photo_url: selectedCompletionPhotoUrls[0] || null,
            completion_photo_urls: selectedCompletionPhotoUrls,
          },
          photoBlobs,
        })
      }

      setShowComplete(false)
      setCompletePhotos([])
      setCompletePhotoPreviews([])
      setSelectedCompletionPhotoUrls([])
      setCompleteComments('')
      setSavingComplete(false)
      await loadRepair()
    } catch {
      alert('Something went wrong. Please try again.')
      setSavingComplete(false)
    }
  }

  async function handleDeleteRepair() {
    if (!repair) return
    if (!confirm('Are you sure you want to delete this repair? This cannot be undone.')) return
    try {
      const { error } = await getSupabase().from('repairs').delete().eq('id', repair.id)
      if (error) {
        alert('Failed to delete: ' + error.message)
        return
      }
      router.back()
    } catch {
      alert('Failed to delete repair')
    }
  }

  async function handleDeleteStep(stepId: string) {
    if (!confirm('Delete this step?')) return
    try {
      const { error } = await getSupabase().from('repair_steps').delete().eq('id', stepId)
      if (error) {
        alert('Failed to delete step: ' + error.message)
        return
      }
      await loadRepair()
    } catch {
      alert('Failed to delete step')
    }
  }

  async function handleReopen() {
    if (!repair || reopening) return
    setReopening(true)

    try {
      if (navigator.onLine) {
        const updatePayload = {
          status: 'in_progress',
          completed_at: null,
          completed_by: null,
          completion_photo_url: null,
          completion_photo_urls: null,
          completion_comments: null,
        }

        let { error } = await getSupabase()
          .from('repairs')
          .update(updatePayload)
          .eq('id', repair.id)

        if (error && isMissingColumnError(error, 'completion_photo_urls')) {
          const { completion_photo_urls: _completionPhotoUrls, ...fallbackPayload } = updatePayload
          ;({ error } = await getSupabase()
            .from('repairs')
            .update(fallbackPayload)
            .eq('id', repair.id))
        }

        if (error) {
          alert('Failed to reopen repair: ' + error.message)
          setReopening(false)
          return
        }
      } else {
        await addToQueue({
          type: 'status_change',
          action: 'update',
          table: 'repairs',
          data: {
            id: repair.id,
            status: 'in_progress',
            completed_at: null,
            completed_by: null,
            completion_photo_url: null,
            completion_photo_urls: null,
            completion_comments: null,
          },
          photoBlobs: [],
        })
      }

      setReopening(false)
      await loadRepair()
    } catch {
      alert('Something went wrong. Please try again.')
      setReopening(false)
    }
  }

  function startEditStep(step: RepairStep) {
    setEditingStepId(step.id)
    setEditStepExistingPhotos(getStepPhotoUrls(step))
    setEditStepPhotos([])
    setEditStepPhotoPreviews([])
    setEditStepComments(step.comments || '')
  }

  function cancelEditStep() {
    setEditingStepId(null)
    setEditStepExistingPhotos([])
    setEditStepPhotos([])
    setEditStepPhotoPreviews([])
    setEditStepComments('')
  }

  function handleEditStepPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const remainingSlots = MAX_STEP_PHOTOS - (editStepExistingPhotos.length + editStepPhotos.length)
    const nextFiles = files.slice(0, remainingSlots)
    if (nextFiles.length < files.length) {
      alert(`Max ${MAX_STEP_PHOTOS} photos per step`)
    }
    if (nextFiles.length === 0) return

    setEditStepPhotos(prev => [...prev, ...nextFiles])
    setEditStepPhotoPreviews(prev => [...prev, ...nextFiles.map(file => URL.createObjectURL(file))])
    e.target.value = ''
  }

  function removeEditStepExistingPhoto(index: number) {
    setEditStepExistingPhotos(prev => prev.filter((_, i) => i !== index))
  }

  function removeEditStepPhoto(index: number) {
    setEditStepPhotos(prev => prev.filter((_, i) => i !== index))
    setEditStepPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSaveEditStep(step: RepairStep) {
    if (!repair || savingEditStep) return
    setSavingEditStep(true)

    try {
      const mergedPhotoUrls = [...editStepExistingPhotos]

      if (editStepPhotos.length > 0) {
        const timestamp = getUploadToken()
        for (let i = 0; i < editStepPhotos.length; i++) {
          const ext = getFileExtension(editStepPhotos[i])
          const path = `repair-photos/${repair.id}/steps/${step.id}/${timestamp}_${i}.${ext}`
          const { error: uploadError } = await getSupabase()
            .storage
            .from('repairs')
            .upload(path, editStepPhotos[i])

          if (!uploadError) {
            const { data: urlData } = getSupabase()
              .storage
              .from('repairs')
              .getPublicUrl(path)
            if (urlData?.publicUrl) mergedPhotoUrls.push(urlData.publicUrl)
          }
        }
      }

      const updatePayload = {
        photo_url: mergedPhotoUrls[0] || null,
        photo_urls: mergedPhotoUrls,
        comments: editStepComments.trim() || null,
      }

      let { error } = await getSupabase()
        .from('repair_steps')
        .update(updatePayload)
        .eq('id', step.id)

      if (error && isMissingColumnError(error, 'photo_urls')) {
        const { photo_urls: _photoUrls, ...fallbackPayload } = updatePayload
        ;({ error } = await getSupabase()
          .from('repair_steps')
          .update(fallbackPayload)
          .eq('id', step.id))
      }

      if (error) {
        alert('Failed to update step: ' + error.message)
        setSavingEditStep(false)
        return
      }

      cancelEditStep()
      setSavingEditStep(false)
      await loadRepair()
    } catch {
      alert('Something went wrong. Please try again.')
      setSavingEditStep(false)
    }
  }

  function startEditDefect() {
    if (!repair) return
    setEditingDefect(true)
    setEditDefectPhoto(null)
    setEditDefectPhotoPreview(null)
    setEditDefectComments(repair.initial_comments || '')
    setEditDropLabel(repair.drop_label || '')
    setEditFloorNumber(String(repair.floor_number ?? ''))
    setEditDefectType(repair.defect_type || '')
    if (repair.defect_type === 'Other') {
      setEditSubType('')
      setEditCustomSubType(repair.sub_type || '')
    } else {
      setEditSubType(repair.sub_type || '')
      setEditCustomSubType('')
    }
  }

  function cancelEditDefect() {
    setEditingDefect(false)
    setEditDefectPhoto(null)
    setEditDefectPhotoPreview(null)
    setEditDefectComments('')
    setEditDropLabel('')
    setEditFloorNumber('')
    setEditDefectType('')
    setEditSubType('')
    setEditCustomSubType('')
  }

  function handleEditDefectPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setEditDefectPhoto(file)
      setEditDefectPhotoPreview(URL.createObjectURL(file))
    }
  }

  function handleAdditionalPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setAdditionalPhotos(prev => [...prev, ...files])
    setAdditionalPhotoPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }

  async function handleSaveEditDefect() {
    if (!repair || savingEditDefect) return
    setSavingEditDefect(true)

    try {
      let photoUrl = repair.initial_photo_url

      if (editDefectPhoto) {
        const path = `repairs/${repair.id}/initial.jpg`
        const { error: uploadError } = await getSupabase()
          .storage
          .from('repairs')
          .upload(path, editDefectPhoto, { upsert: true })

        if (!uploadError) {
          const { data: urlData } = getSupabase()
            .storage
            .from('repairs')
            .getPublicUrl(path)
          photoUrl = urlData?.publicUrl ? `${urlData.publicUrl}?t=${getUploadToken()}` : photoUrl
        }
      }

      const dropChanged = editDropLabel !== repair.drop_label
      const floorChanged = String(editFloorNumber) !== String(repair.floor_number)
      let repairNumber = repair.repair_number

      if (dropChanged || floorChanged) {
        const { data: existing } = await getSupabase()
          .from('repairs')
          .select('id')
          .eq('building_id', repair.building_id)
          .eq('drop_label', editDropLabel)
          .eq('floor_number', editFloorNumber)
          .neq('id', repair.id)
        const seq = (existing?.length || 0) + 1
        repairNumber = `${editDropLabel}.${editFloorNumber}.${seq}`
      }

      const resolvedSubType = editDefectType === 'Other'
        ? editCustomSubType.trim() || null
        : editSubType || null

      // Upload additional photos
      const existingUrls = getInitialPhotoUrls(repair)
      const allUrls = [...existingUrls]
      
      if (photoUrl && !allUrls.includes(photoUrl)) {
        allUrls[0] = photoUrl // Replace first photo if changed
      }

      for (let i = 0; i < additionalPhotos.length; i++) {
        const ext = additionalPhotos[i].name.split('.').pop() || 'jpg'
        const path = `repairs/${repair.id}/initial_${getUploadToken()}_${i}.${ext}`
        const { error: upErr } = await getSupabase().storage.from('repairs').upload(path, additionalPhotos[i])
        if (!upErr) {
          const { data: urlData } = getSupabase().storage.from('repairs').getPublicUrl(path)
          if (urlData?.publicUrl) allUrls.push(urlData.publicUrl)
        }
      }

      const { error } = await getSupabase()
        .from('repairs')
        .update({
          drop_label: editDropLabel,
          floor_number: editFloorNumber,
          defect_type: editDefectType,
          sub_type: resolvedSubType,
          repair_number: repairNumber,
          initial_photo_url: allUrls[0] || photoUrl,
          initial_photo_urls: allUrls,
          initial_comments: editDefectComments.trim() || null,
        })
        .eq('id', repair.id)

      if (error) {
        alert('Failed to update defect: ' + error.message)
        setSavingEditDefect(false)
        return
      }

      setAdditionalPhotos([])
      setAdditionalPhotoPreviews([])
      cancelEditDefect()
      setSavingEditDefect(false)
      await loadRepair()
    } catch {
      alert('Something went wrong. Please try again.')
      setSavingEditDefect(false)
    }
  }

  function openGallery(urls: string[], startIndex: number) {
    const clickedUrl = urls[startIndex]
    if (!clickedUrl || isVideoUrl(clickedUrl)) return

    const imageUrls = urls.filter(url => !isVideoUrl(url))
    const imageIndex = imageUrls.indexOf(clickedUrl)
    if (imageUrls.length === 0 || imageIndex === -1) return

    setLightboxPhotos(imageUrls)
    setLightboxIndex(imageIndex)
    setLightboxUrl(imageUrls[imageIndex])
  }

  function openMovePhoto(source: PhotoSource) {
    if (!navigator.onLine) {
      alert('Photos can only be moved while online.')
      return
    }

    const firstOtherStep = getSelectableMoveTargetSteps(source)[0]
    setMovingPhoto(source)
    setPhotoMoveMessage('')
    setMoveTarget(firstOtherStep ? 'existing_step' : 'new_step')
    setMoveTargetStepIds(firstOtherStep ? [String(firstOtherStep.id)] : [])
    setCopyPhotoToTargets(false)
    setMoveNewStepName('')
    setMoveCustomStepName('')
  }

  function toggleMoveTargetStep(stepId: string) {
    setMoveTargetStepIds(prev =>
      prev.includes(stepId)
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    )
  }

  function getSelectableMoveTargetSteps(source: PhotoSource | null) {
    if (!repair) return []
    return repair.repair_steps.filter(step => source?.type !== 'step' || !sameId(step.id, source.stepId))
  }

  async function updateInitialPhotos(urls: string[]) {
    return getSupabase()
      .from('repairs')
      .update({
        initial_photo_url: urls[0] || null,
        initial_photo_urls: urls,
      })
      .eq('id', repair?.id)
  }

  async function updateCompletionPhotos(urls: string[]) {
    let result = await getSupabase()
      .from('repairs')
      .update({
        completion_photo_url: urls[0] || null,
        completion_photo_urls: urls,
      })
      .eq('id', repair?.id)

    if (result.error && isMissingColumnError(result.error, 'completion_photo_urls')) {
      result = await getSupabase()
        .from('repairs')
        .update({ completion_photo_url: urls[0] || null })
        .eq('id', repair?.id)
    }

    return result
  }

  async function updateStepPhotos(stepId: string, urls: string[]) {
    let result = await getSupabase()
      .from('repair_steps')
      .update({
        photo_url: urls[0] || null,
        photo_urls: urls,
      })
      .eq('id', stepId)

    if (result.error && isMissingColumnError(result.error, 'photo_urls')) {
      result = await getSupabase()
        .from('repair_steps')
        .update({ photo_url: urls[0] || null })
        .eq('id', stepId)
    }

    return result
  }

  async function removePhotoFromSource(source: PhotoSource) {
    if (!repair) return { error: null }

    if (source.type === 'initial') {
      return updateInitialPhotos(removeUrl(getInitialPhotoUrls(repair), source.url))
    }

    if (source.type === 'completion') {
      return updateCompletionPhotos(removeUrl(getCompletionPhotoUrls(repair), source.url))
    }

    const step = repair.repair_steps.find(s => sameId(s.id, source.stepId))
    if (!step) return { error: { message: 'Source step not found' } }
    return updateStepPhotos(step.id, removeUrl(getStepPhotoUrls(step), source.url))
  }

  async function handleMovePhoto() {
    if (savingPhotoMove) return
    if (!repair || !movingPhoto) {
      alert('Photo move is not ready yet. Please close this and try again.')
      return
    }
    if (!user) {
      alert('Your login session has expired. Please log in again before moving photos.')
      return
    }
    setSavingPhotoMove(true)

    try {
      const source = movingPhoto
      let targetMatchesSource = false
      let targetError: { message?: string } | null = null
      let movedToLabel = ''

      if (moveTarget === 'initial') {
        movedToLabel = 'Initial Defect'
        targetMatchesSource = source.type === 'initial'
        if (targetMatchesSource) {
          alert('This photo is already in Initial Defect. Choose a different target.')
          setSavingPhotoMove(false)
          return
        }
        if (!targetMatchesSource) {
          const { error } = await updateInitialPhotos(addUniqueUrl(getInitialPhotoUrls(repair), source.url))
          targetError = error
        }
      } else if (moveTarget === 'completion') {
        movedToLabel = 'Completion'
        targetMatchesSource = source.type === 'completion'
        if (targetMatchesSource) {
          alert('This photo is already in Completion. Choose a different target.')
          setSavingPhotoMove(false)
          return
        }
        if (!targetMatchesSource) {
          const { error } = await updateCompletionPhotos(addUniqueUrl(getCompletionPhotoUrls(repair), source.url))
          targetError = error
        }
      } else if (moveTarget === 'existing_step') {
        const targetSteps = repair.repair_steps.filter(step =>
          moveTargetStepIds.some(stepId => sameId(step.id, stepId))
        )
        if (targetSteps.length === 0) {
          alert('Choose at least one target step.')
          setSavingPhotoMove(false)
          return
        }
        const sameSourceTargets = targetSteps.filter(step => source.type === 'step' && sameId(source.stepId, step.id))
        if (sameSourceTargets.length > 0) {
          alert('This photo is already in one of the selected steps. Choose a different target step.')
          setSavingPhotoMove(false)
          return
        }
        for (const targetStep of targetSteps) {
          const { error } = await updateStepPhotos(targetStep.id, addUniqueUrl(getStepPhotoUrls(targetStep), source.url))
          if (error) {
            targetError = error
            break
          }
        }
        targetMatchesSource = copyPhotoToTargets
        movedToLabel = targetSteps.length === 1
          ? `Step ${targetSteps[0].step_number}: ${targetSteps[0].step_name || 'Step'}`
          : `${targetSteps.length} steps`
      } else {
        const stepName = moveNewStepName === 'Other' ? moveCustomStepName.trim() : moveNewStepName.trim()
        if (!stepName) {
          alert('Choose a step for the new step.')
          setSavingPhotoMove(false)
          return
        }

        const { error } = await getSupabase()
          .from('repair_steps')
          .insert({
            repair_id: repair.id,
            step_number: (repair.repair_steps?.length || 0) + 1,
            step_name: stepName,
            photo_url: source.url,
            photo_urls: [source.url],
            comments: null,
            created_by: user.name,
          })
        targetError = error
        movedToLabel = `new step: ${stepName}`
      }

      if (targetError) {
        alert('Failed to move photo: ' + targetError.message)
        setSavingPhotoMove(false)
        return
      }

      if (!targetMatchesSource) {
        const { error } = await removePhotoFromSource(source)
        if (error) {
          alert('Photo was copied to the target, but could not be removed from the original section: ' + error.message)
        }
      }

      setMovingPhoto(null)
      cancelEditStep()
      cancelEditDefect()
      setPhotoMoveMessage(`Photo moved to ${movedToLabel}.`)
      setSavingPhotoMove(false)
      await loadRepair()
    } catch (error) {
      alert('Photo move failed: ' + (error instanceof Error ? error.message : 'Something went wrong. Please try again.'))
      setSavingPhotoMove(false)
    }
  }

  async function handleReorderStep(stepId: string, direction: -1 | 1) {
    if (!repair || reorderingStepId) return
    const steps = [...repair.repair_steps].sort((a, b) => a.step_number - b.step_number)
    const index = steps.findIndex(step => sameId(step.id, stepId))
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= steps.length) return

    const nextSteps = [...steps]
    ;[nextSteps[index], nextSteps[targetIndex]] = [nextSteps[targetIndex], nextSteps[index]]
    setReorderingStepId(stepId)

    try {
      const results = await Promise.all(
        nextSteps.map((step, stepIndex) =>
          getSupabase().from('repair_steps').update({ step_number: stepIndex + 1 }).eq('id', step.id)
        )
      )

      const error = results.find(result => result.error)?.error
      if (error) {
        alert('Failed to reorder steps: ' + error.message)
        setReorderingStepId(null)
        return
      }

      setReorderingStepId(null)
      await loadRepair()
    } catch {
      alert('Failed to reorder steps')
      setReorderingStepId(null)
    }
  }

  function closeLightbox() {
    setLightboxUrl(null)
    setLightboxPhotos([])
    setLightboxIndex(0)
  }

  if (!user) return null

  // Get all initial photos
  const initialPhotos = repair ? getInitialPhotoUrls(repair) : []
  const completionPhotos = repair ? getCompletionPhotoUrls(repair) : []
  const selectableMoveTargetSteps = getSelectableMoveTargetSteps(movingPhoto)
  const existingCompletionPhotoOptions = getExistingCompletionPhotoOptions()

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href={repair?.drop_label ? `/repairs/${params.buildingId}/drop/${repair.drop_label}` : `/repairs/${params.buildingId}`} className="min-w-[48px] min-h-[48px] flex items-center justify-center text-white active:scale-95 transition-transform -ml-2">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="flex-1 min-w-0">
            {repair ? (
              <>
                <div className="text-lg font-bold text-white truncate">
                  {repair.repair_number
                    ? `${repair.repair_number} — ${repair.defect_type}`
                    : `Drop ${repair.drop_label} · Floor ${repair.floor_number}`
                  }
                </div>
                {repair.repair_number && (
                  <div className="text-xs text-white/50">Drop {repair.drop_label} · Floor {repair.floor_number}</div>
                )}
                {!repair.repair_number && (
                  <div className="text-xs text-white/50">{repair.defect_type}</div>
                )}
              </>
            ) : (
              <div className="text-lg font-bold text-white">Repair Detail</div>
            )}
          </div>
          {repair && (
            <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
              repair.status === 'completed'
                ? 'bg-green-100 text-green-700'
                : 'bg-orange/10 text-orange'
            }`}>
              {repair.status === 'completed' ? 'Completed' : 'In Progress'}
            </span>
          )}
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !repair ? (
            <div className="text-center py-12 text-navy/40">Repair not found</div>
          ) : (
            <div className="flex flex-col gap-4">
              {photoMoveMessage && (
                <div className="rounded-xl bg-green-100 border border-green-200 text-green-800 px-4 py-3 text-sm font-semibold">
                  {photoMoveMessage}
                </div>
              )}

              {/* Defect info with initial photo gallery */}
              {editingDefect ? (
                <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-orange/20 overflow-hidden">
                  <div className="text-sm font-semibold text-navy mb-3">Edit Initial Defect</div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-xs font-medium text-navy/70 mb-1">Drop Label</label>
                      <input
                        type="text"
                        value={editDropLabel}
                        onChange={e => setEditDropLabel(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                        placeholder="e.g. A1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-navy/70 mb-1">Floor Number</label>
                      <input
                        type="text"
                        value={editFloorNumber}
                        onChange={e => setEditFloorNumber(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                        placeholder="e.g. 3"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-navy/70 mb-1">Defect Category</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DEFECT_CATEGORIES.map(cat => (
                          <button
                            key={cat}
                            onClick={() => { setEditDefectType(cat === editDefectType ? '' : cat); setEditSubType(''); setEditCustomSubType('') }}
                            className={`rounded-xl text-sm font-semibold min-h-[48px] px-3 py-2 transition-all text-left whitespace-normal break-words leading-tight ${
                              editDefectType === cat
                                ? 'bg-orange text-white'
                                : 'bg-light-gray text-navy border border-navy/10'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    {editDefectType && SUB_TYPE_MAP[editDefectType]?.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-navy/70 mb-1">Sub-Type</label>
                        <div className="flex flex-wrap gap-1.5">
                          {SUB_TYPE_MAP[editDefectType].map(st => (
                            <button
                              key={st}
                              onClick={() => setEditSubType(st === editSubType ? '' : st)}
                              className={`rounded-xl text-sm font-semibold min-h-[48px] px-4 py-2 transition-all whitespace-normal break-words leading-tight ${
                                editSubType === st
                                  ? 'bg-orange text-white'
                                  : 'bg-light-gray text-navy border border-navy/10'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {editDefectType === 'Other' && (
                      <div>
                        <label className="block text-xs font-medium text-navy/70 mb-1">Describe Defect</label>
                        <input
                          type="text"
                          value={editCustomSubType}
                          onChange={e => setEditCustomSubType(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                          placeholder="Enter defect type..."
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-navy/70 mb-1">Photos</label>
                      <div className="flex flex-wrap gap-2 mb-2 max-w-full overflow-hidden">
                        {getInitialPhotoUrls(repair).map((url, i) => (
                          <div key={i} className="shrink-0">
                            {isVideoUrl(url) ? (
                              <video src={url} playsInline className="w-20 h-20 rounded-lg object-cover" />
                            ) : (
                              <button
                                type="button"
                                onClick={() => openGallery(getInitialPhotoUrls(repair), i)}
                                className="block cursor-pointer active:scale-95 transition-transform"
                                aria-label={`Enlarge photo ${i + 1}`}
                              >
                                <img src={url} alt={`Photo ${i+1}`} className="w-20 h-20 rounded-lg object-cover" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openMovePhoto({ type: 'initial', url })}
                              className="mt-1 w-full min-h-[36px] rounded-lg bg-navy text-white text-xs font-semibold"
                            >
                              Move
                            </button>
                          </div>
                        ))}
                        {additionalPhotoPreviews.map((url, i) => (
                          <div key={`new-${i}`} className="relative">
                            <button
                              type="button"
                              onClick={() => openGallery(additionalPhotoPreviews, i)}
                              className="block cursor-pointer active:scale-95 transition-transform"
                              aria-label={`Enlarge new photo ${i + 1}`}
                            >
                              <img src={url} alt={`New ${i+1}`} className="w-16 h-16 rounded-lg object-cover border-2 border-orange" />
                            </button>
                            <button onClick={() => {
                              setAdditionalPhotos(p => p.filter((_, j) => j !== i))
                              setAdditionalPhotoPreviews(p => p.filter((_, j) => j !== i))
                            }} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-12 h-12 text-sm flex items-center justify-center">×</button>
                          </div>
                        ))}
                      </div>
                      <label className="flex items-center justify-center w-full min-h-[48px] px-4 py-3 rounded-xl border-2 border-dashed border-navy/20 bg-light-gray text-navy/50 text-sm cursor-pointer active:scale-95 transition-all duration-150">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleAdditionalPhotos}
                          className="hidden"
                        />
                        + Add More Photos
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-navy/70 mb-1">Comments</label>
                      <textarea
                        value={editDefectComments}
                        onChange={e => setEditDefectComments(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 resize-none"
                        placeholder="Describe the defect..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={cancelEditDefect}
                        className="flex-1 bg-light-gray text-navy font-semibold py-3 rounded-xl border border-navy/10 active:scale-95 transition-all duration-150 min-h-[48px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEditDefect}
                        disabled={savingEditDefect}
                        className="flex-1 bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100"
                      >
                        {savingEditDefect ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                          </span>
                        ) : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={startEditDefect}
                  className="bg-white rounded-xl p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-all duration-150 overflow-hidden"
                >
                  <div className="flex flex-col gap-3">
                    {/* Multi-photo gallery */}
                    {initialPhotos.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-1 max-w-full" onClick={e => e.stopPropagation()}>
                        {initialPhotos.map((url, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => openGallery(initialPhotos, i)}
                            className="shrink-0 cursor-pointer active:scale-95 transition-transform"
                            aria-label={`Enlarge initial defect photo ${i + 1}`}
                          >
                            {isVideoUrl(url) ? (
                              <video src={url} controls playsInline className="w-24 h-24 rounded-lg object-cover bg-light-gray" />
                            ) : (
                              <img src={url} alt={`Initial defect photo ${i + 1}`} className="w-24 h-24 rounded-lg object-cover bg-light-gray" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-navy mb-1 break-words">{repair.defect_type}</div>
                      {repair.sub_type && <div className="text-xs text-navy/50 mb-2 break-words">{repair.sub_type}</div>}
                      {repair.initial_comments && (
                        <div className="text-sm text-navy/70 whitespace-pre-wrap break-words mb-2">{repair.initial_comments}</div>
                      )}
                      <div className="text-xs text-navy/40 break-words">Started {new Date(repair.started_at).toLocaleDateString()} by {repair.created_by}</div>
                      {(repair.urgency || repair.assigned_contractor) && (
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {repair.urgency && URGENCY_BADGE[repair.urgency] && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${URGENCY_BADGE[repair.urgency]}`}>{repair.urgency}</span>
                          )}
                          {repair.assigned_contractor && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{repair.assigned_contractor}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-navy/30 text-center mt-2">Tap photo to enlarge • Tap card to edit</div>
                </div>
              )}

              {/* Timer removed — supervisors allocate time at end of day */}

              {/* Steps */}
              {repair.repair_steps.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2 px-1">
                    Steps ({repair.repair_steps.length})
                  </div>
                  <div className="flex flex-col gap-2">
                    {repair.repair_steps.map(s => (
                      editingStepId === s.id ? (
                        <div key={s.id} className="bg-white rounded-xl px-4 py-3 shadow-sm border-2 border-orange/20 overflow-hidden">
                          <div className="text-sm font-semibold text-navy mb-3 break-words">Edit Step {s.step_number} — {s.step_name}</div>
                          <div className="flex flex-col gap-3">
                            <div>
                              <label className="block text-xs font-medium text-navy/70 mb-1">Photos</label>
                              <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                                {editStepExistingPhotos.map((url, i) => (
                                  <div key={`existing-${i}`} className="relative shrink-0 w-20">
                                    {isVideoUrl(url) ? (
                                      <video src={url} playsInline className="w-20 h-20 rounded-lg object-cover" />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openGallery(editStepExistingPhotos, i)}
                                        className="block cursor-pointer active:scale-95 transition-transform"
                                        aria-label={`Enlarge step ${s.step_number} photo ${i + 1}`}
                                      >
                                        <img src={url} alt={`Step ${s.step_number} photo ${i + 1}`} className="w-20 h-20 rounded-lg object-cover" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => removeEditStepExistingPhoto(i)}
                                      className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-red-500 text-white text-sm flex items-center justify-center"
                                    >
                                      ×
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openMovePhoto({ type: 'step', stepId: s.id, url })}
                                      className="mt-1 w-full min-h-[36px] rounded-lg bg-navy text-white text-xs font-semibold"
                                    >
                                      Move
                                    </button>
                                  </div>
                                ))}
                                {editStepPhotoPreviews.map((url, i) => (
                                  <div key={`new-${i}`} className="relative shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => openGallery(editStepPhotoPreviews, i)}
                                      className="block cursor-pointer active:scale-95 transition-transform"
                                      aria-label={`Enlarge new step photo ${i + 1}`}
                                    >
                                      <img src={url} alt={`New step photo ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border-2 border-orange" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeEditStepPhoto(i)}
                                      className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-red-500 text-white text-sm flex items-center justify-center"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                                {editStepExistingPhotos.length + editStepPhotos.length < MAX_STEP_PHOTOS && (
                                  <label className="shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-lg border-2 border-dashed border-orange/40 bg-orange/5 text-orange cursor-pointer active:scale-95 transition-all duration-150">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      onChange={handleEditStepPhotoChange}
                                      className="hidden"
                                    />
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                                    <span className="text-[10px] font-semibold">Add</span>
                                  </label>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-navy/70 mb-1">Comments</label>
                              <textarea
                                value={editStepComments}
                                onChange={e => setEditStepComments(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 resize-none"
                                placeholder="Describe this step..."
                              />
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={cancelEditStep}
                                className="flex-1 bg-light-gray text-navy font-semibold py-3 rounded-xl border border-navy/10 active:scale-95 transition-all duration-150 min-h-[48px]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEditStep(s)}
                                disabled={savingEditStep}
                                className="flex-1 bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100"
                              >
                                {savingEditStep ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Saving...
                                  </span>
                                ) : 'Save'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={s.id}
                          onClick={() => startEditStep(s)}
                          className="bg-white rounded-xl px-4 py-3 shadow-sm cursor-pointer active:scale-[0.98] transition-all duration-150 overflow-hidden"
                        >
                          <div className="flex flex-col gap-3">
                            {getStepPhotoUrls(s).length > 0 && (
                              <div className="flex gap-2 overflow-x-auto pb-1 max-w-full" onClick={e => e.stopPropagation()}>
                                {getStepPhotoUrls(s).map((url, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    className="shrink-0 cursor-pointer active:scale-95 transition-transform"
                                    onClick={() => openGallery(getStepPhotoUrls(s), i)}
                                    aria-label={`Enlarge step ${s.step_number} photo ${i + 1}`}
                                  >
                                    {isVideoUrl(url) ? (
                                      <video src={url} playsInline className="w-24 h-24 rounded-lg object-cover bg-light-gray" />
                                    ) : (
                                      <img src={url} alt={`Step ${s.step_number} photo ${i + 1}`} className="w-24 h-24 rounded-lg object-cover bg-light-gray" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="shrink-0 text-xs font-bold text-orange">Step {s.step_number}</span>
                                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => handleReorderStep(s.id, -1)}
                                      disabled={reorderingStepId !== null || sameId(repair.repair_steps[0]?.id, s.id)}
                                      className="w-9 h-9 rounded-lg bg-light-gray text-navy/60 border border-navy/10 disabled:opacity-30"
                                      aria-label="Move step up"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleReorderStep(s.id, 1)}
                                      disabled={reorderingStepId !== null || sameId(repair.repair_steps[repair.repair_steps.length - 1]?.id, s.id)}
                                      className="w-9 h-9 rounded-lg bg-light-gray text-navy/60 border border-navy/10 disabled:opacity-30"
                                      aria-label="Move step down"
                                    >
                                      ↓
                                    </button>
                                  </div>
                                </div>
                                <div className="text-sm font-semibold text-navy break-words">
                                  {s.step_name} — {s.created_by || 'Unknown'}, {new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                {s.comments && <div className="text-sm text-navy/70 whitespace-pre-wrap break-words mt-0.5">{s.comments}</div>}
                                <div className="text-xs text-navy/30 mt-1">Tap photo to enlarge • Tap card to edit / move photos</div>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteStep(s.id) }}
                                className="shrink-0 text-red-400 hover:text-red-600 min-w-[48px] min-h-[48px] flex items-center justify-center"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Completed section */}
              {repair.status === 'completed' && (
                <div>
                  <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2 px-1">Completed</div>
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200 overflow-hidden">
                    <div className="flex items-start gap-3 min-w-0">
                      {completionPhotos.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto max-w-full min-w-0">
                          {completionPhotos.map((url, i) => (
                            <div
                              key={i}
                              onClick={() => openGallery(completionPhotos, i)}
                              className="shrink-0 cursor-pointer w-20"
                            >
                              {isVideoUrl(url) ? (
                                <video src={url} playsInline className="w-20 h-20 rounded-lg object-cover" />
                              ) : (
                                <img src={url} alt={`Completion photo ${i + 1}`} className="w-20 h-20 rounded-lg object-cover" />
                              )}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openMovePhoto({ type: 'completion', url }) }}
                                className="mt-1 w-full min-h-[36px] rounded-lg bg-navy text-white text-xs font-semibold"
                              >
                                Move
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {repair.completion_comments && (
                          <div className="text-sm text-navy whitespace-pre-wrap break-words mb-2">{repair.completion_comments}</div>
                        )}
                        <div className="text-xs text-navy/40 break-words">
                          Completed {repair.completed_at ? new Date(repair.completed_at).toLocaleDateString() : ''} by {repair.completed_by}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions for in_progress */}
              {repair.status === 'in_progress' && (
                <>
                  {/* Add Step inline form */}
                  {showAddStep ? (
                    <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-orange/20 overflow-hidden">
                      <div className="text-sm font-semibold text-navy mb-3">Add Step {(repair.repair_steps?.length || 0) + 1}</div>

                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="block text-xs font-medium text-navy/70 mb-1">Step Name</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {SUGGESTED_STEPS.map(name => (
                              <button
                                key={name}
                                onClick={() => { setSelectedStepName(name === selectedStepName ? '' : name); if (name !== 'Other') setCustomStepName('') }}
                                className={`rounded-xl text-sm font-semibold min-h-[48px] px-2 py-2 transition-all whitespace-normal break-words leading-tight ${
                                  selectedStepName === name
                                    ? 'bg-orange text-white'
                                    : 'bg-light-gray text-navy border border-navy/10'
                                }`}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                          {selectedStepName === 'Other' && (
                            <input
                              type="text"
                              value={customStepName}
                              onChange={e => setCustomStepName(e.target.value)}
                              className="w-full mt-2 px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                              placeholder="Enter step name..."
                              autoFocus
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-navy/70 mb-1">Photos</label>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {stepPhotoPreviews.map((url, i) => (
                              <div key={i} className="relative shrink-0">
                                <img src={url} alt={`Step photo ${i + 1}`} className="w-16 h-16 rounded-lg object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeStepPhoto(i)}
                                  className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-red-500 text-white text-sm flex items-center justify-center"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {stepPhotos.length < MAX_STEP_PHOTOS && (
                              <label className="shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-lg border-2 border-dashed border-orange/40 bg-orange/5 text-orange cursor-pointer active:scale-95 transition-all duration-150">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={handleStepPhotoChange}
                                  className="hidden"
                                />
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                                <span className="text-[10px] font-semibold">Add</span>
                              </label>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-navy/70 mb-1">Comments</label>
                          <textarea
                            value={stepComments}
                            onChange={e => setStepComments(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 resize-none"
                            placeholder="Describe this step..."
                          />
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setShowAddStep(false)
                              setStepPhotos([])
                              setStepPhotoPreviews([])
                              setStepComments('')
                              setSelectedStepName('')
                              setCustomStepName('')
                            }}
                            className="flex-1 bg-light-gray text-navy font-semibold py-3 rounded-xl border border-navy/10 active:scale-95 transition-all duration-150 min-h-[48px]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleAddStep}
                            disabled={savingStep || !selectedStepName || (selectedStepName === 'Other' && !customStepName.trim())}
                            className="flex-1 bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100"
                          >
                            {savingStep ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                              </span>
                            ) : 'Save Step'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddStep(true)}
                      className="w-full bg-white text-orange font-semibold py-3 rounded-xl border-2 border-orange/20 active:scale-95 transition-all duration-150 min-h-[48px]"
                    >
                      + Add Step
                    </button>
                  )}

                  {/* Complete repair */}
                  {showComplete ? (
                    <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-green-200 overflow-hidden">
                      <div className="text-sm font-semibold text-navy mb-3">Complete Repair</div>

                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="block text-xs font-medium text-navy/70 mb-1">Upload Completion Photos</label>
                          <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                            {completePhotoPreviews.map((url, i) => (
                              <div key={i} className="relative shrink-0">
                                <img src={url} alt={`Completion photo ${i + 1}`} className="w-16 h-16 rounded-lg object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeCompletePhoto(i)}
                                  className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-red-500 text-white text-sm flex items-center justify-center"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {completePhotos.length < MAX_STEP_PHOTOS && (
                              <label className="shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-lg border-2 border-dashed border-orange/40 bg-orange/5 text-orange cursor-pointer active:scale-95 transition-all duration-150">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={handleCompletePhotoChange}
                                  className="hidden"
                                />
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                                <span className="text-[10px] font-semibold">Add</span>
                              </label>
                            )}
                          </div>
                        </div>

                        {existingCompletionPhotoOptions.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-navy/70 mb-1">Or Use Existing Photo</label>
                            <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                              {existingCompletionPhotoOptions.map(option => {
                                const selected = selectedCompletionPhotoUrls.includes(option.url)
                                return (
                                  <button
                                    key={option.url}
                                    type="button"
                                    onClick={() => toggleExistingCompletionPhoto(option.url)}
                                    className={`relative shrink-0 w-24 text-left rounded-xl border-2 p-1 ${
                                      selected ? 'border-green-600 bg-green-50' : 'border-navy/10 bg-light-gray'
                                    }`}
                                  >
                                    <img src={option.url} alt={option.label} className="w-full h-16 rounded-lg object-cover" />
                                    <div className="mt-1 text-[10px] font-semibold text-navy leading-tight break-words">
                                      {option.label}
                                    </div>
                                    {selected && (
                                      <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
                                        ✓
                                      </div>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                            {selectedCompletionPhotoUrls.length > 0 && (
                              <div className="text-xs text-green-700 font-medium">
                                {selectedCompletionPhotoUrls.length} existing photo{selectedCompletionPhotoUrls.length === 1 ? '' : 's'} selected for completion.
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-medium text-navy/70 mb-1">Completion Comments</label>
                          <textarea
                            value={completeComments}
                            onChange={e => setCompleteComments(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 resize-none"
                            placeholder="Describe the completed repair..."
                          />
                        </div>

                        {displaySeconds > 0 && (
                          <div className="text-xs text-navy/50 text-center">
                            Total time: {formatDuration(displaySeconds)}
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setShowComplete(false)
                              setCompletePhotos([])
                              setCompletePhotoPreviews([])
                              setSelectedCompletionPhotoUrls([])
                              setCompleteComments('')
                            }}
                            className="flex-1 bg-light-gray text-navy font-semibold py-3 rounded-xl border border-navy/10 active:scale-95 transition-all duration-150 min-h-[48px]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleComplete}
                            disabled={savingComplete || (completePhotos.length === 0 && selectedCompletionPhotoUrls.length === 0)}
                            className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100"
                          >
                            {savingComplete ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                              </span>
                            ) : 'Mark Complete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowComplete(true)}
                      className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px]"
                    >
                      Repair Complete
                    </button>
                  )}
                </>
              )}

              {/* Reopen */}
              {repair.status === 'completed' && (
                <button
                  onClick={handleReopen}
                  disabled={reopening}
                  className="w-full bg-white text-orange font-semibold py-3 rounded-xl border-2 border-orange/20 active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40 disabled:active:scale-100"
                >
                  {reopening ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                      Reopening...
                    </span>
                  ) : 'Reopen Repair'}
                </button>
              )}

              {/* Delete Repair */}
              <button
                onClick={handleDeleteRepair}
                className="w-full text-red-500 font-medium py-3 text-sm mt-2"
              >
                🗑️ Delete Repair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Move photo modal */}
      {movingPhoto && repair && (
        <div className="fixed inset-0 z-40 bg-navy/60 flex items-end sm:items-center justify-center px-4 py-6">
          <div className="w-full max-w-[480px] bg-white rounded-xl shadow-xl p-4 overflow-hidden">
            <div className="flex items-start gap-3 mb-4">
              {isVideoUrl(movingPhoto.url) ? (
                <video src={movingPhoto.url} playsInline controls className="w-20 h-20 rounded-lg object-cover bg-light-gray" />
              ) : (
                <button
                  type="button"
                  onClick={() => openGallery([movingPhoto.url], 0)}
                  className="shrink-0 active:scale-95 transition-transform"
                  aria-label="Enlarge photo before moving"
                >
                  <img src={movingPhoto.url} alt="Photo to move" className="w-20 h-20 rounded-lg object-cover bg-light-gray" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-navy mb-1">Move Photo</div>
                <div className="text-xs text-navy/50">
                  Tap the photo to enlarge it, then choose where it belongs. The file stays stored; only its report section changes.
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-navy/70 mb-1">Move To</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMoveTarget('initial')}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold ${moveTarget === 'initial' ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'}`}
                  >
                    Initial Defect
                  </button>
                  {(repair.status === 'completed' || completionPhotos.length > 0) && (
                    <button
                      type="button"
                      onClick={() => setMoveTarget('completion')}
                      className={`min-h-[44px] rounded-xl text-sm font-semibold ${moveTarget === 'completion' ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'}`}
                    >
                      Completion
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const selectedStepStillExists = selectableMoveTargetSteps.some(step =>
                        moveTargetStepIds.some(stepId => sameId(step.id, stepId))
                      )
                      const firstOtherStep = selectableMoveTargetSteps[0]
                      setMoveTarget('existing_step')
                      if (!selectedStepStillExists && firstOtherStep) {
                        setMoveTargetStepIds([String(firstOtherStep.id)])
                      }
                    }}
                    disabled={selectableMoveTargetSteps.length === 0}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold disabled:opacity-30 ${moveTarget === 'existing_step' ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'}`}
                  >
                    Existing Step
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveTarget('new_step')}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold ${moveTarget === 'new_step' ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'}`}
                  >
                    New Step
                  </button>
                </div>
              </div>

              {moveTarget === 'existing_step' && (
                <div>
                  <label className="block text-xs font-medium text-navy/70 mb-1">Target Step(s)</label>
                  <div className="grid grid-cols-1 gap-2">
                    {selectableMoveTargetSteps.map(step => (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => toggleMoveTargetStep(String(step.id))}
                        className={`min-h-[44px] rounded-xl px-4 py-3 text-left text-sm font-semibold border ${
                          moveTargetStepIds.some(stepId => sameId(step.id, stepId))
                            ? 'bg-orange text-white border-orange'
                            : 'bg-light-gray text-navy border-navy/10'
                        }`}
                      >
                        Step {step.step_number}: {step.step_name || 'Step'}
                      </button>
                    ))}
                  </div>
                  {moveTargetStepIds.length > 1 && (
                    <div className="mt-2 text-xs text-navy/50">
                      This photo will be added to all selected steps.
                    </div>
                  )}
                  <label className="mt-3 flex items-center gap-3 min-h-[44px] text-sm text-navy">
                    <input
                      type="checkbox"
                      checked={copyPhotoToTargets}
                      onChange={e => setCopyPhotoToTargets(e.target.checked)}
                      className="w-5 h-5 accent-orange"
                    />
                    <span>Keep photo in current section as well</span>
                  </label>
                </div>
              )}

              {moveTarget === 'new_step' && (
                <div>
                  <label className="block text-xs font-medium text-navy/70 mb-1">New Step</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SUGGESTED_STEPS.map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setMoveNewStepName(name === moveNewStepName ? '' : name)
                          if (name !== 'Other') setMoveCustomStepName('')
                        }}
                        className={`rounded-xl text-sm font-semibold min-h-[48px] px-2 py-2 transition-all whitespace-normal break-words leading-tight ${
                          moveNewStepName === name
                            ? 'bg-orange text-white'
                            : 'bg-light-gray text-navy border border-navy/10'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  {moveNewStepName === 'Other' && (
                    <input
                      type="text"
                      value={moveCustomStepName}
                      onChange={e => setMoveCustomStepName(e.target.value)}
                      className="w-full mt-2 px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                      placeholder="Enter step name..."
                      autoFocus
                    />
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setMovingPhoto(null)}
                  className="flex-1 bg-light-gray text-navy font-semibold py-3 rounded-xl border border-navy/10 min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMovePhoto}
                  disabled={savingPhotoMove || (moveTarget === 'existing_step' && moveTargetStepIds.length === 0) || (moveTarget === 'new_step' && (!moveNewStepName || (moveNewStepName === 'Other' && !moveCustomStepName.trim())))}
                  className="flex-1 bg-orange text-white font-semibold py-3 rounded-xl min-h-[48px] disabled:opacity-40"
                >
                  {savingPhotoMove ? 'Saving...' : (moveTarget === 'existing_step' && copyPhotoToTargets ? 'Copy Photo' : 'Move Photo')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox overlay with gallery navigation */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
          >
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          {lightboxPhotos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); const prev = (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length; setLightboxIndex(prev); setLightboxUrl(lightboxPhotos[prev]) }}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10 min-w-[48px] min-h-[48px] flex items-center justify-center"
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); const next = (lightboxIndex + 1) % lightboxPhotos.length; setLightboxIndex(next); setLightboxUrl(lightboxPhotos[next]) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10 min-w-[48px] min-h-[48px] flex items-center justify-center"
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7"/></svg>
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
                {lightboxIndex + 1} / {lightboxPhotos.length}
              </div>
            </>
          )}
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain p-4"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
