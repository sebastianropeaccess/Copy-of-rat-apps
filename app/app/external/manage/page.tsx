'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser, ExternalUser, RepairBuilding } from '@/lib/types'

type ExternalRole = 'view_only' | 'allocate' | 'full'
type ExternalViewLevel = 'summary' | 'detailed'

interface ExternalFormState {
  name: string
  email: string
  company: string
  role: ExternalRole
  view_level: ExternalViewLevel
  building_ids: number[]
  can_download_reports: boolean
  authorised: boolean
  password: string
}

const emptyForm: ExternalFormState = {
  name: '',
  email: '',
  company: '',
  role: 'view_only',
  view_level: 'summary',
  building_ids: [],
  can_download_reports: false,
  authorised: true,
  password: '',
}

function generatePassword() {
  const parts = [
    'RAT',
    String(Math.floor(1000 + Math.random() * 9000)),
    ['Access', 'Report', 'Facade', 'Safety'][Math.floor(Math.random() * 4)],
    ['!', '#', '?'][Math.floor(Math.random() * 3)],
  ]
  return parts.join('')
}

export default function ManageExternalUsersPage() {
  const [user] = useState<RatUser | null>(() => getStoredUser())
  const [extUsers, setExtUsers] = useState<ExternalUser[]>([])
  const [buildings, setBuildings] = useState<RepairBuilding[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [form, setForm] = useState<ExternalFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | number | null>(null)
  const [notice, setNotice] = useState('')

  const canManage = user?.can_manage_settings === true || user?.can_view_all_data === true || user?.role === 'admin'

  const loadData = useCallback(async () => {
    setLoading(true)
    const [usersResponse, { data: blds }] = await Promise.all([
      fetch('/api/external-users', { cache: 'no-store' }),
      getSupabase().from('repair_buildings').select('*').order('name'),
    ])

    const usersJson = await usersResponse.json()
    if (!usersResponse.ok) {
      alert(usersJson.error || 'Failed to load external users.')
      setExtUsers([])
    } else {
      setExtUsers(usersJson.users || [])
    }
    setBuildings((blds || []) as RepairBuilding[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) { window.location.href = '/login'; return }
    if (!canManage) { window.location.href = '/'; return }
    queueMicrotask(() => {
      void loadData()
    })
  }, [canManage, loadData, user])

  function resetForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setNotice('')
  }

  function updateField<K extends keyof ExternalFormState>(key: K, value: ExternalFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function startCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, password: generatePassword() })
    setShowForm(true)
    setNotice('')
  }

  function startEdit(eu: ExternalUser) {
    setEditingId(eu.id)
    setForm({
      name: eu.name || '',
      email: eu.email || '',
      company: eu.company || '',
      role: eu.role || 'view_only',
      view_level: eu.view_level || 'summary',
      building_ids: (eu.building_ids || []).map(Number),
      can_download_reports: eu.can_download_reports === true,
      authorised: eu.authorised !== false && eu.auth_status !== 'blocked',
      password: '',
    })
    setShowForm(true)
    setNotice('')
  }

  function toggleBuilding(id: number) {
    setForm((prev) => ({
      ...prev,
      building_ids: prev.building_ids.includes(id)
        ? prev.building_ids.filter((buildingId) => buildingId !== id)
        : [...prev.building_ids, id],
    }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim() || !form.company.trim() || saving) return
    if (!editingId && form.password.trim().length < 8) {
      alert('Set a password of at least 8 characters.')
      return
    }

    setSaving(true)
    setNotice('')

    try {
      const response = await fetch('/api/external-users', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          ...form,
          email: form.email.trim().toLowerCase(),
          name: form.name.trim(),
          company: form.company.trim(),
          password: form.password.trim() || undefined,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        alert(json.error || 'Failed to save external user.')
        setSaving(false)
        return
      }

      const passwordMessage = form.password.trim()
        ? ` Password set to: ${form.password.trim()}`
        : ''
      setNotice(`${editingId ? 'Updated' : 'Created'} ${form.name.trim()}.${passwordMessage}`)
      resetForm()
      await loadData()
    } catch {
      alert('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(eu: ExternalUser) {
    if (!confirm(`Delete external user "${eu.name}" and remove their login access?`)) return
    setDeleting(eu.id)

    try {
      const response = await fetch('/api/external-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eu.id, email: eu.email }),
      })
      const json = await response.json()
      if (!response.ok) {
        alert(json.error || 'Failed to delete user.')
        return
      }
      setExtUsers((prev) => prev.filter((item) => item.id !== eu.id))
    } catch {
      alert('Failed to delete user.')
    } finally {
      setDeleting(null)
    }
  }

  async function quickAuthorise(eu: ExternalUser, authorised: boolean) {
    setSaving(true)
    const password = eu.auth_status === 'missing_auth' && authorised ? generatePassword() : ''

    try {
      const response = await fetch('/api/external-users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: eu.id,
          name: eu.name,
          email: eu.email,
          company: eu.company,
          role: eu.role,
          view_level: eu.view_level,
          building_ids: eu.building_ids || [],
          can_download_reports: eu.can_download_reports,
          authorised,
          password: password || undefined,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        alert(json.error || 'Failed to update authorisation.')
        return
      }
      if (password) setNotice(`${eu.name} is authorised. Password set to: ${password}`)
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  if (!user || !canManage) return null

  const roleLabel = (role: string) => {
    if (role === 'view_only') return 'View Only'
    if (role === 'allocate') return 'Allocate'
    return 'Full'
  }

  const roleBadgeColor = (role: string) => {
    if (role === 'view_only') return 'bg-gray-100 text-gray-600'
    if (role === 'allocate') return 'bg-blue-100 text-blue-700'
    return 'bg-green-100 text-green-700'
  }

  const statusLabel = (eu: ExternalUser) => {
    if (eu.auth_status === 'missing_auth') return 'Needs Password'
    if (eu.auth_status === 'blocked' || eu.authorised === false) return 'Blocked'
    return 'Authorised'
  }

  const statusClass = (eu: ExternalUser) => {
    if (eu.auth_status === 'missing_auth') return 'bg-amber-100 text-amber-700'
    if (eu.auth_status === 'blocked' || eu.authorised === false) return 'bg-red-100 text-red-700'
    return 'bg-green-100 text-green-700'
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[560px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/" className="min-w-[48px] min-h-[48px] flex items-center justify-center text-white active:scale-95 transition-transform -ml-2">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-white">External Users</div>
            <div className="text-xs text-white/50">{extUsers.length} user{extUsers.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4">
          {notice && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {notice}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {!showForm && (
                <button
                  onClick={startCreate}
                  className="w-full bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] mb-4"
                >
                  + Add External User
                </button>
              )}

              {showForm && (
                <div className="bg-white rounded-xl p-4 shadow-sm mb-4 border-2 border-orange/20">
                  <div className="text-sm font-semibold text-navy mb-3">{editingId ? 'Edit External User' : 'Add External User'}</div>

                  <div className="flex flex-col gap-3">
                    <TextInput label="Name" value={form.name} onChange={(value) => updateField('name', value)} placeholder="Full name" />
                    <TextInput label="Email" value={form.email} onChange={(value) => updateField('email', value)} placeholder="email@company.com" type="email" />
                    <TextInput label="Company" value={form.company} onChange={(value) => updateField('company', value)} placeholder="Company name" />

                    <div>
                      <label className="block text-xs font-medium text-navy/60 mb-1">Password {editingId ? '(leave blank to keep current)' : ''}</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={form.password}
                          onChange={(event) => updateField('password', event.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
                          placeholder={editingId ? 'New password optional' : 'Set password'}
                        />
                        <button
                          type="button"
                          onClick={() => updateField('password', generatePassword())}
                          className="px-3 rounded-xl bg-navy text-white text-xs font-semibold min-h-[48px] active:scale-95"
                        >
                          Generate
                        </button>
                      </div>
                    </div>

                    <Toggle
                      label="Authorised to log in"
                      enabled={form.authorised}
                      onChange={() => updateField('authorised', !form.authorised)}
                    />

                    <div>
                      <label className="block text-xs font-medium text-navy/60 mb-1">Role</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['view_only', 'allocate', 'full'] as const).map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => updateField('role', role)}
                            className={`rounded-xl text-sm font-semibold min-h-[48px] px-3 py-2 transition-all ${
                              form.role === role ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                            }`}
                          >
                            {roleLabel(role)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-navy/60 mb-1">View Level</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['summary', 'detailed'] as const).map((viewLevel) => (
                          <button
                            key={viewLevel}
                            type="button"
                            onClick={() => updateField('view_level', viewLevel)}
                            className={`rounded-xl text-sm font-semibold min-h-[48px] px-3 py-2 transition-all capitalize ${
                              form.view_level === viewLevel ? 'bg-orange text-white' : 'bg-light-gray text-navy border border-navy/10'
                            }`}
                          >
                            {viewLevel}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-navy/60 mb-1">Assigned Buildings</label>
                      <div className="flex flex-wrap gap-1.5">
                        {buildings.map((building) => (
                          <button
                            type="button"
                            key={building.id}
                            onClick={() => toggleBuilding(Number(building.id))}
                            className={`rounded-xl text-sm font-semibold min-h-[40px] px-3 py-1.5 transition-all ${
                              form.building_ids.includes(Number(building.id))
                                ? 'bg-orange text-white'
                                : 'bg-light-gray text-navy border border-navy/10'
                            }`}
                          >
                            {building.name}
                          </button>
                        ))}
                        {buildings.length === 0 && <div className="text-xs text-navy/40">No buildings found</div>}
                      </div>
                    </div>

                    <Toggle
                      label="Can download reports"
                      enabled={form.can_download_reports}
                      onChange={() => updateField('can_download_reports', !form.can_download_reports)}
                    />

                    <div className="flex gap-3">
                      <button
                        onClick={resetForm}
                        className="flex-1 bg-light-gray text-navy font-semibold py-3 rounded-xl border border-navy/10 active:scale-95 transition-all duration-150 min-h-[48px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || !form.name.trim() || !form.email.trim() || !form.company.trim() || (!editingId && form.password.trim().length < 8)}
                        className="flex-1 bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-40"
                      >
                        {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {extUsers.map((eu) => (
                  <div key={eu.id} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-1 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-navy text-sm">{eu.name}</div>
                        <div className="text-xs text-navy/50 break-all">{eu.email}</div>
                        <div className="text-xs text-navy/40">{eu.company}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadgeColor(eu.role)}`}>{roleLabel(eu.role)}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusClass(eu)}`}>{statusLabel(eu)}</span>
                      </div>
                    </div>
                    <div className="text-xs text-navy/40 mt-1">
                      {eu.building_ids?.length || 0} building{(eu.building_ids?.length || 0) !== 1 ? 's' : ''}
                      {eu.last_sign_in_at ? ` · Last login ${new Date(eu.last_sign_in_at).toLocaleDateString('en-AU')}` : ''}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button onClick={() => startEdit(eu)} className="bg-light-gray text-navy font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all min-h-[44px]">
                        Edit
                      </button>
                      <button
                        onClick={() => quickAuthorise(eu, !(eu.authorised !== false && eu.auth_status === 'authorised'))}
                        disabled={saving}
                        className="bg-orange/10 text-orange font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all min-h-[44px] disabled:opacity-40"
                      >
                        {eu.authorised !== false && eu.auth_status === 'authorised' ? 'Block' : 'Authorise'}
                      </button>
                      <button
                        onClick={() => {
                          startEdit(eu)
                          setForm((prev) => ({ ...prev, password: generatePassword(), authorised: true }))
                        }}
                        className="bg-blue-50 text-blue-700 font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all min-h-[44px]"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => handleDelete(eu)}
                        disabled={deleting === eu.id}
                        className="bg-red-50 text-red-600 font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all disabled:opacity-40 min-h-[44px]"
                      >
                        {deleting === eu.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
                {extUsers.length === 0 && !showForm && <div className="text-center py-8 text-navy/40">No external users yet</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-navy/60 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-navy/10 bg-light-gray text-navy text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-orange/40"
        placeholder={placeholder}
      />
    </div>
  )
}

function Toggle({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        onClick={onChange}
        className={`w-12 h-7 rounded-full transition-all relative cursor-pointer ${enabled ? 'bg-orange' : 'bg-navy/20'}`}
      >
        <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${enabled ? 'left-5.5' : 'left-0.5'}`} />
      </button>
      <span className="text-sm text-navy">{label}</span>
    </label>
  )
}
