'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { getStoredUser } from '@/lib/helpers'
import type { RatUser } from '@/lib/types'

interface ReportRepair {
  id: number
  repairNumber: string | null
  drop: string
  floor: number | string
  defectType: string
  subType: string | null
  location: string | null
  dimensions: string | null
  quantity: number | null
  status: string
  urgency: string | null
  assignedContractor: string | null
  initialComments: string | null
  completionComments: string | null
  startedAt: string
  completedAt: string | null
  completedBy: string | null
  createdBy: string
  steps: Array<{ number: number; name: string | null; comments: string | null }>
  photos: Array<{ label: string; dataUri: string | null }>
}

interface ReportData {
  building: {
    id: number
    name: string
    dropCount: number
    dropLabelling: string
    floorCount: number
  }
  generated: string
  summary: {
    total: number
    completed: number
    inProgress: number
    byDefectType: Record<string, number>
    byDrop: Record<string, number>
    byUrgency: Record<string, number>
  }
  repairs: ReportRepair[]
}

type ReportType = 'summary' | 'detailed' | 'csv'

export default function ReportPage({ params }: { params: Promise<{ buildingId: string }> }) {
  const { buildingId } = use(params)
  const [user, setUser] = useState<RatUser | null>(null)
  const [reportType, setReportType] = useState<ReportType>('detailed')
  const [statusFilter, setStatusFilter] = useState('all')
  const [defectFilter, setDefectFilter] = useState('')
  const [dropFilter, setDropFilter] = useState('')
  const [includePhotos, setIncludePhotos] = useState(true)
  const [showStepTitles, setShowStepTitles] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [buildingName, setBuildingName] = useState('')

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { window.location.href = '/login'; return }
    setUser(stored)

    // Load building name
    fetch(`/api/repairs/report?buildingId=${buildingId}&format=json&photos=false`)
      .then(r => r.json())
      .then(d => {
        if (d.building) setBuildingName(d.building.name)
      })
      .catch(() => {})
  }, [buildingId])

  async function handleGenerate() {
    setGenerating(true)

    if (reportType === 'csv') {
      setProgress('Generating CSV...')
      const params = new URLSearchParams({
        buildingId,
        format: 'csv',
        status: statusFilter,
        defectType: defectFilter,
        drop: dropFilter,
      })
      
      try {
        const res = await fetch(`/api/repairs/report?${params}`)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = res.headers.get('content-disposition')?.split('filename="')[1]?.replace('"', '') || 'repairs.csv'
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        setProgress('Error generating CSV')
      }
      setGenerating(false)
      setProgress('')
      return
    }

    try {
      if (reportType === 'detailed') {
        setProgress('Generating compressed PDF on the server...')
        const params = new URLSearchParams({
          buildingId,
          status: statusFilter,
          defectType: defectFilter,
          drop: dropFilter,
          photos: includePhotos ? 'true' : 'false',
          showStepTitles: showStepTitles ? 'true' : 'false',
        })

        const res = await fetch(`/api/external-reports/repair-pdf?${params}`)
        if (!res.ok) throw new Error(`Failed to generate PDF (${res.status})`)

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = res.headers.get('content-disposition')?.split('filename="')[1]?.replace('"', '') || `${buildingName || 'Repair'}_Report_${new Date().toISOString().split('T')[0]}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        setProgress('')
        setGenerating(false)
        return
      }

      setProgress('Fetching repair data...')

      const params = new URLSearchParams({
        buildingId,
        format: 'json',
        status: statusFilter,
        defectType: defectFilter,
        drop: dropFilter,
        photos: 'false',
      })

      const res = await fetch(`/api/repairs/report?${params}`)
      if (!res.ok) throw new Error('Failed to fetch report data')
      const data: ReportData = await res.json()

      setProgress('Building PDF...')

      // Dynamic import jsPDF (client-side only)
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const pageW = 210
      const pageH = 297
      const margin = 15
      const contentW = pageW - margin * 2
      let y = margin

      const navy = [26, 32, 44]
      const orange = [255, 107, 53]
      const gray = [120, 130, 145]
      const lightGray = [240, 242, 245]

      function checkPage(needed: number) {
        if (y + needed > pageH - 20) {
          doc.addPage()
          y = margin
        }
      }

      // ===== COVER / HEADER =====
      doc.setFillColor(navy[0], navy[1], navy[2])
      doc.rect(0, 0, pageW, 50, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('Defect Repair Report', margin, 22)

      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.text(data.building.name, margin, 33)

      doc.setFontSize(9)
      doc.setTextColor(200, 210, 220)
      const genDate = new Date(data.generated).toLocaleDateString('en-AU', { dateStyle: 'long' })
      doc.text(`Generated: ${genDate}`, margin, 42)
      doc.text('Rope Access Technicians', pageW - margin, 42, { align: 'right' })

      y = 60

      // ===== SUMMARY SECTION =====
      doc.setTextColor(navy[0], navy[1], navy[2])
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Summary', margin, y)
      y += 8

      // KPI boxes
      const kpiBoxW = contentW / 3 - 3
      const kpis = [
        { label: 'Total Repairs', value: String(data.summary.total), color: navy },
        { label: 'Completed', value: String(data.summary.completed), color: [34, 197, 94] },
        { label: 'In Progress', value: String(data.summary.inProgress), color: orange },
      ]

      kpis.forEach((kpi, i) => {
        const x = margin + i * (kpiBoxW + 4.5)
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
        doc.roundedRect(x, y, kpiBoxW, 22, 3, 3, 'F')

        doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2])
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text(kpi.value, x + kpiBoxW / 2, y + 11, { align: 'center' })

        doc.setTextColor(gray[0], gray[1], gray[2])
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(kpi.label, x + kpiBoxW / 2, y + 18, { align: 'center' })
      })

      y += 30

      // Breakdown by defect type
      const defectEntries = Object.entries(data.summary.byDefectType).sort((a, b) => b[1] - a[1])
      if (defectEntries.length > 0) {
        doc.setTextColor(navy[0], navy[1], navy[2])
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('By Defect Type', margin, y)
        y += 5

        const barMaxW = contentW * 0.5
        const maxCount = Math.max(...defectEntries.map(e => e[1]))

        for (const [type, count] of defectEntries) {
          checkPage(7)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(navy[0], navy[1], navy[2])
          doc.text(type, margin, y + 4)

          const barW = (count / maxCount) * barMaxW
          doc.setFillColor(orange[0], orange[1], orange[2])
          doc.roundedRect(margin + 55, y, barW, 5, 1, 1, 'F')

          doc.setTextColor(gray[0], gray[1], gray[2])
          doc.setFontSize(7)
          doc.text(String(count), margin + 55 + barW + 3, y + 4)

          y += 7
        }
        y += 5
      }

      // Breakdown by drop
      const dropEntries = Object.entries(data.summary.byDrop).sort((a, b) => a[0].localeCompare(b[0]))
      if (dropEntries.length > 0 && dropEntries.length <= 26) {
        checkPage(15)
        doc.setTextColor(navy[0], navy[1], navy[2])
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('By Drop', margin, y)
        y += 5

        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        let dropX = margin
        for (const [drop, count] of dropEntries) {
          if (dropX + 18 > pageW - margin) {
            dropX = margin
            y += 10
          }
          doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
          doc.roundedRect(dropX, y, 16, 8, 2, 2, 'F')
          doc.setTextColor(navy[0], navy[1], navy[2])
          doc.text(`${drop}: ${count}`, dropX + 8, y + 5.5, { align: 'center' })
          dropX += 18
        }
        y += 14
      }

      if (reportType === 'summary') {
        // Summary-only report — add the defect table without photos
        checkPage(20)
        doc.setTextColor(navy[0], navy[1], navy[2])
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Repair Schedule', margin, y)
        y += 8

        // Table header
        const cols = [
          { label: '#', w: 18 },
          { label: 'Drop', w: 12 },
          { label: 'Flr', w: 10 },
          { label: 'Defect', w: 30 },
          { label: 'Sub Type', w: 25 },
          { label: 'Location', w: 22 },
          { label: 'Dimensions', w: 30 },
          { label: 'Qty', w: 10 },
          { label: 'Status', w: 23 },
        ]

        doc.setFillColor(navy[0], navy[1], navy[2])
        doc.rect(margin, y, contentW, 7, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')

        let colX = margin + 1
        for (const col of cols) {
          doc.text(col.label, colX, y + 5)
          colX += col.w
        }
        y += 8

        // Rows
        let alt = false
        for (const r of data.repairs) {
          checkPage(7)
          if (alt) {
            doc.setFillColor(248, 249, 252)
            doc.rect(margin, y - 1, contentW, 6, 'F')
          }
          alt = !alt

          doc.setTextColor(navy[0], navy[1], navy[2])
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')

          colX = margin + 1
          const values = [
            r.repairNumber || '-',
            r.drop,
            String(r.floor),
            r.defectType,
            r.subType || '-',
            r.location || '-',
            r.dimensions || '-',
            r.quantity != null ? String(r.quantity) : '-',
            r.status === 'completed' ? '✓ Done' : '● Active',
          ]

          for (let i = 0; i < cols.length; i++) {
            const text = values[i].slice(0, Math.floor(cols[i].w / 1.8))
            doc.text(text, colX, y + 3)
            colX += cols[i].w
          }
          y += 6
        }

      } else {
        // ===== DETAILED REPORT — each repair as a card =====
        doc.addPage()
        y = margin

        doc.setTextColor(navy[0], navy[1], navy[2])
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Repair Details', margin, y)
        y += 10

        for (let ri = 0; ri < data.repairs.length; ri++) {
          const r = data.repairs[ri]
          setProgress(`Rendering repair ${ri + 1} of ${data.repairs.length}...`)

          // Estimate space needed
          const photoCount = r.photos.filter(p => p.dataUri).length
          const neededHeight = 40 + (photoCount > 0 ? 55 : 0) + (r.steps.length * 6)
          checkPage(Math.min(neededHeight, 120))

          // Card background
          const cardStart = y
          doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
          doc.roundedRect(margin, y, contentW, 4, 3, 3, 'F') // top placeholder, we'll extend later

          // Repair number header bar
          const statusColor = r.status === 'completed' ? [34, 197, 94] : orange
          doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
          doc.roundedRect(margin, y, contentW, 9, 3, 3, 'F')
          // Flatten bottom corners
          doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
          doc.rect(margin, y + 5, contentW, 4, 'F')

          doc.setTextColor(255, 255, 255)
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.text(r.repairNumber || `#${r.id}`, margin + 4, y + 6.5)

          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          const statusText = r.status === 'completed' ? 'COMPLETED' : 'IN PROGRESS'
          doc.text(statusText, pageW - margin - 4, y + 6.5, { align: 'right' })
          y += 12

          // Details grid
          const detailPairs = [
            ['Drop', r.drop],
            ['Floor', String(r.floor)],
            ['Defect', r.defectType],
            ['Sub Type', r.subType || '-'],
            ['Location', r.location || '-'],
            ['Dimensions', r.dimensions || '-'],
            ['Quantity', r.quantity != null ? String(r.quantity) : '-'],
            ['Urgency', r.urgency || '-'],
          ]

          if (r.assignedContractor) {
            detailPairs.push(['Contractor', r.assignedContractor])
          }

          doc.setFontSize(7)
          const pairColW = contentW / 4
          let pairX = margin + 3
          let pairCount = 0
          for (const [label, value] of detailPairs) {
            if (pairCount > 0 && pairCount % 4 === 0) {
              pairX = margin + 3
              y += 10
              checkPage(15)
            }

            doc.setFont('helvetica', 'normal')
            doc.setTextColor(gray[0], gray[1], gray[2])
            doc.text(label, pairX, y)

            doc.setFont('helvetica', 'bold')
            doc.setTextColor(navy[0], navy[1], navy[2])
            doc.text(String(value).slice(0, 18), pairX, y + 4)

            pairX += pairColW
            pairCount++
          }
          y += 10

          // Comments
          if (r.initialComments) {
            checkPage(12)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(gray[0], gray[1], gray[2])
            doc.text('Initial Notes:', margin + 3, y)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(navy[0], navy[1], navy[2])
            const lines = doc.splitTextToSize(r.initialComments, contentW - 8)
            doc.text(lines, margin + 3, y + 4)
            y += 4 + lines.length * 3
          }

          if (r.completionComments) {
            checkPage(12)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(gray[0], gray[1], gray[2])
            doc.text('Completion Notes:', margin + 3, y)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(navy[0], navy[1], navy[2])
            const lines = doc.splitTextToSize(r.completionComments, contentW - 8)
            doc.text(lines, margin + 3, y + 4)
            y += 4 + lines.length * 3
          }

          // Steps
          if (r.steps.length > 0) {
            checkPage(10)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(gray[0], gray[1], gray[2])
            doc.text('Repair Steps:', margin + 3, y)
            y += 4

            for (const step of r.steps) {
              checkPage(6)
              doc.setFont('helvetica', 'normal')
              doc.setTextColor(navy[0], navy[1], navy[2])
              doc.setFontSize(7)
              doc.text(`${step.number}. ${step.name || 'Step ' + step.number}${step.comments ? ' — ' + step.comments : ''}`, margin + 6, y)
              y += 4
            }
            y += 2
          }

          // Photos
          const validPhotos = r.photos.filter(p => p.dataUri)
          if (validPhotos.length > 0) {
            checkPage(55)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(gray[0], gray[1], gray[2])
            doc.text('Photos:', margin + 3, y)
            y += 4

            const photoW = validPhotos.length <= 2 ? (contentW - 10) / 2 : (contentW - 14) / 3
            const photoH = photoW * 0.75
            let px = margin + 3
            let photosInRow = 0
            const maxPerRow = validPhotos.length <= 2 ? 2 : 3

            for (const photo of validPhotos) {
              if (photosInRow >= maxPerRow) {
                px = margin + 3
                y += photoH + 8
                photosInRow = 0
                checkPage(photoH + 10)
              }

              try {
                doc.addImage(photo.dataUri!, 'JPEG', px, y, photoW, photoH)
              } catch {
                // If image fails, draw placeholder
                doc.setFillColor(220, 220, 220)
                doc.rect(px, y, photoW, photoH, 'F')
                doc.setFontSize(6)
                doc.setTextColor(150, 150, 150)
                doc.text('Photo unavailable', px + photoW / 2, y + photoH / 2, { align: 'center' })
              }

              // Photo label
              doc.setFontSize(6)
              doc.setTextColor(gray[0], gray[1], gray[2])
              doc.text(photo.label, px + photoW / 2, y + photoH + 3, { align: 'center' })

              px += photoW + 4
              photosInRow++
            }
            y += photoH + 8
          }

          // Date footer
          checkPage(8)
          doc.setFontSize(6)
          doc.setTextColor(gray[0], gray[1], gray[2])
          const startDate = r.startedAt ? new Date(r.startedAt).toLocaleDateString('en-AU') : '-'
          const endDate = r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-AU') : '-'
          doc.text(`Started: ${startDate} | Completed: ${endDate} | By: ${r.completedBy || r.createdBy}`, margin + 3, y)
          y += 4

          // Divider
          doc.setDrawColor(220, 225, 230)
          doc.setLineWidth(0.3)
          doc.line(margin, y, pageW - margin, y)
          y += 8
        }
      }

      // ===== FOOTER on every page =====
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(gray[0], gray[1], gray[2])
        doc.text(
          `${data.building.name} — Defect Repair Report — ${genDate}`,
          margin,
          pageH - 8
        )
        doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' })
      }

      // Save
      const filename = `${data.building.name.replace(/[^a-zA-Z0-9]/g, '_')}_Repair_Report_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(filename)
      setProgress('')

    } catch (err) {
      console.error('Report generation error:', err)
      setProgress(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    setGenerating(false)
  }

  if (!user) return null

  return (
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-navy px-5 py-4 flex items-center gap-3">
          <Link href={`/repairs/${buildingId}`} className="text-white/60 active:scale-95 transition-transform">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div>
            <div className="text-lg font-bold text-white">Generate Report</div>
            <div className="text-xs text-white/50">{buildingName}</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 pb-32">
          <div className="flex flex-col gap-4">
            {/* Report Type */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-xs font-semibold text-navy/60 mb-3">Report Type</div>
              <div className="flex flex-col gap-2">
                {([
                  { key: 'detailed' as ReportType, label: 'Detailed PDF', desc: 'Full report with photos, steps, and dimensions' },
                  { key: 'summary' as ReportType, label: 'Summary PDF', desc: 'Table view — compact, no photos' },
                  { key: 'csv' as ReportType, label: 'CSV Export', desc: 'Spreadsheet data for Excel / Google Sheets' },
                ]).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setReportType(opt.key)}
                    className={`w-full p-3 rounded-xl text-left transition-all duration-150 active:scale-95 min-h-[48px]
                      ${reportType === opt.key
                        ? 'bg-orange/10 border-2 border-orange'
                        : 'bg-gray-50 border-2 border-transparent'}`}
                  >
                    <div className={`text-sm font-semibold ${reportType === opt.key ? 'text-orange' : 'text-navy'}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-navy/40 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-xs font-semibold text-navy/60 mb-3">Filters</div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs text-navy/40 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[48px]"
                  >
                    <option value="all">All Repairs</option>
                    <option value="in_progress">In Progress Only</option>
                    <option value="completed">Completed Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-navy/40 mb-1">Defect Type</label>
                  <select
                    value={defectFilter}
                    onChange={e => setDefectFilter(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[48px]"
                  >
                    <option value="">All Types</option>
                    {['Concrete', 'Caulking', 'Coatings', 'Waterproofing', 'Windows & Doors',
                      'Screens, Fins & Hoods', 'Spitters', 'Cleaning', 'Installation', 'Brick Work', 'Other'
                    ].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-navy/40 mb-1">Drop</label>
                  <input
                    type="text"
                    value={dropFilter}
                    onChange={e => setDropFilter(e.target.value.toUpperCase())}
                    placeholder="All drops (or type A, B, C...)"
                    maxLength={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:border-orange focus:outline-none min-h-[48px]"
                  />
                </div>
              </div>
            </div>

            {/* Options */}
            {reportType === 'detailed' && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-xs font-semibold text-navy/60 mb-3">Options</div>
                <label className="flex items-center gap-3 min-h-[48px] cursor-pointer">
                  <div className={`w-11 h-6 rounded-full transition-all duration-200 relative
                    ${includePhotos ? 'bg-orange' : 'bg-gray-300'}`}
                    onClick={() => setIncludePhotos(!includePhotos)}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-all duration-200
                      ${includePhotos ? 'left-5.5' : 'left-0.5'}`}
                      style={{ left: includePhotos ? '22px' : '2px' }}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-navy">Include Photos</div>
                    <div className="text-xs text-navy/40">Downloads all repair photos into the PDF</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 min-h-[48px] cursor-pointer mt-3">
                  <div className={`w-11 h-6 rounded-full transition-all duration-200 relative
                    ${showStepTitles ? 'bg-orange' : 'bg-gray-300'}`}
                    onClick={() => setShowStepTitles(!showStepTitles)}
                  >
                    <div className="w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-all duration-200"
                      style={{ left: showStepTitles ? '22px' : '2px' }}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-navy">Show Step Titles</div>
                    <div className="text-xs text-navy/40">Shows step labels under photos and the steps section</div>
                  </div>
                </label>
              </div>
            )}

            {/* Info box */}
            {reportType === 'detailed' && includePhotos && (
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                <strong>Note:</strong> Photos are downloaded at full resolution. Generation may take 30-60 seconds depending on the number of repairs.
              </div>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <div className="fixed bottom-0 left-0 right-0">
          <div className="w-full max-w-[480px] mx-auto px-4 py-4 bg-light-gray border-t border-gray-200">
            {progress && (
              <div className="text-center text-xs text-navy/50 mb-2 flex items-center justify-center gap-2">
                {generating && (
                  <div className="w-3 h-3 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                )}
                {progress}
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full bg-orange text-white font-semibold py-4 rounded-xl text-sm
                active:scale-95 transition-all duration-150 disabled:opacity-40 min-h-[48px]
                flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                    <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" />
                  </svg>
                  Generate {reportType === 'csv' ? 'CSV' : 'PDF'} Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
