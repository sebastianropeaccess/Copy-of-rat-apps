'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser } from '@/lib/types'

interface DriveFile {
  id: string
  fileName: string
  productName: string
  manufacturer: string
  type: 'SDS' | 'TDS' | 'Unknown'
  size: string
  viewUrl: string
  downloadUrl: string
  driveUrl: string
  createdTime: string
}

type FilterTab = 'All' | 'SDS' | 'TDS'

export default function SDSRegisterPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [checked, setChecked] = useState(false)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<FilterTab>('All')

  useEffect(() => {
    const u = getStoredUser()
    setUser(u)
    setChecked(true)
    if (u) loadFiles()
  }, [])

  async function loadFiles() {
    setLoading(true)
    try {
      const resp = await fetch('/api/sds-drive')
      if (resp.ok) {
        const data = await resp.json()
        setFiles(data.files || [])
      }
    } catch (err) {
      console.error('Failed to load SDS files:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = files.filter(f => {
    const matchesSearch = !search ||
      f.productName.toLowerCase().includes(search.toLowerCase()) ||
      f.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
      f.fileName.toLowerCase().includes(search.toLowerCase())
    const matchesTab = tab === 'All' ||
      (tab === 'SDS' && f.type === 'SDS') ||
      (tab === 'TDS' && f.type === 'TDS')
    return matchesSearch && matchesTab
  })

  // Group by manufacturer
  const grouped: Record<string, DriveFile[]> = {}
  filtered.forEach(f => {
    const key = f.manufacturer || 'Other'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(f)
  })
  const sortedGroups = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))

  function generateRegister() {
    const sdsFiles = files.filter(f => f.type === 'SDS')
    const rows = [
      'Chemical Name,Manufacturer,Document Type,File Name,Drive Link',
      ...sdsFiles.map(f =>
        `"${f.productName}","${f.manufacturer}","${f.type}","${f.fileName}","${f.driveUrl}"`
      )
    ].join('\n')
    const blob = new Blob([rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Chemical_Register_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (!checked) return null
  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return null
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Header */}
      <div className="bg-[#1a1f36] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/70 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-lg font-bold">SDS / TDS Register</h1>
        </div>
        <Link href="/sds/new" className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold active:scale-95 transition-all">
          + Add
        </Link>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-[#1a1f36]">{files.length}</div>
          <div className="text-xs text-gray-500">Total Docs</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-blue-500">{files.filter(f => f.type === 'SDS').length}</div>
          <div className="text-xs text-gray-500">SDS</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-green-500">{files.filter(f => f.type === 'TDS').length}</div>
          <div className="text-xs text-gray-500">TDS</div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <input
          type="text"
          placeholder="Search products, manufacturers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-orange-500 focus:outline-none shadow-sm"
        />
      </div>

      {/* Tabs */}
      <div className="px-4 pb-3 flex gap-2">
        {(['All', 'SDS', 'TDS'] as FilterTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === t ? 'bg-[#1a1f36] text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}>
            {t} {t !== 'All' ? `(${files.filter(f => f.type === t).length})` : ''}
          </button>
        ))}
      </div>

      {/* File List */}
      <div className="px-4 space-y-4 pb-24">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-2xl mb-2">⏳</div>
            <div className="text-gray-500 text-sm">Loading documents from Drive...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🧪</div>
            <div className="text-gray-500 text-sm">{search ? 'No matching documents' : 'No documents found'}</div>
          </div>
        ) : (
          sortedGroups.map(([manufacturer, docs]) => (
            <div key={manufacturer}>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
                {manufacturer} ({docs.length})
              </div>
              <div className="space-y-1.5">
                {docs.map(doc => (
                  <a key={doc.id} href={doc.driveUrl} target="_blank" rel="noopener noreferrer"
                    className="block bg-white rounded-xl p-3 shadow-sm active:scale-[0.98] transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[#1a1f36] text-sm truncate">{doc.productName}</div>
                        <div className="text-xs text-gray-400 truncate">{doc.fileName}</div>
                      </div>
                      <div className="ml-2 flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          doc.type === 'SDS' ? 'bg-blue-50 text-blue-600' :
                          doc.type === 'TDS' ? 'bg-green-50 text-green-600' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {doc.type}
                        </span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Generate Register Button */}
      {files.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
          <button onClick={generateRegister}
            className="flex-1 bg-[#1a1f36] text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all">
            📋 Export Chemical Register
          </button>
          <button onClick={loadFiles}
            className="bg-gray-100 text-gray-600 font-semibold py-3 px-4 rounded-xl text-sm active:scale-[0.98] transition-all">
            🔄
          </button>
        </div>
      )}
    </div>
  )
}
