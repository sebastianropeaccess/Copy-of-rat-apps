import { NextRequest, NextResponse } from 'next/server'

const SIMPRO_URL = 'https://ropeaccess.simprosuite.com/api/v1.0/companies/0'
const SIMPRO_KEY = process.env.SIMPRO_API_KEY || ''

async function simproFetch(path: string, params?: Record<string, string>) {
  const url = new URL(`${SIMPRO_URL}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${SIMPRO_KEY}` },
    next: { revalidate: 300 }, // cache 5 min
  })
  if (!res.ok) {
    throw new Error(`Simpro ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function parseJobDescription(desc: string): { location: string; client: string; services: string; date: string } {
  const clean = stripHtml(desc)
  // Format: "GC - Building Name - Client - Services - [date,status,type]"
  const parts = clean.split(' - ')
  const location = parts[0] || ''
  const client = parts.length > 2 ? parts[1] : ''
  const services = parts.length > 3 ? parts.slice(2, -1).join(' - ') : parts.length > 1 ? parts[1] : ''
  
  // Extract bracket info
  const bracketMatch = clean.match(/\[([^\]]+)\]/)
  const date = bracketMatch ? bracketMatch[1] : ''
  
  // Clean services of bracket info
  const cleanServices = services.replace(/\s*\[[^\]]*\]\s*/g, '').trim()
  
  return { location, client, services: cleanServices, date }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'dashboard': {
        // Fetch all data in parallel
        const [jobs, schedules, employees, quotes] = await Promise.all([
          simproFetch('/jobs/', { pageSize: '100' }),
          simproFetch('/schedules/', { pageSize: '500' }),
          simproFetch('/employees/', { pageSize: '50' }),
          simproFetch('/quotes/', { pageSize: '50' }),
        ])

        // Process jobs
        const processedJobs = (jobs as Array<{ ID: number; Description: string; Total: { ExTax: number; IncTax: number; Tax: number } }>)
          .filter((j) => j.Description && j.Total.ExTax > 0)
          .map((j) => {
            const parsed = parseJobDescription(j.Description)
            return {
              id: j.ID,
              description: stripHtml(j.Description).slice(0, 120),
              location: parsed.location,
              client: parsed.client,
              services: parsed.services,
              dateInfo: parsed.date,
              totalExTax: j.Total.ExTax,
              totalIncTax: j.Total.IncTax,
            }
          })
          .sort((a, b) => b.id - a.id)

        // Process schedules — group by date
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const schedulesByDate: Record<string, Array<{
          staff: string
          staffId: number
          hours: number
          startTime: string
          endTime: string
          jobRef: string
        }>> = {}
        
        for (const s of schedules as Array<{
          Date: string
          Staff: { Name: string; ID: number }
          TotalHours: number
          Reference: string
          Blocks: Array<{ StartTime: string; EndTime: string }>
        }>) {
          const date = s.Date
          if (!schedulesByDate[date]) schedulesByDate[date] = []
          schedulesByDate[date].push({
            staff: s.Staff.Name,
            staffId: s.Staff.ID,
            hours: s.TotalHours,
            startTime: s.Blocks?.[0]?.StartTime || '',
            endTime: s.Blocks?.[0]?.EndTime || '',
            jobRef: s.Reference,
          })
        }

        // This week's schedule (Mon to Sun)
        const startOfWeek = new Date(today)
        const dayOfWeek = startOfWeek.getDay()
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Monday = 0
        startOfWeek.setDate(startOfWeek.getDate() - diff)
        
        const weekSchedule: Array<{
          date: string
          dayName: string
          isToday: boolean
          entries: typeof schedulesByDate[string]
        }> = []
        
        for (let i = 0; i < 7; i++) {
          const d = new Date(startOfWeek)
          d.setDate(d.getDate() + i)
          const dateStr = d.toISOString().split('T')[0]
          const isToday = dateStr === today.toISOString().split('T')[0]
          weekSchedule.push({
            date: dateStr,
            dayName: d.toLocaleDateString('en-AU', { weekday: 'short' }),
            isToday,
            entries: schedulesByDate[dateStr] || [],
          })
        }

        // Next week too
        const nextWeekSchedule: typeof weekSchedule = []
        for (let i = 7; i < 14; i++) {
          const d = new Date(startOfWeek)
          d.setDate(d.getDate() + i)
          const dateStr = d.toISOString().split('T')[0]
          nextWeekSchedule.push({
            date: dateStr,
            dayName: d.toLocaleDateString('en-AU', { weekday: 'short' }),
            isToday: false,
            entries: schedulesByDate[dateStr] || [],
          })
        }

        // Team stats
        const totalPipelineExTax = processedJobs.reduce((sum, j) => sum + j.totalExTax, 0)
        const totalQuotesExTax = (quotes as Array<{ Total: { ExTax: number } }>)
          .reduce((sum, q) => sum + q.Total.ExTax, 0)
        
        // Hours this week
        const weekHours = weekSchedule.reduce(
          (sum, day) => sum + day.entries.reduce((s, e) => s + e.hours, 0), 0
        )
        
        // Unique techs scheduled this week
        const weekTechs = new Set(
          weekSchedule.flatMap((day) => day.entries.map((e) => e.staffId))
        )

        // Employee count
        const employeeCount = (employees as Array<{ ID: number }>).length

        return NextResponse.json({
          stats: {
            totalJobs: processedJobs.length,
            totalPipelineExTax,
            totalPipelineIncTax: processedJobs.reduce((sum, j) => sum + j.totalIncTax, 0),
            totalQuotesExTax,
            employeeCount,
            weekHours,
            weekTechCount: weekTechs.size,
          },
          jobs: processedJobs,
          weekSchedule,
          nextWeekSchedule,
          employees: (employees as Array<{ ID: number; Name: string }>).map((e) => ({
            id: e.ID,
            name: e.Name,
          })),
        })
      }
      case 'jobs': {
        // Fetch jobs with full details + schedules + sites
        const [rawJobs, schedules, sites, customers] = await Promise.all([
          simproFetch('/jobs/', { pageSize: '100' }),
          simproFetch('/schedules/', { Type: 'job', pageSize: '500' }),
          simproFetch('/sites/', { pageSize: '100' }),
          simproFetch('/customers/', { pageSize: '200' }),
        ])

        const jobs = rawJobs as Array<{
          ID: number
          Description: string
          Total: { ExTax: number; IncTax: number; Tax: number }
        }>

        type ScheduleEntry = {
          Date: string
          Staff: { Name: string; ID: number }
          TotalHours: number
          Reference: string
          Blocks: Array<{ StartTime: string; EndTime: string }>
          Project: { ProjectID: number; SectionID: number; CostCenterID: number }
        }

        // Group schedules by project ID
        const schedulesByJob: Record<number, ScheduleEntry[]> = {}
        for (const s of schedules as ScheduleEntry[]) {
          const jobId = s.Project?.ProjectID
          if (jobId) {
            if (!schedulesByJob[jobId]) schedulesByJob[jobId] = []
            schedulesByJob[jobId].push(s)
          }
        }

        // Build site lookup
        const siteMap = new Map<number, string>()
        for (const s of sites as Array<{ ID: number; Name: string }>) {
          siteMap.set(s.ID, s.Name)
        }

        // Build customer lookup
        const customerMap = new Map<number, string>()
        for (const c of customers as Array<{ ID: number; CompanyName: string }>) {
          customerMap.set(c.ID, stripHtml(c.CompanyName))
        }

        // Fetch full details for active jobs (those with value > 0)
        const activeJobs = jobs.filter(j => j.Total.ExTax > 0 || j.Description)
        
        // Fetch details in batches of 10
        const jobDetails: Array<Record<string, unknown>> = []
        const batchSize = 10
        for (let i = 0; i < activeJobs.length; i += batchSize) {
          const batch = activeJobs.slice(i, i + batchSize)
          const details = await Promise.all(
            batch.map(j => simproFetch(`/jobs/${j.ID}`).catch(() => null))
          )
          jobDetails.push(...details.filter(Boolean) as Array<Record<string, unknown>>)
        }

        // Build enriched job list
        const enrichedJobs = jobDetails.map((j: Record<string, unknown>) => {
          const id = j.ID as number
          const desc = stripHtml((j.Description as string) || '')
          const customer = j.Customer as { ID: number; CompanyName: string } | null
          const site = j.Site as { ID: number; Name: string } | null
          const status = j.Status as { ID: number; Name: string; Color: string } | null
          const totals = j.Totals as Record<string, Record<string, number>> | null
          const total = j.Total as { ExTax: number; IncTax: number; Tax: number }
          
          // Schedule info for this job
          const jobSchedules = schedulesByJob[id] || []
          const crew = [...new Set(jobSchedules.map(s => s.Staff.Name))].sort()
          const totalHours = jobSchedules.reduce((sum, s) => sum + s.TotalHours, 0)
          const scheduleDates = [...new Set(jobSchedules.map(s => s.Date))].sort()
          
          // Get upcoming schedule entries (today or later)
          const today = new Date().toISOString().split('T')[0]
          const upcomingSchedules = jobSchedules
            .filter(s => s.Date >= today)
            .sort((a, b) => a.Date.localeCompare(b.Date))
          
          // Parse description for service codes
          const parsed = parseJobDescription((j.Description as string) || '')

          return {
            id,
            description: desc,
            parsedDescription: parsed,
            customer: customer ? stripHtml(customer.CompanyName) : null,
            customerId: customer?.ID || null,
            site: site?.Name || null,
            siteId: site?.ID || null,
            stage: (j.Stage as string) || null,
            status: status ? { name: status.Name.replace('Job : ', ''), color: status.Color } : null,
            dateIssued: (j.DateIssued as string) || null,
            dueDate: (j.DueDate as string) || null,
            completedDate: (j.CompletedDate as string) || null,
            total: {
              exTax: total.ExTax,
              incTax: total.IncTax,
              tax: total.Tax,
            },
            financials: {
              invoicedValue: totals?.InvoicedValue as unknown as number || 0,
              invoicePercentage: totals?.InvoicePercentage as unknown as number || 0,
              laborHoursActual: ((totals?.ResourcesCost as unknown) as Record<string, Record<string, number>>)?.LaborHours?.Actual || 0,
              materialsCostEstimate: totals?.MaterialsCost?.Estimate || 0,
              grossMarginActual: totals?.GrossMargin?.Actual || 0,
            },
            crew,
            totalScheduledHours: totalHours,
            scheduleDateRange: scheduleDates.length > 0 ? {
              start: scheduleDates[0],
              end: scheduleDates[scheduleDates.length - 1],
              totalDays: scheduleDates.length,
            } : null,
            upcomingSchedule: upcomingSchedules.slice(0, 10).map(s => ({
              date: s.Date,
              staff: s.Staff.Name,
              hours: s.TotalHours,
              startTime: s.Blocks?.[0]?.StartTime || '',
              endTime: s.Blocks?.[0]?.EndTime || '',
            })),
          }
        }).sort((a, b) => b.id - a.id)

        return NextResponse.json({
          jobs: enrichedJobs,
          summary: {
            total: enrichedJobs.length,
            inProgress: enrichedJobs.filter(j => j.stage === 'Progress').length,
            totalValueExTax: enrichedJobs.reduce((sum, j) => sum + j.total.exTax, 0),
            totalInvoiced: enrichedJobs.reduce((sum, j) => sum + j.financials.invoicedValue, 0),
          },
        })
      }

      case 'timesheet-jobs': {
        // Lightweight job list for timesheet job picker
        const rawJobs = await simproFetch('/jobs/', { pageSize: '200' })
        const jobs = (rawJobs as Array<{
          ID: number
          Description: string
          Total: { ExTax: number; IncTax: number; Tax: number }
          Site?: { ID: number; Name: string }
          Customer?: { ID: number; CompanyName: string }
        }>)
          .filter((j) => j.Description)
          .map((j) => ({
            id: j.ID,
            description: stripHtml(j.Description).slice(0, 120),
            value: j.Total.ExTax,
          }))
          .sort((a, b) => b.id - a.id)

        return NextResponse.json({ jobs })
      }

      case 'schedule-for-job': {
        // Get staff scheduled for a specific job on a specific date
        const jobId = searchParams.get('jobId')
        const dateParam = searchParams.get('date')
        if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

        const schedules = await simproFetch('/schedules/', { Type: 'job', pageSize: '500' })
        type SchedEntry = {
          Date: string
          Staff: { Name: string; ID: number }
          TotalHours: number
          Blocks: Array<{ StartTime: string; EndTime: string }>
          Project: { ProjectID: number }
        }

        const matching = (schedules as SchedEntry[]).filter((s) => {
          const matchesJob = s.Project?.ProjectID === Number(jobId)
          const matchesDate = dateParam ? s.Date === dateParam : true
          return matchesJob && matchesDate
        })

        const staff = matching.map((s) => ({
          name: s.Staff.Name,
          staffId: s.Staff.ID,
          hours: s.TotalHours,
          date: s.Date,
          startTime: s.Blocks?.[0]?.StartTime || '',
          endTime: s.Blocks?.[0]?.EndTime || '',
        }))

        return NextResponse.json({ staff })
      }

      case 'job-detail': {
        const jobId = searchParams.get('jobId')
        if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })
        
        const [job, sections] = await Promise.all([
          simproFetch(`/jobs/${jobId}`),
          simproFetch(`/jobs/${jobId}/sections/`).catch(() => []),
        ])

        return NextResponse.json({ job, sections })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    console.error('Simpro API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
