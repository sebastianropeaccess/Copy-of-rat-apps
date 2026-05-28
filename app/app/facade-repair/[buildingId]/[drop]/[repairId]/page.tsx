'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser, FacadeRepair, FacadeRepairStep } from '@/lib/types'

type RepairWithSteps = FacadeRepair & { facade_repair_steps: FacadeRepairStep[] }

export default function RepairDetailPage() {
  const params = useParams()
  const buildingId = params.buildingId as string
  const drop = decodeURIComponent(params.drop as string)
  const repairId = params.repairId as string

  const [user, setUser] = useState<RatUser | null>(null)
  const [repair, setRepair] = useState<RepairWithSteps | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadingStep, setUploadingStep] = useState<number | null>(null)
  const [stepComments, setStepComments] = useState<Record<number, string>>({})
  const [showComplete, setShowComplete] = useState(false)
  const [completionComments, setCompletionComments] = useState('')
  const [completing, setCompleting] = useState(false)
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const completeFileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)
    loadRepair()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repairId])

  async function loadRepair() {
    const { data } = await getSupabase()
      .from('facade_repairs')
      .select('*, facade_repair_steps(*)')
      .eq('id', repairId)
      .single()

    if (data) {
      const r = data as RepairWithSteps
      r.facade_repair_steps.sort((a, b) => a.step_number - b.step_number)
      setRepair(r)
    }
    setLoading(false)
  }

  async function handleStepPhoto(stepNumber: number, file: File) {
    if (!user || !repair) return
    setUploadingStep(stepNumber)
    const supabase = getSupabase()

    try {
      const filePath = `${repairId}/step_${stepNumber}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('facade-repairs')
        .upload(filePath, file, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('facade-repairs')
        .getPublicUrl(filePath)

      const step = repair.facade_repair_steps.find(s => s.step_number === stepNumber)
      if (!step) return

      const { error: updateError } = await supabase
        .from('facade_repair_steps')
        .update({
          photo_url: urlData.publicUrl,
          comments: stepComments[stepNumber] || null,
          completed: true,
          completed_at: new Date().toISOString(),
          completed_by: user.name,
        })
        .eq('id', step.id)

      if (updateError) throw updateError

      // Update repair status to in_progress if not_started
      if (repair.status === 'not_started') {
        await supabase
          .from('facade_repairs')
          .update({ status: 'in_progress' })
          .eq('id', repairId)
      }

      await loadRepair()
    } catch (err) {
      console.error('Step upload failed:', err)
      alert('Failed to upload photo. Please try again.')
    } finally {
      setUploadingStep(null)
    }
  }

  async function handleSkipStep(stepNumber: number) {
    if (!user || !repair) return
    setUploadingStep(stepNumber)
    const supabase = getSupabase()

    try {
      const step = repair.facade_repair_steps.find(s => s.step_number === stepNumber)
      if (!step) return

      const { error: updateError } = await supabase
        .from('facade_repair_steps')
        .update({
          comments: stepComments[stepNumber] || 'Skipped',
          completed: true,
          completed_at: new Date().toISOString(),
          completed_by: user.name,
        })
        .eq('id', step.id)

      if (updateError) throw updateError

      if (repair.status === 'not_started') {
        await supabase
          .from('facade_repairs')
          .update({ status: 'in_progress' })
          .eq('id', repairId)
      }

      await loadRepair()
    } catch (err) {
      console.error('Skip failed:', err)
      alert('Failed to skip step. Please try again.')
    } finally {
      setUploadingStep(null)
    }
  }

  async function handleComplete(file: File) {
    if (!user || !repair) return
    setCompleting(true)
    const supabase = getSupabase()

    try {
      const filePath = `${repairId}/complete.jpg`
      const { error: uploadError } = await supabase.storage
        .from('facade-repairs')
        .upload(filePath, file, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('facade-repairs')
        .getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('facade_repairs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.name,
          completion_photo_url: urlData.publicUrl,
          completion_comments: completionComments || null,
        })
        .eq('id', repairId)

      if (updateError) throw updateError

      await loadRepair()
      setShowComplete(false)
    } catch (err) {
      console.error('Completion failed:', err)
      alert('Failed to complete repair. Please try again.')
    } finally {
      setCompleting(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href={`/facade-repair/${buildingId}/${drop}`} className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">{repair?.repair_number || 'Repair'}</div>
            <div className="text-xs text-white/50">{repair?.defect_type}{repair?.sub_type ? ` — ${repair.sub_type}` : ''}</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 pb-28">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !repair ? (
            <div className="text-center py-12 text-navy/40">Repair not found</div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Initial defect photo */}
              {repair.initial_photo_url && (
                <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                  <img
                    src={repair.initial_photo_url}
                    alt="Initial defect"
                    className="w-full h-48 object-cover"
                  />
                  <div className="px-4 py-2 text-xs text-navy/50">Initial defect photo</div>
                </div>
              )}

              {/* Steps */}
              <div className="flex flex-col gap-3">
                {repair.facade_repair_steps.map(step => (
                  <div key={step.id} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        step.completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-navy/50'
                      }`}>
                        {step.completed ? (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                        ) : (
                          step.step_number
                        )}
                      </div>
                      <div className="font-semibold text-sm text-navy">{step.step_name}</div>
                    </div>

                    {step.completed ? (
                      <div className="ml-10">
                        {step.photo_url && (
                          <img
                            src={step.photo_url}
                            alt={step.step_name}
                            className="w-full h-32 object-cover rounded-lg mb-2"
                          />
                        )}
                        {step.comments && (
                          <div className="text-xs text-navy/50 mb-1">{step.comments}</div>
                        )}
                        {step.completed_by && (
                          <div className="text-xs text-navy/30">{step.completed_by}</div>
                        )}
                      </div>
                    ) : (
                      <div className="ml-10 flex flex-col gap-2">
                        <textarea
                          placeholder="Comments (optional)"
                          value={stepComments[step.step_number] || ''}
                          onChange={e => setStepComments(prev => ({ ...prev, [step.step_number]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-navy resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <input
                            ref={el => { fileInputRefs.current[step.step_number] = el }}
                            type="file"
                            accept="image/*"
                           
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0]
                              if (file) handleStepPhoto(step.step_number, file)
                            }}
                          />
                          <button
                            onClick={() => fileInputRefs.current[step.step_number]?.click()}
                            disabled={uploadingStep === step.step_number}
                            className="flex-1 bg-orange text-white text-xs font-semibold py-2.5 rounded-lg min-h-[48px] disabled:opacity-50 active:scale-95 transition-all duration-150 flex items-center justify-center gap-1"
                          >
                            {uploadingStep === step.step_number ? (
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
                                Add Photo
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleSkipStep(step.step_number)}
                            disabled={uploadingStep === step.step_number}
                            className="px-4 bg-gray-200 text-navy/60 text-xs font-semibold py-2.5 rounded-lg min-h-[48px] disabled:opacity-50 active:scale-95 transition-all duration-150"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Completion photo if already completed */}
              {repair.status === 'completed' && repair.completion_photo_url && (
                <div className="bg-green-50 border border-green-200 rounded-xl overflow-hidden">
                  <img
                    src={repair.completion_photo_url}
                    alt="Completion"
                    className="w-full h-48 object-cover"
                  />
                  <div className="px-4 py-2">
                    <div className="text-xs font-semibold text-green-700">Repair Complete</div>
                    {repair.completion_comments && (
                      <div className="text-xs text-green-600 mt-1">{repair.completion_comments}</div>
                    )}
                    {repair.completed_by && (
                      <div className="text-xs text-green-500 mt-1">By {repair.completed_by}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Complete button */}
        {repair && repair.status !== 'completed' && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-gray/90 backdrop-blur-sm">
            <div className="max-w-[480px] mx-auto">
              {!showComplete ? (
                <button
                  onClick={() => setShowComplete(true)}
                  className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl min-h-[48px] active:scale-95 transition-all duration-150"
                >
                  Repair Complete
                </button>
              ) : (
                <div className="bg-white rounded-xl p-4 shadow-lg flex flex-col gap-3">
                  <div className="text-sm font-semibold text-navy">Complete Repair</div>
                  <textarea
                    placeholder="Completion comments (optional)"
                    value={completionComments}
                    onChange={e => setCompletionComments(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-navy resize-none"
                    rows={2}
                  />
                  <input
                    ref={completeFileRef}
                    type="file"
                    accept="image/*"
                   
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleComplete(file)
                    }}
                  />
                  <button
                    onClick={() => completeFileRef.current?.click()}
                    disabled={completing}
                    className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl min-h-[48px] disabled:opacity-50 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
                  >
                    {completing ? (
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
                        Take Final Photo
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowComplete(false)}
                    className="w-full text-navy/50 text-sm py-2"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
