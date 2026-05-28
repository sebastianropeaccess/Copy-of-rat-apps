'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { jsPDF } from 'jspdf'

interface ReportData {
  service: { name: string; serviceType: string; dropCount: number }
  stats: { total: number; completed: number; remaining: number }
  generatedDate: string
  planImages: { data: string; type: string }[]
  drops: {
    drop: string
    completedBy: string
    completedAt: string
    comments: string
    photos: { data: string; type: string }[]
  }[]
}

export default function ReportPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params)
  const [status, setStatus] = useState<'loading' | 'generating' | 'done' | 'error'>('loading')
  const [progress, setProgress] = useState('')

  useEffect(() => {
    generateReport()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Compress image using canvas
  function compressImage(b64: string, type: string, maxWidth = 1200, quality = 0.5): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width
        let h = img.height
        if (w > maxWidth) {
          h = (maxWidth / w) * h
          w = maxWidth
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        const compressed = canvas.toDataURL('image/jpeg', quality)
        resolve(compressed.split(',')[1])
      }
      img.onerror = () => resolve(b64)
      img.src = `data:image/${type.toLowerCase()};base64,${b64}`
    })
  }

  async function generateReport() {
    try {
      setStatus('loading')
      setProgress('Fetching report data...')

      const resp = await fetch(`/api/drop-tracker/report?serviceId=${serviceId}`)
      if (!resp.ok) throw new Error('Failed to fetch report data')
      const data: ReportData = await resp.json()

      setStatus('generating')
      setProgress('Building PDF...')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 15
      const contentWidth = pageWidth - margin * 2
      let y = margin

      // Helper to check page break
      function checkPage(needed: number) {
        if (y + needed > pageHeight - 20) {
          doc.addPage()
          y = margin
        }
      }

      // Header
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text(data.service.name, margin, y + 7)
      y += 10
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100)
      doc.text(data.service.serviceType || 'Drop Tracker Report', margin, y + 4)
      y += 6
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Generated ${data.generatedDate} · Rope Access Technicians Pty Ltd · 1300 297 673`, margin, y + 3)
      y += 6

      // Orange line
      doc.setDrawColor(249, 115, 22)
      doc.setLineWidth(1)
      doc.line(margin, y, pageWidth - margin, y)
      y += 8

      // Stats
      doc.setTextColor(0)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      const statWidth = contentWidth / 4
      const stats = [
        { label: 'Total Drops', value: String(data.stats.total) },
        { label: 'Completed', value: String(data.stats.completed) },
        { label: 'Remaining', value: String(data.stats.remaining) },
        { label: 'Progress', value: data.stats.total > 0 ? `${Math.round((data.stats.completed / data.stats.total) * 100)}%` : '0%' },
      ]
      stats.forEach((stat, i) => {
        const x = margin + i * statWidth
        doc.setFillColor(248, 248, 245)
        doc.roundedRect(x, y, statWidth - 3, 18, 2, 2, 'F')
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 31, 54)
        doc.text(stat.value, x + (statWidth - 3) / 2, y + 9, { align: 'center' })
        doc.setFontSize(6)
        doc.setTextColor(150)
        doc.setFont('helvetica', 'normal')
        doc.text(stat.label.toUpperCase(), x + (statWidth - 3) / 2, y + 14, { align: 'center' })
      })
      y += 24

      // Drop Plans
      if (data.planImages.length > 0) {
        checkPage(60)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 31, 54)
        doc.text('DROP PLANS', margin, y + 4)
        y += 8
        doc.setDrawColor(230)
        doc.line(margin, y, pageWidth - margin, y)
        y += 5

        const planWidth = (contentWidth - 4) / 2
        let planX = margin
        for (let pi = 0; pi < data.planImages.length; pi++) {
          const img = data.planImages[pi]
          try {
            const compressed = await compressImage(img.data, img.type, 900, 0.5)
            const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
              const i = new Image()
              i.onload = () => resolve(i)
              i.onerror = reject
              i.src = `data:image/jpeg;base64,${compressed}`
            })
            const aspectRatio = imgEl.width / imgEl.height
            const imgHeight = planWidth / aspectRatio
            checkPage(imgHeight + 10)
            doc.addImage(`data:image/jpeg;base64,${compressed}`, 'JPEG', planX, y, planWidth, imgHeight, undefined, 'FAST')
            if (pi % 2 === 0) {
              planX = margin + planWidth + 4
            } else {
              planX = margin
              y += imgHeight + 4
            }
          } catch { /* skip broken image */ }
          setProgress(`Adding drop plans...`)
        }
        // If odd number of plans, move y down
        if (data.planImages.length % 2 === 1) {
          const lastImg = data.planImages[data.planImages.length - 1]
          try {
            const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
              const i = new Image()
              i.onload = () => resolve(i)
              i.onerror = reject
              i.src = `data:image/${lastImg.type.toLowerCase()};base64,${lastImg.data}`
            })
            y += planWidth / (imgEl.width / imgEl.height) + 4
          } catch { y += 60 }
        }
      }

      // Completed Drops
      if (data.drops.length > 0) {
        checkPage(20)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 31, 54)
        doc.text(`COMPLETED DROPS (${data.drops.length})`, margin, y + 4)
        y += 8
        doc.setDrawColor(230)
        doc.line(margin, y, pageWidth - margin, y)
        y += 5

        for (let di = 0; di < data.drops.length; di++) {
          const drop = data.drops[di]
          setProgress(`Processing drop ${di + 1}/${data.drops.length}...`)

          checkPage(50)

          // Drop header
          doc.setFillColor(240, 253, 244)
          doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'F')
          doc.setFontSize(12)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(26, 31, 54)
          doc.text(`Drop ${drop.drop}`, margin + 4, y + 6)

          // Complete badge
          doc.setFillColor(34, 197, 94)
          doc.roundedRect(margin + 30, y + 1.5, 18, 5, 1, 1, 'F')
          doc.setFontSize(5)
          doc.setTextColor(255)
          doc.setFont('helvetica', 'bold')
          doc.text('COMPLETE', margin + 39, y + 5, { align: 'center' })

          // Who and when
          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(80)
          doc.text(drop.completedBy, pageWidth - margin - 4, y + 5, { align: 'right' })
          doc.text(drop.completedAt, pageWidth - margin - 4, y + 10, { align: 'right' })
          y += 17

          // Photos
          if (drop.photos.length > 0) {
            const photoSize = contentWidth / 3 - 3
            let px = margin
            for (let pi = 0; pi < drop.photos.length; pi++) {
              if (px + photoSize > pageWidth - margin) {
                px = margin
                y += photoSize + 3
                checkPage(photoSize + 10)
              }
              try {
                const photo = drop.photos[pi]
                const compPhoto = await compressImage(photo.data, photo.type, 800, 0.45)
                doc.addImage(`data:image/jpeg;base64,${compPhoto}`, 'JPEG', px, y, photoSize, photoSize, undefined, 'FAST')
                px += photoSize + 3
              } catch { /* skip */ }
            }
            y += photoSize + 5
          }

          // Comments
          if (drop.comments) {
            checkPage(15)
            doc.setFillColor(248, 248, 245)
            doc.roundedRect(margin, y, contentWidth, 10, 1, 1, 'F')
            doc.setFontSize(8)
            doc.setTextColor(80)
            doc.setFont('helvetica', 'normal')
            const lines = doc.splitTextToSize(drop.comments, contentWidth - 8)
            doc.text(lines, margin + 4, y + 4)
            y += Math.max(10, lines.length * 4 + 4)
          }

          y += 5
        }
      }

      // Footer
      checkPage(15)
      doc.setDrawColor(230)
      doc.line(margin, y, pageWidth - margin, y)
      y += 5
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.setFont('helvetica', 'normal')
      doc.text('Rope Access Technicians Pty Ltd · ABN: 85 604 378 850 · QBCC: 15006167 · 1300 297 673 · info@ropeaccess.com.au', pageWidth / 2, y + 3, { align: 'center' })

      // Save
      const fileName = `${data.service.name} - Drop Report.pdf`
      doc.save(fileName)
      setStatus('done')
      setProgress(fileName)
    } catch (err) {
      console.error('Report generation failed:', err)
      setStatus('error')
      setProgress(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0] flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-3 border-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div className="text-sm text-navy font-medium">{progress}</div>
          </>
        )}
        {status === 'generating' && (
          <>
            <div className="w-10 h-10 border-3 border-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div className="text-sm text-navy font-medium">{progress}</div>
          </>
        )}
        {status === 'done' && (
          <>
            <div className="text-4xl mb-3">✅</div>
            <div className="text-sm font-semibold text-navy mb-1">PDF Downloaded</div>
            <div className="text-xs text-gray-500 mb-4">{progress}</div>
            <div className="flex gap-2">
              <button onClick={generateReport} className="flex-1 bg-orange text-white font-semibold py-3 rounded-xl text-sm active:scale-95 transition-all">
                Download Again
              </button>
              <Link href={`/drop-tracker/${serviceId}`} className="flex-1 bg-gray-100 text-navy font-semibold py-3 rounded-xl text-sm text-center active:scale-95 transition-all">
                Back
              </Link>
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl mb-3">❌</div>
            <div className="text-sm font-semibold text-red-500 mb-1">Report Failed</div>
            <div className="text-xs text-gray-500 mb-4">{progress}</div>
            <div className="flex gap-2">
              <button onClick={generateReport} className="flex-1 bg-orange text-white font-semibold py-3 rounded-xl text-sm active:scale-95 transition-all">
                Retry
              </button>
              <Link href={`/drop-tracker/${serviceId}`} className="flex-1 bg-gray-100 text-navy font-semibold py-3 rounded-xl text-sm text-center active:scale-95 transition-all">
                Back
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
