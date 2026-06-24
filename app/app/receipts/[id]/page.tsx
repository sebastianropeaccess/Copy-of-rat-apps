'use client'

import { use, useEffect, useState } from 'react'
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

function getCardAccount(receipt: PurchaseReceipt) {
  return receipt.card_or_account || receipt.card_account
}

function isJobLinked(receipt: PurchaseReceipt) {
  return receipt.is_for_job ?? receipt.job_linked ?? false
}

function getPurchaseType(receipt: PurchaseReceipt) {
  return receipt.purchase_type || receipt.purchase_category
}

function getSubCategory(receipt: PurchaseReceipt) {
  return receipt.sub_category || receipt.purchase_for
}

function getPhotoUrl(receipt: PurchaseReceipt) {
  return receipt.receipt_photo_url || receipt.photo_url
}

function getSubmitter(receipt: PurchaseReceipt) {
  return receipt.submitted_by || receipt.team_member_name
}

export default function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [receipt, setReceipt] = useState<PurchaseReceipt | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }

    const supabase = getSupabase()
    supabase
      .from('purchase_receipts')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setReceipt(data)
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

  if (!receipt) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="text-navy/40">Receipt not found</div>
      </div>
    )
  }

  const rows: { label: string; value: string | null }[] = [
    { label: 'Date', value: new Date(getReceiptDate(receipt)).toLocaleDateString('en-AU') },
    { label: 'Payment Type', value: receipt.payment_type },
    { label: 'Card / Account', value: getCardAccount(receipt) },
    { label: 'Total (inc. GST)', value: `$${getReceiptTotal(receipt).toFixed(2)}` },
    { label: 'Store', value: receipt.store_name },
    { label: 'Purchase Type', value: getPurchaseType(receipt) },
    { label: 'Sub Category', value: getSubCategory(receipt) },
    ...(receipt.vehicle ? [{ label: 'Vehicle', value: receipt.vehicle }] : []),
    ...(isJobLinked(receipt)
      ? [
          { label: 'Job Name', value: receipt.job_name },
          { label: 'Job Number', value: receipt.job_number },
        ]
      : []),
    { label: 'Details', value: receipt.details },
    { label: 'Submitted By', value: getSubmitter(receipt) },
    { label: 'Status', value: receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1) },
    ...(receipt.approved_by ? [{ label: 'Approved By', value: receipt.approved_by }] : []),
  ]

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
          <div className="text-xl font-bold text-white">Receipt Detail</div>
        </div>

        <div className="flex-1 px-4 py-4 space-y-4">
          {/* Photo */}
          {getPhotoUrl(receipt) && (
            <div className="rounded-xl overflow-hidden shadow-sm">
              <img
                src={getPhotoUrl(receipt) || ''}
                alt="Receipt"
                className="w-full max-h-64 object-cover"
              />
            </div>
          )}

          {/* Details */}
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
            {rows.map(
              (row) =>
                row.value && (
                  <div key={row.label}>
                    <div className="text-xs text-navy/40 uppercase tracking-wide">{row.label}</div>
                    <div className="text-navy font-medium mt-0.5">{row.value}</div>
                  </div>
                )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
