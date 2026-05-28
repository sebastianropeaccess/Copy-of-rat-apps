'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import { getSupabase } from '@/lib/supabase'
import type { PurchaseReceipt } from '@/lib/types'

type Tab = 'All' | 'Pending' | 'Approved'

function getReceiptDate(receipt: PurchaseReceipt) {
  return receipt.date_of_purchase || receipt.date || ''
}

function getReceiptTotal(receipt: PurchaseReceipt) {
  return Number(receipt.total_inc_gst ?? receipt.total ?? 0)
}

function isJobLinked(receipt: PurchaseReceipt) {
  return receipt.is_for_job ?? receipt.job_linked ?? false
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('All')
  const user = typeof window === 'undefined' ? null : getStoredUser()

  useEffect(() => {
    if (!user) { window.location.href = '/login'; return }

    let cancelled = false

    async function syncReceipts() {
      const supabase = getSupabase()
      const { data } = await supabase
        .from('purchase_receipts')
        .select('*')
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

  const filtered = tab === 'All'
    ? receipts
    : receipts.filter((r) => r.status.toLowerCase() === tab.toLowerCase())

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const tabs: Tab[] = ['All', 'Pending', 'Approved']

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/60 active:text-white transition-all">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <div className="text-xl font-bold text-white">Purchase Receipts</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white px-4 py-2 flex gap-2 border-b border-gray-100">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all min-h-[40px]
                ${tab === t ? 'bg-navy text-white' : 'bg-gray-100 text-navy/60 active:bg-gray-200'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 px-4 py-4 pb-24 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-navy/40 py-12">No receipts found</div>
          ) : (
            filtered.map((r) => (
              <Link key={r.id} href={`/receipts/${r.id}`}>
                <div className="bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-navy">{r.store_name}</div>
                      <div className="text-sm text-navy/50 mt-0.5">
                        {new Date(getReceiptDate(r)).toLocaleDateString('en-AU')}
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
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Add Button */}
        <div className="fixed bottom-0 left-0 right-0 z-10">
          <div className="max-w-[480px] mx-auto px-4 pb-6">
            <Link href="/receipts/new">
              <button className="w-full bg-orange text-white font-semibold py-4 rounded-xl text-center
                active:scale-95 active:bg-orange-light transition-all shadow-lg min-h-[48px]">
                + Add Receipt
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
