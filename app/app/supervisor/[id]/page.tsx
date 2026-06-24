'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredUser } from '../../../lib/helpers'
import { getSupabase } from '../../../lib/supabase'
import type { SupervisorReview } from '../../../lib/types'

export default function SupervisorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [review, setReview] = useState<SupervisorReview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }

    const supabase = getSupabase()
    supabase
      .from('supervisor_reviews')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setReview(data)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!review) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="text-navy/40">Review not found</div>
      </div>
    )
  }

  const sectionClass = 'bg-white rounded-xl p-4 shadow-sm space-y-3'
  const sectionTitle = 'font-semibold text-navy text-base mb-2'
  const fieldLabel = 'text-xs text-navy/40 uppercase tracking-wide'
  const fieldValue = 'text-navy font-medium mt-0.5'

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/supervisor" className="text-white/60 active:text-white transition-all">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="text-xl font-bold text-white">Review Detail</div>
        </div>

        <div className="flex-1 px-4 py-4 space-y-4">
          {/* Job Details */}
          <div className={sectionClass}>
            <div className={sectionTitle}>Job Details</div>
            <div>
              <div className={fieldLabel}>Supervisor</div>
              <div className={fieldValue}>{review.supervisor}</div>
            </div>
            <div>
              <div className={fieldLabel}>Job Name</div>
              <div className={fieldValue}>{review.job_name}</div>
            </div>
            <div>
              <div className={fieldLabel}>Service Types</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {review.service_types.map((t) => (
                  <span key={t} className="text-xs bg-orange/10 text-orange px-2 py-1 rounded-full font-medium">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className={fieldLabel}>Date</div>
              <div className={fieldValue}>{new Date(review.job_date).toLocaleDateString('en-AU')}</div>
            </div>
            <div className="flex gap-4">
              <div>
                <div className={fieldLabel}>Start</div>
                <div className={fieldValue}>{review.start_time}</div>
              </div>
              <div>
                <div className={fieldLabel}>Finish</div>
                <div className={fieldValue}>{review.finish_time}</div>
              </div>
            </div>
          </div>

          {/* Team */}
          <div className={sectionClass}>
            <div className={sectionTitle}>Team Members</div>
            <div className="flex flex-wrap gap-1">
              {review.team_members.map((m) => (
                <span key={m} className="text-xs bg-navy/10 text-navy px-2 py-1 rounded-full font-medium">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Incidents */}
          <div className={sectionClass}>
            <div className={sectionTitle}>Incidents</div>
            <div className={fieldValue}>
              {review.incidents ? (
                <span className="text-red-600">Yes</span>
              ) : (
                <span className="text-green-600">No</span>
              )}
            </div>
            {review.incidents && (
              <>
                <div>
                  <div className={fieldLabel}>Report Filed</div>
                  <div className={fieldValue}>{review.incident_report_filed ? 'Yes' : 'No'}</div>
                </div>
                {review.incident_details && (
                  <div>
                    <div className={fieldLabel}>Details</div>
                    <div className={fieldValue}>{review.incident_details}</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Delays */}
          <div className={sectionClass}>
            <div className={sectionTitle}>Delays</div>
            <div className={fieldValue}>
              {review.delays ? (
                <span className="text-yellow-600">Yes</span>
              ) : (
                <span className="text-green-600">No</span>
              )}
            </div>
            {review.delays && review.delay_details && (
              <div>
                <div className={fieldLabel}>Details</div>
                <div className={fieldValue}>{review.delay_details}</div>
              </div>
            )}
          </div>

          {/* Walk-around */}
          <div className={sectionClass}>
            <div className={sectionTitle}>Walk-around</div>
            <div className={fieldValue}>
              {review.walkaround_completed ? (
                <span className="text-green-600">Completed</span>
              ) : (
                <span className="text-red-600">Not Completed</span>
              )}
            </div>
            {review.walkaround_completed && review.walkaround_by.length > 0 && (
              <div>
                <div className={fieldLabel}>By</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {review.walkaround_by.map((m) => (
                    <span key={m} className="text-xs bg-navy/10 text-navy px-2 py-1 rounded-full font-medium">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Job Notes */}
          <div className={sectionClass}>
            <div className={sectionTitle}>Job Notes</div>
            <div className={fieldValue}>
              {review.job_notes_sufficient ? (
                <span className="text-green-600">Sufficient</span>
              ) : (
                <span className="text-red-600">Insufficient</span>
              )}
            </div>
            {!review.job_notes_sufficient && review.job_notes_feedback && (
              <div>
                <div className={fieldLabel}>Feedback</div>
                <div className={fieldValue}>{review.job_notes_feedback}</div>
              </div>
            )}
          </div>

          {/* Client */}
          <div className={sectionClass}>
            <div className={sectionTitle}>Client</div>
            <div>
              <div className={fieldLabel}>Client Aware</div>
              <div className={fieldValue}>{review.client_aware ? 'Yes' : 'No'}</div>
            </div>
            {review.client_aware && review.client_details && (
              <div>
                <div className={fieldLabel}>Details</div>
                <div className={fieldValue}>{review.client_details}</div>
              </div>
            )}
            <div>
              <div className={fieldLabel}>Client Conversation</div>
              <div className={fieldValue}>{review.client_conversation ? 'Yes' : 'No'}</div>
            </div>
            {review.client_conversation && review.client_conversation_details && (
              <div>
                <div className={fieldLabel}>Conversation Details</div>
                <div className={fieldValue}>{review.client_conversation_details}</div>
              </div>
            )}
            {review.client_conversation && (
              <div>
                <div className={fieldLabel}>Ops Notified</div>
                <div className={fieldValue}>{review.ops_notified ? 'Yes' : 'No'}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
