'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser } from '@/lib/types'

const GHS_PICTOGRAMS = [
  { id: 'flame', label: '🔥 Flammable', code: 'GHS02' },
  { id: 'oxidizer', label: '⭕ Oxidizer', code: 'GHS03' },
  { id: 'gas', label: '🫧 Gas Under Pressure', code: 'GHS04' },
  { id: 'corrosion', label: '⚗️ Corrosive', code: 'GHS05' },
  { id: 'skull', label: '☠️ Acute Toxicity', code: 'GHS06' },
  { id: 'exclamation', label: '⚠️ Irritant/Harmful', code: 'GHS07' },
  { id: 'health', label: '🫁 Health Hazard', code: 'GHS08' },
  { id: 'environment', label: '🐟 Environmental', code: 'GHS09' },
  { id: 'explosive', label: '💥 Explosive', code: 'GHS01' },
]

interface FormData {
  productName: string
  manufacturer: string
  manufacturerContact: string
  sdsDate: string
  hazardClassification: string
  ghsPictograms: string[]
  signalWord: string
  maxQuantity: string
  storageLocation: string
  comments: string
  sdsUrl: string
  tdsUrl: string
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input {...props} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-orange-500 focus:outline-none" />
    </div>
  )
}

function TextArea({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <textarea {...props} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-orange-500 focus:outline-none min-h-[80px]" />
    </div>
  )
}

export default function NewSDSPage() {
  const router = useRouter()
  const [user, setUser] = useState<RatUser | null>(null)
  const [saved, setSaved] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [form, setForm] = useState<FormData>({
    productName: '', manufacturer: '', manufacturerContact: '', sdsDate: '',
    hazardClassification: '', ghsPictograms: [], signalWord: '',
    maxQuantity: '', storageLocation: '', comments: '', sdsUrl: '', tdsUrl: ''
  })

  useEffect(() => {
    const u = getStoredUser()
    setUser(u)
    if (!u && typeof window !== 'undefined') window.location.href = '/login'
  }, [])

  const update = (key: keyof FormData, value: string | string[]) => {
    setForm(f => ({ ...f, [key]: value }))
  }

  const togglePictogram = (id: string) => {
    setForm(f => ({
      ...f,
      ghsPictograms: f.ghsPictograms.includes(id)
        ? f.ghsPictograms.filter(p => p !== id)
        : [...f.ghsPictograms, id]
    }))
  }

  const handleAISearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const resp = await fetch('/api/search-sds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      })
      if (resp.ok) {
        const data = await resp.json()
        if (data.product) {
          setForm(f => ({
            ...f,
            productName: data.product.productName || f.productName,
            manufacturer: data.product.manufacturer || f.manufacturer,
            manufacturerContact: data.product.manufacturerContact || f.manufacturerContact,
            hazardClassification: data.product.hazardClassification || f.hazardClassification,
            signalWord: data.product.signalWord || f.signalWord,
            sdsUrl: data.product.sdsUrl || f.sdsUrl,
            comments: data.product.comments || f.comments,
          }))
        }
      }
    } catch (err) {
      console.error('AI search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleSave = () => {
    if (!form.productName) {
      alert('Please enter a product name')
      return
    }
    const product = {
      id: `sds_${Date.now()}`,
      ...form,
      createdBy: user?.name || '',
      createdAt: new Date().toISOString(),
    }
    const existing = JSON.parse(localStorage.getItem('sdsProducts') || '[]')
    existing.push(product)
    localStorage.setItem('sdsProducts', JSON.stringify(existing))
    setSaved(true)
    setTimeout(() => router.push('/sds'), 1500)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#f5f5f0] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#1a1f36] text-white px-4 py-3 flex items-center gap-3">
        <Link href="/sds" className="text-white/70 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-lg font-bold">Add Product</h1>
      </div>

      {saved && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-medium">
          ✅ Product saved!
        </div>
      )}

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* AI Search */}
        <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-orange-200">
          <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">🤖 AI Product Search</div>
          <div className="text-xs text-gray-500 mb-2">Type a product name and AI will find the SDS details for you</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Sika Boom Expanding Foam"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAISearch()}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none"
            />
            <button
              onClick={handleAISearch}
              disabled={searching || !searchQuery.trim()}
              className="bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all whitespace-nowrap"
            >
              {searching ? '🔍...' : '🔍 Search'}
            </button>
          </div>
        </div>

        {/* Product Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Product Information</div>
          <Input label="Product Name *" placeholder="e.g. Sika Boom Expanding Foam" value={form.productName} onChange={e => update('productName', e.target.value)} />
          <Input label="Manufacturer" placeholder="e.g. Sika Australia Pty Ltd" value={form.manufacturer} onChange={e => update('manufacturer', e.target.value)} />
          <Input label="Manufacturer Contact" placeholder="Phone or address" value={form.manufacturerContact} onChange={e => update('manufacturerContact', e.target.value)} />
          <Input label="SDS Issue Date" type="date" value={form.sdsDate} onChange={e => update('sdsDate', e.target.value)} />
        </div>

        {/* Hazard Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hazard Classification</div>
          <Input label="Hazard Classification" placeholder="e.g. FLAMMABLE LIQUIDS - Category 2" value={form.hazardClassification} onChange={e => update('hazardClassification', e.target.value)} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Signal Word</label>
            <div className="flex gap-2">
              {['Danger', 'Warning', 'None'].map(w => (
                <button key={w} type="button" onClick={() => update('signalWord', w)}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    form.signalWord === w 
                      ? w === 'Danger' ? 'bg-red-500 text-white' : w === 'Warning' ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">GHS Pictograms</label>
            <div className="grid grid-cols-3 gap-2">
              {GHS_PICTOGRAMS.map(p => (
                <button key={p.id} type="button" onClick={() => togglePictogram(p.id)}
                  className={`px-2 py-2 rounded-lg text-xs text-center transition-colors ${
                    form.ghsPictograms.includes(p.id) ? 'bg-red-50 text-red-700 border-2 border-red-300' : 'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Storage */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Storage & Quantity</div>
          <Input label="Max Quantity on Site" placeholder="e.g. 10 Litres" value={form.maxQuantity} onChange={e => update('maxQuantity', e.target.value)} />
          <Input label="Storage Location" placeholder="e.g. Flammable goods cabinet" value={form.storageLocation} onChange={e => update('storageLocation', e.target.value)} />
        </div>

        {/* Documents */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documents</div>
          <Input label="SDS Document URL" placeholder="Link to SDS PDF" value={form.sdsUrl} onChange={e => update('sdsUrl', e.target.value)} />
          <Input label="TDS Document URL" placeholder="Link to TDS PDF" value={form.tdsUrl} onChange={e => update('tdsUrl', e.target.value)} />
        </div>

        {/* Comments */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <TextArea label="Comments" placeholder="Additional notes..." value={form.comments} onChange={e => update('comments', e.target.value)} />
        </div>

        {/* Save */}
        <button onClick={handleSave}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-xl text-lg transition-colors active:scale-[0.98]">
          💾 Save Product
        </button>
      </div>
    </div>
  )
}
