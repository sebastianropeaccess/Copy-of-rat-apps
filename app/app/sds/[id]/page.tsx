'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoredUser } from '../../../lib/helpers'

interface Product {
  id: string
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
  createdBy: string
  createdAt: string
}

export default function SDSDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)

  useEffect(() => {
    const u = getStoredUser()
    if (!u && typeof window !== 'undefined') { window.location.href = '/login'; return }
    const products = JSON.parse(localStorage.getItem('sdsProducts') || '[]')
    const found = products.find((p: Product) => p.id === params.id)
    setProduct(found || null)
  }, [params.id])

  const handleDelete = () => {
    if (!confirm('Delete this product?')) return
    const products = JSON.parse(localStorage.getItem('sdsProducts') || '[]')
    const updated = products.filter((p: Product) => p.id !== params.id)
    localStorage.setItem('sdsProducts', JSON.stringify(updated))
    router.push('/sds')
  }

  if (!product) return (
    <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f5f5f0] pb-24">
      <div className="sticky top-0 z-10 bg-[#1a1f36] text-white px-4 py-3 flex items-center gap-3">
        <Link href="/sds" className="text-white/70 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-lg font-bold flex-1 truncate">{product.productName}</h1>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {/* Product Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-bold text-[#1a1f36]">{product.productName}</h2>
          <p className="text-sm text-gray-500 mt-1">{product.manufacturer}</p>
          {product.manufacturerContact && <p className="text-xs text-gray-400 mt-0.5">{product.manufacturerContact}</p>}
          {product.sdsDate && <p className="text-xs text-gray-400 mt-1">SDS Date: {product.sdsDate}</p>}
        </div>

        {/* Hazard */}
        {(product.hazardClassification || product.signalWord) && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hazard Information</div>
            {product.signalWord && product.signalWord !== 'None' && (
              <div className={`inline-block px-3 py-1 rounded-lg text-sm font-bold mb-2 ${
                product.signalWord === 'Danger' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {product.signalWord}
              </div>
            )}
            {product.hazardClassification && (
              <p className="text-sm text-gray-700">{product.hazardClassification}</p>
            )}
            {product.ghsPictograms && product.ghsPictograms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {product.ghsPictograms.map(p => (
                  <span key={p} className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs">{p}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Storage */}
        {(product.maxQuantity || product.storageLocation) && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Storage</div>
            {product.maxQuantity && <p className="text-sm text-gray-700">Max Quantity: {product.maxQuantity}</p>}
            {product.storageLocation && <p className="text-sm text-gray-700 mt-1">Location: {product.storageLocation}</p>}
          </div>
        )}

        {/* Documents */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Documents</div>
          <div className="space-y-2">
            {product.sdsUrl ? (
              <a href={product.sdsUrl} target="_blank" rel="noopener noreferrer" className="block bg-blue-50 text-blue-700 px-4 py-3 rounded-xl text-sm font-medium active:scale-[0.98] transition-all">
                📄 View SDS Document →
              </a>
            ) : (
              <div className="text-sm text-gray-400">No SDS document linked</div>
            )}
            {product.tdsUrl ? (
              <a href={product.tdsUrl} target="_blank" rel="noopener noreferrer" className="block bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-medium active:scale-[0.98] transition-all">
                📄 View TDS Document →
              </a>
            ) : (
              <div className="text-sm text-gray-400">No TDS document linked</div>
            )}
          </div>
        </div>

        {/* Comments */}
        {product.comments && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Comments</div>
            <p className="text-sm text-gray-700">{product.comments}</p>
          </div>
        )}

        {/* Meta */}
        <div className="text-xs text-gray-400 text-center pt-2">
          Added by {product.createdBy} on {new Date(product.createdAt).toLocaleDateString()}
        </div>

        {/* Delete */}
        <button onClick={handleDelete} className="w-full text-red-500 text-sm font-medium py-3">
          Delete Product
        </button>
      </div>
    </div>
  )
}
