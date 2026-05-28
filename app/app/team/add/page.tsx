'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser } from '@/lib/types'

const ROLES = ['admin', 'manager', 'technician']

const APP_KEYS = [
  { key: 'dashboard', label: 'Ops Dashboard' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'drop-tracker', label: 'Drop Tracker' },
  { key: 'candidates', label: 'Candidates' },
  { key: 'timesheets', label: 'Timesheets' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'supervisor', label: 'Supervisor Review' },
  { key: 'toolbox-talk', label: 'Toolbox Talk' },
  { key: 'gear-registry', label: 'Gear Registry' },
  { key: 'leave-request', label: 'Leave Request' },
  { key: 'simple-repair', label: 'Simple Repair' },
  { key: 'facade-inspection', label: 'Facade Inspection' },
  { key: 'hss-inspection', label: 'HSS Inspection' },
  { key: 'facade-repair', label: 'Facade Repair' },
  { key: 'site_visit', label: 'Site Visit' },
  { key: 'team', label: 'Team' },
]

export default function AddMemberPage() {
  const [user] = useState<RatUser | null>(() => getStoredUser())
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [position, setPosition] = useState('')
  const [role, setRole] = useState('technician')
  const [pin, setPin] = useState('1234')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [accessApps, setAccessApps] = useState<string[]>([])
  const [canGenerateReports, setCanGenerateReports] = useState(false)
  const [canViewAllData, setCanViewAllData] = useState(false)
  const [canManageSettings, setCanManageSettings] = useState(false)
  const [canQuote, setCanQuote] = useState(false)

  useEffect(() => {
    if (!user) { window.location.href = '/login'; return }
    if (!user.can_manage_settings) { window.location.href = '/team'; return }
  }, [user])

  function toggleApp(key: string) {
    setAccessApps((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await getSupabase()
      .from('team_members')
      .insert({
        name: name.trim(),
        position: position.trim(),
        role,
        pin,
        phone: phone.trim() || null,
        email: email.trim() || null,
        active: true,
        can_access_apps: accessApps,
        can_generate_reports: canGenerateReports,
        can_view_all_data: canViewAllData,
        can_manage_settings: canManageSettings,
        can_quote: canQuote,
      })
    setSaving(false)
    window.location.href = '/team'
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-gray">
        <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/team" className="text-white/60 min-w-[48px] min-h-[48px] flex items-center justify-center -ml-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="text-xl font-bold text-white">Add Member</div>
            <div className="text-xs text-white/50">Create new team member</div>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 px-4 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-navy
                placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-orange/30 min-h-[48px]"
            />
          </div>

          {/* Position */}
          <div>
            <label className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-1 block">Position</label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Level 3 Technician"
              className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-navy
                placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-orange/30 min-h-[48px]"
            />
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-1 block">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-navy
                focus:outline-none focus:ring-2 focus:ring-orange/30 min-h-[48px]"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* PIN */}
          <div>
            <label className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-1 block">PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-navy
                focus:outline-none focus:ring-2 focus:ring-orange/30 min-h-[48px]"
            />
            <div className="text-xs text-navy/40 mt-1">Default: 1234</div>
          </div>

          <div>
            <label className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-1 block">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0400 000 000"
              className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-navy
                placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-orange/30 min-h-[48px]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-navy
                placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-orange/30 min-h-[48px]"
            />
          </div>

          {/* Permissions Section */}
          <div className="pt-2">
            <div className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-3">Permissions</div>

            {/* App Access Chips */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 mb-3">
              <div className="text-sm font-medium text-navy mb-3">App Access</div>
              <div className="flex flex-wrap gap-2">
                {APP_KEYS.map((app) => {
                  const selected = accessApps.includes(app.key)
                  return (
                    <button
                      key={app.key}
                      onClick={() => toggleApp(app.key)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all min-h-[32px]
                        active:scale-95
                        ${selected
                          ? 'bg-orange text-white'
                          : 'bg-gray-100 text-navy/50'
                        }`}
                    >
                      {app.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Permission Toggles */}
            <div className="space-y-0 bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-navy">Can generate reports</span>
                <button
                  onClick={() => setCanGenerateReports(!canGenerateReports)}
                  className={`w-12 h-7 rounded-full transition-colors duration-200 relative
                    ${canGenerateReports ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-1 transition-transform duration-200
                    ${canGenerateReports ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-navy">Can view all data</span>
                <button
                  onClick={() => setCanViewAllData(!canViewAllData)}
                  className={`w-12 h-7 rounded-full transition-colors duration-200 relative
                    ${canViewAllData ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-1 transition-transform duration-200
                    ${canViewAllData ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-navy">Can manage settings</span>
                <button
                  onClick={() => setCanManageSettings(!canManageSettings)}
                  className={`w-12 h-7 rounded-full transition-colors duration-200 relative
                    ${canManageSettings ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-1 transition-transform duration-200
                    ${canManageSettings ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-navy">Can quote site visits</span>
                <button
                  onClick={() => setCanQuote(!canQuote)}
                  className={`w-12 h-7 rounded-full transition-colors duration-200 relative
                    ${canQuote ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-1 transition-transform duration-200
                    ${canQuote ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Spacer for fixed save button */}
          <div className="h-20" />
        </div>

        {/* Save Button */}
        <div className="sticky bottom-0 px-4 py-4 bg-light-gray">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full bg-orange text-white font-semibold py-3 rounded-xl
              active:scale-95 active:bg-orange-light transition-all min-h-[48px]
              disabled:opacity-50 disabled:active:scale-100"
          >
            {saving ? 'Creating...' : 'Create Member'}
          </button>
        </div>
      </div>
    </div>
  )
}
