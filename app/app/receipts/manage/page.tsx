'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredUser } from '../../../lib/helpers'
import { getSupabase } from '../../../lib/supabase'
import type { PurchaseReceipt } from '../../../lib/types'

function getReceiptDate(receipt: PurchaseReceipt) {
  return receipt.date_of_purchase || receipt.date || ''
}

function getReceiptTotal(receipt: PurchaseReceipt) {
  return Number(receipt.total_inc_gst ?? receipt.total ?? 0)
}

function getSubmitter(receipt: PurchaseReceipt) {
  return receipt.submitted_by || receipt.team_member_name || 'Unknown'
}

function isJobLinked(receipt: PurchaseReceipt) {
  return receipt.is_for_job ?? receipt.job_linked ?? false
}

export default function ManageReceiptsPage() {
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const user = typeof window === 'undefined' ? null : getStoredUser()

  async function loadData() {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('purchase_receipts')
      .select('*')
      .order('status', { ascending: true })
      .order('date_of_purchase', { ascending: false })
    setReceipts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!user) { window.location.href = '/login'; return }
    if (!user.can_view_all_data) { window.location.href = '/receipts'; return }

    let cancelled = false

    async function syncReceipts() {
      const supabase = getSupabase()
      const { data } = await supabase
        .from('purchase_receipts')
        .select('*')
        .order('status', { ascending: true })
        .order('date_of_purchase', { ascending: false })
      if (cancelled) return
      setReceipts(data || [])
      setLoading(false)
    }

    void syncReceipts()
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleAction(id: string, action: 'approved' | 'rejected') {
    if (!user) return
    const supabase = getSupabase()
    await supabase
      .from('purchase_receipts')
      .update({ status: action, approved_by: user.name, approved_at: new Date().toISOString() })
      .eq('id', id)
    loadData()
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const pending = receipts.filter((r) => r.status === 'pending')
  const rest = receipts.filter((r) => r.status !== 'pending')

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/receipts" className="text-white/60 active:text-white transition-all">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="text-xl font-bold text-white">Manage Receipts</div>
        </div>

        <div className="flex-1 px-4 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-navy/50 mb-2 uppercase tracking-wide">
                    Pending ({pending.length})
                  </div>
                  <div className="space-y-3">
                    {pending.map((r) => (
                      <ReceiptCard key={r.id} receipt={r} onAction={handleAction} />
                    ))}
                  </div>
                </div>
              )}
              {rest.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-navy/50 mb-2 mt-6 uppercase tracking-wide">
                    Processed ({rest.length})
                  </div>
                  <div className="space-y-3">
                    {rest.map((r) => (
                      <ReceiptCard key={r.id} receipt={r} onAction={handleAction} />
                    ))}
                  </div>
                </div>
              )}
              {receipts.length === 0 && (
                <div className="text-center text-navy/40 py-12">No receipts to manage</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ReceiptCard({
  receipt: r,
  onAction,
}: {
  receipt: PurchaseReceipt
  onAction: (id: string, action: 'approved' | 'rejected') => void
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <Link href={`/receipts/${r.id}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-navy">{r.store_name}</div>
            <div className="text-sm text-navy/50 mt-0.5">
              {new Date(getReceiptDate(r)).toLocaleDateString('en-AU')} &middot; {getSubmitter(r)}
            </div>
            {isJobLinked(r) && r.job_name && (
              <div className="text-xs text-navy/40 mt-1">Job: {r.job_name}</div>
            )}
          </div>
          <div className="text-right">
            <div className="font-bold text-navy">${getReceiptTotal(r).toFixed(2)}</div>
            <span
              className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                r.status === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : r.status === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
            </span>
          </div>
        </div>
      </Link>
      {r.status === 'pending' && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => onAction(r.id, 'approved')}
            className="flex-1 py-2.5 rounded-lg bg-green-500 text-white font-medium text-sm
              active:scale-95 transition-all min-h-[48px]"
          >
            Approve
          </button>
          <button
            onClick={() => onAction(r.id, 'rejected')}
            className="flex-1 py-2.5 rounded-lg bg-red-500 text-white font-medium text-sm
              active:scale-95 transition-all min-h-[48px]"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
