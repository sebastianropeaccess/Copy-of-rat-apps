'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser, TeamMember } from '@/lib/types'

const PRESET_GAUGES = ['Visual', 'GAU01', 'GAU02', 'GAU03', 'GAU04', 'GAU05', 'GAU06', 'GAU07', 'GAU08', 'GAU09', 'GAU10', 'GAU11', 'GAU12', 'GAU13', 'GAU14', 'GAU15']

export default function HssNewPage() {
  const [user, setUser] = useState<RatUser | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [buildingName, setBuildingName] = useState('')
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedInspectors, setSelectedInspectors] = useState<string[]>([])
  const [selectedGauges, setSelectedGauges] = useState<string[]>([])
  const [customGauge, setCustomGauge] = useState('')
  const [planFiles, setPlanFiles] = useState<File[]>([])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)

    async function load() {
      const { data } = await getSupabase()
        .from('team_members')
        .select('*')
        .eq('active', true)

      if (data) setTeamMembers(data as TeamMember[])
      setLoading(false)
    }
    load()
  }, [])

  function toggleInspector(name: string) {
    setSelectedInspectors(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  function toggleGauge(gauge: string) {
    setSelectedGauges(prev =>
      prev.includes(gauge) ? prev.filter(g => g !== gauge) : [...prev, gauge]
    )
  }

  function addCustomGauge() {
    const trimmed = customGauge.trim()
    if (trimmed && !selectedGauges.includes(trimmed)) {
      setSelectedGauges(prev => [...prev, trimmed])
    }
    setCustomGauge('')
  }

  function handlePlanFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 4)
    setPlanFiles(files)
  }

  async function handleSave() {
    if (!user || !buildingName.trim()) return
    setSaving(true)

    try {
      const { data: inspection, error } = await getSupabase()
        .from('hss_inspections')
        .insert({
          building_name: buildingName.trim(),
          inspection_date: inspectionDate,
          inspectors: selectedInspectors,
          gauges_used: selectedGauges,
          anchor_plan_urls: [],
          inspection_complete: false,
          created_by: user.name,
        })
        .select()
        .single()

      if (error || !inspection) {
        alert('Failed to create inspection')
        setSaving(false)
        return
      }

      const uploadedUrls: string[] = []
      for (let i = 0; i < planFiles.length; i++) {
        const file = planFiles[i]
        const path = `${inspection.id}/plan_${i + 1}.jpg`
        const { error: uploadError } = await getSupabase()
          .storage
          .from('hss-inspections')
          .upload(path, file, { upsert: true })

        if (!uploadError) {
          const { data: urlData } = getSupabase()
            .storage
            .from('hss-inspections')
            .getPublicUrl(path)
          uploadedUrls.push(urlData.publicUrl)
        }
      }

      if (uploadedUrls.length > 0) {
        await getSupabase()
          .from('hss_inspections')
          .update({ anchor_plan_urls: uploadedUrls })
          .eq('id', inspection.id)
      }

      window.location.href = `/hss/${inspection.id}`
    } catch {
      alert('Failed to create inspection')
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href="/hss" className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="text-lg font-bold text-white">New HSS Inspection</div>
        </div>

        <div className="flex-1 px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Building Name */}
              <div>
                <label className="block text-sm font-medium text-navy/70 mb-1">Building Name *</label>
                <input
                  type="text"
                  value={buildingName}
                  onChange={e => setBuildingName(e.target.value)}
                  className="w-full border border-navy/20 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange/50 min-h-[48px]"
                  placeholder="Enter building name"
                />
              </div>

              {/* Inspection Date */}
              <div>
                <label className="block text-sm font-medium text-navy/70 mb-1">Inspection Date</label>
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={e => setInspectionDate(e.target.value)}
                  className="w-full border border-navy/20 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange/50 min-h-[48px]"
                />
              </div>

              {/* Inspectors */}
              <div>
                <label className="block text-sm font-medium text-navy/70 mb-2">Inspectors</label>
                <div className="flex flex-col gap-2">
                  {teamMembers.map(member => (
                    <label key={member.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 min-h-[48px] cursor-pointer active:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedInspectors.includes(member.name)}
                        onChange={() => toggleInspector(member.name)}
                        className="w-5 h-5 accent-orange"
                      />
                      <span className="text-sm text-navy">{member.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Gauges Used */}
              <div>
                <label className="block text-sm font-medium text-navy/70 mb-2">Gauges Used</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_GAUGES.map(gauge => (
                    <button
                      key={gauge}
                      onClick={() => toggleGauge(gauge)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium min-h-[40px] transition-all duration-150 active:scale-95 ${
                        selectedGauges.includes(gauge)
                          ? 'bg-orange text-white'
                          : 'bg-white text-navy/60 border border-navy/20'
                      }`}
                    >
                      {gauge}
                    </button>
                  ))}
                  {/* Show custom gauges as active chips */}
                  {selectedGauges
                    .filter(g => !PRESET_GAUGES.includes(g))
                    .map(gauge => (
                      <button
                        key={gauge}
                        onClick={() => toggleGauge(gauge)}
                        className="px-3 py-2 rounded-lg text-xs font-medium min-h-[40px] bg-orange text-white active:scale-95 transition-all duration-150"
                      >
                        {gauge}
                      </button>
                    ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={customGauge}
                    onChange={e => setCustomGauge(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomGauge() } }}
                    className="flex-1 border border-navy/20 rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange/50 min-h-[44px]"
                    placeholder="Add custom gauge"
                  />
                  <button
                    onClick={addCustomGauge}
                    className="bg-navy text-white text-sm font-medium px-4 rounded-xl active:scale-95 transition-all duration-150 min-h-[44px]"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Anchor Plans */}
              <div>
                <label className="block text-sm font-medium text-navy/70 mb-1">Anchor Plans (up to 4 images)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePlanFiles}
                  className="w-full text-sm text-navy/60 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-orange/10 file:text-orange cursor-pointer min-h-[48px]"
                />
                {planFiles.length > 0 && (
                  <div className="text-xs text-navy/50 mt-1">{planFiles.length} file{planFiles.length !== 1 ? 's' : ''} selected</div>
                )}
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={saving || !buildingName.trim()}
                className="w-full bg-orange text-white font-semibold py-3 rounded-xl active:scale-95 transition-all duration-150 min-h-[48px] disabled:opacity-50 disabled:active:scale-100 mt-2"
              >
                {saving ? 'Creating...' : 'Create Inspection'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
